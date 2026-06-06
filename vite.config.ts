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
import type { Alert, AuditLog, Device } from "./src/types/domain";
import type { AccessRecord } from "./src/features/access-management/accessRecords";
import type { ChangeEvent } from "./src/features/change-management/changeEvents";
import { LocalServiceDataSource, getRequestActor } from "./local-service/dataSource";

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
const agentApiKeysPath = path.resolve(".local/agent-api-keys.json");
const demoSeedPath = path.resolve(".local/demo-seed.json");
const gatewayInboxPath = path.resolve(".local/agent-gateway-inbox.json");
const localDataSource = new LocalServiceDataSource(path.resolve(".local"));
const localDataSourceReady = localDataSource.init();

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

type AgentApiScope = "read" | "write";

interface AgentApiKeyRecord {
  id: string;
  name: string;
  scopes: AgentApiScope[];
  tokenHash: string;
  tokenPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

function previewToken(token?: string): string | undefined {
  if (!token) return undefined;
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

function hashAgentToken(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createAgentToken(): string {
  return `qf_agent_${crypto.randomUUID().replace(/-/g, "")}`;
}

function publicApiKey(record: AgentApiKeyRecord) {
  const { tokenHash: _tokenHash, ...publicPart } = record;
  return publicPart;
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

async function loadAgentApiKeys(): Promise<AgentApiKeyRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(agentApiKeysPath, "utf8")) as AgentApiKeyRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAgentApiKeys(keys: AgentApiKeyRecord[]): Promise<void> {
  await mkdir(path.dirname(agentApiKeysPath), { recursive: true });
  await writeFile(agentApiKeysPath, JSON.stringify(keys, null, 2), "utf8");
}

async function ensureAgentAuthorized(
  req: IncomingMessage,
  res: Parameters<import("connect").NextHandleFunction>[1],
  requiredScope: AgentApiScope = "read",
): Promise<boolean> {
  await localDataSourceReady;
  const settings = await loadAgentAuthSettings();
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (requiredScope === "read" && !settings.enabled) return true;
  if (requiredScope === "read" && token && token === settings.token) {
    await localDataSource.appendAudit({
      actor: getRequestActor(req),
      action: "agent_api.authorize",
      targetType: "agent_api",
      requiredScope,
      status: "success",
      summary: "Agent API 只读令牌验证通过",
    });
    return true;
  }

  if (token) {
    const keys = await loadAgentApiKeys();
    const hash = hashAgentToken(token);
    const record = keys.find((item) => item.tokenHash === hash && item.enabled);
    if (record?.scopes.includes(requiredScope)) {
      const updated = {
        ...record,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveAgentApiKeys(keys.map((item) => (item.id === record.id ? updated : item)));
      await localDataSource.appendAudit({
        actor: record.name,
        action: "agent_api.authorize",
        targetType: "agent_api_key",
        targetId: record.id,
        requiredScope,
        status: "success",
        summary: `Agent API Key ${record.name} 通过 ${requiredScope} 权限校验`,
      });
      return true;
    }
  }

  await localDataSource.appendAudit({
    actor: getRequestActor(req),
    action: "agent_api.authorize",
    targetType: "agent_api",
    requiredScope,
    status: "denied",
    summary: `Agent API ${requiredScope} 权限校验失败`,
    metadata: { hasBearerToken: Boolean(token) },
  });
  sendJson(
    res,
    {
      message:
        requiredScope === "write"
          ? "Agent API 写入接口需要具备 write 权限的 API Key。"
          : "Agent API 已启用访问令牌，请使用 Authorization: Bearer <token> 调用。",
      requiredScope,
    },
    401,
  );
  return false;
}

async function loadAgentSnapshot(): Promise<AgentReadonlySnapshot> {
  await localDataSourceReady;
  const sqliteSnapshot = await localDataSource.loadSnapshot();
  if (sqliteSnapshot) return sqliteSnapshot;
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
  await localDataSourceReady;
  await localDataSource.saveSnapshot(snapshot);
  await mkdir(path.dirname(agentSnapshotPath), { recursive: true });
  await writeFile(agentSnapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
}

async function auditAgentApi(
  req: IncomingMessage,
  input: {
    action: string;
    summary: string;
    targetType?: string;
    targetId?: string;
    requiredScope?: AgentApiScope;
    status?: "success" | "denied" | "failed";
    metadata?: Record<string, unknown>;
  },
) {
  await localDataSourceReady;
  await localDataSource.appendAudit({
    actor: getRequestActor(req),
    action: input.action,
    targetType: input.targetType ?? "agent_api",
    targetId: input.targetId,
    requiredScope: input.requiredScope,
    status: input.status ?? "success",
    summary: input.summary,
    metadata: {
      method: req.method ?? "GET",
      endpoint: req.url ?? "",
      ...input.metadata,
    },
  });
}

function toDomainAuditLog(record: Awaited<ReturnType<LocalServiceDataSource["loadAuditLogs"]>>[number]): AuditLog {
  return {
    id: record.id,
    actor: record.actor,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    summary: record.summary,
    createdAt: record.createdAt,
    metadata: {
      ...record.metadata,
      requiredScope: record.requiredScope,
      status: record.status,
      source: "local_http_service",
    },
  };
}

async function getCombinedAuditLogs(snapshot: AgentReadonlySnapshot): Promise<AuditLog[]> {
  await localDataSourceReady;
  const serviceLogs = (await localDataSource.loadAuditLogs(500)).map(toDomainAuditLog);
  return [...serviceLogs, ...(snapshot.data.auditLogs ?? [])].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

async function appendGatewayInbox(message: unknown): Promise<number> {
  let records: unknown[] = [];
  try {
    const parsed = JSON.parse(await readFile(gatewayInboxPath, "utf8")) as unknown[];
    records = Array.isArray(parsed) ? parsed : [];
  } catch {
    records = [];
  }
  records.unshift(message);
  await mkdir(path.dirname(gatewayInboxPath), { recursive: true });
  await writeFile(gatewayInboxPath, JSON.stringify(records.slice(0, 500), null, 2), "utf8");
  return records.length;
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

      server.middlewares.use("/api/local/v1/collections", async (req, res) => {
        await localDataSourceReady;
        const collectionName = decodeURIComponent(
          new URL(req.url ?? "/", "http://localhost").pathname.split("/").filter(Boolean)[0] ?? "",
        );

        if (!collectionName) {
          if (req.method === "GET") {
            sendJson(res, {
              dataSourceMode: localDataSource.mode,
              data: await localDataSource.listCollections(),
            });
            return;
          }
          sendJson(res, { message: "缺少 collection 名称。" }, 400);
          return;
        }

        if (req.method === "GET") {
          sendJson(res, {
            collection: collectionName,
            data: await localDataSource.loadCollection(collectionName),
            dataSourceMode: localDataSource.mode,
          });
          return;
        }

        if (req.method !== "PUT" && req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const body = (await readBody(req)) as { data?: unknown[] };
        if (!Array.isArray(body.data)) {
          sendJson(res, { message: "collection 写入需要 data 数组。" }, 400);
          return;
        }
        await localDataSource.saveCollection(collectionName, body.data);
        await localDataSource.appendAudit({
          actor: getRequestActor(req),
          action: "local_collection.write",
          targetType: "local_collection",
          targetId: collectionName,
          requiredScope: "write",
          status: "success",
          summary: `写入统一数据集合：${collectionName}`,
          metadata: { count: body.data.length, dataSourceMode: localDataSource.mode },
        });
        sendJson(res, {
          message: "统一数据集合已写入 SQLite 后端",
          collection: collectionName,
          count: body.data.length,
          dataSourceMode: localDataSource.mode,
        });
      });

      server.middlewares.use("/api/local/v1/backups", async (req, res) => {
        await localDataSourceReady;
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        if (!(await ensureAgentAuthorized(req, res, "write"))) return;
        const backup = await localDataSource.createBackup();
        sendJson(res, {
          message: "统一后端数据备份已创建",
          data: backup,
          dataSourceMode: localDataSource.mode,
        });
      });

      server.middlewares.use("/api/agent/v1/snapshot", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        if (req.method === "GET") {
          const snapshot = await loadAgentSnapshot();
          await auditAgentApi(req, {
            action: "agent_api.snapshot.read",
            summary: "读取 Agent API 全量快照",
            requiredScope: "read",
            metadata: { dataSourceMode: localDataSource.mode },
          });
          sendJson(res, snapshot);
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
          await auditAgentApi(req, {
            action: "agent_api.snapshot.sync",
            summary: "同步 Agent API 全量快照",
            requiredScope: "write",
            metadata: {
              dataSourceMode: localDataSource.mode,
              devices: snapshot.data.devices.length,
              racks: snapshot.data.racks.length,
            },
          });
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
        await auditAgentApi(req, {
          action: "agent_api.auth_token.update",
          summary: `${nextSettings.enabled ? "启用" : "停用"} Agent API 只读令牌`,
          targetType: "agent_api_auth",
          requiredScope: "write",
          metadata: { enabled: nextSettings.enabled },
        });
        sendJson(res, {
          enabled: nextSettings.enabled,
          tokenPreview: previewToken(nextSettings.token),
        });
      });

      server.middlewares.use("/api/agent/v1/auth/keys", async (req, res) => {
        if (req.method === "GET") {
          const keys = await loadAgentApiKeys();
          sendJson(res, { data: keys.map(publicApiKey) });
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const body = (await readBody(req)) as { name?: string; scopes?: AgentApiScope[] };
        const token = createAgentToken();
        const now = new Date().toISOString();
        const scopes = new Set<AgentApiScope>(body.scopes?.length ? body.scopes : ["read"]);
        if (scopes.has("write")) scopes.add("read");
        const record: AgentApiKeyRecord = {
          id: `agent-key-${crypto.randomUUID()}`,
          name: body.name?.trim() || "未命名 Agent API Key",
          scopes: [...scopes],
          tokenHash: hashAgentToken(token),
          tokenPreview: previewToken(token) ?? "qf_agent_...",
          enabled: true,
          createdAt: now,
          updatedAt: now,
        };
        await saveAgentApiKeys([record, ...(await loadAgentApiKeys())]);
        await auditAgentApi(req, {
          action: "agent_api_key.create",
          summary: `创建 Agent API Key：${record.name}`,
          targetType: "agent_api_key",
          targetId: record.id,
          requiredScope: "write",
          metadata: { scopes: record.scopes },
        });
        sendJson(res, { record: publicApiKey(record), token });
      });

      server.middlewares.use("/api/agent/v1/write-approvals", async (req, res) => {
        await localDataSourceReady;
        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        const segments = requestUrl.pathname.split("/").filter(Boolean);

        if (req.method === "GET") {
          if (!(await ensureAgentAuthorized(req, res, "read"))) return;
          const status = requestUrl.searchParams.get("status");
          const approvals = await localDataSource.loadWriteApprovals(500);
          sendJson(res, {
            data: status ? approvals.filter((item) => item.status === status) : approvals,
            dataSourceMode: localDataSource.mode,
          });
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const body = (await readBody(req)) as {
          module?: string;
          action?: string;
          summary?: string;
          payload?: unknown;
          decisionBy?: string;
          decisionNote?: string;
          status?: "approved" | "rejected" | "applied";
        };

        if (segments.length >= 2 && segments[1] === "decision") {
          if (!(await ensureAgentAuthorized(req, res, "write"))) return;
          const id = segments[0];
          const status = body.status ?? "approved";
          const record = await localDataSource.decideWriteApproval({
            id,
            status,
            decisionBy: body.decisionBy || getRequestActor(req),
            decisionNote: body.decisionNote,
          });
          if (!record) {
            sendJson(res, { message: "审批记录不存在。" }, 404);
            return;
          }
          sendJson(res, { message: "Agent 写入审批已处理", data: record });
          return;
        }

        if (!(await ensureAgentAuthorized(req, res, "write"))) return;
        if (!body.module || !body.action || !body.summary) {
          sendJson(res, { message: "创建审批需要 module、action、summary。" }, 400);
          return;
        }
        const record = await localDataSource.createWriteApproval({
          actor: getRequestActor(req),
          module: body.module,
          action: body.action,
          summary: body.summary,
          payload: body.payload ?? {},
        });
        sendJson(res, {
          message: "Agent 写入请求已进入审批流",
          data: record,
          requiresApproval: true,
        });
      });

      server.middlewares.use("/api/agent/v1/health", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        await auditAgentApi(req, {
          action: "agent_api.health.read",
          summary: "读取 Agent API 健康状态",
          requiredScope: "read",
          metadata: { dataSourceMode: localDataSource.mode },
        });
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
        await auditAgentApi(req, {
          action: "agent_api.tools.read",
          summary: "读取 Agent 工具清单",
          requiredScope: "read",
        });
        sendJson(res, { data: getAgentReadonlyTools(getAgentApiBaseUrl(req)) });
      });

      server.middlewares.use("/api/agent/v1/openapi.json", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        await auditAgentApi(req, {
          action: "agent_api.openapi.read",
          summary: "读取 Agent OpenAPI 描述",
          requiredScope: "read",
        });
        sendJson(res, buildAgentOpenApiDocument(getAgentApiBaseUrl(req)));
      });

      server.middlewares.use("/api/agent/v1/topology", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        await auditAgentApi(req, {
          action: "agent_api.topology.read",
          summary: "读取拓扑全量数据",
          requiredScope: "read",
        });
        sendJson(res, snapshot);
      });

      server.middlewares.use("/api/agent/v1/rooms", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        await auditAgentApi(req, {
          action: "agent_api.rooms.read",
          summary: "读取机房列表",
          requiredScope: "read",
        });
        sendJson(res, { data: snapshot.data.rooms });
      });

      server.middlewares.use("/api/agent/v1/racks", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentRacks(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.racks.read",
          summary: `读取机柜列表：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/devices", async (req, res) => {
        if (req.method !== "GET") {
          if (!(await ensureAgentAuthorized(req, res, "write"))) return;
          const snapshot = await loadAgentSnapshot();
          const body = (await readBody(req)) as Partial<Device> & { id?: string };
          if (!body.id && !body.computerName && !body.name) {
            sendJson(res, { message: "写入设备至少需要 id、computerName 或 name。" }, 400);
            return;
          }
          const nowId = `api-device-${Date.now()}`;
          const existing = snapshot.data.devices.find(
            (item) =>
              item.id === body.id ||
              (!!body.computerName && item.computerName === body.computerName) ||
              (!!body.businessIp && item.businessIp === body.businessIp),
          );
          const saved: Device = {
            ...(existing ?? {
              id: body.id || nowId,
              rackId: body.rackId || snapshot.data.racks[0]?.id || "rack-unassigned",
              categoryId: body.categoryId || "server",
              name: body.name || "物理服务器",
              ips: [],
              side: "front",
              startU: 1,
              endU: body.heightU || 1,
              heightU: body.heightU || 1,
              status: "normal",
              ports: [],
            }),
            ...body,
            id: existing?.id || body.id || nowId,
            ips: body.ips ?? existing?.ips ?? (body.businessIp ? [body.businessIp] : []),
            ports: body.ports ?? existing?.ports ?? [],
            metadata: body.metadata ?? existing?.metadata,
          };
          snapshot.data.devices = [saved, ...snapshot.data.devices.filter((item) => item.id !== saved.id)];
          snapshot.generatedAt = new Date().toISOString();
          await saveAgentSnapshot(snapshot);
          await auditAgentApi(req, {
            action: existing ? "agent_api.devices.update" : "agent_api.devices.create",
            summary: existing ? `更新设备：${saved.computerName || saved.name}` : `新增设备：${saved.computerName || saved.name}`,
            targetType: "device",
            targetId: saved.id,
            requiredScope: "write",
            metadata: { businessIp: saved.businessIp, rackId: saved.rackId },
          });
          sendJson(res, { message: existing ? "设备已更新" : "设备已新增", data: saved });
          return;
        }
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentDevices(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.devices.read",
          summary: `读取设备列表：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/alerts", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentAlerts(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.alerts.read",
          summary: `读取告警列表：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/audit-logs", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const auditLogs = await getCombinedAuditLogs(snapshot);
        const data = filterAgentAuditLogs({ auditLogs }, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.audit_logs.read",
          summary: `读取审计日志：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/access-records", async (req, res) => {
        if (req.method !== "GET") {
          if (!(await ensureAgentAuthorized(req, res, "write"))) return;
          const snapshot = await loadAgentSnapshot();
          const body = (await readBody(req)) as Partial<AccessRecord>;
          const now = new Date().toISOString();
          const saved: AccessRecord = {
            id: body.id || `api-access-${Date.now()}`,
            date: body.date || now.slice(0, 10),
            unit: body.unit || "未填写单位",
            visitorName: body.visitorName || "未填写人员",
            enterTime: body.enterTime || now.slice(11, 16),
            leaveTime: body.leaveTime,
            reason: body.reason || "AI/API 录入",
            isServerRepair: Boolean(body.isServerRepair),
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            faultDescription: body.faultDescription,
            result: body.result,
            attachments: body.attachments ?? [],
            createdAt: body.createdAt || now,
            updatedAt: now,
          };
          snapshot.data.accessRecords = [
            saved,
            ...(snapshot.data.accessRecords ?? []).filter((item) => item.id !== saved.id),
          ];
          snapshot.generatedAt = now;
          await saveAgentSnapshot(snapshot);
          await auditAgentApi(req, {
            action: "agent_api.access_records.create",
            summary: `写入进出记录：${saved.date} ${saved.unit}`,
            targetType: "access_record",
            targetId: saved.id,
            requiredScope: "write",
            metadata: { deviceId: saved.deviceId, reason: saved.reason },
          });
          sendJson(res, { message: "进出记录已写入", data: saved });
          return;
        }
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentAccessRecords(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.access_records.read",
          summary: `读取进出记录：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/change-events", async (req, res) => {
        if (req.method !== "GET") {
          if (!(await ensureAgentAuthorized(req, res, "write"))) return;
          const snapshot = await loadAgentSnapshot();
          const body = (await readBody(req)) as Partial<ChangeEvent>;
          const now = new Date().toISOString();
          const saved: ChangeEvent = {
            id: body.id || `api-change-${Date.now()}`,
            title: body.title || "AI/API 变更记录",
            type: body.type || "other",
            status: body.status || "completed",
            roomId: body.roomId,
            roomName: body.roomName,
            rackId: body.rackId,
            rackName: body.rackName,
            deviceId: body.deviceId,
            deviceName: body.deviceName,
            businessIp: body.businessIp,
            operator: body.operator || "api-agent",
            changedAt: body.changedAt || now,
            content: body.content || "未填写变更内容",
            impact: body.impact,
            result: body.result,
            relatedConnectionId: body.relatedConnectionId,
            attachments: body.attachments ?? [],
            createdAt: body.createdAt || now,
            updatedAt: now,
          };
          snapshot.data.changeEvents = [
            saved,
            ...(snapshot.data.changeEvents ?? []).filter((item) => item.id !== saved.id),
          ];
          snapshot.generatedAt = now;
          await saveAgentSnapshot(snapshot);
          await auditAgentApi(req, {
            action: "agent_api.change_events.create",
            summary: `写入变更记录：${saved.title}`,
            targetType: "change_event",
            targetId: saved.id,
            requiredScope: "write",
            metadata: { deviceId: saved.deviceId, type: saved.type, status: saved.status },
          });
          sendJson(res, { message: "变更记录已写入", data: saved });
          return;
        }
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentChangeEvents(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.change_events.read",
          summary: `读取变更记录：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/connections", async (req, res) => {
        if (!(await ensureAgentAuthorized(req, res))) return;
        const snapshot = await loadAgentSnapshot();
        const data = filterAgentConnections(snapshot.data, getQuery(req));
        await auditAgentApi(req, {
          action: "agent_api.connections.read",
          summary: `读取连线关系：${data.length} 条`,
          requiredScope: "read",
          metadata: getQuery(req),
        });
        sendJson(res, { data });
      });

      server.middlewares.use("/api/agent/v1/gateway", async (req, res) => {
        if (req.method === "GET") {
          const requestUrl = new URL(req.url ?? "/", "http://localhost");
          const segments = requestUrl.pathname.split("/").filter(Boolean);
          const provider = segments[0] ?? "wechat";
          if (segments[1] === "pair") {
            const configId = requestUrl.searchParams.get("configId") ?? "";
            const record = {
              id: `gateway-pair-${Date.now()}`,
              provider,
              configId,
              externalUserId: `scan-${Date.now()}`,
              displayName: "扫码配对用户",
              content: "扫码配对成功",
              receivedAt: new Date().toISOString(),
              status: "paired",
            };
            await appendGatewayInbox(record);
            await localDataSource.appendGatewayMessage({
              provider,
              externalUserId: record.externalUserId,
              displayName: record.displayName,
              direction: "inbound",
              content: record.content,
              rawPayload: record,
            });
            await auditAgentApi(req, {
              action: "agent_gateway.pairing.accepted",
              summary: `消息网关扫码配对请求已接收：${provider}`,
              targetType: "agent_gateway",
              targetId: configId || undefined,
              metadata: { provider, externalUserId: record.externalUserId },
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(
              [
                "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />",
                "<title>泉峰AI消息网关配对</title>",
                "<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ecfdf5;color:#0f172a;padding:32px;line-height:1.7}main{max-width:560px;margin:auto;background:white;border:1px solid #bbf7d0;border-radius:12px;padding:24px;box-shadow:0 18px 44px rgba(15,23,42,.12)}code{display:block;overflow:auto;background:#f8fafc;border-radius:8px;padding:10px}</style>",
                "</head><body><main>",
                "<h1>消息网关配对请求已记录</h1>",
                `<p>平台已收到 ${provider} 的扫码配对请求。</p>`,
                "<p>平台端回调和审计已就绪。要让个人微信/企业微信/钉钉消息真正进入 AI Agent，还需要部署对应 Hermes-compatible gateway adapter，并把消息 POST 到平台回调地址。</p>",
                `<code>${getRuntimePublicBaseUrl(req)}/api/agent/v1/gateway/${provider}</code>`,
                "</main></body></html>",
              ].join(""),
            );
            return;
          }
          sendJson(res, {
            message: "Agent 消息网关在线",
            provider,
            hermesCompatible: true,
            callbackUrl: `${getRuntimePublicBaseUrl(req)}/api/agent/v1/gateway/${provider}`,
            supportedProviders: ["wechat", "wecom", "dingtalk"],
          });
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        const provider = (req.url ?? "").split("/").filter(Boolean).at(-1) ?? "wechat";
        const body = (await readBody(req)) as {
          externalUserId?: string;
          displayName?: string;
          content?: string;
          attachments?: unknown[];
        };
        const record = {
          id: `gateway-message-${Date.now()}`,
          provider,
          externalUserId: body.externalUserId || "external-user",
          displayName: body.displayName || "外部用户",
          content: body.content || "",
          attachments: body.attachments ?? [],
          receivedAt: new Date().toISOString(),
          status: "received",
        };
        const total = await appendGatewayInbox(record);
        const gatewayMessage = await localDataSource.appendGatewayMessage({
          provider,
          externalUserId: record.externalUserId,
          displayName: record.displayName,
          direction: "inbound",
          content: record.content,
          rawPayload: body,
        });
        await auditAgentApi(req, {
          action: "agent_gateway.message.received",
          summary: `消息网关收到 ${provider} 消息`,
          targetType: "agent_gateway_message",
          targetId: record.id,
          metadata: {
            provider,
            externalUserId: record.externalUserId,
            hasAttachments: (record.attachments as unknown[]).length > 0,
          },
        });
        sendJson(res, {
          message: "Agent 消息网关已接收",
          readonly: true,
          hermesCompatible: true,
          sessionId: `${provider}-${record.externalUserId}`,
          total,
          record: gatewayMessage,
        });
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
          await auditAgentApi(req, {
            action: "webhook.alert.ingest",
            summary: `Webhook 告警接收：${alert.title}`,
            targetType: "alert",
            targetId: alert.id,
            metadata: { tokenPreview: previewToken(token), deviceId: device.id, level: alert.level },
          });
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
