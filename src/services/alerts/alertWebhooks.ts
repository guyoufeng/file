import type { Alert, AlertLevel, Device } from "../../types/domain";

export interface AlertWebhook {
  id: string;
  name: string;
  source: "zoho" | "prometheus" | "custom";
  enabled: boolean;
  token: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertWebhookInput {
  name: string;
  source: AlertWebhook["source"];
  enabled: boolean;
}

export interface IncomingAlertPayload {
  hostname?: string;
  ip?: string;
  title?: string;
  message?: string;
  severity?: string;
  status?: string;
  startedAt?: string;
}

const WEBHOOK_KEY = "qf-ai-dcim.alertWebhooks";
const ALERT_KEY = "qf-ai-dcim.alerts";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = storage()?.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  storage()?.setItem(key, JSON.stringify(value));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createToken() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function webhookUrl(token: string) {
  const origin = typeof location === "undefined" ? "http://127.0.0.1:5173" : location.origin;
  return `${origin}/api/webhooks/alerts/${token}`;
}

function normalizeLevel(severity?: string): AlertLevel {
  const value = severity?.toLowerCase() ?? "";
  if (/critical|严重|fatal|high/.test(value)) return "critical";
  if (/warning|warn|告警|中/.test(value)) return "warning";
  return "info";
}

export function getAlertWebhooks(): AlertWebhook[] {
  return readJson<AlertWebhook[]>(WEBHOOK_KEY, []);
}

export function createAlertWebhook(input: AlertWebhookInput): AlertWebhook {
  const now = new Date().toISOString();
  const token = createToken();
  const webhook: AlertWebhook = {
    id: createId("alert-webhook"),
    name: input.name.trim() || "告警 Webhook",
    source: input.source,
    enabled: input.enabled,
    token,
    url: webhookUrl(token),
    createdAt: now,
    updatedAt: now,
  };
  writeJson(WEBHOOK_KEY, [webhook, ...getAlertWebhooks()]);
  return webhook;
}

export function deleteAlertWebhook(id: string) {
  writeJson(
    WEBHOOK_KEY,
    getAlertWebhooks().filter((item) => item.id !== id),
  );
}

export function testAlertWebhookPayload(input: IncomingAlertPayload): IncomingAlertPayload {
  return input;
}

export function ingestWebhookAlert(
  token: string,
  payload: IncomingAlertPayload,
  devices: Device[],
): Alert | null {
  const webhook = getAlertWebhooks().find((item) => item.token === token && item.enabled);
  if (!webhook) return null;

  const device = devices.find(
    (item) =>
      item.computerName === payload.hostname ||
      item.name === payload.hostname ||
      item.businessIp === payload.ip ||
      item.managementIp === payload.ip ||
      item.ips.includes(payload.ip ?? ""),
  );
  if (!device) return null;

  const alert: Alert = {
    id: createId("alert-webhook-event"),
    deviceId: device.id,
    source: webhook.source,
    level: normalizeLevel(payload.severity),
    status: payload.status === "recovered" ? "recovered" : "unconfirmed",
    title: payload.title || payload.message || "Webhook 告警",
    description: payload.message,
    startedAt: payload.startedAt || new Date().toISOString(),
  };
  writeJson(ALERT_KEY, [alert, ...readJson<Alert[]>(ALERT_KEY, [])]);
  return alert;
}
