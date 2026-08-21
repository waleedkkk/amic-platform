export type SidebarSide = "left" | "right";

type HorizontalBounds = Pick<DOMRect, "left" | "right">;

export const ARABIC_SIDEBAR_SIDE: SidebarSide = "right";

export function getSidebarResizeWidth(
  side: SidebarSide,
  bounds: HorizontalBounds,
  pointerX: number,
): number {
  return side === "right" ? bounds.right - pointerX : pointerX - bounds.left;
}
