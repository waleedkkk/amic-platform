import { z } from "zod";
import { invokeLLM } from "./_core/llm";

const critiqueSchema = z.object({
  planAdherence: z.array(z.string().min(1).max(220)).max(3),
  timing: z.array(z.string().min(1).max(220)).max(3),
  didWell: z.array(z.string().min(1).max(220)).max(3),
  improve: z.array(z.string().min(1).max(220)).max(3),
  nextSteps: z.array(z.string().min(1).max(220)).min(1).max(3),
  disclaimer: z.literal("تعليمي فقط؛ لا يمثل توصية تداول."),
});

export type PaperTradeCritique = z.infer<typeof critiqueSchema>;

type CritiqueInput = {
  trade: { symbol: string; exchange: string; side: string; quantity: string; entryPrice: string; exitPrice: string | null; stopLoss: string | null; takeProfit: string | null; realizedPnl: string | null; openedAt: Date; closedAt: Date | null };
  signal: { timeframe: string; recommendation: string; confidence: number; summary: string } | null;
};

export function buildPaperTradeCritiquePrompt(input: CritiqueInput) {
  return `حلّل صفقة ورقية مغلقة تحليلًا تعليميًا موجزًا ومبنيًا على البيانات فقط. ركز على الالتزام بالخطة القابلة للقياس (وجود وقف/هدف واتجاههما وسعر الدخول والخروج)، توقيت الدخول والخروج مقارنةً ببيانات الإشارة المتاحة، وما يصلح تكراره أو تحسينه. لا تستنتج المشاعر أو الدوافع أو السمات الشخصية، ولا تصف المستخدم أو تحكم عليه. لا تقدم توقعًا سعريًا ولا توصية بفتح أو إغلاق صفقة.

بيانات الصفقة: ${JSON.stringify(input.trade)}
الإشارة الأصلية المتاحة: ${JSON.stringify(input.signal)}

أعد العربية فقط وضمن البنية المطلوبة. عند غياب معلومة، اذكر بوضوح أن التقييم غير ممكن من البيانات المتاحة بدل التخمين.`;
}

export async function generatePaperTradeCritique(input: CritiqueInput) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxCompletionTokens: 900,
    messages: [{ role: "system", content: "أنت مراجع صفقات ورقية تعليمي ودقيق. لا تقدم نصيحة استثمارية شخصية." }, { role: "user", content: buildPaperTradeCritiquePrompt(input) }],
    outputSchema: {
      name: "paper_trade_critique",
      strict: true,
      schema: {
        type: "object",
        properties: { planAdherence: { type: "array", items: { type: "string" } }, timing: { type: "array", items: { type: "string" } }, didWell: { type: "array", items: { type: "string" } }, improve: { type: "array", items: { type: "string" } }, nextSteps: { type: "array", items: { type: "string" } }, disclaimer: { type: "string", enum: ["تعليمي فقط؛ لا يمثل توصية تداول."] } },
        required: ["planAdherence", "timing", "didWell", "improve", "nextSteps", "disclaimer"],
        additionalProperties: false,
      },
    },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("لم يُعد النموذج نقدًا نصيًا صالحًا.");
  return critiqueSchema.parse(JSON.parse(content));
}
