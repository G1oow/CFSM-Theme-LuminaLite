/**
 * 指标放大图（趋势面积图）的几何计算。
 *
 * 和 `sparklineGeometry` 分开：迷你曲线是等距格子、没有坐标轴；放大图要按真实时间摊开、
 * 带 Y 刻度和时间刻度，还要把指针位置换算回最近的采样点。
 */

export interface TrendChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 左侧留出 Y 刻度文字的位置，底部留出时间刻度的位置。 */
export const TREND_CHART_PADDING: TrendChartPadding = {
  top: 12,
  right: 16,
  bottom: 22,
  left: 52,
};

/** 低于这个尺寸就不画：宽高来自 ResizeObserver，首帧是 0。 */
const MIN_CHART_WIDTH = 120;
const MIN_CHART_HEIGHT = 80;

export interface TrendChartPoint {
  x: number;
  y: number;
  t: number;
  v: number;
}

export interface TrendChartGeometry {
  width: number;
  height: number;
  /** 绘图区（不含刻度文字）的四边坐标。 */
  left: number;
  right: number;
  top: number;
  bottom: number;
  line: string;
  area: string;
  points: TrendChartPoint[];
  yTicks: Array<{ y: number; value: number }>;
  xTicks: Array<{ x: number; time: number }>;
}

/**
 * 把上限收到 1 / 2 / 2.5 / 5 × 10^k 上，刻度才是整数（`0 / 25 / 50 / 75 / 100`）。
 * 永远不低于 `min`（百分比指标传 10，免得零点几的读数被拉满整幅）。
 */
export function niceCeiling(value: number, options: { min?: number; max?: number } = {}): number {
  const min = options.min ?? 1;
  if (!Number.isFinite(value) || value <= 0) return min;
  let ceiling = min;
  const steps = [1, 2, 2.5, 5, 10];
  for (let exponent = 0; exponent < 12; exponent += 1) {
    const base = 10 ** exponent;
    for (const step of steps) {
      const candidate = step * base;
      if (candidate >= value) {
        ceiling = candidate;
        break;
      }
    }
    if (ceiling >= value) break;
  }
  const result = Math.max(min, ceiling);
  return options.max != null ? Math.min(result, options.max) : result;
}
/**
 * 字节读数的上限：按 1024 进制收到 1 / 2 / 2.5 / 4 / 5 / 8 / 10 × 1 KiB / MiB / GiB … 上，
 * Y 轴刻度才落在「8 GB / 10 GB」这种整值上，而不是 2.33 GB。
 */
export function niceBinaryCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1024 * 1024;
  const steps = [1, 2, 2.5, 4, 5, 8, 10, 16, 32, 64, 128, 256, 512, 1024];
  let unit = 1;
  while (unit * 1024 <= value) unit *= 1024;
  for (const step of steps) {
    const candidate = step * unit;
    if (candidate >= value) return candidate;
  }
  return 1024 * unit;
}


/** 指针位置换算成最近的采样点下标；越界夹到两端，没有点返回 -1。 */
export function pickTrendIndex(
  geometry: TrendChartGeometry,
  x: number,
): number {
  const { points } = geometry;
  if (points.length === 0) return -1;
  if (x <= points[0]!.x) return 0;
  const last = points[points.length - 1]!;
  if (x >= last.x) return points.length - 1;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const distance = Math.abs(points[i]!.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * 把 (时间, 读数) 序列换算成绘图坐标。
 *
 * - 时间轴按真实时间摊开：采样间隔抖动时曲线的疏密也随之变化；
 * - Y 轴恒从 0 起（`yMax` 由调用方用 {@link niceCeiling} 算好），读数变化幅度不会被夸大；
 * - 不足两个点也画：一个点时曲线退化成一个点、面积高度为 0，调用方另给文案。
 */
export function buildTrendChart(
  points: readonly { t: number; v: number }[],
  options: {
    width: number;
    height: number;
    yMax: number;
    padding?: Partial<TrendChartPadding>;
    /** 时间轴范围，默认取首末样本。 */
    tMin?: number;
    tMax?: number;
    yTickCount?: number;
    xTickCount?: number;
  },
): TrendChartGeometry | null {
  const { width, height } = options;
  if (!(width >= MIN_CHART_WIDTH) || !(height >= MIN_CHART_HEIGHT)) return null;
  if (points.length === 0) return null;

  const padding = { ...TREND_CHART_PADDING, ...options.padding };
  const left = padding.left;
  const right = Math.max(left + 1, width - padding.right);
  const top = padding.top;
  const bottom = Math.max(top + 1, height - padding.bottom);
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const yMax = options.yMax > 0 && Number.isFinite(options.yMax) ? options.yMax : 1;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const tMin = options.tMin ?? first.t;
  const tMaxRaw = options.tMax ?? last.t;
  // 单个点（或时间全相同）没有跨度：把它钉在右端，和「最新读数在右边」一致。
  const tMax = tMaxRaw > tMin ? tMaxRaw : tMin;
  const timeSpan = tMax - tMin;

  const xFor = (t: number) =>
    timeSpan > 0 ? left + ((Math.min(tMax, Math.max(tMin, t)) - tMin) / timeSpan) * plotWidth : right;
  const yFor = (v: number) =>
    bottom - (Math.min(yMax, Math.max(0, v)) / yMax) * plotHeight;

  const chartPoints: TrendChartPoint[] = points.map((point) => ({
    x: xFor(point.t),
    y: yFor(point.v),
    t: point.t,
    v: point.v,
  }));

  let line = "";
  for (let i = 0; i < chartPoints.length; i += 1) {
    const point = chartPoints[i]!;
    line += `${i === 0 ? "M" : " L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }
  const head = chartPoints[0]!;
  const tail = chartPoints[chartPoints.length - 1]!;
  const area =
    chartPoints.length > 1
      ? `${line} L${tail.x.toFixed(2)} ${bottom.toFixed(2)} L${head.x.toFixed(2)} ${bottom.toFixed(2)} Z`
      : "";

  const yTickCount = Math.max(2, options.yTickCount ?? 3);
  const yTicks: Array<{ y: number; value: number }> = [];
  for (let i = 0; i < yTickCount; i += 1) {
    const ratio = i / (yTickCount - 1);
    yTicks.push({ y: bottom - ratio * plotHeight, value: yMax * ratio });
  }

  const xTickCount = Math.max(2, options.xTickCount ?? 3);
  const xTicks: Array<{ x: number; time: number }> = [];
  for (let i = 0; i < xTickCount; i += 1) {
    const ratio = i / (xTickCount - 1);
    xTicks.push({
      x: left + ratio * plotWidth,
      time: timeSpan > 0 ? tMin + ratio * timeSpan : last.t,
    });
  }

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    line,
    area,
    points: chartPoints,
    yTicks,
    xTicks,
  };
}