import { describe, expect, it } from "vitest";
import { MOBILE_SIDEBAR_SURFACE_CLASS } from "./sidebarMobileSurface";

describe("MOBILE_SIDEBAR_SURFACE_CLASS", () => {
  it("يفرض خلفية صلبة على درج الهاتف بدل مظهر شفاف", () => {
    expect(MOBILE_SIDEBAR_SURFACE_CLASS).toContain("bg-[#0c141e]");
    expect(MOBILE_SIDEBAR_SURFACE_CLASS).toContain("opacity-100");
  });
});
