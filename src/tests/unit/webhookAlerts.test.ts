import { beforeEach, describe, expect, it } from "vitest";
import {
  createAlertWebhook,
  getAlertWebhooks,
  ingestWebhookAlert,
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
});
