import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  CandlestickSeries,
  createChart,
  CrosshairMode,
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

export function CandlestickChart(props: { symbol: string; exchange: string }) {
  const { symbol, exchange } = props;
  const [interval, setInterval] = useState<ChartInterval>("1d");
  const stableKey = useMemo(() => `${exchange}:${symbol}:${interval}`, [exchange, symbol, interval]);
  const candlesQuery = trpc.market.candles.useQuery(
    { symbol, exchange, interval: interval as "60m" | "1d" | "1wk" | "1mo", range: intervalToRange(interval) },
    { refetchOnWindowFocus: false, enabled: Boolean(symbol) && Boolean(exchange) },
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
    const line = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;
    candleSeriesRef.current = candles;
    lineSeriesRef.current = line;
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
      lineSeriesRef.current = null;
    };
  }, []);

  // Update data whenever the query or interval changes
  useEffect(() => {
    const data = candlesQuery.data?.candles;
    const candlesSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    const chart = chartRef.current;
    if (!data || !data.length || !candlesSeries || !lineSeries || !chart) return;
    const seriesData = data.map(candle => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    const lineData = data.map(candle => ({ time: candle.time as Time, value: candle.close }));
    candlesSeries.setData(seriesData);
    lineSeries.setData(lineData);
    chart.timeScale().fitContent();
  }, [stableKey, candlesQuery.data]);

  return (
    <Card className="bg-white/[0.02]">
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-[0.13em] text-primary">PRICE HISTORY</p>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/25 p-0.5">
            {candleIntervals.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setInterval(item)}
                className={`rounded-md px-2.5 py-1 text-xs font-mono transition-colors duration-150 ${interval === item ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {displayLabel[item] ?? item}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-[220px]">
          <div ref={containerRef} className="h-[380px] w-full" />
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
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {candlesQuery.data ? (
            <>
              <span className="font-mono">
                {candlesQuery.data.candles.length} شمعة · {candlesQuery.data.interval} ·{" "}
                {candlesQuery.data.exchangeName}
              </span>
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
