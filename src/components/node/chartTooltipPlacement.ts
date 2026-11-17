/** 悬浮卡片与数据点顶点之间留的空隙（px）。 */
export const TOOLTIP_GAP = 10;

/**
 * 决定悬浮卡片贴在顶点上方还是下方。
 *
 * 卡片本身比首页那张小图表还高，多数情况下两边都塞不满，
 * 因此按「溢出画布更少的一侧」来选：卡片始终紧贴顶点，
 * 宁可压住一小条图表，也不会飘到离顶点很远的地方。
 *
 * @param pointY 顶点在画布坐标系里的纵坐标（画布顶边为 0）
 * @param canvasHeight 画布高度
 * @param tooltipHeight 卡片自身的实际高度
 */
export function resolveTooltipPlacement(
  pointY: number,
  canvasHeight: number,
  tooltipHeight: number,
): "above" | "below" {
  const needed = tooltipHeight + TOOLTIP_GAP;
  const overflowAbove = Math.max(0, needed - pointY);
  const overflowBelow = Math.max(0, needed - (canvasHeight - pointY));
  return overflowAbove <= overflowBelow ? "above" : "below";
}
