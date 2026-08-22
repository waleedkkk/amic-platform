export type ChartFullscreenMode = "native" | "fallback";

type FullscreenCapableElement = {
  requestFullscreen?: () => Promise<void>;
};

export async function requestChartFullscreen(element: FullscreenCapableElement): Promise<ChartFullscreenMode> {
  if (typeof element.requestFullscreen !== "function") return "fallback";
  try {
    await element.requestFullscreen();
    return "native";
  } catch {
    return "fallback";
  }
}

export function isChartFullscreenTarget(target: Element | null, fullscreenElement: Element | null) {
  return Boolean(target && fullscreenElement && target === fullscreenElement);
}

export function getChartFullscreenPortalContainer<T extends HTMLElement>(isFullscreen: boolean, target: T | null) {
  return isFullscreen ? target : undefined;
}
