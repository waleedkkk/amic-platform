export type ChartOverlayDensity = {
  compact: boolean;
  levelLimit: number;
  zoneLimit: number;
  showZoneAxisLabels: boolean;
  showProposalAxisLabels: boolean;
};

const MOBILE_OVERLAY_MAX_WIDTH = 560;
const STABLE_LEVEL_LIMIT = 6;
const STABLE_ZONE_LIMIT = 4;

export function getChartOverlayDensity(chartWidth: number): ChartOverlayDensity {
  const compact = chartWidth <= 0 || chartWidth < MOBILE_OVERLAY_MAX_WIDTH;
  if (compact) {
    return {
      compact: true,
      // لا تخفِ طبقات اختارها المستخدم عند تغيير عرض المخطط؛
      // نخفّض كثافة التسميات فقط على الهاتف كي تبقى الطبقات ثابتة.
      levelLimit: STABLE_LEVEL_LIMIT,
      zoneLimit: STABLE_ZONE_LIMIT,
      showZoneAxisLabels: false,
      showProposalAxisLabels: false,
    };
  }

  return {
    compact: false,
    levelLimit: STABLE_LEVEL_LIMIT,
    zoneLimit: STABLE_ZONE_LIMIT,
    showZoneAxisLabels: true,
    showProposalAxisLabels: true,
  };
}
