import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";

export interface ClusterStatusNode {
  name: string;
  group?: string;
}

const MAX_VISIBLE_ROWS = 6;
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

/**
 * 首页「服务器集群」标题行右上角的状态胶囊。
 * hover / focus 弹出详情：离线服务器逐台列出，全在线时只报总数。
 */
export function ClusterStatusPill({
  totalNodes,
  onlineNodes,
  offlineNodes,
  offlineList,
}: {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  offlineList: ClusterStatusNode[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const panelId = useId();
  const titleId = useId();

  const isAllHealthy = offlineNodes === 0 && totalNodes > 0;
  const label = isAllHealthy
    ? t("状态健康")
    : totalNodes === 0
      ? t("未连接")
      : t("存在离线 ({n})", { n: offlineNodes });
  const tone = isAllHealthy ? "is-healthy" : "is-warning";

  const clearTimers = () => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const show = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) return;
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const hide = () => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const rows = offlineList.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = offlineList.length - rows.length;

  return (
    <div
      className="mao-cluster-status"
      ref={rootRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) hide();
      }}
    >
      <button
        type="button"
        className={`mao-status-pill ${tone} mao-cluster-status-trigger`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("集群状态详情")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mao-status-dot" />
        {label}
      </button>

      {open && (
        <section
          id={panelId}
          className="mao-cluster-panel shadcn-hover-card"
          role="dialog"
          aria-labelledby={titleId}
        >
          <header className="mao-cluster-panel-head">
            <h2 id={titleId}>{t("集群状态")}</h2>
            <span className="mao-cluster-panel-count" data-tone={tone}>
              {totalNodes > 0 ? t("在线 {online} / {total}", { online: onlineNodes, total: totalNodes }) : t("未连接")}
            </span>
          </header>

          {rows.length > 0 ? (
            <div className="mao-cluster-panel-list">
              {rows.map((node, index) => (
                <div className="mao-cluster-panel-row" key={`${node.name}-${index}`}>
                  <span className="mao-cluster-panel-name" title={node.name}>
                    {node.name}
                  </span>
                  {node.group ? (
                    <span className="mao-cluster-panel-group">{node.group}</span>
                  ) : null}
                  <span className="mao-cluster-panel-status">{t("离线")}</span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="mao-cluster-panel-more">
                  {t("还有 {n} 台离线服务器", { n: hiddenCount })}
                </p>
              )}
            </div>
          ) : (
            <p className="mao-cluster-panel-note">
              {totalNodes > 0
                ? t("全部 {n} 台服务器在线", { n: totalNodes })
                : t("暂未检测到在线服务器，等待节点客户端数据上报。")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
