import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { t } from "@/i18n";
import type { ChartTooltipState } from "./chartShared";

export function ChartTooltip({ tooltip }: { tooltip: ChartTooltipState }) {
  if (!tooltip.show) return null;
  return (
    <div
      aria-hidden="true"
      className="instance-chart-tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      <div className="instance-chart-tooltip-time">{tooltip.time}</div>
      {tooltip.rows.map((row, index) => (
        <div key={`${index}-${row.label}`} className="instance-chart-tooltip-row">
          <span
            aria-hidden="true"
            className="instance-chart-tooltip-dot"
            style={{ background: row.color }}
          />
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SwitchToggle({
  label,
  active,
  onToggle,
  title,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="instance-toggle-button instance-switch-button"
      data-active={active ? "true" : "false"}
      onClick={onToggle}
      aria-pressed={active}
      title={title}
    >
      {/* 开关本身就表示开 / 关，不再另写「开启 / 关闭」，标题行右侧一组控件才排得进一行；读屏靠 aria-pressed。 */}
      <span className="instance-switch-copy">{label}</span>
      <span className="instance-switch-track" aria-hidden>
        <span className="instance-switch-thumb" />
      </span>
    </button>
  );
}

/**
 * 图表面板里的拖拽手柄（和首页的分栏手柄同一套交互）：指针拖动改数值、方向键微调、单击恢复默认。
 * `orientation="x"` 是竖条手柄，左右拖调宽度；`"y"` 是横条手柄，上下拖调高度。
 * `invert` 给「手柄放在被调内容上方」的场景用：往上拖才是变大（图表高度手柄就挂在图表上方）。
 * 平时几乎看不见，只在 hover / 拖拽 / 键盘聚焦时显形。
 */
export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  step = 8,
  resetValue,
  onChange,
  label,
  invert = false,
}: {
  orientation: "x" | "y";
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 数值归零 = 回到自适应默认值。 */
  resetValue: number;
  onChange: (next: number) => void;
  label: string;
  invert?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ pointer: 0, value });

  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const axisOf = (event: ReactPointerEvent<HTMLButtonElement>) =>
    orientation === "x" ? event.clientX : event.clientY;

  const stopDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    document.body.classList.remove("is-resizing-chart");
  };

  return (
    <button
      type="button"
      className={`instance-resize-handle is-${orientation}${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation={orientation === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      title={`${label} · ${t("拖动调整，单击恢复默认")}`}
      onPointerDown={(event) => {
        event.preventDefault();
        startRef.current = { pointer: axisOf(event), value };
        movedRef.current = false;
        draggingRef.current = true;
        setDragging(true);
        document.body.classList.add("is-resizing-chart");
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // 合成事件 / 不支持指针捕获时忽略，拖动仍靠 pointermove 跟踪
        }
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        const delta = (axisOf(event) - startRef.current.pointer) * (invert ? -1 : 1);
        if (Math.abs(delta) > 3) movedRef.current = true;
        onChange(clamp(startRef.current.value + delta));
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        setDragging(false);
        document.body.classList.remove("is-resizing-chart");
      }}
      onClick={() => {
        // 拖过一次不算单击：避免松手时顺带把尺寸重置掉
        if (movedRef.current) {
          movedRef.current = false;
          return;
        }
        onChange(resetValue);
      }}
      onKeyDown={(event) => {
        // 手柄在内容上方时，方向键也要反过来：↑ 变大、↓ 变小
        const decreaseKey = orientation === "x" ? "ArrowLeft" : invert ? "ArrowDown" : "ArrowUp";
        const increaseKey = orientation === "x" ? "ArrowRight" : invert ? "ArrowUp" : "ArrowDown";
        if (event.key === decreaseKey) {
          event.preventDefault();
          onChange(clamp(value - step));
        } else if (event.key === increaseKey) {
          event.preventDefault();
          onChange(clamp(value + step));
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(resetValue);
        }
      }}
    >
      <span className="instance-resize-grip" aria-hidden="true" />
    </button>
  );
}
