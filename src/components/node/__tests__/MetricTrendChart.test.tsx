// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MetricTrendChart } from "@/components/node/MetricTrendChart";

/**
 * 弹窗是挂在页面上的：采样点从 1 个长到 2 个时，图表要自己量到宽度把曲线画出来，
 * 而不是等用户关掉再点开（重开时组件重新挂载、宽度才量得上）。这里复现这条时序。
 */
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const RECT = {
  width: 400,
  height: 200,
  top: 0,
  left: 0,
  right: 400,
  bottom: 200,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 没有布局引擎：给容器一个固定宽度，模拟弹窗里量到的 400px。
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(RECT);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

function render(points: ReadonlyArray<{ t: number; v: number }>) {
  act(() => {
    root!.render(<MetricTrendChart metric="cpu" points={points} />);
  });
}

describe("MetricTrendChart", () => {
  it("只有 1 个采样点时给采集说明", () => {
    render([{ t: 0, v: 20 }]);
    expect(container!.textContent).toContain("趋势正在采集");
    expect(container!.querySelector("svg")).toBeNull();
  });

  it("采样点攒到 2 个时立刻画出曲线，不必关掉重开", () => {
    render([{ t: 0, v: 20 }]);
    render([
      { t: 0, v: 20 },
      { t: 5_000, v: 32 },
    ]);

    expect(container!.textContent).not.toContain("趋势正在采集");
    const svg = container!.querySelector("svg");
    expect(svg).not.toBeNull();
    // 曲线本身也在：面积路径之外还有一条折线。
    expect(container!.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
  });
});
