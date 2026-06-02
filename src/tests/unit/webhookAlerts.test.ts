import { beforeEach, describe, expect, it } from "vitest";
import {
  createAlertWebhook,
  getAlertWebhookPublicBaseUrl,
  getAlertWebhooks,
  ingestWebhookAlert,
  setAlertWebhookPublicBaseUrl,
  testAlertWebhookPayload,
} from "../../services/alerts/alertWebhooks";
import type { Device } from "../../types/domain";

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

const device: Device = {
  id: "dev-1",
  rackId: "rack-1",
  categoryId: "server",
  name: "数据库服务器",
  computerName: "db01",
  businessIp: "192.168.11.191",
  managementIp: "172.16.1.191",
  ips: ["192.168.11.191", "172.16.1.191"],
  side: "front",
  startU: 10,
  endU: 11,
  heightU: 2,
  status: "normal",
  ports: [],
};

describe("alert webhooks", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("creates a Zoho webhook and converts incoming payload into an alert", () => {
    const webhook = createAlertWebhook({
      name: "卓豪硬件告警",
      source: "zoho",
      enabled: true,
    });

    expect(webhook.url).toContain(webhook.token);
    expect(getAlertWebhooks()).toHaveLength(1);

    const alert = ingestWebhookAlert(
      webhook.token,
      testAlertWebhookPayload({
        hostname: "db01",
        ip: "192.168.11.191",
        title: "硬盘故障",
        severity: "critical",
      }),
      [device],
    );

    expect(alert?.deviceId).toBe("dev-1");
    expect(alert?.source).toBe("zoho");
    expect(alert?.level).toBe("critical");
    expect(alert?.title).toContain("硬盘故障");
  });

  it("uses a configured public base url instead of loopback for webhook addresses", () => {
    setAlertWebhookPublicBaseUrl("http://192.168.31.50:5173");

    const webhook = createAlertWebhook({
      name: "卓豪推送",
      source: "zoho",
      enabled: true,
    });

    expect(getAlertWebhookPublicBaseUrl()).toBe("http://192.168.31.50:5173");
    expect(webhook.url).toBe(`http://192.168.31.50:5173/api/webhooks/alerts/${webhook.token}`);
    expect(webhook.url).not.toContain("127.0.0.1");
  });
});
