import { useCallback, useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";

export interface SpotlightCardProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  /** 光斑半径（px）。 */
  radius?: number;
}

/**
 * 指针跟随的柔光卡片。
 *
 * 光斑画在独立的覆盖层上，坐标直接写进 DOM 的 CSS 变量、不触发 React 重渲染；
 * 只切换这一层的 opacity，卡片内容（图标、文字）不参与重绘。
 */
export function SpotlightCard({
  children,
  className = "",
  radius = 420,
  style,
  ...rest
}: SpotlightCardProps) {
  const glowRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const glow = glowRef.current;
    if (!glow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    glow.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    glow.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  }, []);

  const setOpacity = (value: string) => {
    glowRef.current?.style.setProperty("--spotlight-opacity", value);
  };

  return (
    <div
      className={`mao-spotlight${className ? ` ${className}` : ""}`}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setOpacity("1")}
      onPointerLeave={() => setOpacity("0")}
      style={style}
      {...rest}
    >
      <div
        ref={glowRef}
        aria-hidden="true"
        className="mao-spotlight-layer"
        style={{ "--spotlight-radius": `${radius}px` } as CSSProperties}
      />
      {children}
    </div>
  );
}
