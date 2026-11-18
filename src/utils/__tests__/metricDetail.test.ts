import { describe, expect, it } from "vitest";
import {
  buildAssetMetricRows,
  buildNodeMetricRows,
  formatMetricAxisValue,
  formatMetricValue,
  isTrendMetric,
} from "@/utils/metricDetail";
import type { HomeNodeSummary } from "@/services/wsStore";

function node(overrides: Partial<HomeNodeSummary> = {}): HomeNodeSummary {
  return {
    uuid: "n1",
    group: "生产",
    region: "HK",
    hidden: false,
    weight: 0,
    online: true,
    trafficUp: 0,
    trafficDown: 0,
    netUp: 0,
    netDown: 0,
    cpuPct: 10,
    ramUsed: 1024,
    ramTotal: 4096,
    diskUsed: 2048,
    diskTotal: 8192,
    tcpConn: 5,
    udpConn: 5,
    ...overrides,
  };
}

const nameOf = (uuid: string) => `name-${uuid}`;

describe("buildNodeMetricRows", () => {
  it("按读数从高到低排序，条柱长度按最大值归一", () => {
    const rows = buildNodeMetricRows(
      "cpu",
      [
        node({ uuid: "a", cpuPct: 20 }),
        node({ uuid: "b", cpuPct: 80 }),
        node({ uuid: "c", cpuPct: 50 }),
      ],
      nameOf,
    );
    expect(rows.map((row) => row.uuid)).toEqual(["b", "c", "a"]);
    expect(rows[0]!.ratio).toBe(1);
    expect(rows[1]!.ratio).toBeCloseTo(0.625);
    expect(rows[0]!.name).toBe("name-b");
  });

  it("离线节点不进排行，读数为 0 的在线节点保留", () => {
    const rows = buildNodeMetricRows(
      "connections",
      [
        node({ uuid: "online", tcpConn: 0, udpConn: 0 }),
        node({ uuid: "offline", online: false, tcpConn: 99 }),
      ],
      nameOf,
    );
    expect(rows.map((row) => row.uuid)).toEqual(["online"]);
    expect(rows[0]!.value).toBe(0);
    expect(rows[0]!.ratio).toBe(0);
  });

  it("连接数把 TCP 与 UDP 相加", () => {
    const rows = buildNodeMetricRows(
      "connections",
      [node({ tcpConn: 7, udpConn: 3 })],
      nameOf,
    );
    expect(rows[0]!.value).toBe(10);
  });

  it("运行时长缺测的节点不混进排行", () => {
    const rows = buildNodeMetricRows(
      "uptime",
      [node({ uuid: "a" }), node({ uuid: "b" })],
      nameOf,
      { uptimeByUuid: new Map([["a", 7200]]) },
    );
    expect(rows.map((row) => row.uuid)).toEqual(["a"]);
    expect(rows[0]!.value).toBe(7200);
  });

  it("全部读数为 0 时条柱长度统一给 0，不会除零", () => {
    const rows = buildNodeMetricRows("disk", [node({ diskUsed: 0 })], nameOf);
    expect(rows[0]!.ratio).toBe(0);
  });
});

describe("buildAssetMetricRows", () => {
  it("只算进资产的节点，剩余价值含未摊销溢价", () => {
    const rows = buildAssetMetricRows(
      [
        { uuid: "a", counted: true, remainingCny: 100, premiumRemainingCny: 20 },
        { uuid: "b", counted: false, remainingCny: 999 },
        { uuid: "c", counted: true, remainingCny: 0 },
      ],
      nameOf,
    );
    expect(rows.map((row) => row.uuid)).toEqual(["a"]);
    expect(rows[0]!.value).toBe(120);
  });
});

describe("formatMetricValue", () => {
  it("按指标给出读数与单位", () => {
    expect(formatMetricValue("connections", 1234)).toEqual({ value: "1,234", unit: "Conn" });
    expect(formatMetricValue("cpu", 42.34)).toEqual({ value: "42.3", unit: "%" });
    expect(formatMetricValue("ram", 1024 * 1024)).toEqual({ value: "1.00", unit: "MB" });
    expect(formatMetricValue("asset", 1234.6)).toEqual({ value: "¥1,235", unit: "" });
  });

  it("Y 轴刻度收短，不与主读数抢宽度", () => {
    expect(formatMetricAxisValue("connections", 12345)).toBe("12k");
    expect(formatMetricAxisValue("cpu", 55.4)).toBe("55%");
    expect(formatMetricAxisValue("ram", 1024 * 1024 * 1024)).toBe("1.00 GB");
  });
});

describe("isTrendMetric", () => {
  it("只有随时间变化的四项指标画曲线", () => {
    expect(isTrendMetric("cpu")).toBe(true);
    expect(isTrendMetric("connections")).toBe(true);
    expect(isTrendMetric("uptime")).toBe(false);
    expect(isTrendMetric("asset")).toBe(false);
  });
});
