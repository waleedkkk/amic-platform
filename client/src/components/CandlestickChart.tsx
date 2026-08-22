import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { calculateSma, findLatestSmaCrossover, type MovingAverageCrossover } from "@shared/movingAverageCrossover";
import { analyzeMarketStructure, type MarketStructure } from "@shared/marketStructure";
import { getBinanceKlineStream, mergeLiveCandle, parseBinanceKlineMessage, type LiveChartCandle } from "@shared/chartLive";
import { DEFAULT_CHART_LAYERS, normalizeChartLayers, type ChartLayerPreferences } from "@shared/chartPreferences";
import { describeLiveProviderStatus, type ChartLiveProviderStatus } from "@/lib/liveProviderStatus";
import {
  CandlestickSeries,
  createSeriesMarkers,
  createChart,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineSeries,
  LineStyle,
  type SeriesMarker,
  type DeepPartial,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

const candleIntervals = ["1m", "5m", "15m", "60m", "1d", "1wk", "1mo"] as const;
type ChartInterval = (typeof candleIntervals)[number];
const displayLabel: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "60m": "1h", "1d": "1d", "1wk": "1w", "1mo": "1M" };

const chartTheme: DeepPartial<import("lightweight-charts").ChartOptions> = {
  layout: {
    background: { color: "#050910" },
    textColor: "#8da2b5",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  grid: {
    vertLines: { color: "rgba(141,162,181,0.06)" },
    horzLines: { color: "rgba(141,162,181,0.06)" },
  },
  crosshair: { mode: CrosshairMode.Normal },
  timeScale: { timeVisible: true, borderColor: "rgba(141,162,181,0.12)" },
  rightPriceScale: { borderColor: "rgba(141,162,181,0.12)" },
};

function intervalToRange(interval: ChartInterval): "1d" | "5d" | "1mo" | "6mo" | "2y" | "5y" {
  switch (interval) {
    case "1m": return "1d";
    case "5m":
    case "15m": return "5d";
    case "60m": return "5d";
    case "1d": return "6mo";
    case "1wk": return "2y";
    case "1mo": return "5y";
    default: return "6mo";
  }
}

// ---------- Indicator math ----------
type CandleRow = LiveChartCandle;

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0];
    } else {
      prev = values[i] * k + (prev as number) * (1 - k);
    }
    out.push(i >= period - 1 ? prev : null);
  }
  return out;
}

function findLevels(candles: CandleRow[], lookback: number) {
  // Support = lowest low in recent window; Resistance = highest high
  const window = candles.slice(-lookback);
  let support = Infinity;
  let resistance = -Infinity;
  for (const c of window) {
    if (c.low < support) support = c.low;
    if (c.high > resistance) resistance = c.high;
  }
  return { support, resistance };
}

interface OverlaySeries {
  sma20: ISeriesApi<"Line">;
  sma50: ISeriesApi<"Line">;
  ema12: ISeriesApi<"Line">;
  ema26: ISeriesApi<"Line">;
  support: ISeriesApi<"Line">;
  resistance: ISeriesApi<"Line">;
  volume: ISeriesApi<"Histogram">;
}

type StructureDecorations = {
  levelLines: IPriceLine[];
  zoneLines: IPriceLine[];
};

export function CandlestickChart(props: { symbol: string; exchange: string; onCrossoverChange?: (crossover: MovingAverageCrossover | null, interval: ChartInterval) => void }) {
  const { symbol, exchange, onCrossoverChange } = props;
  const [interval, setInterval] = useState<ChartInterval>("1d");
  const [visible, setVisible] = useState<ChartLayerPreferences>(DEFAULT_CHART_LAYERS);
  const chartPreferencesQuery = trpc.market.chartPreferences.get.useQuery(undefined, { staleTime: 60 * 60 * 1000 });
  const saveChartPreferences = trpc.market.chartPreferences.save.useMutation();
  const structureAlertsQuery = trpc.structureAlerts.list.useQuery();
  const createStructureAlert = trpc.structureAlerts.create.useMutation({ onSuccess: () => structureAlertsQuery.refetch() });
  const cancelStructureAlert = trpc.structureAlerts.cancel.useMutation({ onSuccess: () => structureAlertsQuery.refetch() });
  const stableKey = useMemo(() => `${exchange}:${symbol}:${interval}`, [exchange, symbol, interval]);
  const liveStreamUrl = useMemo(() => getBinanceKlineStream(symbol, exchange, interval), [symbol, exchange, interval]);
  const [liveCandle, setLiveCandle] = useState<LiveChartCandle | null>(null);
  const [liveStatus, setLiveStatus] = useState<ChartLiveProviderStatus>("delayed");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const candlesQuery = trpc.market.candles.useQuery(
    { symbol, exchange, interval: interval as "60m" | "1d" | "1wk" | "1mo", range: intervalToRange(interval) },
    { refetchOnWindowFocus: true, refetchInterval: interval === "1m" || interval === "5m" ? 30_000 : interval === "15m" || interval === "60m" ? 60_000 : 5 * 60_000, enabled: Boolean(symbol) && Boolean(exchange) },
  );
  const twelveLiveQuote = trpc.market.liveQuote.useQuery(
    { symbol, exchange },
    { enabled: Boolean(symbol) && Boolean(exchange) && exchange.toUpperCase() !== "BINANCE", refetchInterval: 2_500, refetchOnWindowFocus: true },
  );
  const chartCandles = useMemo(() => mergeLiveCandle(candlesQuery.data?.candles ?? [], liveCandle), [candlesQuery.data?.candles, liveCandle]);
  const latestCrossover = useMemo(
    () => findLatestSmaCrossover(chartCandles),
    [chartCandles],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlaysRef = useRef<OverlaySeries | null>(null);
  const decorationsRef = useRef<StructureDecorations>({ levelLines: [], zoneLines: [] });
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [hasVolume, setHasVolume] = useState(false);
  const [structureDetail, setStructureDetail] = useState<Pick<MarketStructure, "events" | "zones">>({ events: [], zones: [] });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const structureAlertInterval = useMemo<"5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | null>(() => {
    if (interval === "5m" || interval === "15m" || interval === "1d" || interval === "1wk") return interval;
    if (interval === "60m") return "1h";
    return null;
  }, [interval]);
  const activeStructureAlerts = useMemo(
    () => (structureAlertsQuery.data ?? []).filter(alert => alert.symbol === symbol && alert.exchange === exchange && alert.status === "active"),
    [exchange, structureAlertsQuery.data, symbol],
  );

  useEffect(() => {
    if (chartPreferencesQuery.data?.layers) {
      setVisible(normalizeChartLayers(chartPreferencesQuery.data.layers));
    }
  }, [chartPreferencesQuery.data?.layers]);

  useEffect(() => {
    onCrossoverChange?.(latestCrossover, interval);
  }, [interval, latestCrossover, onCrossoverChange]);

  useEffect(() => {
    setLiveCandle(null);
    if (!liveStreamUrl) {
      setLiveStatus("delayed");
      return;
    }
    let disposed = false;
    let retryTimer: number | undefined;
    setLiveStatus(reconnectAttempt ? "reconnecting" : "connecting");
    const socket = new WebSocket(liveStreamUrl);
    socket.onopen = () => { if (!disposed) setLiveStatus("live"); };
    socket.onmessage = event => {
      const candle = parseBinanceKlineMessage(event.data);
      if (candle && !disposed) setLiveCandle(candle);
    };
    socket.onclose = () => {
      if (disposed) return;
      setLiveStatus("reconnecting");
      retryTimer = window.setTimeout(() => setReconnectAttempt(value => value + 1), 2_500);
    };
    socket.onerror = () => socket.close();
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket.close();
    };
  }, [liveStreamUrl, reconnectAttempt]);

  useEffect(() => {
    if (exchange.toUpperCase() === "BINANCE") return;
    const quote = twelveLiveQuote.data;
    const last = candlesQuery.data?.candles.at(-1);
    if (!quote?.price || !last) {
      setLiveStatus(quote?.status ?? "unavailable");
      return;
    }
    setLiveStatus(quote.status);
    setLiveCandle({
      time: last.time,
      open: last.open,
      high: Math.max(last.high, quote.price),
      low: Math.min(last.low, quote.price),
      close: quote.price,
      volume: last.volume,
    });
  }, [candlesQuery.data?.candles, exchange, twelveLiveQuote.data]);

  // Create chart once per container
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      ...chartTheme,
      rightPriceScale: { borderColor: "rgba(141,162,181,0.12)" },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    const makeLine = (color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid): ISeriesApi<"Line"> =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
      });

    const volumePanel = chart.addPane();
    const volume = volumePanel.addSeries(HistogramSeries, {
      color: "rgba(56,189,248,0.35)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

    const overlays: OverlaySeries = {
      sma20: makeLine("#f59e0b", 2),
      sma50: makeLine("#a78bfa", 2),
      ema12: makeLine("#38bdf8", 1, LineStyle.Dashed),
      ema26: makeLine("#34d399", 1, LineStyle.Dashed),
      support: makeLine("#16a34a", 2, LineStyle.Dotted),
      resistance: makeLine("#dc2626", 2, LineStyle.Dotted),
      volume,
    };

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    overlaysRef.current = overlays;
    markersRef.current = createSeriesMarkers(candles);

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry?.contentRect.width && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaysRef.current = null;
      markersRef.current = null;
      decorationsRef.current = { levelLines: [], zoneLines: [] };
    };
  }, []);

  // Re-apply visibility whenever toggles or data change
  useEffect(() => {
    const data = chartCandles;
    const candlesSeries = candleSeriesRef.current;
    const overlays = overlaysRef.current;
    const chart = chartRef.current;
    if (!data || !data.length || !candlesSeries || !overlays || !chart) return;

    const seriesData = data.map(candle => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    candlesSeries.setData(seriesData);

    const closes = data.map(c => c.close);
    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const volumes = data.map(c => c.volume ?? 0);

    const apply = (series: ISeriesApi<"Line"> | ISeriesApi<"Histogram">, show: boolean, points: { time: Time; value: number }[]) => {
      if (show && points.length > 0) {
        series.setData(points);
        series.applyOptions({ visible: true });
      } else {
        series.setData([]);
        series.applyOptions({ visible: false });
      }
    };

    const sma20Vals = calculateSma(closes, 20);
    apply(overlays.sma20, visible.sma, closes.map((v, i) => sma20Vals[i]).map((v, i) => v !== null ? { time: data[i].time as Time, value: v } : null).filter((p): p is { time: Time; value: number } => p !== null));
    const sma50Vals = calculateSma(closes, 50);
    apply(overlays.sma50, visible.sma, sma50Vals.map((v, i) => v !== null ? { time: data[i].time as Time, value: v } : null).filter((p): p is { time: Time; value: number } => p !== null));
    const ema12Vals = ema(closes, 12);
    apply(overlays.ema12, visible.ema, ema12Vals.map((v, i) => v !== null ? { time: data[i].time as Time, value: v } : null).filter((p): p is { time: Time; value: number } => p !== null));
    const ema26Vals = ema(closes, 26);
    apply(overlays.ema26, visible.ema, ema26Vals.map((v, i) => v !== null ? { time: data[i].time as Time, value: v } : null).filter((p): p is { time: Time; value: number } => p !== null));

    const lookback = Math.min(55, data.length);
    const fallbackLevels = findLevels(data, lookback);
    const structure = analyzeMarketStructure(
      data.map(candle => ({
        time: Number(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
      { swingRadius: 2, levelTolerance: 0.003, confirmationBars: 3 },
    );
    setStructureDetail({ events: structure.events.slice(-4).reverse(), zones: structure.zones.slice(-4).reverse() });
    const latestSupport = structure.levels.filter(level => level.kind === "support").sort((a, b) => b.createdAt - a.createdAt)[0];
    const latestResistance = structure.levels.filter(level => level.kind === "resistance").sort((a, b) => b.createdAt - a.createdAt)[0];
    apply(overlays.support, visible.levels, data.map(c => ({ time: c.time as Time, value: latestSupport?.price ?? fallbackLevels.support })));
    apply(overlays.resistance, visible.levels, data.map(c => ({ time: c.time as Time, value: latestResistance?.price ?? fallbackLevels.resistance })));

    const clearLines = (lines: IPriceLine[]) => lines.forEach(line => candlesSeries.removePriceLine(line));
    clearLines(decorationsRef.current.levelLines);
    clearLines(decorationsRef.current.zoneLines);
    decorationsRef.current = { levelLines: [], zoneLines: [] };

    if (visible.levels) {
      decorationsRef.current.levelLines = structure.levels.slice(-6).map(level => candlesSeries.createPriceLine({
        price: level.price,
        color: level.kind === "support" ? "rgba(22,163,74,0.46)" : "rgba(220,38,38,0.46)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.kind === "support" ? "دعم" : "مقاومة"} ×${level.touches}`,
      }));
    }

    if (visible.zones) {
      decorationsRef.current.zoneLines = structure.zones.slice(-4).flatMap(zone => [
        candlesSeries.createPriceLine({
          price: zone.high,
          color: zone.kind === "demand" ? "rgba(16,185,129,0.5)" : "rgba(251,113,133,0.5)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${zone.kind === "demand" ? "طلب" : "عرض"} · أعلى`,
        }),
        candlesSeries.createPriceLine({
          price: zone.low,
          color: zone.kind === "demand" ? "rgba(16,185,129,0.3)" : "rgba(251,113,133,0.3)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
        }),
      ]);
    }

    const markers: SeriesMarker<Time>[] = visible.events
      ? structure.events.map(event => ({
        time: event.time as Time,
        position: event.kind === "bullish-breakout" || event.kind === "bullish-reversal" ? "belowBar" : "aboveBar",
        color: event.kind === "bullish-breakout" || event.kind === "bullish-reversal" ? "#34d399" : "#fb7185",
        shape: event.kind === "bullish-breakout" || event.kind === "bullish-reversal" ? "arrowUp" : "arrowDown",
        text: event.kind === "bullish-breakout" ? "اختراق" : event.kind === "bearish-breakdown" ? "كسر" : "انعكاس",
      }))
      : [];
    markersRef.current?.setMarkers(markers);

    const hasVol = volumes.some(v => v > 0);
    setHasVolume(hasVol);
    if (visible.volume && hasVol) {
      overlays.volume.setData(
        data.map((c, i) => ({ time: c.time as Time, value: c.volume ?? 0, color: c.close >= c.open ? "rgba(22,163,74,0.45)" : "rgba(220,38,38,0.45)" })),
      );
      overlays.volume.applyOptions({ visible: true });
      candlesSeries.applyOptions({ priceScaleId: "right" });
    } else {
      overlays.volume.setData([]);
      overlays.volume.applyOptions({ visible: false });
    }

    chart.timeScale().fitContent();
  }, [stableKey, chartCandles, visible]);

  const toggle = (key: keyof ChartLayerPreferences) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next);
    saveChartPreferences.mutate({ layers: next });
  };
  const liveProvider = exchange.toUpperCase() === "BINANCE" ? "binance" : "twelve-data";
  const livePresentation = describeLiveProviderStatus(liveStatus, liveProvider);

  return (
    <Card className="bg-white/[0.02]">
      <CardContent className="pt-4 sm:pt-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs font-semibold tracking-[0.13em] text-primary">PRICE HISTORY</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/[0.08] bg-black/25 p-0.5 sm:flex sm:items-center">
              {candleIntervals.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setInterval(item)}
                  className={`min-h-10 rounded-md px-1.5 py-1 text-xs font-mono transition-colors duration-150 sm:min-h-0 sm:px-2.5 ${interval === item ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {displayLabel[item] ?? item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.08] bg-black/25 p-0.5 sm:flex sm:items-center">
              {(
                [
                  { key: "sma", label: "SMA" },
                  { key: "ema", label: "EMA" },
                  { key: "levels", label: "دعم/مقاومة" },
                  { key: "zones", label: "طلب/عرض" },
                  { key: "events", label: "اختراقات" },
                  { key: "volume", label: "الحجم" },
                ] as const
              ).map(btn => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => toggle(btn.key)}
                  aria-pressed={visible[btn.key]}
                  className={`min-h-10 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 sm:min-h-0 sm:px-2.5 ${visible[btn.key] ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <span className="self-center text-[10px] text-muted-foreground">
              {chartPreferencesQuery.isLoading ? "تحميل الطبقات…" : saveChartPreferences.isPending ? "حفظ الطبقات…" : "تفضيلاتك محفوظة"}
            </span>
          </div>
        </div>
        <div className="relative min-h-[220px]">
          <div ref={containerRef} className="h-[300px] w-full sm:h-[380px]" />
          {candlesQuery.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 backdrop-blur-[2px]">
              <Spinner className="size-5 text-primary" />
              <span className="mr-2 text-sm text-muted-foreground">جارٍ جلب الشموع التاريخية…</span>
            </div>
          )}
          {candlesQuery.isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/45 backdrop-blur-[2px]">
              <p className="text-sm font-medium text-destructive">تعذّر تحميل بيانات الأسعار التاريخية</p>
              <p className="mt-1 text-xs text-muted-foreground">{candlesQuery.error.message}</p>
            </div>
          )}
          {!candlesQuery.isLoading && !candlesQuery.isError && !candlesQuery.data?.candles?.length && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 backdrop-blur-[2px]">
              <p className="text-sm text-muted-foreground">لا تتوفر سلسلة شموع لهذا الرمز في النطاق المحدد.</p>
            </div>
          )}
        </div>
        {latestCrossover ? (
          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs ${latestCrossover.kind === "golden" ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200" : "border-rose-400/25 bg-rose-400/[0.07] text-rose-200"}`}>
            <span className="font-semibold">{latestCrossover.kind === "golden" ? "التقاطع الذهبي" : "تقاطع الموت"} <span className="font-normal opacity-80">— SMA 20 / SMA 50</span></span>
            <span className="font-mono opacity-80">سعر التقاطع: {latestCrossover.price.toLocaleString("en-US", { maximumFractionDigits: 6 })} · قبل {latestCrossover.barsSince} شموع</span>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {candlesQuery.data ? (
            <>
              <span className="font-mono">
                {chartCandles.length} شمعة · {candlesQuery.data.interval} ·{" "}
                {candlesQuery.data.exchangeName}
              </span>
              <span className={livePresentation.className}>{livePresentation.label}</span>
              <span className="font-mono text-muted-foreground">
                الشموع: {candlesQuery.data.provider === "twelve-data" ? "Twelve Data مرخّص" : "Yahoo Finance احتياطي"}
              </span>
              {visible.sma && <span className="font-mono text-amber-400/80">━ SMA 20 ━ SMA 50</span>}
              {visible.ema && <span className="font-mono text-sky-400/80">╌ EMA 12 ┅ EMA 26</span>}
              {visible.levels && (
                <>
                  <span className="font-mono text-green-500/80">┅ دعم بنيوي</span>
                  <span className="font-mono text-red-400/80">┅ مقاومة بنيوية</span>
                </>
              )}
              {visible.zones && <span className="font-mono text-emerald-300/80">┈ مناطق طلب/عرض مؤكدة</span>}
              {visible.events && <span className="font-mono text-violet-300/80">↑↓ اختراقات بإغلاق الشمعة</span>}
              {visible.volume && hasVolume && <span className="font-mono text-sky-300/80">▪ الحجم</span>}
              {candlesQuery.data.regularMarketPrice != null ? (
                <span className="font-mono text-sky-300">
                  السعر الحالي: {candlesQuery.data.regularMarketPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              ) : null}
              <span>{new Date(candlesQuery.data.fetchedAt).toLocaleString("ar-EG")}</span>
            </>
          ) : null}
        </div>
        {(visible.events || visible.zones) && (structureDetail.events.length > 0 || structureDetail.zones.length > 0) ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs sm:grid-cols-2">
            {visible.events && structureDetail.events.length > 0 ? (
              <div className="min-w-0">
                <p className="mb-2 font-semibold text-foreground">أحداث بنية السعر</p>
                <div className="flex flex-wrap gap-1.5">
                  {structureDetail.events.map(event => {
                    const positive = event.kind === "bullish-breakout" || event.kind === "bullish-reversal";
                    const label = event.kind === "bullish-breakout" ? "اختراق صاعد" : event.kind === "bearish-breakdown" ? "كسر هابط" : event.kind === "bullish-reversal" ? "انعكاس صاعد" : "انعكاس هابط";
                    return <button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} aria-pressed={selectedEventId === event.id} className={`rounded-md border px-2 py-1 transition-colors ${selectedEventId === event.id ? "border-primary/50 bg-primary/15 text-primary" : positive ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200" : "border-rose-400/20 bg-rose-400/[0.06] text-rose-200"}`}>{label}</button>;
                  })}
                </div>
                {(() => {
                  const selected = structureDetail.events.find(event => event.id === selectedEventId) ?? structureDetail.events[0];
                  return selected ? <p className="mt-2 leading-5 text-muted-foreground"><span className="font-semibold text-foreground">السبب:</span> {selected.explanation} <span className="font-mono text-primary">المستوى {selected.level.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span></p> : null;
                })()}
              </div>
            ) : null}
            {visible.zones && structureDetail.zones.length > 0 ? (
              <div className="min-w-0">
                <p className="mb-2 font-semibold text-foreground">مناطق قابلة للمراجعة</p>
                <div className="flex flex-wrap gap-1.5">
                  {structureDetail.zones.map(zone => <span key={zone.id} className={`rounded-md border px-2 py-1 font-mono ${zone.kind === "demand" ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200" : "border-rose-400/20 bg-rose-400/[0.06] text-rose-200"}`}>{zone.kind === "demand" ? "طلب" : "عرض"} {zone.low.toLocaleString("en-US", { maximumFractionDigits: 4 })}–{zone.high.toLocaleString("en-US", { maximumFractionDigits: 4 })} · إبطال {zone.invalidation.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">تنبيهات بنية السعر</p>
              <p className="mt-0.5 text-muted-foreground">يُفحص آخر حدث مؤكد دوريًا ويُرسل لك إشعارًا داخل AMIC وتيليغرام عند تفعيله.</p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{structureAlertsQuery.isLoading ? "تحميل…" : `${activeStructureAlerts.length} نشط`}</span>
          </div>
          {structureAlertInterval ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([
                { eventType: "breakout", label: "اختراق صاعد" },
                { eventType: "breakdown", label: "كسر هابط" },
                { eventType: "bullish_reversal", label: "انعكاس صاعد" },
                { eventType: "bearish_reversal", label: "انعكاس هابط" },
              ] as const).map(option => {
                const alreadyActive = activeStructureAlerts.some(alert => alert.interval === structureAlertInterval && alert.eventType === option.eventType);
                return <button key={option.eventType} type="button" disabled={alreadyActive || createStructureAlert.isPending} onClick={() => createStructureAlert.mutate({ symbol, exchange, interval: structureAlertInterval, eventType: option.eventType })} className={`min-h-9 rounded-md border px-2 py-1.5 transition-colors ${alreadyActive ? "cursor-default border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200" : "border-white/[0.12] text-muted-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-primary disabled:opacity-50"}`}>{alreadyActive ? "✓ " : "+ "}{option.label}</button>;
              })}
            </div>
          ) : <p className="mt-2 text-amber-300">تدعم التنبيهات حاليًا أطر 5m و15m و1h و1d و1w. اختر إطارًا مدعومًا لإضافة تنبيه.</p>}
          {activeStructureAlerts.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{activeStructureAlerts.map(alert => <button key={alert.id} type="button" onClick={() => cancelStructureAlert.mutate({ id: alert.id })} disabled={cancelStructureAlert.isPending} className="rounded-md border border-rose-400/20 bg-rose-400/[0.06] px-2 py-1 text-rose-200 transition-colors hover:bg-rose-400/[0.12]">إلغاء {alert.eventType === "breakout" ? "الاختراق" : alert.eventType === "breakdown" ? "الكسر" : alert.eventType === "bullish_reversal" ? "الانعكاس الصاعد" : "الانعكاس الهابط"} · {alert.interval}</button>)}</div> : null}
          {createStructureAlert.isError || cancelStructureAlert.isError ? <p className="mt-2 text-destructive">تعذّر تحديث التنبيه. أعد المحاولة.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
