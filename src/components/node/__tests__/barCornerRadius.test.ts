// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { barCornerRadius } from "@/components/node/CanvasStrip";

describe("barCornerRadius", () => {
  it("keeps the chamfer at one device pixel whatever the scaling factor is", () => {
    for (const dpr of [1, 1.1, 1.25, 1.5, 2, 3]) {
      const radius = barCornerRadius(9, 14, dpr);
      // 折算回设备像素：始终正好 1 个，不随缩放比变钝。
      expect(radius * dpr).toBeCloseTo(1, 10);
    }
  });

  it("squares off bars too narrow to carry a chamfer", () => {
    // 5 个设备像素宽：倒角只能靠抗锯齿画出来，柱端会被啃成胶囊。
    expect(barCornerRadius(5, 14, 1)).toBe(0);
    expect(barCornerRadius(2.5, 14, 2)).toBe(0);
    expect(barCornerRadius(5.4, 14, 1)).toBe(0);
    // 6 个设备像素起才给倒角。
    expect(barCornerRadius(6, 14, 1)).toBe(1);
  });

  it("squares off short bars where the chamfer would eat most of the height", () => {
    // 缺样本的矮桩只有 2 个设备像素高（圆角会被柱高截断，两端仍留半透明边）。
    expect(barCornerRadius(9, 2, 1)).toBe(0);
    expect(barCornerRadius(9, 1.8, 2)).toBe(0);
    // 4 个设备像素高起才给倒角。
    expect(barCornerRadius(9, 4, 1)).toBe(1);
  });

  it("falls back to a sane ratio when dpr is unusable", () => {
    expect(barCornerRadius(9, 14, 0)).toBe(1);
    expect(barCornerRadius(9, 14, Number.NaN)).toBe(1);
  });
});
