import { describe, expect, it } from "vitest";
import { buildPaperTradeCritiquePrompt } from "./tradeCritique";

describe("ضوابط نقد الصفقة الورقية", () => {
  it("يقصر النقد على الحقائق ولا يشتمل على أوصاف حكمية للمستخدم", () => {
    const prompt = buildPaperTradeCritiquePrompt({ trade: { symbol: "BTCUSDT", exchange: "BINANCE", side: "long", quantity: "1", entryPrice: "100", exitPrice: "110", stopLoss: "95", takeProfit: "115", realizedPnl: "10", openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-02") }, signal: null, linkType: "none" });
    expect(prompt).toContain("بيانات الصفقة");
    expect(prompt).toContain("لا تستنتج المشاعر");
    expect(prompt).not.toMatch(/متهور|خائف|طماع|ذكي|فاشل/);
  });

  it("يميّز صراحة بين الإشارة المرتبطة مؤكدًا والمطابقة التقريبية", () => {
    const trade = { symbol: "BTCUSDT", exchange: "BINANCE", side: "long", quantity: "1", entryPrice: "100", exitPrice: "110", stopLoss: "95", takeProfit: "115", realizedPnl: "10", openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-02") };
    const signal = { timeframe: "1h", recommendation: "buy", confidence: 70, summary: "سياق الاختبار" };

    const confirmed = buildPaperTradeCritiquePrompt({ trade, signal, linkType: "confirmed" });
    const guessed = buildPaperTradeCritiquePrompt({ trade, signal, linkType: "guessed" });

    expect(confirmed).toContain("نوع الربط بالإشارة: confirmed");
    expect(confirmed).toContain("الإشارة الأصلية المتاحة");
    expect(guessed).toContain("نوع الربط بالإشارة: guessed");
    expect(guessed).toContain("مطابقة تقريبية غير مؤكدة");
    expect(guessed).toContain("بحذر معلن");
  });
});
