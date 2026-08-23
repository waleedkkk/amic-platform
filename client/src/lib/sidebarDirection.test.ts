import { describe, expect, it } from "vitest";
import { ARABIC_SIDEBAR_SIDE, getSidebarResizeWidth, getSidebarSideForLanguage } from "./sidebarDirection";

describe("اتجاه الشريط الجانبي العربي", () => {
  it("يضع الواجهة العربية في الجهة اليمنى", () => {
    expect(ARABIC_SIDEBAR_SIDE).toBe("right");
  });

  it("ينقل الواجهة الإنجليزية إلى الجهة اليسرى", () => {
    expect(getSidebarSideForLanguage("ar")).toBe("right");
    expect(getSidebarSideForLanguage("en")).toBe("left");
  });

  it("يحسب عرض شريط الجهة اليمنى من حافته اليمنى", () => {
    expect(getSidebarResizeWidth("right", { left: 1000, right: 1280 }, 1040)).toBe(240);
  });

  it("يحافظ على حساب الجهة اليسرى عند إعادة استخدام الدالة", () => {
    expect(getSidebarResizeWidth("left", { left: 0, right: 280 }, 240)).toBe(240);
  });
});
