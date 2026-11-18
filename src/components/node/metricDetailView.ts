import { t } from "@/i18n";
import { formatBytes } from "@/utils/format";
import {
  buildAssetMetricRows,
  buildNodeMetricRows,
  formatMetricValue,
  isTrendMetric,
  type AssetDetailSource,
  type MetricDetailKey,
  type MetricDetailRow,
} from "@/utils/metricDetail";
import { summarizeTrend, trendPointsFor, type MetricTrendSample } from "@/utils/metricTrend";
import type { HomeNodeSummary } from "@/services/wsStore";
import type { MetricDetailStat } from "./MetricDetailDialog";

/**
 * 放大视图要展示的读数全部在这里算好。
 *
 * 弹窗组件只管排版：主读数、副标题、次级读数方块、逐节点明细都从这个结构来，
 * 口径与卡片本身一致（同一套格式化函数）。
 */

export interface MetricDetailOverview {
  onlineNodes: number;
  totalTcpConn: number;
  totalUdpConn: number;
  avgCpu: number;
  totalRamUsed: number;
  totalRamTotal: number;
  ramPct: number;
  totalDiskUsed: number;
  totalDiskTotal: number;
  diskPct: number;
}

export interface MetricDetailAssetSummary {
  remainingCny: number;
  totalOriginalPriceCny?: number;
}

export interface MetricDetailViewInput {
  metric: MetricDetailKey;
  overview: MetricDetailOverview;
  nodes: readonly HomeNodeSummary[];
  nameOf: (uuid: string) => string;
  /** 逐节点运行时长（秒），「最近重启」排行用。 */
  uptimeByUuid: ReadonlyMap<string, number>;
  /** 资产明细（`costSummary.details`）；没有汇率或未登录时为 null。 */
  assetDetails: readonly AssetDetailSource[] | null;
  assetSummary: MetricDetailAssetSummary | null;
  isPriceVisible: boolean;
  samples: readonly MetricTrendSample[];
}

export interface MetricDetailView {
  value: string;
  unit: string;
  caption: string;
  stats: MetricDetailStat[];
  rows: MetricDetailRow[];
  rowsCaption: string;
  emptyRowsText: string;
  priceHidden: boolean;
}

const ROWS_CAPTION: Record<MetricDetailKey, string> = {
  connections: "按连接数从高到低",
  cpu: "按 CPU 从高到低",
  ram: "按内存用量从高到低",
  disk: "按硬盘用量从高到低",
  uptime: "按运行时长从高到低",
  asset: "按剩余价值从高到低",
};

const EMPTY_ROWS: Record<MetricDetailKey, string> = {
  connections: "暂无在线服务器",
  cpu: "暂无在线服务器",
  ram: "暂无在线服务器",
  disk: "暂无在线服务器",
  uptime: "暂无在线服务器",
  asset: "暂无可计费设备",
};

function formatStatValue(metric: MetricDetailKey, value: number): string {
  const text = formatMetricValue(metric, value);
  return text.unit ? `${text.value} ${text.unit}` : text.value;
}

/** 趋势指标：当前 / 均值 / 峰值 / 谷值，四个方块。 */
function trendStats(metric: MetricDetailKey, samples: readonly MetricTrendSample[]): MetricDetailStat[] {
  const summary = summarizeTrend(trendPointsFor(samples, metric));
  if (!summary) return [];
  return [
    { label: t("均值"), value: formatStatValue(metric, summary.avg) },
    { label: t("峰值"), value: formatStatValue(metric, summary.max) },
    { label: t("谷值"), value: formatStatValue(metric, summary.min) },
  ];
}

export function buildMetricDetailView(input: MetricDetailViewInput): MetricDetailView {
  const {
    metric,
    overview,
    nodes,
    nameOf,
    uptimeByUuid,
    assetDetails,
    assetSummary,
    isPriceVisible,
    samples,
  } = input;
  const priceHidden = metric === "asset" && !isPriceVisible;
  const rows = priceHidden
    ? []
    : metric === "asset"
      ? buildAssetMetricRows(assetDetails ?? [], nameOf)
      : buildNodeMetricRows(metric, nodes, nameOf, { uptimeByUuid });

  let current = 0;
  let caption = "";
  switch (metric) {
    case "connections":
      current = overview.totalTcpConn + overview.totalUdpConn;
      caption = `TCP ${overview.totalTcpConn.toLocaleString("zh-CN")} · UDP ${overview.totalUdpConn.toLocaleString("zh-CN")}`;
      break;
    case "cpu":
      current = overview.avgCpu;
      caption = t("{n} 台在线服务器", { n: overview.onlineNodes });
      break;
    case "ram":
      current = overview.totalRamUsed;
      caption = t("共 {total}", { total: formatBytes(overview.totalRamTotal) }) + ` · ${overview.ramPct.toFixed(1)}%`;
      break;
    case "disk":
      current = overview.totalDiskUsed;
      caption = t("共 {total}", { total: formatBytes(overview.totalDiskTotal) }) + ` · ${overview.diskPct.toFixed(1)}%`;
      break;
    case "uptime": {
      // 与卡面口径一致：取全站最短运行时长的那台，也就是最近重启的机器。
      const latest = rows[rows.length - 1];
      current = latest?.value ?? 0;
      caption = latest ? t("最近重启设备: {name}", { name: latest.name }) : t("暂无在线设备");
      break;
    }
    case "asset":
      current = assetSummary?.remainingCny ?? 0;
      caption = t("实时汇率折算");
      break;
  }

  const text = formatMetricValue(metric, current);
  const stats: MetricDetailStat[] = [];
  if (isTrendMetric(metric)) {
    stats.push(...trendStats(metric, samples));
  } else if (metric === "uptime" && rows.length > 0) {
    const values = rows.map((row) => row.value);
    stats.push(
      { label: t("最长运行"), value: formatStatValue(metric, Math.max(...values)) },
      { label: t("最短运行"), value: formatStatValue(metric, Math.min(...values)) },
    );
  } else if (metric === "asset" && !priceHidden) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    stats.push(
      { label: t("剩余总值"), value: formatStatValue(metric, total) },
      { label: t("计入设备"), value: t("{n} 台", { n: rows.length }) },
    );
  }

  return {
    value: priceHidden ? t("保密") : text.value,
    unit: priceHidden ? "" : text.unit,
    caption,
    stats,
    rows,
    rowsCaption: t(ROWS_CAPTION[metric]),
    emptyRowsText: t(EMPTY_ROWS[metric]),
    priceHidden,
  };
}