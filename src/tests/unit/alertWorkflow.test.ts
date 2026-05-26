import { describe, expect, it } from "vitest";
import type { Alert, AlertStatus } from "../../types/domain";
import {
  alertStatusOptions,
  batchUpdateAlertStatus,
  getAlertStatusLabel,
} from "../../services/alerts/alertWorkflow";

const baseAlert: Alert = {
  id: "alert-1",
  deviceId: "dev-1",
  source: "manual",
  level: "warning",
  status: "unconfirmed",
  title: "CPU使用率偏高",
  startedAt: "2026-05-26T08:00:00+08:00",
};

describe("alert workflow", () => {
  it("maps alert statuses to operational labels", () => {
    expect(alertStatusOptions.map((item) => item.label)).toEqual([
      "未读",
      "已读",
      "进行中",
      "已解决",
    ]);
    expect(getAlertStatusLabel("acknowledged")).toBe("进行中");
    expect(getAlertStatusLabel("read")).toBe("已读");
  });

  it("updates selected alerts in batch", () => {
    const alerts = [
      baseAlert,
      { ...baseAlert, id: "alert-2", status: "read" as AlertStatus },
      { ...baseAlert, id: "alert-3" },
    ];

    const updated = batchUpdateAlertStatus(alerts, ["alert-1", "alert-3"], "acknowledged");

    expect(updated.find((item) => item.id === "alert-1")?.status).toBe("acknowledged");
    expect(updated.find((item) => item.id === "alert-2")?.status).toBe("read");
    expect(updated.find((item) => item.id === "alert-3")?.status).toBe("acknowledged");
  });
});
