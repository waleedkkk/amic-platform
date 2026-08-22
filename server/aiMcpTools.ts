import { z } from "zod";
import type { Tool } from "./_core/llm";
import type { TradingViewToolName } from "./mcpClient";

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1D", "1W", "1M"] as const;
const MARKET_SYMBOL_PATTERN = /^[A-Z0-9._=-]{1,32}$/;
const EXCHANGE_PATTERN = /^[A-Z0-9._-]{1,32}$/;

const marketSymbol = z.string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.string().regex(MARKET_SYMBOL_PATTERN, "رمز السوق غير صالح."));

const exchange = z.string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.string().regex(EXCHANGE_PATTERN, "البورصة غير صالحة."));

const timeframe = z.enum(TIMEFRAMES);
const category = z.enum(["crypto", "stocks", "all"]);
const limit = z.number().int().min(1).max(50);

const toolSchemas = {
  coin_analysis: z.object({
    symbol: marketSymbol,
    exchange: exchange.default("KUCOIN"),
    timeframe: timeframe.default("15m"),
  }),
  top_gainers: z.object({
    exchange: exchange.default("KUCOIN"),
    timeframe: timeframe.default("15m"),
    limit: limit.default(25),
  }),
  top_losers: z.object({
    exchange: exchange.default("KUCOIN"),
    timeframe: timeframe.default("15m"),
    limit: limit.default(25),
  }),
  market_sentiment: z.object({
    symbol: marketSymbol,
    category: category.default("all"),
    limit: limit.default(20),
  }),
  financial_news: z.object({
    symbol: marketSymbol.optional(),
    category: category.default("stocks"),
    limit: limit.default(10),
  }),
  multi_timeframe_analysis: z.object({
    symbol: marketSymbol,
    exchange: exchange.default("KUCOIN"),
  }),
} as const;

export const assistantMcpToolNames = [
  "coin_analysis",
  "top_gainers",
  "top_losers",
  "market_sentiment",
  "financial_news",
  "multi_timeframe_analysis",
] as const satisfies readonly TradingViewToolName[];

export type AssistantMcpToolName = (typeof assistantMcpToolNames)[number];

const marketSymbolParameters = {
  type: "string",
  pattern: "^[A-Z0-9._=-]{1,32}$",
  description: "رمز السوق فقط، مثل BTCUSDT أو XAUUSD، دون مسافات أو روابط.",
} as const;

const exchangeParameters = {
  type: "string",
  pattern: "^[A-Z0-9._-]{1,32}$",
  default: "KUCOIN",
  description: "اسم البورصة بحروف كبيرة؛ القيمة الافتراضية KUCOIN.",
} as const;

const timeframeParameters = {
  type: "string",
  enum: TIMEFRAMES,
  default: "15m",
  description: "الإطار الزمني. الافتراضي 15m.",
} as const;

const limitParameters = {
  type: "integer",
  minimum: 1,
  maximum: 50,
  default: 25,
} as const;

/**
 * مجموعة الأدوات الصغيرة المسموح بها للمساعد. الأدوات قراءة فقط، ويُعاد التحقق
 * من كل وسيط عبر Zod قبل وصوله إلى TradingView MCP.
 */
export const assistantMcpTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "coin_analysis",
      description: "يجلب تحليلًا فنيًا لرمز واحد على بورصة وإطار زمني محددين. استخدمه فقط عند الحاجة إلى بيانات حديثة.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: marketSymbolParameters, exchange: exchangeParameters, timeframe: timeframeParameters },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_gainers",
      description: "يجلب قائمة الرابحين في سوق/بورصة ضمن إطار زمني. الافتراضي KUCOIN و15m و25 نتيجة.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { exchange: exchangeParameters, timeframe: timeframeParameters, limit: limitParameters },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_losers",
      description: "يجلب قائمة الخاسرين في سوق/بورصة ضمن إطار زمني. الافتراضي KUCOIN و15m و25 نتيجة.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { exchange: exchangeParameters, timeframe: timeframeParameters, limit: limitParameters },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "market_sentiment",
      description: "يجلب مؤشرات المزاج السوقي لرمز محدد. لا تستخدمه لتحويل المزاج إلى توصية استثمارية شخصية.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: marketSymbolParameters,
          category: { type: "string", enum: ["crypto", "stocks", "all"], default: "all" },
          limit: { ...limitParameters, default: 20 },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "financial_news",
      description: "يجلب أخبارًا مالية حديثة لفئة أو رمز اختياري. لخّص الوقائع ولا تجعل الخبر توصية تداول.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: marketSymbolParameters,
          category: { type: "string", enum: ["crypto", "stocks", "all"], default: "stocks" },
          limit: { ...limitParameters, default: 10 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multi_timeframe_analysis",
      description: "يجلب قراءة فنية متعددة الأطر لرمز واحد. استخدمه عند طلب توافق الأطر الزمنية أو اختلافها.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { symbol: marketSymbolParameters, exchange: exchangeParameters },
        required: ["symbol"],
      },
    },
  },
];

export function isAssistantMcpToolName(name: string): name is AssistantMcpToolName {
  return (assistantMcpToolNames as readonly string[]).includes(name);
}

export function validateAssistantMcpArgs(name: AssistantMcpToolName, args: unknown) {
  return toolSchemas[name].safeParse(args);
}

export function parseAssistantMcpArguments(name: AssistantMcpToolName, rawArguments: string) {
  try {
    return validateAssistantMcpArgs(name, JSON.parse(rawArguments) as unknown);
  } catch {
    return { success: false as const, error: new z.ZodError([{ code: "custom", path: [], message: "وسائط الأداة ليست JSON صالحًا." }]) };
  }
}

export const MAX_ASSISTANT_MCP_RESULT_CHARS = 12_000;

export function serializeAssistantMcpResult(result: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify({ ok: true, data: result });
  } catch {
    serialized = JSON.stringify({ ok: false, error: "تعذر ترميز نتيجة سوق آمنة للمساعد." });
  }

  if (serialized.length <= MAX_ASSISTANT_MCP_RESULT_CHARS) return serialized;
  return `${serialized.slice(0, MAX_ASSISTANT_MCP_RESULT_CHARS)}…[تم تقليم نتيجة الأداة لحماية سياق المحادثة]`;
}

export function serializeAssistantMcpError(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}
