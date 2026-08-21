import { describe, expect, it, vi } from "vitest";
import { closeMobileSidebarAfterNavigation, navigateFromSidebar } from "./sidebarMobileNavigation";

describe("closeMobileSidebarAfterNavigation", () => {
  it("يغلق درج الشريط الجانبي عند اختيار قسم من الهاتف", () => {
    const setOpenMobile = vi.fn();

    closeMobileSidebarAfterNavigation(true, setOpenMobile);

    expect(setOpenMobile).toHaveBeenCalledOnce();
    expect(setOpenMobile).toHaveBeenCalledWith(false);
  });

  it("لا يغيّر حالة درج الهاتف أثناء التنقل المكتبي", () => {
    const setOpenMobile = vi.fn();

    closeMobileSidebarAfterNavigation(false, setOpenMobile);

    expect(setOpenMobile).not.toHaveBeenCalled();
  });

  it("يغلق الدرج قبل تغيير مسار عنصر قائمة الهاتف", () => {
    const events: string[] = [];
    const setOpenMobile = vi.fn((open: boolean) => events.push(`drawer:${open}`));
    const setLocation = vi.fn((path: string) => events.push(`route:${path}`));

    navigateFromSidebar({
      isMobile: true,
      setOpenMobile,
      setLocation,
      path: "/analysis",
    });

    expect(events).toEqual(["drawer:false", "route:/analysis"]);
  });
});
