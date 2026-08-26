import { eq } from "drizzle-orm";
import { z } from "zod";
import { aiProviderSettings } from "../../drizzle/schema";
import { decryptProviderKey, encryptProviderKey, getKeyHint } from "../aiProviderCrypto";
import { listProviderModels, verifyProviderConnection } from "../aiProviderVerifier";
import { getAiModelUsageSummary, getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { listTradingViewTools } from "../mcpClient";
import { aiProviderDefinitions, aiProviderIds } from "../../shared/aiProviders";
import { validateCustomBaseUrl } from "../aiProviderBaseUrl";

const providerSchema = z.enum(aiProviderIds);

function requireDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export const adminAiRouter = router({
  list: adminProcedure.query(async () => {
    const db = requireDatabase(await getDb());
    const settings = await db.select().from(aiProviderSettings);
    const byProvider = new Map(settings.map(setting => [setting.provider, setting]));
    return aiProviderIds.map(provider => {
      const setting = byProvider.get(provider);
      return {
        provider,
        model: setting?.model ?? aiProviderDefinitions[provider].defaultModel,
        customBaseUrl: setting?.customBaseUrl ?? null,
        maxOutputTokens: setting?.maxOutputTokens ?? 900,
        configured: Boolean(setting?.encryptedApiKey),
        keyHint: setting?.keyHint ?? null,
        enabled: setting?.enabled === 1,
        isActive: setting?.isActive === 1,
        updatedAt: setting?.updatedAt ?? null,
      };
    });
  }),

  marketProviderStatus: adminProcedure.query(async () => {
    const checkedAt = new Date();
    try {
      const tools = await listTradingViewTools();
      return { status: "healthy" as const, toolCount: tools.length, checkedAt };
    } catch {
      return { status: "unavailable" as const, toolCount: null, checkedAt };
    }
  }),

  usage: adminProcedure
    .input(z.object({ periodDays: z.union([z.literal(7), z.literal(30)]).default(7) }))
    .query(({ input }) => getAiModelUsageSummary(input.periodDays)),

  testConnection: adminProcedure
    .input(z.object({ provider: providerSchema, model: z.string().trim().min(2).max(128), apiKey: z.string().trim().min(8).max(1_000), customBaseUrl: z.string().trim().max(512).optional() }))
    .mutation(async ({ input }) => verifyProviderConnection({ ...input, customBaseUrl: await validateCustomBaseUrl(input.provider, input.customBaseUrl) })),

  listModels: adminProcedure
    .input(z.object({ provider: providerSchema, apiKey: z.string().trim().min(8).max(1_000).optional(), customBaseUrl: z.string().trim().max(512).optional() }))
    .mutation(async ({ input }) => {
      const db = requireDatabase(await getDb());
      const [existing] = input.apiKey
        ? []
        : await db.select().from(aiProviderSettings).where(eq(aiProviderSettings.provider, input.provider)).limit(1);
      const apiKey = input.apiKey ?? (existing?.encryptedApiKey ? decryptProviderKey(existing.encryptedApiKey) : null);
      if (!apiKey) throw new Error("أدخل مفتاح API لجلب النماذج، أو احفظ مفتاحًا مشفرًا لهذا المزود أولًا.");
      const customBaseUrl = await validateCustomBaseUrl(input.provider, input.customBaseUrl ?? existing?.customBaseUrl);
      return listProviderModels({ provider: input.provider, apiKey, customBaseUrl });
    }),

  save: adminProcedure
    .input(
      z.object({
        provider: providerSchema,
        model: z.string().trim().min(2).max(128),
        maxOutputTokens: z.number().int().min(128).max(8_000).default(900),
        apiKey: z.string().trim().min(8).max(1_000).optional(),
        customBaseUrl: z.string().trim().max(512).optional(),
        enabled: z.boolean(),
        makeActive: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = requireDatabase(await getDb());
      const [existing] = await db.select().from(aiProviderSettings).where(eq(aiProviderSettings.provider, input.provider)).limit(1);
      const encryptedApiKey = input.apiKey ? encryptProviderKey(input.apiKey) : existing?.encryptedApiKey ?? null;
      const keyHint = input.apiKey ? getKeyHint(input.apiKey) : existing?.keyHint ?? null;
      const customBaseUrl = await validateCustomBaseUrl(input.provider, input.customBaseUrl ?? existing?.customBaseUrl);
      if (input.enabled && !encryptedApiKey) throw new Error("أضف مفتاح API قبل تفعيل هذا المزود.");
      if (input.makeActive && !input.enabled) throw new Error("يجب تفعيل المزود قبل اختياره كمزود نشط.");

      const keyToVerify = input.apiKey ?? (existing?.encryptedApiKey ? decryptProviderKey(existing.encryptedApiKey) : null);
      if (keyToVerify && (Boolean(input.apiKey) || input.enabled || input.makeActive)) {
        const verification = await verifyProviderConnection({ provider: input.provider, apiKey: keyToVerify, model: input.model, customBaseUrl });
        if (!verification.valid) throw new Error(verification.message);
      }

      const isActive = input.makeActive ? 1 : input.enabled ? (existing?.isActive ?? 0) : 0;

      await db.transaction(async transaction => {
        if (input.makeActive) {
          await transaction.update(aiProviderSettings).set({ isActive: 0 }).where(eq(aiProviderSettings.isActive, 1));
        }
        await transaction
          .insert(aiProviderSettings)
          .values({
            provider: input.provider,
            encryptedApiKey,
            keyHint,
            model: input.model,
            customBaseUrl,
            maxOutputTokens: input.maxOutputTokens,
            enabled: input.enabled ? 1 : 0,
            isActive,
            updatedByUserId: ctx.user.id,
          })
          .onDuplicateKeyUpdate({
            set: {
              encryptedApiKey,
              keyHint,
              model: input.model,
              customBaseUrl,
              maxOutputTokens: input.maxOutputTokens,
              enabled: input.enabled ? 1 : 0,
              isActive,
              updatedByUserId: ctx.user.id,
              updatedAt: new Date(),
            },
          });
      });
      return { success: true } as const;
    }),

  removeKey: adminProcedure.input(z.object({ provider: providerSchema })).mutation(async ({ input, ctx }) => {
    const db = requireDatabase(await getDb());
    await db
      .update(aiProviderSettings)
      .set({ encryptedApiKey: null, keyHint: null, enabled: 0, isActive: 0, updatedByUserId: ctx.user.id, updatedAt: new Date() })
      .where(eq(aiProviderSettings.provider, input.provider));
    return { success: true } as const;
  }),
});
