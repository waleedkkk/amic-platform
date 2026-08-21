export type SetOpenMobile = (open: boolean) => void;
export type SetLocation = (path: string) => void;

/**
 * يغلق درج التنقل في الهاتف قبل تغيير الصفحة، ولا يغيّر حالة الشريط المكتبي.
 */
export function closeMobileSidebarAfterNavigation(
  isMobile: boolean,
  setOpenMobile: SetOpenMobile,
): void {
  if (isMobile) {
    setOpenMobile(false);
  }
}

/**
 * ينفّذ التنقل من عناصر القائمة بترتيب آمن: إغلاق الدرج المحمول ثم تغيير المسار.
 */
export function navigateFromSidebar({
  isMobile,
  setOpenMobile,
  setLocation,
  path,
}: {
  isMobile: boolean;
  setOpenMobile: SetOpenMobile;
  setLocation: SetLocation;
  path: string;
}): void {
  closeMobileSidebarAfterNavigation(isMobile, setOpenMobile);
  setLocation(path);
}
