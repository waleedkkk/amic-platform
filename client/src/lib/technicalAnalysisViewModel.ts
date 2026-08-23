import type { MultiTimeframeAnalysis, MultiTimeframeFrame, TechnicalAnalysis } from "@shared/technicalAnalysis";

export type TechnicalMetricId = "price" | "rsi" | "macd" | "bollinger";

export type TechnicalMetricCard = {
  id: TechnicalMetricId;
  label: string;
  detail: string;
  value: number | null;
  digits: number;
};

export type TechnicalDetailItem = {
  label: string;
  value: number | string | boolean | null;
  digits?: number;
};

export type TechnicalDetailGroup = {
  id: string;
  title: string;
  items: TechnicalDetailItem[];
};

function formatLevelList(levels: number[]) {
  return levels.length > 0
    ? levels.map(level => new Intl.NumberFormat("ar", { maximumFractionDigits: 6 }).format(level)).join(" · ")
    : null;
}

export function getTechnicalMetricCards(analysis: TechnicalAnalysis): TechnicalMetricCard[] {
  return [
    { id: "price", label: "السعر / الإغلاق", detail: `${analysis.symbol} · ${analysis.exchange}`, value: analysis.price.current ?? analysis.price.close, digits: 6 },
    { id: "rsi", label: "RSI", detail: "مؤشر الزخم النسبي", value: analysis.indicators.rsi.value, digits: 2 },
    { id: "macd", label: "MACD", detail: "فرق المتوسطات المتحركة", value: analysis.indicators.macd.line, digits: 4 },
    { id: "bollinger", label: "Bollinger", detail: "الخط الأوسط لنطاقات بولينجر", value: analysis.indicators.bollinger.middle, digits: 4 },
  ];
}

export function getUnavailableMetricLabels(analysis: TechnicalAnalysis) {
  return getTechnicalMetricCards(analysis).filter(metric => metric.value === null).map(metric => metric.label);
}

export function getTechnicalDetailGroups(analysis: TechnicalAnalysis): TechnicalDetailGroup[] {
  return [
    {
      id: "bollinger",
      title: "نطاقات Bollinger",
      items: [
        { label: "العلوي", value: analysis.indicators.bollinger.upper, digits: 6 },
        { label: "الأوسط", value: analysis.indicators.bollinger.middle, digits: 6 },
        { label: "السفلي", value: analysis.indicators.bollinger.lower, digits: 6 },
        { label: "العرض", value: analysis.indicators.bollinger.width, digits: 4 },
        { label: "انضغاط", value: analysis.indicators.bollinger.squeeze === null ? null : analysis.indicators.bollinger.squeeze ? "نعم" : "لا" },
      ],
    },
    {
      id: "momentum",
      title: "الزخم",
      items: [
        { label: "RSI", value: analysis.indicators.rsi.value, digits: 2 },
        { label: "اتجاه RSI", value: analysis.indicators.rsi.direction },
        { label: "MACD Signal", value: analysis.indicators.macd.signal, digits: 4 },
        { label: "Histogram", value: analysis.indicators.macd.histogram, digits: 4 },
        { label: "Crossover", value: analysis.indicators.macd.crossover },
        { label: "Stochastic K / D", value: analysis.indicators.stochastic.k === null || analysis.indicators.stochastic.d === null ? null : `${analysis.indicators.stochastic.k.toFixed(2)} / ${analysis.indicators.stochastic.d.toFixed(2)}` },
      ],
    },
    {
      id: "trend",
      title: "الاتجاه والتذبذب",
      items: [
        { label: "ADX", value: analysis.indicators.adx.value, digits: 2 },
        { label: "قوة الاتجاه", value: analysis.indicators.adx.trendStrength },
        { label: "ATR", value: analysis.indicators.atr.value, digits: 6 },
        { label: "تذبذب ATR", value: analysis.indicators.atr.volatility },
        { label: "بنية السوق", value: analysis.marketStructure.trend },
        { label: "قوة البنية", value: analysis.marketStructure.strength },
      ],
    },
    {
      id: "levels",
      title: "مستويات السعر",
      items: [
        { label: "Pivot", value: analysis.levels.pivot, digits: 6 },
        { label: "أقرب دعم", value: analysis.levels.nearestSupport, digits: 6 },
        { label: "أقرب مقاومة", value: analysis.levels.nearestResistance, digits: 6 },
        { label: "الدعوم", value: formatLevelList(analysis.levels.supports) },
        { label: "المقاومات", value: formatLevelList(analysis.levels.resistances) },
      ],
    },
  ];
}

export function describeConfluenceFrame(frame: MultiTimeframeFrame | undefined) {
  if (!frame) return "—";
  if (frame.score !== null) {
    const label = frame.score > 0.3 ? "صاعد" : frame.score < -0.3 ? "هابط" : "عرضي";
    return `${label} (${frame.score > 0 ? "+" : ""}${frame.score.toFixed(2)})`;
  }
  return frame.bias ?? frame.marketStructure ?? "—";
}

export function getConfluenceReferencePrice(analysis: MultiTimeframeAnalysis) {
  for (const timeframe of ["1h", "4h", "15m", "1D", "1W"]) {
    const price = analysis.frames[timeframe]?.price;
    if (price !== null && price !== undefined && Number.isFinite(price) && price > 0) {
      return { price, timeframe };
    }
  }
  return null;
}

export function resolveConfluenceDisplayPrice(livePrice: unknown, analysis: MultiTimeframeAnalysis) {
  const parsedLivePrice = Number(livePrice);
  if (Number.isFinite(parsedLivePrice) && parsedLivePrice > 0) {
    return { price: parsedLivePrice, source: "live" as const, timeframe: null };
  }
  const reference = getConfluenceReferencePrice(analysis);
  return reference ? { price: reference.price, source: "frame" as const, timeframe: reference.timeframe } : { price: null, source: "unavailable" as const, timeframe: null };
}

export function createSavedAnalysisPayload(analysis: TechnicalAnalysis, movingAverageCrossover: unknown) {
  return {
    contractVersion: analysis.schemaVersion,
    technicalAnalysis: analysis,
    chartContext: { movingAverageCrossover },
  };
}
