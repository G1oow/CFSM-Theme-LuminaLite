import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { formatClockTime } from "@/utils/format";
import { formatMetricAxisValue, formatMetricValue, type MetricDetailKey } from "@/utils/metricDetail";
import { t } from "@/i18n";
import {
  buildTrendChart,
  niceBinaryCeiling,
  niceCeiling,
  pickTrendIndex,
  type TrendChartGeometry,
} from "./metricTrendGeometry";

/** 绘图区高度：再高首屏就装不下明细列表了。 */
const CHART_HEIGHT = 176;
/** 百分比指标的 Y 轴上限：读数再高也不会超过 100，但也不能让 0.6% 铺满整幅。 */
const PERCENT_MIN_CEILING = 10;

export interface MetricTrendChartProps {
  metric: MetricDetailKey;
  points: ReadonlyArray<{ t: number; v: number }>;
}

/**
 * 时间刻度：窗口不到 5 分钟时带上秒，否则三个刻度会挤成同一个「17:05」。
 */
function tickLabel(timeMs: number, withSeconds: boolean): string {
  if (!withSeconds) return formatClockTime(timeMs);
  const date = new Date(timeMs);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/**
 * 放大视图里的趋势面积图。
 *
 * 时间轴按真实采样时间摊开，Y 轴恒从 0 起；指针移到哪一格就报哪一次的读数与时刻。
 * 读数太少（刚打开页面）时不硬画一根平线，直接给一句说明。
 */
export function MetricTrendChart({ metric, points }: MetricTrendChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gradientId = useId();
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 曲线要两个点才画，在那之前包装层根本不渲染，挂载时 ref 还是空的、量不到宽度。
  // 所以测量跟着「有没有画布」重跑：采样攒到第二个点时再量一次，否则宽度会一直是 0，
  // 弹窗里只剩一个空框，要关掉重开（此时已有两个点）才画得出来。
  const hasCanvas = points.length > 1;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (next: number) => setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    apply(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasCanvas]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const point of points) {
      if (point.v > max) max = point.v;
    }
    // 留一点顶部余量，峰值不会贴着上边框；字节读数的上限落在 1/2/2.5/5 GB 这类整值上。
    if (metric === "cpu") return niceCeiling(max * 1.15, { min: PERCENT_MIN_CEILING, max: 100 });
    if (metric === "ram" || metric === "disk") return niceBinaryCeiling(max * 1.08);
    return niceCeiling(max * 1.15);
  }, [metric, points]);

  const geometry: TrendChartGeometry | null = useMemo(
    () => buildTrendChart(points, { width, height: CHART_HEIGHT, yMax, yTickCount: 3, xTickCount: 3 }),
    [points, width, yMax],
  );

  const hover =
    geometry && hoverIndex != null ? geometry.points[hoverIndex] : undefined;
  const hoverText = hover ? formatMetricValue(metric, hover.v) : null;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = pickTrendIndex(geometry, event.clientX - rect.left);
    setHoverIndex(index >= 0 ? index : null);
  };

  if (!hasCanvas) {
    return (
      <div className="mao-detail-chart is-empty">
        <span>{t("趋势正在采集，页面打开后每 5 秒记一个点")}</span>
      </div>
    );
  }

  const tooltipLeft = hover && geometry
    ? Math.min(Math.max(hover.x, 56), Math.max(56, geometry.width - 56))
    : 0;

  // 刚打开页面时缓冲里只有几十秒，刻度要精确到秒才看得出三个刻度的差别。
  const withSeconds =
    hasCanvas && points[points.length - 1]!.t - points[0]!.t < 5 * 60_000;

  return (
    <div
      ref={wrapRef}
      className="mao-detail-chart"
      data-metric={metric}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverIndex(null)}
    >
      {geometry && (
        <svg
          className="mao-detail-chart-svg"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          width={geometry.width}
          height={geometry.height}
          role="img"
          aria-label={t("最近 30 分钟读数趋势")}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--detail-chart-fill-top)" />
            </linearGradient>
          </defs>

          {geometry.yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
              <line
                className="mao-detail-chart-grid"
                x1={geometry.left}
                y1={tick.y}
                x2={geometry.right}
                y2={tick.y}
              />
              <text
                className="mao-detail-chart-tick"
                x={geometry.left - 8}
                y={tick.y + 3}
                textAnchor="end"
              >
                {formatMetricAxisValue(metric, tick.value)}
              </text>
            </g>
          ))}

          {geometry.xTicks.map((tick, index) => (
            <text
              key={`x-${tick.time}`}
              className="mao-detail-chart-tick"
              x={tick.x}
              y={geometry.height - 6}
              textAnchor={
                index === 0 ? "start" : index === geometry.xTicks.length - 1 ? "end" : "middle"
              }
            >
              {tickLabel(tick.time, withSeconds)}
            </text>
          ))}

          {geometry.area && <path d={geometry.area} fill={`url(#${gradientId})`} stroke="none" />}
          <path className="mao-detail-chart-line" d={geometry.line} fill="none" />

          {hover && (
            <g>
              <line
                className="mao-detail-chart-cursor"
                x1={hover.x}
                y1={geometry.top}
                x2={hover.x}
                y2={geometry.bottom}
              />
              <circle className="mao-detail-chart-dot" cx={hover.x} cy={hover.y} r={3.5} />
            </g>
          )}
        </svg>
      )}

      {hover && hoverText && (
        <div className="mao-detail-chart-tip" style={{ left: tooltipLeft, top: hover.y }}>
          <b>
            {hoverText.value}
            {hoverText.unit && <em> {hoverText.unit}</em>}
          </b>
          <span>{tickLabel(hover.t, withSeconds)}</span>
        </div>
      )}
    </div>
  );
}