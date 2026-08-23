import { describe, expect, it } from "vitest";
import { isManualSymbolRequired, SUGGESTED_SYMBOLS, SYMBOL_GROUPS } from "./SymbolSelect";

describe("قائمة الرموز الافتراضية", () => {
  it("تضم الذهب والفضة في فئة المعادن مع سوق FX", () => {
    expect(SUGGESTED_SYMBOLS).toContainEqual({ symbol: "XAUUSD", exchange: "FX" });
    expect(SUGGESTED_SYMBOLS).toContainEqual({ symbol: "XAGUSD", exchange: "FX" });

    const metals = SYMBOL_GROUPS.find(group => group.label === "المعادن");
    expect(metals?.filter("XAUUSD")).toBe(true);
    expect(metals?.filter("XAGUSD")).toBe(true);
  });

  it("لا يخلط المعادن مع مجموعة أزواج العملات", () => {
    const forex = SYMBOL_GROUPS.find(group => group.label === "أزواج العملات");
    expect(forex?.filter("XAUUSD")).toBe(false);
    expect(forex?.filter("XAGUSD")).toBe(false);
  });

  it("لا يفرض إدخال الرمز اليدوي عند اختيار رمز مقترح من القائمة", () => {
    expect(isManualSymbolRequired("BTCUSDT", true)).toBe(false);
    expect(isManualSymbolRequired("XAUUSD", true)).toBe(false);
  });

  it("يفرض الإدخال اليدوي للرمز المخصص فقط عندما يكون الرمز مطلوبًا", () => {
    expect(isManualSymbolRequired("CUSTOMPAIR", true)).toBe(true);
    expect(isManualSymbolRequired("CUSTOMPAIR", false)).toBe(false);
  });
});
