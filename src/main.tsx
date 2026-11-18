import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/index.css";
import { App } from "./App";
import { installSideColumnDetection } from "./utils/duoSideColumn";
import { stripReloadParam } from "./utils/hardReload";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
const root = rootEl;

async function bootstrap() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("mock") === "1"
  ) {
    const { installDevMockApi } = await import("./dev/mockApi");
    installDevMockApi();
  }

  // 硬刷新会带一个时间戳参数绕开缓存，这里清掉，地址栏不留痕
  stripReloadParam();
  installSideColumnDetection();

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
