import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { calculateSma, findLatestSmaCrossover, type MovingAverageCrossover } from "@shared/movingAverageCrossover";
import {
  CandlestickSeries,
  createChart,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  type DeepPartial,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

const candleIntervals = ["60m", "1d", "1wk", "1mo"] as const;
type ChartInterval = (typeof candleIntervals)[number];
const displayLabel: Record<string, string> = { "60m": "1h", "1d": "1d", "1wk": "1w", "1mo": "1M" };

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
    case "60m": return "5d";
    case "1d": return "6mo";
    case "1wk": return "2y";
    case "1mo": return "5y";
    default: return "6mo";
  }
}

// ---------- Indicator math ----------
type CandleRow = { time: string; open: number; high: number; low: number; close: number; volume?: number };

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

export function CandlestickChart(props: { symbol: string; exchange: string; onCrossoverChange?: (crossover: MovingAverageCrossover | null, interval: ChartInterval) => void }) {
  const { symbol, exchange, onCrossoverChange } = props;
  const [interval, setInterval] = useState<ChartInterval>("1d");
  const [visible, setVisible] = useState({
    sma: true,
    ema: true,
    levels: true,
    volume: true,
  });
  const stableKey = useMemo(() => `${exchange}:${symbol}:${interval}`, [exchange, symbol, interval]);
  const candlesQuery = trpc.market.candles.useQuery(
    { symbol, exchange, interval: interval as "60m" | "1d" | "1wk" | "1mo", range: intervalToRange(interval) },
    { refetchOnWindowFocus: true, refetchInterval: 60_000, enabled: Boolean(symbol) && Boolean(exchange) },
  );
  const latestCrossover = useMemo(
    () => findLatestSmaCrossover(candlesQuery.data?.candles ?? []),
    [candlesQuery.data?.candles],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlaysRef = useRef<OverlaySeries | null>(null);
  const [hasVolume, setHasVolume] = useState(false);

  useEffect(() => {
    onCrossoverChange?.(latestCrossover, interval);
  }, [interval, latestCrossover, onCrossoverChange]);

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
    };
  }, []);

  // Re-apply visibility whenever toggles or data change
  useEffect(() => {
    const data = candlesQuery.data?.candles;
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
    const levels = findLevels(
      data.map(d => ({ time: String(d.time), open: d.open, high: d.high, low: d.low, close: d.close })),
      lookback,
    );
    const supportPoints = data.map(c => ({ time: c.time as Time, value: levels.support }));
    const resistancePoints = data.map(c => ({ time: c.time as Time, value: levels.resistance }));
    apply(overlays.support, visible.levels, supportPoints);
    apply(overlays.resistance, visible.levels, resistancePoints);

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
  }, [stableKey, candlesQuery.data, visible]);

  const toggle = (key: keyof typeof visible) => setVisible(v => ({ ...v, [key]: !v[key] }));

  return (
    <Card className="bg-white/[0.02]">
      <CardContent className="pt-4 sm:pt-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs font-semibold tracking-[0.13em] text-primary">PRICE HISTORY</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
            <div className="grid grid-cols-5 gap-1 rounded-lg border border-white/[0.08] bg-black/25 p-0.5 sm:flex sm:items-center">
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
                {candlesQuery.data.candles.length} شمعة · {candlesQuery.data.interval} ·{" "}
                {candlesQuery.data.exchangeName}
              </span>
              {visible.sma && <span className="font-mono text-amber-400/80">━ SMA 20 ━ SMA 50</span>}
              {visible.ema && <span className="font-mono text-sky-400/80">╌ EMA 12 ┅ EMA 26</span>}
              {visible.levels && (
                <>
                  <span className="font-mono text-green-500/80">┅ دعم (أدنى قاع)</span>
                  <span className="font-mono text-red-400/80">┅ مقاومة (أعلى قمة)</span>
                </>
              )}
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
      </CardContent>
    </Card>
  );
}
