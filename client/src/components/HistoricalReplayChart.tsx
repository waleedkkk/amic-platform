import { CandlestickSeries, createChart, CrosshairMode, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { LiveChartCandle } from "@shared/chartLive";

export function HistoricalReplayChart({ candles }: { candles: LiveChartCandle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const chart = createChart(element, { width: element.clientWidth, height: 360, layout: { background: { color: "#050910" }, textColor: "#8da2b5", fontFamily: "'IBM Plex Mono', monospace" }, grid: { vertLines: { color: "rgba(141,162,181,0.06)" }, horzLines: { color: "rgba(141,162,181,0.06)" } }, crosshair: { mode: CrosshairMode.Normal }, timeScale: { timeVisible: true, borderColor: "rgba(141,162,181,0.12)" }, rightPriceScale: { borderColor: "rgba(141,162,181,0.12)" } });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#32d583", downColor: "#f97066", borderVisible: false, wickUpColor: "#32d583", wickDownColor: "#f97066" });
    chartRef.current = chart; seriesRef.current = series;
    const observer = new ResizeObserver(entries => chart.applyOptions({ width: entries[0]?.contentRect.width ?? element.clientWidth }));
    observer.observe(element);
    return () => { observer.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);
  useEffect(() => { seriesRef.current?.setData(candles.map(candle => ({ time: candle.time as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }))); chartRef.current?.timeScale().fitContent(); }, [candles]);
  return <div ref={containerRef} className="mt-4 h-[360px] w-full" aria-label="مخطط إعادة التشغيل التاريخي" />;
}
