import { useEffect, useRef, useState } from "react";
import {
  appendTrendSample,
  TREND_SAMPLE_INTERVAL_MS,
  type MetricTrendSample,
} from "@/utils/metricTrend";
import type { MetricDetailKey } from "@/utils/metricDetail";

/**
 * 首页集群指标的实时趋势缓冲（放大视图用）。
 *
 * 数据源就是首页已经在用的 WebSocket 最新值，不额外查历史接口（理由见 `utils/metricTrend`）。
 * 采样挂在定时器上而不是跟着渲染走：读数一段时间不变（空闲集群）也要照常落点，时间轴才连续。
 */
export function useMetricTrends(
  values: Partial<Record<MetricDetailKey, number>>,
): readonly MetricTrendSample[] {
  const valuesRef = useRef(values);
  const [samples, setSamples] = useState<readonly MetricTrendSample[]>([]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const take = () => {
      const now = Date.now();
      setSamples((prev) => {
        const next = appendTrendSample(prev, { t: now, values: valuesRef.current });
        return next === prev ? prev : next;
      });
    };
    take();
    const timer = window.setInterval(take, TREND_SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return samples;
}