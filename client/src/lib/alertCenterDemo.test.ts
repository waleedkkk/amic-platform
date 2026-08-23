import { describe, expect, it } from "vitest";
import { LOCAL_ALERT_DEMO_ACCOUNT, getLocalAlertCenterDemoItems } from "./alertCenterDemo";

describe("بيانات معاينة مركز التنبيهات", () => {
  it("تعيد سجلاً محليًا متنوعًا للحساب التجريبي دون بيانات تعريف شخصية", () => {
    const items = getLocalAlertCenterDemoItems();
    expect(LOCAL_ALERT_DEMO_ACCOUNT.email).toBe("demo-alerts@amic.local");
    expect(items).toHaveLength(4);
    expect(new Set(items.map(item => item.category))).toEqual(new Set(["metal_alert", "structure_alert", "structure_context_alert"]));
    expect(items.some(item => item.readAt === null)).toBe(true);
    expect(items.every(item => typeof item.metadata.symbol === "string")).toBe(true);
  });
});
