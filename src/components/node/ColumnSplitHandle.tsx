import { useCallback, useRef, useState } from "react";
import { t } from "@/i18n";

const STORAGE_KEY = "cfsmtheme:home-split-ratio";
export const SPLIT_MIN = 32;
export const SPLIT_MAX = 68;
export const SPLIT_DEFAULT = 45;
const STEP = 2;

function clampRatio(value: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value)));
}

function readStoredRatio(): number {
  if (typeof window === "undefined") return SPLIT_DEFAULT;
  try {
    const raw = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? clampRatio(raw) : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** 首页左右两栏的分栏比例（左栏百分比），跟着本机保存。 */
export function useColumnSplitRatio(): [number, (next: number) => void] {
  const [ratio, setRatio] = useState(readStoredRatio);

  const update = useCallback((next: number) => {
    const clamped = clampRatio(next);
    setRatio(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // 隐私模式下写不进去，本次会话仍生效
    }
  }, []);

  return [ratio, update];
}

/**
 * 左右两栏之间的拖拽手柄：指针拖动改比例，方向键微调，双击恢复默认。
 * 视觉上刻意做得很淡，只在 hover / 拖拽 / 键盘聚焦时显形。
 */
export function ColumnSplitHandle({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);

  const applyPointerX = (clientX: number) => {
    const container = rootRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    onChange(((clientX - rect.left) / rect.width) * 100);
  };

  const stopDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    document.body.classList.remove("is-resizing-columns");
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <button
      ref={rootRef}
      type="button"
      className={`mao-column-split${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t("拖拽调整左右两栏宽度")}
      aria-valuenow={Math.round(value)}
      aria-valuemin={SPLIT_MIN}
      aria-valuemax={SPLIT_MAX}
      title={t("拖拽调整左右两栏宽度（单击恢复默认）")}
      onPointerDown={(event) => {
        event.preventDefault();
        startXRef.current = event.clientX;
        movedRef.current = false;
        draggingRef.current = true;
        setDragging(true);
        document.body.classList.add("is-resizing-columns");
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // 合成事件 / 不支持指针捕获时忽略，拖动仍靠 pointermove 跟踪
        }
        applyPointerX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        if (Math.abs(event.clientX - startXRef.current) > 3) movedRef.current = true;
        applyPointerX(event.clientX);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        setDragging(false);
        document.body.classList.remove("is-resizing-columns");
      }}
      onClick={() => {
        // 拖过一次不算单击：避免松手时顺带把比例重置掉
        if (movedRef.current) {
          movedRef.current = false;
          return;
        }
        onChange(SPLIT_DEFAULT);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(value - STEP);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(value + STEP);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(SPLIT_DEFAULT);
        }
      }}
    >
      <span className="mao-column-split-grip" aria-hidden="true" />
    </button>
  );
}
