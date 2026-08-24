import { describe, expect, it } from "vitest";
import { ICT_CONFIRMATION_TOOLTIPS } from "./ictSettingHelp";

describe("ICT confirmation setting help", () => {
  it("explains that the gate applies only in normal mode", () => {
    expect(ICT_CONFIRMATION_TOOLTIPS.mode).toContain("Normal");
    expect(ICT_CONFIRMATION_TOOLTIPS.mode).toContain("Scalping");
    expect(ICT_CONFIRMATION_TOOLTIPS.mode).toContain("BUY");
    expect(ICT_CONFIRMATION_TOOLTIPS.mode).toContain("SELL");
  });

  it("explains the ten-point score and its non-execution boundary", () => {
    expect(ICT_CONFIRMATION_TOOLTIPS.threshold).toContain("10 نقاط");
    expect(ICT_CONFIRMATION_TOOLTIPS.threshold).toContain("Order Block");
    expect(ICT_CONFIRMATION_TOOLTIPS.threshold).toContain("لا ينشئ");
  });
});
