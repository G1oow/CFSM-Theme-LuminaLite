import type { CSSProperties } from "react";

export function HealthBucketTooltip({
  text,
  index,
  count,
  fraction,
}: {
  text: string | null;
  index: number | null;
  count: number;
  /**
   * 该柱柱心占整条宽度的比例（0..1）。canvas 行两端有留白居中，按柱数均分算出来的位置
   * 会和实际柱心错开几个像素，所以优先用它；拿不到才退回均分。
   */
  fraction?: number | null;
}) {
  if (!text || index == null || count <= 0) return null;

  const ratio =
    fraction != null && Number.isFinite(fraction) ? fraction : (index + 0.5) / count;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const style = {
    "--node-health-tooltip-x": `${pct.toFixed(2)}%`,
    "--node-health-tooltip-align": `${pct.toFixed(2)}%`,
    "--node-health-arrow-x": `clamp(12px, ${pct.toFixed(2)}%, calc(100% - 12px))`,
  } as CSSProperties;
  return (
    <span className="node-health-hover-tooltip" style={style} role="status">
      {text}
    </span>
  );
}
