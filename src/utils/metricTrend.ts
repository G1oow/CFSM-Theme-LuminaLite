import type { MetricDetailKey } from "./metricDetail";

/**
 * 首页指标卡放大图的实时趋势缓冲。
 *
 * 集群级读数只有 WebSocket 推到的最新值（`getHomeNodeSummariesSnapshot`），历史接口是逐节点
 * 查 `/api/history/all`，首页为画一张图去查几十台节点会把后端 D1 读行翻几十倍 —— 和
 * `hooks/usePingOverview` 里那条约定一致，放大图的时间轴由前端自己累积：页面开多久就有多久。
 */

export interface MetricTrendSample {
  /** 采样时刻（毫秒时间戳）。 */
  t: number;
  /** 同一次采样里各指标的读数；缺测的指标不写键。 */
  values: Partial<Record<MetricDetailKey, number>>;
}

/** 采样间隔：一次推送约 4 秒，5 秒采一个点足够画出平滑曲线，也不会把缓冲撑大。 */
export const TREND_SAMPLE_INTERVAL_MS = 5_000;

/** 时间窗口：最多留 30 分钟。刷新页面后从零开始累积。 */
export const TREND_WINDOW_MS = 30 * 60_000;

/** 条数上限：采样间隔抖动（后台标签页节流）时别让数组无界长。 */
export const TREND_MAX_SAMPLES = Math.ceil(TREND_WINDOW_MS / TREND_SAMPLE_INTERVAL_MS) + 4;

/**
 * 追加一个采样点，并丢掉窗口外的老点。
 *
 * 返回原数组（同一个引用）表示这次没有任何变化：调用方据此避免无意义的重渲染。
 */
export function appendTrendSample(
  samples: readonly MetricTrendSample[],
  sample: MetricTrendSample,
  options: { windowMs?: number; maxSamples?: number } = {},
): readonly MetricTrendSample[] {
  const windowMs = options.windowMs ?? TREND_WINDOW_MS;
  const maxSamples = options.maxSamples ?? TREND_MAX_SAMPLES;
  const last = samples[samples.length - 1];
  // 同一毫秒重复采样（StrictMode 双跑 effect）直接吃掉，避免竖直重复点。
  if (last && sample.t <= last.t) return samples;

  const cutoff = sample.t - windowMs;
  const next: MetricTrendSample[] = [];
  for (const item of samples) {
    if (item.t >= cutoff) next.push(item);
  }
  next.push(sample);
  if (next.length > maxSamples) next.splice(0, next.length - maxSamples);
  return next;
}

/** 把缓冲摊成某个指标的 (时间, 读数) 序列；缺测的采样点跳过。 */
export function trendPointsFor(
  samples: readonly MetricTrendSample[],
  key: MetricDetailKey,
): Array<{ t: number; v: number }> {
  const points: Array<{ t: number; v: number }> = [];
  for (const sample of samples) {
    const value = sample.values[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      points.push({ t: sample.t, v: value });
    }
  }
  return points;
}

export interface TrendSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  /** 首末样本的时间跨度（毫秒）。只有一个点时是 0。 */
  spanMs: number;
  last: number;
}

/** 峰值 / 谷值 / 均值，给放大视图的读数条用。没有样本时返回 null。 */
export function summarizeTrend(
  points: readonly { t: number; v: number }[],
): TrendSummary | null {
  if (points.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const point of points) {
    if (point.v < min) min = point.v;
    if (point.v > max) max = point.v;
    sum += point.v;
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return {
    count: points.length,
    min,
    max,
    avg: sum / points.length,
    spanMs: Math.max(0, last.t - first.t),
    last: last.v,
  };
}
