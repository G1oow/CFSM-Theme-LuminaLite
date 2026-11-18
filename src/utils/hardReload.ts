const RELOAD_PARAM = "cfsm_reload";

/**
 * 给当前地址拼上一次性时间戳。
 *
 * 产物更新后旧 chunk 会被新构建删掉，而 assets 带 `max-age=3600`：普通 `location.reload()`
 * 会直接复用浏览器 / 边缘缓存里的旧 index.html 与旧主 chunk，于是依旧 404、页面卡在
 * 「检测到主题新版本」。换一个 query 重新请求文档，才能拿到新 index.html 和它引用的新 chunk。
 * hash 路由与原有 query 都保留。
 */
export function buildReloadUrl(href: string, stamp: number): string {
  const url = new URL(href);
  url.searchParams.set(RELOAD_PARAM, String(stamp));
  return url.toString();
}

/** 硬刷新：带时间戳重新加载当前页面。 */
export function hardReload(): void {
  if (typeof window === "undefined") return;
  try {
    window.location.replace(buildReloadUrl(window.location.href, Date.now()));
  } catch {
    window.location.reload();
  }
}

/** 启动时清掉硬刷新留下的时间戳参数，地址栏不留痕。 */
export function stripReloadParam(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RELOAD_PARAM)) return;
    url.searchParams.delete(RELOAD_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // 忽略：地址栏多一个参数不影响功能
  }
}
