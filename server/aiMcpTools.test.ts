import { describe, expect, it } from "vitest";
import {
  assistantMcpToolNames,
  assistantMcpTools,
  parseAssistantMcpArguments,
  serializeAssistantMcpResult,
} from "./aiMcpTools";

describe("عقد أدوات سوق مساعد AMIC", () => {
  it("يعرض ست أدوات القراءة المعتمدة فقط", () => {
    expect(assistantMcpToolNames).toEqual([
      "coin_analysis",
      "top_gainers",
      "top_losers",
      "market_sentiment",
      "financial_news",
      "multi_timeframe_analysis",
    ]);
    expect(assistantMcpTools.map(tool => tool.function.name)).toEqual(assistantMcpToolNames);
  });

  it("يطبع الرمز والبورصة ويطبق القيم الافتراضية دون تمرير مفاتيح إضافية", () => {
    const parsed = parseAssistantMcpArguments("coin_analysis", '{"symbol":" btcusdt ","exchange":"binance","ignored":"value"}');

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "15m" });
    }
  });

  it("يرفض الرموز والحدود غير الآمنة قبل أي اتصال MCP", () => {
    expect(parseAssistantMcpArguments("coin_analysis", '{"symbol":"BTC USDT"}').success).toBe(false);
    expect(parseAssistantMcpArguments("top_gainers", '{"limit":51}').success).toBe(false);
    expect(parseAssistantMcpArguments("financial_news", "not-json").success).toBe(false);
  });

  it("يقلم نتائج الأداة الطويلة قبل إعادتها للنموذج", () => {
    const serialized = serializeAssistantMcpResult({ payload: "x".repeat(15_000) });

    expect(serialized.length).toBeLessThanOrEqual(12_050);
    expect(serialized).toContain("تم تقليم نتيجة الأداة");
  });
});
