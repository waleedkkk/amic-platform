import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

const message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4_000) });

export const aiRouter = router({
  explain: protectedProcedure
    .input(
      z.object({
        messages: z.array(message).min(1).max(12),
        marketContext: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 900,
        messages: [
          {
            role: "system",
            content:
              "أنت مساعد AMIC للتحليل الفني. اشرح المؤشرات والسيناريوهات بلغة عربية دقيقة ومباشرة. لا تقدّم توصية استثمارية شخصية، ولا تَعِد بعائد، واذكر بوضوح أن المحتوى تعليمي ومعلوماتي فقط. اعتمد على سياق السوق المرفق ولا تخترع أسعارًا أو بيانات.",
          },
          ...(input.marketContext
            ? [{ role: "system" as const, content: `سياق السوق الحالي:\n${JSON.stringify(input.marketContext).slice(0, 10_000)}` }]
            : []),
          ...input.messages,
        ],
      });
      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "تعذر إنشاء تفسير في هذه اللحظة.";
      return { content };
    }),
});
