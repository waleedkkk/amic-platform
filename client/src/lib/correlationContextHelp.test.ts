import { describe, expect, it } from "vitest";
import { CORRELATION_CONTEXT_HELP, CORRELATION_TOOLTIP_INTERACTION_HINT, correlationStatusHelp } from "./correlationContextHelp";

describe("تلميحات السياق المترابط", () => {
  it("توضح أن السياق طبقة تفسيرية لا توصية أو تنفيذًا", () => {
    expect(CORRELATION_CONTEXT_HELP.overview).toContain("طبقة تفسيرية");
    expect(CORRELATION_CONTEXT_HELP.overview).toContain("لا يغيّر توصية");
    expect(CORRELATION_CONTEXT_HELP.summary).toContain("لا تمثل توصية استثمارية");
  });

  it("يغطي كل حالات التوافق بتفسير عربي حذر", () => {
    expect(correlationStatusHelp("aligned")).toContain("متوافق");
    expect(correlationStatusHelp("divergent")).toContain("بحذر");
    expect(correlationStatusHelp("context_only")).toContain("لا يدخل");
    expect(correlationStatusHelp("unavailable")).toContain("غير حاسم");
  });

  it("يشرح وسيلة التفاعل المناسبة للفأرة واللمس ولوحة المفاتيح", () => {
    expect(CORRELATION_TOOLTIP_INTERACTION_HINT).toContain("ركّزه بلوحة المفاتيح");
    expect(CORRELATION_TOOLTIP_INTERACTION_HINT).toContain("المسه");
  });
});
