import { useEffect, useId, useRef, useState } from "react";
import { buildSparkline } from "./sparklineGeometry";

/** 保留的实时读数个数：按数据推送节奏大约是最近一分钟。 */
const MAX_SAMPLES = 16;
/** 少数据时至少铺 4 格：有 3 个读数就能占半幅，不会缩成一个小疙瘩。 */
const MIN_SLOTS = 4;
const SPARK_HEIGHT = 24;
/** 卡面内容宽度到这个值才画图：再窄就只是一条噪声线。 */
const MIN_WIDTH = 150;

/**
 * 指标卡里的迷你面积图。
 *
 * 首页左栏的读数方阵会随分栏手柄变宽变窄：卡面够宽时在读数与说明之间铺一条平滑面积曲线，
 * 不够宽时整块收成 0 高（不占位），所以拖窄也不会把卡片撑出空白。
 */
export function MetricSparkline({ value }: { value: number }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gradientId = useId();
  const [samples, setSamples] = useState<number[]>([]);
  const [width, setWidth] = useState(0);

  // 首个读数先铺满一屏再继续追加：静态指标（连接数、硬盘）也能画出平线，
  // 四张卡不会有的有图有的没图；真实读数攒起来后，铺底的部分自然滚出去。
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    setSamples((prev) => {
      const base = prev.length === 0 ? new Array<number>(MIN_SLOTS).fill(value) : prev;
      const appended = [...base, value];
      return appended.length > MAX_SAMPLES ? appended.slice(appended.length - MAX_SAMPLES) : appended;
    });
  }, [value]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (next: number) =>
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    apply(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 点从左往右长：新读数接在右边，攒满一屏后老点从左边退出去。
  // 攒够 3 个点再画：两个点只是一根横线，看不出趋势
  const visible = width >= MIN_WIDTH && samples.length > 2;
  const geometry = visible
    ? buildSparkline(samples, {
      height: SPARK_HEIGHT,
      // 格子宽度按当前样本数摊满整幅，读数一多就自然变密
      slot: width / Math.max(samples.length, MIN_SLOTS),
      padTop: 4,
      bottomRoom: 0.28,
    })
    : null;

  return (
    <div
      ref={wrapRef}
      className="mao-stat-sparkline"
      data-visible={visible ? "true" : "false"}
      aria-hidden="true"
    >
      {geometry && geometry.lines.length > 0 && (
        <svg
          className="mao-stat-sparkline-svg"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          width={geometry.width}
          height={geometry.height}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--spark-fill-top)" />
              <stop offset="100%" stopColor="var(--spark-fill-bottom)" />
            </linearGradient>
          </defs>
          {geometry.areas.map((area, index) => (
            <path key={`area-${index}`} d={area} fill={`url(#${gradientId})`} stroke="none" />
          ))}
          {geometry.lines.map((line, index) => (
            <path
              key={`line-${index}`}
              d={line}
              fill="none"
              stroke="var(--spark-line)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
