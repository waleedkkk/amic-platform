export type SidebarSide = "left" | "right";

type HorizontalBounds = Pick<DOMRect, "left" | "right">;

export const ARABIC_SIDEBAR_SIDE: SidebarSide = "right";

export function getSidebarSideForLanguage(language: "ar" | "en"): SidebarSide {
  return language === "ar" ? "right" : "left";
}

export function getSidebarResizeWidth(
  side: SidebarSide,
  bounds: HorizontalBounds,
  pointerX: number,
): number {
  return side === "right" ? bounds.right - pointerX : pointerX - bounds.left;
}
