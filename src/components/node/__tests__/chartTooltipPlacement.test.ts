import { describe, expect, it } from "vitest";
import { resolveTooltipPlacement, TOOLTIP_GAP } from "../chartTooltipPlacement";

// 首页「集群状态」那张小图：画布 64px 高，卡片约 44px 高，两边都塞不满
const CANVAS = 64;
const TOOLTIP = 44;

describe("resolveTooltipPlacement", () => {
  it("keeps the card below a vertex that sits near the top of the plot", () => {
    expect(resolveTooltipPlacement(8, CANVAS, TOOLTIP)).toBe("below");
  });

  it("flips above a vertex that sits near the bottom", () => {
    expect(resolveTooltipPlacement(56, CANVAS, TOOLTIP)).toBe("above");
  });

  it("never drifts further than the smaller overflow on a small canvas", () => {
    for (let y = 0; y <= CANVAS; y += 4) {
      const placement = resolveTooltipPlacement(y, CANVAS, TOOLTIP);
      const needed = TOOLTIP + TOOLTIP_GAP;
      const overflow =
        placement === "above" ? Math.max(0, needed - y) : Math.max(0, needed - (CANVAS - y));
      // 卡片比画布矮的那部分最多溢出一条，卡片本体始终贴着顶点
      expect(overflow).toBeLessThanOrEqual(TOOLTIP / 2);
    }
  });

  it("prefers above when the card fits fully on both sides", () => {
    expect(resolveTooltipPlacement(40, 200, 30)).toBe("above");
  });

  it("ignores the canvas when the tooltip has not been measured yet", () => {
    expect(resolveTooltipPlacement(30, CANVAS, 0)).toBe("above");
  });
});
