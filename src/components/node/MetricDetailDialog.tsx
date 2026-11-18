import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleDollarSign, Cpu, HardDrive, Layers, Network, Timer, X } from "lucide-react";
import type { ElementType } from "react";
import { StatMetricIcon } from "@/components/ui/StatMetricIcon";
import {
  formatMetricValue,
  isTrendMetric,
  type MetricDetailKey,
  type MetricDetailRow,
} from "@/utils/metricDetail";
import { summarizeTrend, trendPointsFor, type MetricTrendSample } from "@/utils/metricTrend";
import { MetricTrendChart } from "./MetricTrendChart";
import { t } from "@/i18n";

const METRIC_ICONS: Record<
  MetricDetailKey,
  ElementType<{ size?: number | string; className?: string }>
> = {
  connections: Network,
  cpu: Cpu,
  ram: Layers,
  disk: HardDrive,
  uptime: Timer,
  asset: CircleDollarSign,
};

const METRIC_TITLES: Record<MetricDetailKey, string> = {
  connections: "活跃连接",
  cpu: "平均 CPU",
  ram: "内存用量",
  disk: "硬盘用量",
  uptime: "最近重启",
  asset: "资产总值",
};

export interface MetricDetailStat {
  label: string;
  value: string;
}

export interface MetricDetailDialogProps {
  metric: MetricDetailKey;
  /** 主读数，已格式化（单位另给）。 */
  value: string;
  unit?: string;
  /** 卡面上那行说明：TCP/UDP 拆分、总量与比例、最近重启的设备名… */
  caption: string;
  /** 次级读数方块：均值 / 峰值 / 采集时长… */
  stats: MetricDetailStat[];
  rows: MetricDetailRow[];
  /** 排行区标题右侧的说明，如「按内存用量排序」。 */
  rowsCaption: string;
  /** 没有可排行的节点时的说明。 */
  emptyRowsText: string;
  /** 资产对访客保密时不列逐节点金额。 */
  priceHidden?: boolean;
  samples: readonly MetricTrendSample[];
  onClose: () => void;
}

/**
 * 指标放大视图：点左栏任一指标卡弹出。
 *
 * 两块内容——最近 30 分钟的读数趋势（只对随时间变化的指标）和逐节点明细排行。
 * 用 portal 挂到 body 上：首页卡片链上有 `transform` 造成的层叠上下文，留在原地会被裁。
 */
export function MetricDetailDialog({
  metric,
  value,
  unit,
  caption,
  stats,
  rows,
  rowsCaption,
  emptyRowsText,
  priceHidden = false,
  samples,
  onClose,
}: MetricDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const Icon = METRIC_ICONS[metric];
  const title = t(METRIC_TITLES[metric]);
  const points = useMemo(
    () => (isTrendMetric(metric) ? trendPointsFor(samples, metric) : []),
    [metric, samples],
  );
  const summary = useMemo(() => summarizeTrend(points), [points]);

  // 关闭回调每次都可能是新函数（父组件每 5 秒重渲染一次），用 ref 兜住：
  // 下面的副作用只该在挂载 / 卸载时跑一次，否则每采一个点就把焦点抢回弹窗。
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Esc 关闭 + 打开期间锁住页面滚动 + 关掉后把焦点还给开卡的按钮。
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  // 曲线不足两个点时不报「最近 N 分钟」，免得写着 1 分钟却只有一句正在采集。
  const trendCaption =
    summary && points.length > 1
      ? t("最近 {n} 分钟 · 每 5 秒 1 个点", { n: Math.max(1, Math.round(summary.spanMs / 60_000)) })
      : t("页面打开后开始累积");

  return createPortal(
    <div
      className="mao-metric-detail-layer"
      data-metric={metric}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mao-metric-detail"
        data-metric={metric}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mao-metric-detail-title"
        tabIndex={-1}
      >
        <header className="mao-metric-detail-head">
          <div className="mao-metric-detail-title-wrap">
            <StatMetricIcon metric={metric} icon={Icon} size={16} />
            <div>
              <h3 id="mao-metric-detail-title">{title}</h3>
              <p className="mao-metric-detail-sub">{caption}</p>
            </div>
          </div>
          <button
            type="button"
            className="mao-metric-detail-close"
            onClick={onClose}
            aria-label={t("关闭")}
            title={t("关闭")}
          >
            <X size={16} />
          </button>
        </header>

        <div className="mao-metric-detail-hero">
          <div className="mao-metric-detail-value">
            {value}
            {unit && <span className="mao-metric-detail-unit">{unit}</span>}
          </div>
          {stats.length > 0 && (
            <dl className="mao-metric-detail-stats">
              {stats.map((stat) => (
                <div key={stat.label} className="mao-metric-detail-stat">
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {isTrendMetric(metric) && (
          <section className="mao-metric-detail-section">
            <div className="mao-metric-detail-section-head">
              <h4>{t("实时趋势")}</h4>
              <span>{trendCaption}</span>
            </div>
            <MetricTrendChart metric={metric} points={points} />
          </section>
        )}

        <section className="mao-metric-detail-section is-rows">
          <div className="mao-metric-detail-section-head">
            <h4>{t("节点明细")}</h4>
            <span>{rowsCaption}</span>
          </div>
          {priceHidden ? (
            <p className="mao-metric-detail-empty">{t("仅管理员可见")}</p>
          ) : rows.length === 0 ? (
            <p className="mao-metric-detail-empty">{emptyRowsText}</p>
          ) : (
            <ul className="mao-metric-detail-rows">
              {rows.map((row) => {
                const text = formatMetricValue(metric, row.value);
                return (
                  <li key={row.uuid} className="mao-metric-detail-row">
                    <span className="mao-metric-detail-row-name" title={row.name}>
                      {row.name}
                    </span>
                    <span className="mao-metric-detail-row-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(1.5, row.ratio * 100)}%` }} />
                    </span>
                    <span className="mao-metric-detail-row-value">
                      {text.value}
                      {text.unit && <em>{text.unit}</em>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mao-metric-detail-foot">
          <span>{t("点击卡片外或按 Esc 关闭")}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}