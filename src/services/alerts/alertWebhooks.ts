import type { Alert, AlertLevel, Device } from "../../types/domain";
import { createPersistentCollection } from "../persistence/unifiedPersistence";

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
  hostName?: string;
  deviceName?: string;
  monitorName?: string;
  resourceName?: string;
  displayName?: string;
  ip?: string;
  ipAddress?: string;
  address?: string;
  title?: string;
  subject?: string;
  message?: string;
  alertMessage?: string;
  description?: string;
  severity?: string;
  priority?: string;
  status?: string;
  startedAt?: string;
  [key: string]: unknown;
}

const WEBHOOK_KEY = "qf-ai-dcim.alertWebhooks";
const ALERT_KEY = "qf-ai-dcim.alerts";
const PUBLIC_BASE_URL_KEY = "qf-ai-dcim.alertWebhookPublicBaseUrl";
const webhookCollection = createPersistentCollection<AlertWebhook>({
  name: "alerts.webhooks",
  legacyKeys: [WEBHOOK_KEY],
  exportable: false,
  sensitive: true,
});

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

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function inferCurrentOrigin() {
  if (typeof location === "undefined") return "http://127.0.0.1:5173";
  return normalizeBaseUrl(location.origin);
}

export function getAlertWebhookPublicBaseUrl(): string {
  const stored = storage()?.getItem(PUBLIC_BASE_URL_KEY);
  return stored ? normalizeBaseUrl(stored) : inferCurrentOrigin();
}

export function setAlertWebhookPublicBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    storage()?.removeItem(PUBLIC_BASE_URL_KEY);
    return inferCurrentOrigin();
  }
  storage()?.setItem(PUBLIC_BASE_URL_KEY, normalized);
  const webhooks = getAlertWebhooks().map((webhook) => ({
    ...webhook,
    url: webhookUrl(webhook.token, normalized),
  }));
  webhookCollection.write(webhooks);
  return normalized;
}

export function refreshAlertWebhookUrls(baseUrl = getAlertWebhookPublicBaseUrl()): AlertWebhook[] {
  const normalized = normalizeBaseUrl(baseUrl);
  const webhooks = getAlertWebhooks().map((webhook) => ({
    ...webhook,
    url: webhookUrl(webhook.token, normalized),
  }));
  webhookCollection.write(webhooks);
  return webhooks;
}

function webhookUrl(token: string, baseUrl = getAlertWebhookPublicBaseUrl()) {
  return `${normalizeBaseUrl(baseUrl)}/api/webhooks/alerts/${token}`;
}

function normalizeLevel(severity?: string): AlertLevel {
  const value = severity?.toLowerCase() ?? "";
  if (/critical|严重|fatal|high|高/.test(value)) return "critical";
  if (/warning|warn|告警|中/.test(value)) return "warning";
  return "info";
}

function pickText(payload: IncomingAlertPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function toPayloadObject(input: unknown): IncomingAlertPayload {
  if (typeof input === "string") {
    return { message: input.trim() || "空白 Webhook 消息" };
  }
  if (typeof input === "number" || typeof input === "boolean") {
    return { message: String(input) };
  }
  if (Array.isArray(input)) {
    return { message: JSON.stringify(input, null, 2), rawPayload: input };
  }
  if (input && typeof input === "object") {
    return input as IncomingAlertPayload;
  }
  return { message: "空白 Webhook 消息" };
}

function summarizeRawPayload(payload: IncomingAlertPayload): string | undefined {
  const ignoredKeys = new Set([
    "hostname",
    "hostName",
    "deviceName",
    "monitorName",
    "resourceName",
    "displayName",
    "name",
    "ip",
    "ipAddress",
    "address",
    "hostIp",
    "deviceIp",
    "title",
    "subject",
    "alertName",
    "message",
    "alertMessage",
    "description",
    "content",
    "details",
    "severity",
    "priority",
    "level",
    "alertLevel",
    "status",
    "startedAt",
  ]);
  const rawEntries = Object.entries(payload).filter(([key]) => !ignoredKeys.has(key));
  if (rawEntries.length === 0) return undefined;
  return JSON.stringify(Object.fromEntries(rawEntries), null, 2);
}

export function normalizeIncomingAlertPayload(input: unknown): IncomingAlertPayload {
  const payload = toPayloadObject(input);
  const hostname = pickText(payload, [
    "hostname",
    "hostName",
    "deviceName",
    "monitorName",
    "resourceName",
    "displayName",
    "name",
  ]);
  const ip = pickText(payload, ["ip", "ipAddress", "address", "hostIp", "deviceIp"]);
  const title = pickText(payload, ["title", "subject", "monitorName", "alertName", "alarmText", "text"]);
  const message = pickText(payload, [
    "message",
    "alertMessage",
    "description",
    "content",
    "details",
    "alarmText",
    "text",
  ]);
  const severity = pickText(payload, ["severity", "priority", "level", "alertLevel"]);
  const rawSummary = summarizeRawPayload(payload);

  return {
    ...payload,
    hostname,
    ip,
    title,
    message: rawSummary ? [message ?? title ?? "Webhook 原始内容", rawSummary].join("\n\n") : message,
    severity,
  };
}

export function getAlertWebhooks(): AlertWebhook[] {
  return webhookCollection.read();
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
  webhookCollection.write([webhook, ...getAlertWebhooks()]);
  return webhook;
}

export function deleteAlertWebhook(id: string) {
  webhookCollection.write(
    getAlertWebhooks().filter((item) => item.id !== id),
  );
}

export function testAlertWebhookPayload(input: unknown): IncomingAlertPayload {
  return normalizeIncomingAlertPayload(input);
}

export function ingestWebhookAlert(
  token: string,
  input: unknown,
  devices: Device[],
): Alert | null {
  const webhook = getAlertWebhooks().find((item) => item.token === token && item.enabled);
  if (!webhook) return null;
  const payload = normalizeIncomingAlertPayload(input);

  const device = devices.find(
    (item) =>
      item.computerName === payload.hostname ||
      item.name === payload.hostname ||
      item.businessIp === payload.ip ||
      item.managementIp === payload.ip ||
      item.ips.includes(payload.ip ?? ""),
  );
  const alert: Alert = {
    id: createId("alert-webhook-event"),
    deviceId: device?.id ?? "",
    source: webhook.source,
    level: normalizeLevel(payload.severity),
    status: payload.status === "recovered" ? "recovered" : "unconfirmed",
    title: payload.title || payload.message || "Webhook 告警",
    description: payload.message || payload.title,
    startedAt: payload.startedAt || new Date().toISOString(),
  };
  writeJson(ALERT_KEY, [alert, ...readJson<Alert[]>(ALERT_KEY, [])]);
  return alert;
}

export function mergeWebhookAlerts(current: Alert[], received: Alert[]): Alert[] {
  const seen = new Set<string>();
  return [...received, ...current].filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}
