import { describe, expect, it } from "vitest";
import {
  buildTrendChart,
  niceBinaryCeiling,
  niceCeiling,
  pickTrendIndex,
} from "@/components/node/metricTrendGeometry";

const GB = 1024 ** 3;

describe("niceCeiling", () => {
  it("把上限收到 1 / 2 / 2.5 / 5 的整数档", () => {
    expect(niceCeiling(42)).toBe(50);
    expect(niceCeiling(3)).toBe(5);
    expect(niceCeiling(1200)).toBe(2000);
  });

  it("不超过 max，也不低于 min", () => {
    expect(niceCeiling(98, { min: 10, max: 100 })).toBe(100);
    expect(niceCeiling(0.2, { min: 10 })).toBe(10);
    expect(niceCeiling(0)).toBe(1);
  });
});

describe("niceBinaryCeiling", () => {
  it("字节上限落在 1024 进制的整值上", () => {
    expect(niceBinaryCeiling(1.2 * GB)).toBe(2 * GB);
    expect(niceBinaryCeiling(7 * GB)).toBe(8 * GB);
    expect(niceBinaryCeiling(9.1 * GB)).toBe(10 * GB);
  });

  it("零或非法值给一个 1 MiB 的兜底上限", () => {
    expect(niceBinaryCeiling(0)).toBe(1024 * 1024);
    expect(niceBinaryCeiling(Number.NaN)).toBe(1024 * 1024);
  });
});

describe("buildTrendChart", () => {
  const points = [
    { t: 0, v: 0 },
    { t: 60_000, v: 50 },
    { t: 120_000, v: 25 },
  ];

  it("按时间摊开：末点贴右边缘，首点贴左边缘", () => {
    const chart = buildTrendChart(points, { width: 400, height: 200, yMax: 100 })!;
    expect(chart.points[0]!.x).toBeCloseTo(chart.left);
    expect(chart.points[2]!.x).toBeCloseTo(chart.right);
  });

  it("Y 轴从 0 起：读数 0 落在底边、上限落在顶边", () => {
    const chart = buildTrendChart(points, { width: 400, height: 200, yMax: 100 })!;
    expect(chart.points[0]!.y).toBeCloseTo(chart.bottom);
    expect(chart.yTicks.map((tick) => tick.value)).toEqual([0, 50, 100]);
  });

  it("面积从曲线闭合到底边", () => {
    const chart = buildTrendChart(points, { width: 400, height: 200, yMax: 100 })!;
    expect(chart.line.startsWith("M")).toBe(true);
    expect(chart.area.endsWith("Z")).toBe(true);
  });

  it("尺寸不足或没有点时不画", () => {
    expect(buildTrendChart(points, { width: 0, height: 200, yMax: 100 })).toBeNull();
    expect(buildTrendChart([], { width: 400, height: 200, yMax: 100 })).toBeNull();
  });

  it("只有一个点时钉在右端，不出现除零", () => {
    const chart = buildTrendChart([{ t: 5000, v: 10 }], { width: 400, height: 200, yMax: 20 })!;
    expect(chart.points[0]!.x).toBeCloseTo(chart.right);
    expect(chart.area).toBe("");
  });

  it("超出上限的读数被夹到顶边", () => {
    const chart = buildTrendChart([{ t: 0, v: 500 }], { width: 400, height: 200, yMax: 100 })!;
    expect(chart.points[0]!.y).toBeCloseTo(chart.top);
  });
});

describe("pickTrendIndex", () => {
  const chart = buildTrendChart(
    [
      { t: 0, v: 10 },
      { t: 60_000, v: 20 },
      { t: 120_000, v: 30 },
    ],
    { width: 400, height: 200, yMax: 40 },
  )!;

  it("取最近的采样点", () => {
    expect(pickTrendIndex(chart, chart.points[0]!.x + 2)).toBe(0);
    expect(pickTrendIndex(chart, chart.points[1]!.x + 3)).toBe(1);
  });

  it("越界夹到两端", () => {
    expect(pickTrendIndex(chart, -100)).toBe(0);
    expect(pickTrendIndex(chart, 9999)).toBe(2);
  });
});