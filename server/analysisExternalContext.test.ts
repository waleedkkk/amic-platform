import { describe, expect, it } from "vitest";
import { correlationLabel, MAX_EXTERNAL_CONTEXT_REFERENCES, normalizeExternalContextReferences } from "../shared/analysisExternalContext";

describe("إعدادات السياق الخارجي", () => {
  it("يطبع الرموز المرجعية ويزيل التكرار ويحدها بالحد الآمن", () => {
    const input = [
      { symbol: "xauusd", exchange: "fx" },
      { symbol: "XAUUSD", exchange: "FX" },
      { symbol: "xagusd", exchange: "fx" },
      { symbol: "eurusd", exchange: "fx" },
      { symbol: "gbpusd", exchange: "fx" },
      { symbol: "usdjpy", exchange: "fx" },
    ];
    const references = normalizeExternalContextReferences(input);
    expect(references).toEqual([{ symbol: "XAUUSD", exchange: "FX" }, { symbol: "XAGUSD", exchange: "FX" }, { symbol: "EURUSD", exchange: "FX" }, { symbol: "GBPUSD", exchange: "FX" }]);
    expect(references).toHaveLength(MAX_EXTERNAL_CONTEXT_REFERENCES);
  });

  it("يصف الارتباط كعلاقة إحصائية دون توصية سببية", () => {
    expect(correlationLabel(0.78)).toMatchObject({ label: "ارتباط موجب قوي", tone: "positive" });
    expect(correlationLabel(-0.45)).toMatchObject({ label: "ارتباط سالب متوسط", tone: "negative" });
    expect(correlationLabel(0.08)).toMatchObject({ label: "ارتباط ضعيف", tone: "neutral" });
  });
});
