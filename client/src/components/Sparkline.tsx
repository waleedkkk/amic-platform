type SparklineDirection = "up" | "down" | "flat";

export type SparklineGeometry = {
  points: string;
  direction: SparklineDirection;
};

const WIDTH = 128;
const HEIGHT = 48;
const PADDING = 4;

function formatCoordinate(value: number) {
  return Number(value.toFixed(2));
}

export function getSparklineGeometry(values: readonly number[]): SparklineGeometry | null {
  const validValues = values.filter(Number.isFinite);
  if (validValues.length < 2) return null;

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const span = max - min;
  const drawableWidth = WIDTH - PADDING * 2;
  const drawableHeight = HEIGHT - PADDING * 2;
  const points = validValues.map((value, index) => {
    const x = PADDING + (drawableWidth * index) / (validValues.length - 1);
    const y = span === 0
      ? HEIGHT / 2
      : PADDING + ((max - value) / span) * drawableHeight;
    return `${formatCoordinate(x)},${formatCoordinate(y)}`;
  }).join(" ");
  const first = validValues[0];
  const last = validValues.at(-1)!;

  return {
    points,
    direction: last > first ? "up" : last < first ? "down" : "flat",
  };
}

export function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  const geometry = getSparklineGeometry(values);
  if (!geometry) {
    return <div className="h-12 w-28 rounded-md border border-dashed border-white/[0.10] sm:h-14 sm:w-32" aria-label={`لا تتوفر بيانات حركة اليوم لـ ${label}`} />;
  }

  const tone = geometry.direction === "up"
    ? "text-emerald-300"
    : geometry.direction === "down"
      ? "text-rose-300"
      : "text-muted-foreground";
  const description = geometry.direction === "up"
    ? "صاعد"
    : geometry.direction === "down"
      ? "هابط"
      : "مستقر";

  return <svg
    className={`h-12 w-28 shrink-0 overflow-visible sm:h-14 sm:w-32 ${tone}`}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    preserveAspectRatio="none"
    role="img"
    aria-label={`اتجاه سعر ${label} خلال اليوم: ${description}`}
  >
    <polyline
      points={geometry.points}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>;
}
