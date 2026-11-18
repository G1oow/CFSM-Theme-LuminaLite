import { describe, expect, it } from "vitest";
import {
  appendTrendSample,
  summarizeTrend,
  trendPointsFor,
  type MetricTrendSample,
} from "@/utils/metricTrend";

const sample = (t: number, cpu: number, ram?: number): MetricTrendSample => ({
  t,
  values: ram === undefined ? { cpu } : { cpu, ram },
});

describe("appendTrendSample", () => {
  it("按时间追加采样点", () => {
    let samples = appendTrendSample([], sample(1000, 10));
    samples = appendTrendSample(samples, sample(2000, 20));
    expect(samples.map((item) => item.t)).toEqual([1000, 2000]);
  });

  it("同一时刻的重复采样直接丢掉，返回原引用", () => {
    const first = appendTrendSample([], sample(1000, 10));
    const second = appendTrendSample(first, sample(1000, 99));
    expect(second).toBe(first);
  });

  it("丢掉窗口外的老点", () => {
    let samples = appendTrendSample([], sample(0, 1), { windowMs: 1000 });
    samples = appendTrendSample(samples, sample(1500, 2), { windowMs: 1000 });
    expect(samples.map((item) => item.t)).toEqual([1500]);
  });

  it("条数超过上限时从最老的开始丢", () => {
    let samples: readonly MetricTrendSample[] = [];
    for (let i = 0; i < 6; i += 1) {
      samples = appendTrendSample(samples, sample(i * 1000, i), { maxSamples: 3, windowMs: 1e9 });
    }
    expect(samples.map((item) => item.t)).toEqual([3000, 4000, 5000]);
  });
});

describe("trendPointsFor", () => {
  it("只摊出该指标的读数，缺测的采样点跳过", () => {
    const samples = [sample(1000, 10, 100), sample(2000, 20), sample(3000, 30, 300)];
    expect(trendPointsFor(samples, "cpu")).toEqual([
      { t: 1000, v: 10 },
      { t: 2000, v: 20 },
      { t: 3000, v: 30 },
    ]);
    expect(trendPointsFor(samples, "ram")).toEqual([
      { t: 1000, v: 100 },
      { t: 3000, v: 300 },
    ]);
  });

  it("没有样本的指标返回空数组", () => {
    expect(trendPointsFor([sample(1000, 10)], "disk")).toEqual([]);
  });
});

describe("summarizeTrend", () => {
  it("给出峰值、谷值、均值与跨度", () => {
    const summary = summarizeTrend([
      { t: 0, v: 10 },
      { t: 60_000, v: 30 },
      { t: 120_000, v: 20 },
    ]);
    expect(summary).toEqual({
      count: 3,
      min: 10,
      max: 30,
      avg: 20,
      spanMs: 120_000,
      last: 20,
    });
  });

  it("没有样本时返回 null", () => {
    expect(summarizeTrend([])).toBeNull();
  });
});
