import { describe, expect, it } from "vitest";
import type { PingOverviewBucket } from "@/types/cfsm";
import {
  formatCompactBillingCycle,
  formatCompactExpire,
  getBarGeometry,
  getBarHit,
  healthBarInteractionModel,
  healthBarSlotModel,
  snapBarRect,
  snapBarTop,
} from "@/components/node/nodeCardShared";

function bucket(value: number | null, loss: number | null = 0): PingOverviewBucket {
  return {
    index: 0,
    value,
    loss,
    total: value == null ? 0 : 1,
    lost: 0,
    startAt: null,
    endAt: null,
  };
}

describe("healthBarSlotModel", () => {
  it("keeps every valid latency bucket at one height while color carries severity", () => {
    const values = [0, 20, 55, 88.5, 151, 400];
    const slots = values.map((value) => healthBarSlotModel(bucket(value), "latency"));

    expect(slots.every((slot) => slot.active)).toBe(true);
    expect(new Set(slots.map((slot) => slot.heightFraction))).toEqual(new Set([0.84]));
    expect(slots.map((slot) => slot.color)).toEqual([
      "var(--latency-excellent)",
      "var(--latency-excellent)",
      "var(--latency-excellent)",
      "var(--latency-good)",
      "var(--latency-moderate)",
      "var(--latency-critical)",
    ]);
  });

  it("renders missing latency as a short neutral gap", () => {
    // 空位块用专用 token：浅色的 --progress-bg 乘模型透明度后与白卡几乎同色，必须换深一档的灰。
    expect(healthBarSlotModel(bucket(null, null), "latency")).toMatchObject({
      active: false,
      heightFraction: 0.25,
      color: "var(--health-bar-empty)",
      alpha: 0.55,
    });
  });

  it("renders missing loss as a full-height neutral gap", () => {
    expect(healthBarSlotModel(bucket(null, null), "loss")).toMatchObject({
      active: false,
      heightFraction: 0.84,
      color: "var(--health-bar-empty)",
      alpha: 0.42,
    });
  });

  it("keeps loss buckets on the same fixed-height visual language", () => {
    expect(healthBarSlotModel(bucket(20), "latency")).toMatchObject({
      active: true,
      heightFraction: 0.84,
      alpha: 0.94,
    });
    expect(healthBarSlotModel(bucket(20, 12.5), "loss")).toMatchObject({
      active: true,
      heightFraction: 0.84,
      alpha: 0.94,
    });
  });

  it("uses the shared hover lift and sibling fade for canvas renderers", () => {
    const slot = healthBarSlotModel(bucket(55), "latency");

    expect(healthBarInteractionModel(slot, true, 1)).toMatchObject({
      heightFraction: 1,
      alpha: 1,
    });
    expect(healthBarInteractionModel(slot, false, 1).alpha).toBeCloseTo(slot.alpha * 0.54);
    expect(healthBarInteractionModel(slot, true, 0)).toMatchObject({
      heightFraction: slot.heightFraction,
      alpha: slot.alpha,
    });
  });
});

describe("formatCompactExpire", () => {
  it("shows 永久 when no expiry date is set", () => {
    // 之前显示 "余 --",看不出是"没填"还是"算不出来"。
    expect(formatCompactExpire({ value: "—", unit: "" })).toBe("永久");
  });

  it("keeps the remaining-days form otherwise", () => {
    expect(formatCompactExpire({ value: "12", unit: "天" })).toBe("余 12天");
    expect(formatCompactExpire({ value: "长期", unit: "" })).toBe("长期");
  });
});

describe("formatCompactBillingCycle", () => {
  it("formats standard cycles correctly", () => {
    expect(formatCompactBillingCycle("month")).toBe("月付");
    expect(formatCompactBillingCycle(30)).toBe("月付");
    expect(formatCompactBillingCycle("quarter")).toBe("季付");
    expect(formatCompactBillingCycle(90)).toBe("季付");
    expect(formatCompactBillingCycle("half_year")).toBe("半年付");
    expect(formatCompactBillingCycle(180)).toBe("半年付");
    expect(formatCompactBillingCycle("year")).toBe("年付");
    expect(formatCompactBillingCycle(365)).toBe("年付");
    expect(formatCompactBillingCycle("two_years")).toBe("2年付");
    expect(formatCompactBillingCycle("三年付")).toBe("3年付");
    expect(formatCompactBillingCycle("three_years")).toBe("3年付");
    expect(formatCompactBillingCycle("four_years")).toBe("4年付");
    expect(formatCompactBillingCycle("five_years")).toBe("5年付");
    expect(formatCompactBillingCycle(1095)).toBe("3年付");
    expect(formatCompactBillingCycle("lifetime")).toBe("永久");
    expect(formatCompactBillingCycle(-1)).toBe("永久");
  });

  it("handles free price sentinel", () => {
    expect(formatCompactBillingCycle("year", -1)).toBe("免费");
  });

  it("falls back to 年付 for invalid or empty cycle values", () => {
    expect(formatCompactBillingCycle("")).toBe("年付");
    expect(formatCompactBillingCycle(null)).toBe("年付");
    expect(formatCompactBillingCycle(undefined)).toBe("年付");
  });
});

describe("snapBarRect", () => {
  // 175.95px 分 20 根：按 CSS 宽度均分得到 6.9px 这类分数，整排边界都会压在半个像素上。
  it("lands both edges of every bar on whole device pixels", () => {
    const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;

    for (const dpr of [1, 1.25, 2]) {
      const geometry = getBarGeometry(175.95, 20, dpr);
      for (let index = 0; index < 20; index += 1) {
        const { x, width } = snapBarRect(index, geometry, dpr);
        expect(isWhole(x * dpr)).toBe(true);
        expect(isWhole((x + width) * dpr)).toBe(true);
      }
    }
  });

  // 之前的实现逐根取整，间距在 2/3 个设备像素之间跳，一整排看着就是间隔不匀。
  it("keeps every gap between bars exactly the same", () => {
    for (const dpr of [1, 1.25, 2]) {
      for (const count of [14, 18, 20]) {
        const geometry = getBarGeometry(176.4, count, dpr);
        for (let index = 1; index < count; index += 1) {
          const previous = snapBarRect(index - 1, geometry, dpr);
          const current = snapBarRect(index, geometry, dpr);
          expect(Math.round((current.x - (previous.x + previous.width)) * dpr)).toBe(
            geometry.gap,
          );
        }
      }
    }
  });

  it("keeps the row inside the track and every bar at least one device pixel wide", () => {
    const geometry = getBarGeometry(60, 20, 1);
    const last = snapBarRect(19, geometry, 1);

    expect(snapBarRect(0, geometry, 1).x).toBe(Math.floor(geometry.extra / 2));
    expect(last.x + last.width).toBeLessThanOrEqual(60);
    expect(last.width).toBeGreaterThanOrEqual(1);
  });

  it("uses identical device-pixel widths at common desktop scaling factors", () => {
    for (const dpr of [1, 1.1, 1.25, 1.5, 1.75, 2]) {
      for (const [trackWidth, count] of [[188, 20], [176, 20], [188, 18], [120, 14]]) {
        const geometry = getBarGeometry(trackWidth, count, dpr);
        const rects = Array.from({ length: count }, (_, index) => snapBarRect(index, geometry, dpr));
        const widths = rects.map(({ width }) => Math.round(width * dpr));
        const gaps = rects.slice(1).map((rect, index) =>
          Math.round((rect.x - rects[index]!.x - rects[index]!.width) * dpr),
        );
        expect(new Set(widths).size).toBe(1);
        expect(new Set(gaps).size).toBe(1);
        const left = Math.round(rects[0]!.x * dpr);
        const right = Math.round(trackWidth * dpr - (rects[count - 1]!.x + rects[count - 1]!.width) * dpr);
        expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("getBarHit", () => {
  const cases = [
    { width: 189.5, count: 20, dpr: 1 },
    { width: 189.5, count: 20, dpr: 1.1 },
    { width: 104, count: 14, dpr: 1.25 },
  ];

  it("hits the bar under the pointer and reports that bar's center", () => {
    for (const { width, count, dpr } of cases) {
      const geometry = getBarGeometry(width, count, dpr);
      for (let index = 0; index < count; index += 1) {
        const rect = snapBarRect(index, geometry, dpr);
        const leftHalf = getBarHit(rect.x + 0.5 / dpr, width, count, dpr);
        const rightHalf = getBarHit(rect.x + rect.width - 0.5 / dpr, width, count, dpr);
        const center = getBarHit(rect.x + rect.width / 2, width, count, dpr);
        expect(leftHalf?.index).toBe(index);
        expect(rightHalf?.index).toBe(index);
        expect(center?.index).toBe(index);
        // 浮层锚点用的比例，必须正好是这根柱子的中心（按 canvas 元素总宽算）。
        const inset = Math.min(width / 2, 1 / dpr);
        expect(center?.fraction).toBeCloseTo(
          (inset + rect.x + rect.width / 2) / (width + inset * 2),
          9,
        );
      }
    }
  });

  it("no longer lands on the neighbouring bar when the pointer is on the right half", () => {
    const width = 189.5;
    const count = 20;
    const dpr = 1;
    const geometry = getBarGeometry(width, count, dpr);
    const rect = snapBarRect(0, geometry, dpr);
    // 第一根柱子右半边：旧实现按「整宽均分」会算成第 2 根，高亮与浮层一起偏位。
    const probe = rect.x + rect.width - 0.5;
    const legacySlot = Math.max(
      0,
      Math.min(count - 1, Math.floor(probe / (width / count))),
    );

    expect(legacySlot).toBe(1);
    expect(getBarHit(probe, width, count, dpr)?.index).toBe(0);
  });

  it("returns null without a track", () => {
    expect(getBarHit(10, 0, 20, 1)).toBeNull();
    expect(getBarHit(10, 100, 0, 1)).toBeNull();
  });
});
describe("snapBarTop", () => {
  it("rounds the top edge to whole device pixels", () => {
    expect(snapBarTop(11 - 11 * 0.84, 1)).toBe(2);
    expect(snapBarTop(2.4, 1)).toBe(2);
    expect(snapBarTop(2.4, 2)).toBe(2.5);
  });
});
