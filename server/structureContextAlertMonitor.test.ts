import { describe, expect, it } from "vitest";
import { evaluateStructureContextAlert } from "./structureContextAlertMonitor";

const base = { id: 1, userId: 1, symbol: "XAUUSD", exchange: "FX", interval: "1h" as const, sourceKind: "support" as const, sourceLabel: "دعم اختبار", referencePrice: "4000", rangeLow: null, rangeHigh: null, invalidationPrice: "3988", proximityBps: 15 };

describe("تنبيهات سياق البنية", () => {
  it("يكتشف الاقتراب واللمس لدعم ولا يعكس إبطال الدعم", () => {
    expect(evaluateStructureContextAlert({ ...base, eventType: "approach" }, { close: 4000.4, high: 4001, low: 3999.8 })).toBe(true);
    expect(evaluateStructureContextAlert({ ...base, eventType: "touch" }, { close: 4002, high: 4003, low: 3999.9 })).toBe(true);
    expect(evaluateStructureContextAlert({ ...base, eventType: "invalidation" }, { close: 3987.9, high: 3990, low: 3987 })).toBe(true);
    expect(evaluateStructureContextAlert({ ...base, eventType: "invalidation" }, { close: 3992, high: 3993, low: 3991 })).toBe(false);
  });

  it("يتحقق من نطاق منطقة العرض عند اللمس", () => {
    const alert = { ...base, sourceKind: "supply_zone" as const, sourceLabel: "منطقة عرض", referencePrice: "4020", rangeLow: "4018", rangeHigh: "4022", invalidationPrice: "4025", eventType: "touch" as const };
    expect(evaluateStructureContextAlert(alert, { close: 4019, high: 4021, low: 4017 })).toBe(true);
    expect(evaluateStructureContextAlert(alert, { close: 4015, high: 4017, low: 4014 })).toBe(false);
  });
});
