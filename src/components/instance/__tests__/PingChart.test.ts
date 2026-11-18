import { describe, expect, it } from "vitest";
import {
  normalizePanelSize,
  normalizePingTaskLayout,
  pingLossAxisRange,
  pingYAxisRange,
  summarizePingRecords,
} from "@/components/instance/PingChart";
import type { PingRecord } from "@/types/cfsm";

function record(
  time: string,
  value: number,
  count: number,
  loss: number,
): PingRecord {
  return { task_id: 1, client: "node-a", time: Date.parse(time), value, count, loss };
}

describe("summarizePingRecords", () => {
  it("weights aggregate latency and loss by the represented sample counts", () => {
    const summary = summarizePingRecords([
      record("2026-01-01T00:00:00Z", 10, 10, 0),
      record("2026-01-01T00:01:00Z", 100, 2, 50),
      record("2026-01-01T00:02:00Z", -1, 5, 100),
    ]);

    expect(summary).toMatchObject({
      latest: 100,
      min: 10,
      max: 100,
      p50: 10,
      total: 17,
      lost: 6,
    });
    expect(summary.avg).toBeCloseTo(200 / 11, 8);
    expect(summary.p99).toBeCloseTo(91, 8);
    expect(summary.loss).toBeCloseTo((6 / 17) * 100, 8);
  });
});

describe("pingYAxisRange", () => {
  it("always starts at 0 and leaves headroom above the peak", () => {
    expect(pingYAxisRange(100)).toEqual([0, 112]);
    // 峰值小时按最小 5ms 留头，不至于把 40ms 的图顶满
    expect(pingYAxisRange(40)).toEqual([0, 45]);
  });

  it("falls back to a 100ms axis when there is no usable sample", () => {
    expect(pingYAxisRange(null)).toEqual([0, 100]);
    expect(pingYAxisRange(0)).toEqual([0, 100]);
  });
});

describe("pingLossAxisRange", () => {
  it("keeps a 5% floor so a 0.3% wobble does not fill the axis", () => {
    expect(pingLossAxisRange(0.3)).toEqual([0, 5]);
    expect(pingLossAxisRange(null)).toEqual([0, 5]);
  });

  it("rounds up above the peak and never exceeds 100%", () => {
    expect(pingLossAxisRange(12)).toEqual([0, 14]);
    expect(pingLossAxisRange(90)).toEqual([0, 100]);
  });
});

describe("normalizePingTaskLayout", () => {
  it("accepts the three column counts and defaults to 3 columns", () => {
    expect(normalizePingTaskLayout("1")).toBe("1");
    expect(normalizePingTaskLayout("2")).toBe("2");
    expect(normalizePingTaskLayout("3")).toBe("3");
  });

  it("falls back to 3 columns for junk (missing key, old value, other types)", () => {
    expect(normalizePingTaskLayout(null)).toBe("3");
    expect(normalizePingTaskLayout("auto")).toBe("3");
    expect(normalizePingTaskLayout(2)).toBe("3");
  });
});

describe("normalizePanelSize", () => {
  it("keeps sizes inside the range and rounds them", () => {
    expect(normalizePanelSize("880", 320, 1600)).toBe(880);
    expect(normalizePanelSize(412.6, 200, 720)).toBe(413);
  });

  it("treats out-of-range or junk values as 'not set' (0 = use the responsive default)", () => {
    expect(normalizePanelSize(null, 320, 1600)).toBe(0);
    expect(normalizePanelSize("", 320, 1600)).toBe(0);
    expect(normalizePanelSize(10, 320, 1600)).toBe(0);
    expect(normalizePanelSize(9999, 320, 1600)).toBe(0);
    expect(normalizePanelSize("wide", 320, 1600)).toBe(0);
  });
});
