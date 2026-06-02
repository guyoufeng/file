import type { IncomingMessage } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import {
  buildAgentOpenApiDocument,
  getAgentReadonlyTools,
} from "./src/services/agent/apiManifest";
import {
  buildAgentReadonlySnapshot,
  filterAgentAlerts,
  filterAgentAuditLogs,
  filterAgentAccessRecords,
  filterAgentChangeEvents,
  filterAgentConnections,
  filterAgentDevices,
  filterAgentRacks,
  type AgentReadonlySnapshot,
  type AgentQuery,
} from "./src/services/agent/readonlyApi";
import type { ProjectJson } from "./src/services/backend/data";
import type { Alert } from "./src/types/domain";

async function readBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0
    ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
    : {};
}

const agentSnapshotPath = path.resolve(".local/agent-api-snapshot.json");
const agentAuthPath = path.resolve(".local/agent-api-auth.json");
const demoSeedPath = path.resolve(".local/demo-seed.json");

function getQuery(req: IncomingMessage): AgentQuery {
  const url = new URL(req.url ?? "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries()) as AgentQuery;
}

function getAgentApiBaseUrl(req: IncomingMessage): string {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? "127.0.0.1:5200";
  return `${protocol}://${host}/api/agent/v1`;
}

function getRuntimePublicBaseUrl(req: IncomingMessage): string {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const port = (req.headers.host ?? "127.0.0.1:5200").split(":").at(-1) ?? "5200";
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return `${protocol}://${entry.address}:${port}`;
      }
    }
  }
  return `${protocol}://${req.headers.host ?? "127.0.0.1:5200"}`;
}

function sendJson(res: Parameters<import("connect").NextHandleFunction>[1], value: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

interface AgentAuthSettings {
  enabled: boolean;
  token?: string;
}

function previewToken(token?: string): string | undefined {
  if (!token) return undefined;
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

async function loadAgentAuthSettings(): Promise<AgentAuthSettings> {
  try {
    return JSON.parse(await readFile(agentAuthPath, "utf8")) as AgentAuthSettings;
  } catch {
    return { enabled: false };
  }
}

async function saveAgentAuthSettings(settings: AgentAuthSettings): Promise<void> {
  await mkdir(path.dirname(agentAuthPath), { recursive: true });
  await writeFile(agentAuthPath, JSON.stringify(settings, null, 2), "utf8");
}

async function ensureAgentAuthorized(
  req: IncomingMessage,
  res: Parameters<import("connect").NextHandleFunction>[1],
): Promise<boolean> {
  const settings = await loadAgentAuthSettings();
  if (!settings.enabled) return true;

  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (token && token === settings.token) return true;

  sendJson(
    res,
    {
      message: "只读 Agent API 已启用访问令牌，请使用 Authorization: Bearer <token> 调用。",
      readonly: true,
    },
    401,
  );
  return false;
}

async function loadAgentSnapshot(): Promise<AgentReadonlySnapshot> {
  try {
    return JSON.parse(await readFile(agentSnapshotPath, "utf8")) as AgentReadonlySnapshot;
  } catch {
    const demoSeed = JSON.parse(await readFile(demoSeedPath, "utf8"));
    return buildAgentReadonlySnapshot({
      schemaVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      data: demoSeed,
    });
  }
}

async function saveAgentSnapshot(snapshot: AgentReadonlySnapshot): Promise<void> {
  await mkdir(path.dirname(agentSnapshotPath), { recursive: true });
  await writeFile(agentSnapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
}

function aiProxyPlugin() {
  return {
    name: "ai-proxy",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/__demo_seed", async (_req, res) => {
        try {
          const content = await readFile(demoSeedPath, "utf8");
          res.setHeader("Content-Type", "application/json");
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ message: "未配置本地演示种子" }));
        }
      });

      server.middlewares.use("/api/runtime/public-base-url", async (req, res) => {
        sendJson(res, { baseUrl: getRuntimePublicBaseUrl(req) });
      });

      server.middlewares.use("/api/agent/v1/snapshot", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        if (req.method === "GET") {
          sendJson(res, await loadAgentSnapshot());
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const project = (await readBody(req)) as ProjectJson;
          const snapshot = buildAgentReadonlySnapshot(project);
          await saveAgentSnapshot(snapshot);
          sendJson(res, {
            message: "只读 Agent API 快照已更新",
            generatedAt: snapshot.generatedAt,
            counts: {
              rooms: snapshot.data.rooms.length,
              racks: snapshot.data.racks.length,
              devices: snapshot.data.devices.length,
              alerts: snapshot.data.alerts.length,
              auditLogs: snapshot.data.auditLogs?.length ?? 0,
              accessRecords: snapshot.data.accessRecords?.length ?? 0,
              changeEvents: snapshot.data.changeEvents?.length ?? 0,
              connectionRecords: snapshot.data.connectionRecords?.length ?? 0,
            },
          });
        } catch (error) {
          sendJson(
            res,
            { message: error instanceof Error ? error.message : "同步只读 API 快照失败" },
            500,
          );
        }
      });

      server.middlewares.use("/api/agent/v1/auth/token", async (req, res) => {
        if (req.method === "GET") {
          const settings = await loadAgentAuthSettings();
          sendJson(res, {
            enabled: settings.enabled,
            tokenPreview: previewToken(settings.token),
          });
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const body = (await readBody(req)) as { enabled?: boolean; token?: string };
        const nextSettings: AgentAuthSettings = {
          enabled: Boolean(body.enabled),
          token: body.token?.trim() || undefined,
        };
        if (nextSettings.enabled && !nextSettings.token) {
          sendJson(res, { message: "启用令牌时 Token 不能为空。" }, 400);
          return;
        }
        await saveAgentAuthSettings(nextSettings);
        sendJson(res, {
          enabled: nextSettings.enabled,
          tokenPreview: previewToken(nextSettings.token),
        });
      });

      server.middlewares.use("/api/agent/v1/health", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, {
          status: "ok",
          readonly: true,
          generatedAt: snapshot.generatedAt,
          endpoints: [
            "/api/agent/v1/topology",
            "/api/agent/v1/rooms",
            "/api/agent/v1/racks",
            "/api/agent/v1/devices",
            "/api/agent/v1/alerts",
            "/api/agent/v1/audit-logs",
            "/api/agent/v1/access-records",
            "/api/agent/v1/change-events",
            "/api/agent/v1/connections",
          ],
        });
      });

      server.middlewares.use("/api/agent/v1/tools", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        sendJson(res, { data: getAgentReadonlyTools(getAgentApiBaseUrl(req)) });
      });

      server.middlewares.use("/api/agent/v1/openapi.json", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        sendJson(res, buildAgentOpenApiDocument(getAgentApiBaseUrl(req)));
      });

      server.middlewares.use("/api/agent/v1/topology", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, snapshot);
      });

      server.middlewares.use("/api/agent/v1/rooms", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: snapshot.data.rooms });
      });

      server.middlewares.use("/api/agent/v1/racks", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentRacks(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/devices", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentDevices(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/alerts", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentAlerts(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/audit-logs", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentAuditLogs(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/access-records", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentAccessRecords(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/change-events", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentChangeEvents(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/agent/v1/connections", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        sendJson(res, { data: filterAgentConnections(snapshot.data, getQuery(req)) });
      });

      server.middlewares.use("/api/webhooks/alerts", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const token = (req.url ?? "").split("/").filter(Boolean).at(-1);
          const body = (await readBody(req)) as {
            hostname?: string;
            ip?: string;
            title?: string;
            message?: string;
            severity?: string;
            source?: "manual" | "prometheus" | "zoho" | "custom";
          };
          const snapshot = await loadAgentSnapshot();
          const device = snapshot.data.devices.find(
            (item) =>
              item.computerName === body.hostname ||
              item.name === body.hostname ||
              item.businessIp === body.ip ||
              item.managementIp === body.ip ||
              item.ips.includes(body.ip ?? ""),
          );

          if (!token || !device) {
            sendJson(res, { message: "Webhook Token 或设备匹配失败" }, 400);
            return;
          }

          const severity = body.severity?.toLowerCase() ?? "";
          const alert: Alert = {
            id: `webhook-${Date.now()}`,
            deviceId: device.id,
            source: body.source ?? "zoho",
            level: /critical|严重|fatal|high/.test(severity)
              ? "critical"
              : /warning|warn|告警|中/.test(severity)
                ? "warning"
                : "info",
            status: "unconfirmed",
            title: body.title || body.message || "Webhook 告警",
            description: body.message,
            startedAt: new Date().toISOString(),
          };
          snapshot.data.alerts = [alert, ...snapshot.data.alerts];
          snapshot.generatedAt = new Date().toISOString();
          await saveAgentSnapshot(snapshot);
          sendJson(res, { message: "Webhook 告警已接收", alert });
        } catch (error) {
          sendJson(
            res,
            { message: error instanceof Error ? error.message : "Webhook 告警接收失败" },
            500,
          );
        }
      });

      server.middlewares.use("/__ai_proxy/models", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const body = (await readBody(req)) as {
            provider?: string;
            baseUrl?: string;
            apiKeyRef?: string;
            model?: string;
          };
          const baseUrl = body.baseUrl?.replace(/\/$/, "") ?? "";

          if (!baseUrl && body.provider !== "gemini") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: "Base URL 不能为空" }));
            return;
          }

          if (body.provider === "gemini") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ data: body.model ? [{ id: body.model }] : [] }),
            );
            return;
          }

          if (body.provider === "ollama") {
            const response = await fetch(`${baseUrl}/api/tags`);
            const data = await response.json();
            const models = Array.isArray(data.models)
              ? data.models.map((item: { name: string }) => item.name)
              : [];
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ models }));
            return;
          }

          const headers: Record<string, string> = {};
          if (body.apiKeyRef) {
            headers.Authorization = `Bearer ${body.apiKeyRef}`;
          }

          const response = await fetch(`${baseUrl}/models`, { headers });
          const data = await response.json();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message:
                error instanceof Error ? error.message : "模型代理请求失败",
            }),
          );
        }
      });

      server.middlewares.use("/__ai_proxy/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const body = (await readBody(req)) as {
            provider?: string;
            baseUrl?: string;
            apiKeyRef?: string;
            model?: string;
            messages?: Array<{ role: string; content: string }>;
          };
          const baseUrl = body.baseUrl?.replace(/\/$/, "") ?? "";

          if (body.provider === "ollama") {
            const response = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: body.model,
                messages: body.messages,
                stream: false,
              }),
            });
            const data = await response.json();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return;
          }

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (body.apiKeyRef) {
            headers.Authorization = `Bearer ${body.apiKeyRef}`;
          }

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: body.model,
              messages: body.messages,
              temperature: 0.2,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            sendJson(
              res,
              { message: data.error?.message || data.message || "模型上游请求失败" },
              response.status,
            );
            return;
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message:
                error instanceof Error ? error.message : "模型聊天代理请求失败",
            }),
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), aiProxyPlugin()],
  test: {
    include: ["src/tests/unit/**/*.test.ts"],
  },
});
