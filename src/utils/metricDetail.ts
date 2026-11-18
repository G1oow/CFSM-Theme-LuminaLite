import { formatBytes, formatUptimeDays } from "@/utils/format";
import type { HomeNodeSummary } from "@/services/wsStore";

/**
 * 左栏六张指标卡对应的放大视图。键与卡面的 `data-metric` 一致。
 *
 * 放大视图的两块内容：一段实时趋势曲线 + 一份逐节点明细排行（见 {@link buildNodeMetricRows}）。
 * 曲线只在有随时间变化的读数时才画，见 {@link TREND_METRIC_KEYS}。
 */
export type MetricDetailKey = "connections" | "cpu" | "ram" | "disk" | "uptime" | "asset";

/**
 * 能画实时曲线的指标。
 *
 * 活跃连接、CPU、内存、硬盘都是逐次推送会变的读数，放大后能看出趋势；
 * 运行时长只涨不减、资产总值一天也不动，画出来是一条直线，那两张卡只看逐节点明细。
 */
export const TREND_METRIC_KEYS = ["connections", "cpu", "ram", "disk"] as const;

export type TrendMetricKey = (typeof TREND_METRIC_KEYS)[number];

export function isTrendMetric(key: MetricDetailKey): key is TrendMetricKey {
  return (TREND_METRIC_KEYS as readonly string[]).includes(key);
}

export interface MetricDetailRow {
  uuid: string;
  name: string;
  /**
   * 该指标在这台节点上的读数。单位随指标而变：
   * 连接数为个、CPU 为百分比、内存/硬盘为字节、运行时长为秒、资产为人民币元。
   */
  value: number;
  /** 条柱长度：与本次排行里最大的那台比，0~1。全为 0 时统一给 0。 */
  ratio: number;
}

/** 「最近重启」排行要用到逐节点运行时长：摘要里没有这一项，从实时快照取。 */
export interface MetricDetailRowsOptions {
  uptimeByUuid?: ReadonlyMap<string, number>;
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function toRows(
  entries: Array<{ uuid: string; name: string; value: number }>,
): MetricDetailRow[] {
  let max = 0;
  for (const entry of entries) {
    if (entry.value > max) max = entry.value;
  }
  return entries
    .map((entry) => ({
      ...entry,
      ratio: max > 0 ? Math.min(1, entry.value / max) : 0,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN"));
}

function readMetricValue(
  key: Exclude<MetricDetailKey, "asset">,
  node: HomeNodeSummary,
  options: MetricDetailRowsOptions,
): number {
  switch (key) {
    case "connections":
      return finiteOrZero(node.tcpConn) + finiteOrZero(node.udpConn);
    case "cpu":
      return finiteOrZero(node.cpuPct);
    case "ram":
      return finiteOrZero(node.ramUsed);
    case "disk":
      return finiteOrZero(node.diskUsed);
    case "uptime":
      return finiteOrZero(options.uptimeByUuid?.get(node.uuid));
  }
}

/**
 * 逐节点明细排行：只算在线节点（离线节点没有读数，排进来只是一排 0）。
 *
 * 读数全为 0 的在线节点也保留：连接数为 0 本身就是这个指标最有意义的一条信息。
 */
export function buildNodeMetricRows(
  key: Exclude<MetricDetailKey, "asset">,
  nodes: readonly HomeNodeSummary[],
  nameOf: (uuid: string) => string,
  options: MetricDetailRowsOptions = {},
): MetricDetailRow[] {
  const entries = nodes
    .filter((node) => node.online === true)
    .map((node) => ({
      uuid: node.uuid,
      name: nameOf(node.uuid)?.trim() || node.uuid,
      value: readMetricValue(key, node, options),
    }));
  if (key === "uptime") {
    // 运行时长缺测的节点（刚上线没报）不该混进排行里当 0 天。
    return toRows(entries.filter((entry) => entry.value > 0));
  }
  return toRows(entries);
}

/** 资产明细的入参：只要每个节点的剩余价值，见 `utils/cost` 的 `details`。 */
export interface AssetDetailSource {
  uuid: string;
  counted: boolean;
  remainingCny: number;
  premiumRemainingCny?: number;
}

/** 资产总值放大视图的逐节点排行：口径与总资产一致（含溢价剩余，忽略名单与免费节点不计）。 */
export function buildAssetMetricRows(
  details: readonly AssetDetailSource[],
  nameOf: (uuid: string) => string,
): MetricDetailRow[] {
  const entries = details
    .filter((detail) => detail.counted)
    .map((detail) => ({
      uuid: detail.uuid,
      name: nameOf(detail.uuid)?.trim() || detail.uuid,
      value: finiteOrZero(detail.remainingCny) + finiteOrZero(detail.premiumRemainingCny),
    }))
    .filter((entry) => entry.value > 0);
  return toRows(entries);
}

export interface MetricValueText {
  value: string;
  unit: string;
}

/** 紧凑写法：Y 轴刻度位只有几十像素宽，千位以上收成 1.2k。 */
function compactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1);
}

/**
 * 读数文本。卡面、放大视图的主读数和逐节点明细共用一套口径，避免同一台机器在
 * 卡上是「1.2 GB」、点开变成「1234 MB」。
 */
export function formatMetricValue(key: MetricDetailKey, value: number): MetricValueText {
  switch (key) {
    case "connections":
      return { value: Math.round(finiteOrZero(value)).toLocaleString("zh-CN"), unit: "Conn" };
    case "cpu":
      return { value: finiteOrZero(value).toFixed(1), unit: "%" };
    case "ram":
    case "disk": {
      const [amount = "0", unit = "B"] = formatBytes(finiteOrZero(value)).split(" ");
      return { value: amount, unit };
    }
    case "uptime":
      return formatUptimeDays(finiteOrZero(value));
    case "asset": {
      const amount = Math.round(finiteOrZero(value)).toLocaleString("zh-CN");
      return { value: `¥${amount}`, unit: "" };
    }
  }
}

/** Y 轴刻度文字：同一套单位口径，但一律收短，别把绘图区挤窄。 */
export function formatMetricAxisValue(key: MetricDetailKey, value: number): string {
  switch (key) {
    case "connections":
      return compactNumber(value);
    case "cpu":
      return `${Math.round(finiteOrZero(value))}%`;
    case "ram":
    case "disk":
      return formatBytes(finiteOrZero(value));
    case "uptime": {
      const seconds = finiteOrZero(value);
      if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
      if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
      return `${Math.max(1, Math.floor(seconds / 60))}m`;
    }
    case "asset":
      return `¥${compactNumber(value)}`;
  }
}
