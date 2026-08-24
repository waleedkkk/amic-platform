import type { BinanceCvdPoint } from "@/lib/binanceOrderFlowEngine";
import { Activity, BarChart3 } from "lucide-react";

type BinanceCvdLiveChartProps = {
  points: BinanceCvdPoint[];
  symbol: string;
  depthLevels: number;
  largeTradeMinNotional: number;
};

const WIDTH = 840;
const HEIGHT = 190;
const H_PADDING = 14;
const CVD_TOP = 16;
const CVD_HEIGHT = 103;
const DELTA_TOP = 137;
const DELTA_HEIGHT = 34;

function numberLabel(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, notation: "compact" }).format(value);
}

export function BinanceCvdLiveChart({ points, symbol, depthLevels, largeTradeMinNotional }: BinanceCvdLiveChartProps) {
  if (!points.length) {
    return <div className="mt-4 flex min-h-44 items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-black/10 px-5 text-center text-sm text-muted-foreground"><BarChart3 className="ml-2 size-4 text-primary" />بانتظار صفقات Binance الأولى لبناء سلسلة CVD الحية…</div>;
  }

  const cvdMin = Math.min(0, ...points.map(point => point.cvd));
  const cvdMax = Math.max(0, ...points.map(point => point.cvd));
  const cvdRange = Math.max(cvdMax - cvdMin, 0.000_001);
  const deltaMax = Math.max(0.000_001, ...points.map(point => Math.abs(point.delta)));
  const xFor = (index: number) => H_PADDING + (points.length === 1 ? 0 : index * ((WIDTH - H_PADDING * 2) / (points.length - 1)));
  const yForCvd = (value: number) => CVD_TOP + ((cvdMax - value) / cvdRange) * CVD_HEIGHT;
  const zeroY = yForCvd(0);
  const deltaZero = DELTA_TOP + DELTA_HEIGHT / 2;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(2)},${yForCvd(point.cvd).toFixed(2)}`).join(" ");

  return <section className="mt-4 overflow-hidden rounded-xl border border-primary/20 bg-black/20" aria-label={`مخطط CVD تقديري للرمز ${symbol}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-primary" />CVD تقديري حي · Binance Spot</p><p className="mt-1 text-xs text-muted-foreground">آخر 5 دقائق · عمق مرافِق {depthLevels} مستويات · علامة كبيرة ≥ {numberLabel(largeTradeMinNotional)} USDT</p></div><span className="rounded-full bg-primary/[0.1] px-2.5 py-1 font-mono text-xs text-primary">{points.length} نقطة</span></div>
    <div className="relative px-2 py-2"><svg className="h-48 w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="خط CVD وأعمدة فرق الحجم اللحظية"><defs><linearGradient id="cvd-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs><line x1={H_PADDING} x2={WIDTH - H_PADDING} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 5" /><line x1={H_PADDING} x2={WIDTH - H_PADDING} y1={deltaZero} y2={deltaZero} stroke="rgba(255,255,255,0.15)" /><path d={`${path} L ${xFor(points.length - 1)},${CVD_TOP + CVD_HEIGHT} L ${xFor(0)},${CVD_TOP + CVD_HEIGHT} Z`} fill="url(#cvd-fill)" /><path d={path} fill="none" stroke="#2dd4bf" strokeWidth="2.3" vectorEffect="non-scaling-stroke" />{points.map((point, index) => { const x = xFor(index); const height = Math.max(1, (Math.abs(point.delta) / deltaMax) * (DELTA_HEIGHT / 2 - 2)); const y = point.delta >= 0 ? deltaZero - height : deltaZero; return <g key={`${point.time}-${index}`}><rect x={x - 1.2} y={y} width="2.4" height={height} fill={point.delta >= 0 ? "#34d399" : "#fb7185"} opacity="0.82" />{point.largeTradeCount ? <circle cx={x} cy={yForCvd(point.cvd)} r="4.2" fill={point.delta >= 0 ? "#fbbf24" : "#fb7185"} stroke="#071017" strokeWidth="1.5" /> : null}</g>; })}</svg><div className="pointer-events-none absolute inset-x-5 top-3 flex justify-between font-mono text-[10px] text-muted-foreground"><span>CVD {numberLabel(cvdMax)}</span><span>صفر</span><span>CVD {numberLabel(cvdMin)}</span></div></div>
    <p className="border-t border-white/[0.08] px-4 py-2 text-[11px] leading-5 text-muted-foreground">الخط يجمع فرق أحجام الصفقات المنفذة فقط. الأعمدة تمثل Delta زمنيًا، والدوائر تميّز صفقات تجاوزت حدك. القراءة تقديرية ولا تمثل إجمالي السوق أو توصية.</p>
  </section>;
}
