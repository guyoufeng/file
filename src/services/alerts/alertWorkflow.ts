import type { Alert, AlertStatus } from "../../types/domain";

export const alertStatusOptions: Array<{ value: AlertStatus; label: string }> = [
  { value: "unconfirmed", label: "未读" },
  { value: "read", label: "已读" },
  { value: "acknowledged", label: "进行中" },
  { value: "recovered", label: "已解决" },
];

export function getAlertStatusLabel(status: AlertStatus): string {
  return (
    alertStatusOptions.find((item) => item.value === status)?.label ??
    (status === "closed" ? "已关闭" : status)
  );
}

export function batchUpdateAlertStatus(
  alerts: Alert[],
  selectedIds: string[],
  status: AlertStatus,
): Alert[] {
  const selected = new Set(selectedIds);
  return alerts.map((alert) =>
    selected.has(alert.id) ? { ...alert, status } : alert,
  );
}
