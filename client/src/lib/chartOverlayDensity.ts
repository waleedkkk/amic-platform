export type ChartOverlayDensity = {
  compact: boolean;
  levelLimit: number;
  zoneLimit: number;
  showZoneAxisLabels: boolean;
  showProposalAxisLabels: boolean;
};

const MOBILE_OVERLAY_MAX_WIDTH = 560;

export function getChartOverlayDensity(chartWidth: number): ChartOverlayDensity {
  const compact = chartWidth <= 0 || chartWidth < MOBILE_OVERLAY_MAX_WIDTH;
  if (compact) {
    return {
      compact: true,
      levelLimit: 2,
      zoneLimit: 2,
      showZoneAxisLabels: false,
      showProposalAxisLabels: false,
    };
  }

  return {
    compact: false,
    levelLimit: 6,
    zoneLimit: 4,
    showZoneAxisLabels: true,
    showProposalAxisLabels: true,
  };
}
