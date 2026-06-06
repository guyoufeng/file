import type { IncomingMessage } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentReadonlySnapshot } from "../src/services/agent/readonlyApi";

export interface LocalServiceAuditInput {
  actor?: string;
  action: string;
  targetType: string;
  targetId?: string;
  requiredScope?: "read" | "write";
  status: "success" | "denied" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface LocalServiceAuditRecord extends Required<Omit<LocalServiceAuditInput, "targetId" | "requiredScope" | "metadata">> {
  id: string;
  targetId?: string;
  requiredScope?: "read" | "write";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type AgentWriteApprovalStatus = "pending" | "approved" | "rejected" | "applied";
export type GatewayMessageDirection = "inbound" | "outbound";

export interface AgentWriteApprovalInput {
  actor?: string;
  module: string;
  action: string;
  summary: string;
  payload: unknown;
}

export interface AgentWriteApprovalRecord extends Required<Omit<AgentWriteApprovalInput, "actor">> {
  id: string;
  actor: string;
  status: AgentWriteApprovalStatus;
  decisionBy?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWriteApprovalDecision {
  id: string;
  status: Exclude<AgentWriteApprovalStatus, "pending">;
  decisionBy: string;
  decisionNote?: string;
}

export interface GatewayMessageInput {
  provider: string;
  externalUserId: string;
  displayName: string;
  direction: GatewayMessageDirection;
  content: string;
  rawPayload?: unknown;
}

export interface GatewayMessageRecord extends GatewayMessageInput {
  id: string;
  status: "received" | "processed" | "failed";
  createdAt: string;
}

const snapshotKey = "agent.readonly.snapshot";

function sqlitePath(baseDir: string) {
  return path.join(baseDir, "qf-ai-dcim-service.sqlite");
}

function jsonSnapshotPath(baseDir: string) {
  return path.join(baseDir, "agent-api-snapshot.json");
}

function jsonAuditPath(baseDir: string) {
  return path.join(baseDir, "service-audit-log.json");
}

function jsonCollectionPath(baseDir: string, name: string) {
  return path.join(baseDir, "collections", `${encodeURIComponent(name)}.json`);
}

function jsonApprovalsPath(baseDir: string) {
  return path.join(baseDir, "agent-write-approvals.json");
}

function jsonGatewayMessagesPath(baseDir: string) {
  return path.join(baseDir, "agent-gateway-messages.json");
}

function now() {
  return new Date().toISOString();
}

function createAuditRecord(input: LocalServiceAuditInput): LocalServiceAuditRecord {
  return {
    id: `local-service-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: input.actor ?? "local-service",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    requiredScope: input.requiredScope,
    status: input.status,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: now(),
  };
}

export class LocalServiceDataSource {
  readonly baseDir: string;
  private db: DatabaseSync | null = null;

  constructor(baseDir = path.resolve(".local")) {
    this.baseDir = baseDir;
  }

  get mode(): "sqlite" | "json" {
    return this.db ? "sqlite" : "json";
  }

  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    try {
      this.db = new DatabaseSync(sqlitePath(this.baseDir));
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS service_documents (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS service_audit_logs (
          id TEXT PRIMARY KEY,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT,
          required_scope TEXT,
          status TEXT NOT NULL,
          summary TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_service_audit_logs_created_at
          ON service_audit_logs(created_at);
        CREATE TABLE IF NOT EXISTS service_collections (
          name TEXT PRIMARY KEY,
          records_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS agent_write_approvals (
          id TEXT PRIMARY KEY,
          actor TEXT NOT NULL,
          module TEXT NOT NULL,
          action TEXT NOT NULL,
          summary TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL,
          decision_by TEXT,
          decision_note TEXT,
          decided_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_write_approvals_status
          ON agent_write_approvals(status, created_at);
        CREATE TABLE IF NOT EXISTS gateway_messages (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          external_user_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          direction TEXT NOT NULL,
          content TEXT NOT NULL,
          raw_payload_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_gateway_messages_created_at
          ON gateway_messages(created_at);
      `);
    } catch {
      this.db = null;
    }
  }

  async loadCollection<T = unknown>(name: string): Promise<T[]> {
    if (this.db) {
      const row = this.db
        .prepare("SELECT records_json FROM service_collections WHERE name = ?")
        .get(name) as { records_json?: string } | undefined;
      return row?.records_json ? (JSON.parse(row.records_json) as T[]) : [];
    }

    try {
      const parsed = JSON.parse(await readFile(jsonCollectionPath(this.baseDir, name), "utf8")) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveCollection<T = unknown>(name: string, records: T[]): Promise<void> {
    if (this.db) {
      this.db
        .prepare(
          "INSERT INTO service_collections (name, records_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET records_json = excluded.records_json, updated_at = excluded.updated_at",
        )
        .run(name, JSON.stringify(records), now());
      return;
    }

    const targetPath = jsonCollectionPath(this.baseDir, name);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, JSON.stringify(records, null, 2), "utf8");
  }

  async listCollections(): Promise<Array<{ name: string; updatedAt: string }>> {
    if (this.db) {
      const rows = this.db
        .prepare("SELECT name, updated_at FROM service_collections ORDER BY name")
        .all() as Array<{ name: string; updated_at: string }>;
      return rows.map((row) => ({ name: row.name, updatedAt: row.updated_at }));
    }
    return [];
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async loadSnapshot(): Promise<AgentReadonlySnapshot | null> {
    if (this.db) {
      const row = this.db
        .prepare("SELECT value_json FROM service_documents WHERE key = ?")
        .get(snapshotKey) as { value_json?: string } | undefined;
      return row?.value_json ? (JSON.parse(row.value_json) as AgentReadonlySnapshot) : null;
    }

    try {
      return JSON.parse(await readFile(jsonSnapshotPath(this.baseDir), "utf8")) as AgentReadonlySnapshot;
    } catch {
      return null;
    }
  }

  async saveSnapshot(snapshot: AgentReadonlySnapshot): Promise<void> {
    if (this.db) {
      this.db
        .prepare(
          "INSERT INTO service_documents (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
        )
        .run(snapshotKey, JSON.stringify(snapshot), now());
      return;
    }

    await mkdir(this.baseDir, { recursive: true });
    await writeFile(jsonSnapshotPath(this.baseDir), JSON.stringify(snapshot, null, 2), "utf8");
  }

  async appendAudit(input: LocalServiceAuditInput): Promise<LocalServiceAuditRecord> {
    const record = createAuditRecord(input);
    if (this.db) {
      this.db
        .prepare(
          "INSERT INTO service_audit_logs (id, actor, action, target_type, target_id, required_scope, status, summary, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.actor,
          record.action,
          record.targetType,
          record.targetId ?? null,
          record.requiredScope ?? null,
          record.status,
          record.summary,
          JSON.stringify(record.metadata),
          record.createdAt,
        );
      return record;
    }

    const records = await this.loadAuditLogs(500);
    await writeFile(jsonAuditPath(this.baseDir), JSON.stringify([record, ...records].slice(0, 500), null, 2), "utf8");
    return record;
  }

  async loadAuditLogs(limit = 200): Promise<LocalServiceAuditRecord[]> {
    if (this.db) {
      const rows = this.db
        .prepare(
          "SELECT id, actor, action, target_type, target_id, required_scope, status, summary, metadata_json, created_at FROM service_audit_logs ORDER BY created_at DESC LIMIT ?",
        )
        .all(limit) as Array<{
          id: string;
          actor: string;
          action: string;
          target_type: string;
          target_id?: string | null;
          required_scope?: "read" | "write" | null;
          status: "success" | "denied" | "failed";
          summary: string;
          metadata_json: string;
          created_at: string;
        }>;
      return rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id ?? undefined,
        requiredScope: row.required_scope ?? undefined,
        status: row.status,
        summary: row.summary,
        metadata: JSON.parse(row.metadata_json || "{}") as Record<string, unknown>,
        createdAt: row.created_at,
      }));
    }

    try {
      const parsed = JSON.parse(await readFile(jsonAuditPath(this.baseDir), "utf8")) as LocalServiceAuditRecord[];
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  async createWriteApproval(input: AgentWriteApprovalInput): Promise<AgentWriteApprovalRecord> {
    const timestamp = now();
    const record: AgentWriteApprovalRecord = {
      id: `agent-write-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor: input.actor ?? "ai-agent",
      module: input.module,
      action: input.action,
      summary: input.summary,
      payload: input.payload,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (this.db) {
      this.db
        .prepare(
          "INSERT INTO agent_write_approvals (id, actor, module, action, summary, payload_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.actor,
          record.module,
          record.action,
          record.summary,
          JSON.stringify(record.payload),
          record.status,
          record.createdAt,
          record.updatedAt,
        );
    } else {
      const records = await this.loadWriteApprovals(500);
      await writeFile(jsonApprovalsPath(this.baseDir), JSON.stringify([record, ...records], null, 2), "utf8");
    }

    await this.appendAudit({
      actor: record.actor,
      action: "agent_write.approval.create",
      targetType: "agent_write_approval",
      targetId: record.id,
      requiredScope: "write",
      status: "success",
      summary: record.summary,
      metadata: { module: record.module, action: record.action },
    });
    return record;
  }

  async decideWriteApproval(decision: AgentWriteApprovalDecision): Promise<AgentWriteApprovalRecord | undefined> {
    const timestamp = now();
    if (this.db) {
      this.db
        .prepare(
          "UPDATE agent_write_approvals SET status = ?, decision_by = ?, decision_note = ?, decided_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(decision.status, decision.decisionBy, decision.decisionNote ?? null, timestamp, timestamp, decision.id);
      const [record] = await this.loadWriteApprovals(500, decision.id);
      if (record) {
        await this.appendAudit({
          actor: decision.decisionBy,
          action: `agent_write.approval.${decision.status}`,
          targetType: "agent_write_approval",
          targetId: decision.id,
          requiredScope: "write",
          status: "success",
          summary: `${decision.status === "approved" ? "批准" : "处理"} Agent 写入审批：${record.summary}`,
          metadata: { decisionNote: decision.decisionNote },
        });
      }
      return record;
    }

    const records = await this.loadWriteApprovals(500);
    let updated: AgentWriteApprovalRecord | undefined;
    const next = records.map((record) => {
      if (record.id !== decision.id) return record;
      updated = {
        ...record,
        status: decision.status,
        decisionBy: decision.decisionBy,
        decisionNote: decision.decisionNote,
        decidedAt: timestamp,
        updatedAt: timestamp,
      };
      return updated;
    });
    await writeFile(jsonApprovalsPath(this.baseDir), JSON.stringify(next, null, 2), "utf8");
    return updated;
  }

  async loadWriteApprovals(limit = 200, id?: string): Promise<AgentWriteApprovalRecord[]> {
    if (this.db) {
      const sql = id
        ? "SELECT id, actor, module, action, summary, payload_json, status, decision_by, decision_note, decided_at, created_at, updated_at FROM agent_write_approvals WHERE id = ? ORDER BY created_at DESC LIMIT ?"
        : "SELECT id, actor, module, action, summary, payload_json, status, decision_by, decision_note, decided_at, created_at, updated_at FROM agent_write_approvals ORDER BY created_at DESC LIMIT ?";
      const rows = (id
        ? this.db.prepare(sql).all(id, limit)
        : this.db.prepare(sql).all(limit)) as Array<{
        id: string;
        actor: string;
        module: string;
        action: string;
        summary: string;
        payload_json: string;
        status: AgentWriteApprovalStatus;
        decision_by?: string | null;
        decision_note?: string | null;
        decided_at?: string | null;
        created_at: string;
        updated_at: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        module: row.module,
        action: row.action,
        summary: row.summary,
        payload: JSON.parse(row.payload_json || "{}") as unknown,
        status: row.status,
        decisionBy: row.decision_by ?? undefined,
        decisionNote: row.decision_note ?? undefined,
        decidedAt: row.decided_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    try {
      const records = JSON.parse(await readFile(jsonApprovalsPath(this.baseDir), "utf8")) as AgentWriteApprovalRecord[];
      return records.filter((record) => !id || record.id === id).slice(0, limit);
    } catch {
      return [];
    }
  }

  async appendGatewayMessage(input: GatewayMessageInput): Promise<GatewayMessageRecord> {
    const record: GatewayMessageRecord = {
      ...input,
      id: `gateway-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "received",
      createdAt: now(),
    };

    if (this.db) {
      this.db
        .prepare(
          "INSERT INTO gateway_messages (id, provider, external_user_id, display_name, direction, content, raw_payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.id,
          record.provider,
          record.externalUserId,
          record.displayName,
          record.direction,
          record.content,
          JSON.stringify(record.rawPayload ?? {}),
          record.status,
          record.createdAt,
        );
    } else {
      const records = await this.loadGatewayMessages(500);
      await writeFile(jsonGatewayMessagesPath(this.baseDir), JSON.stringify([record, ...records], null, 2), "utf8");
    }

    await this.appendAudit({
      actor: `${record.provider}:${record.externalUserId}`,
      action: "agent_gateway.message.received",
      targetType: "agent_gateway_message",
      targetId: record.id,
      requiredScope: "read",
      status: "success",
      summary: `收到 ${record.provider} ${record.direction} 消息：${record.content.slice(0, 80)}`,
      metadata: { provider: record.provider, displayName: record.displayName },
    });
    return record;
  }

  async loadGatewayMessages(limit = 200): Promise<GatewayMessageRecord[]> {
    if (this.db) {
      const rows = this.db
        .prepare(
          "SELECT id, provider, external_user_id, display_name, direction, content, raw_payload_json, status, created_at FROM gateway_messages ORDER BY created_at DESC LIMIT ?",
        )
        .all(limit) as Array<{
          id: string;
          provider: string;
          external_user_id: string;
          display_name: string;
          direction: GatewayMessageDirection;
          content: string;
          raw_payload_json: string;
          status: "received" | "processed" | "failed";
          created_at: string;
        }>;
      return rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        externalUserId: row.external_user_id,
        displayName: row.display_name,
        direction: row.direction,
        content: row.content,
        rawPayload: JSON.parse(row.raw_payload_json || "{}") as unknown,
        status: row.status,
        createdAt: row.created_at,
      }));
    }

    try {
      const parsed = JSON.parse(await readFile(jsonGatewayMessagesPath(this.baseDir), "utf8")) as GatewayMessageRecord[];
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  async createBackup(): Promise<{ path: string; exportedAt: string }> {
    const exportedAt = now();
    const collections = await Promise.all(
      (await this.listCollections()).map(async (collection) => ({
        ...collection,
        records: await this.loadCollection(collection.name),
      })),
    );
    const backup = {
      schemaVersion: "0.1.0",
      exportedAt,
      dataSourceMode: this.mode,
      collections,
      auditLogs: await this.loadAuditLogs(1000),
      agentWriteApprovals: await this.loadWriteApprovals(1000),
      gatewayMessages: await this.loadGatewayMessages(1000),
    };
    const backupDir = path.join(this.baseDir, "backups");
    await mkdir(backupDir, { recursive: true });
    const targetPath = path.join(backupDir, `qf-ai-dcim-backup-${exportedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}.json`);
    await writeFile(targetPath, JSON.stringify(backup, null, 2), "utf8");
    await this.appendAudit({
      actor: "local-service",
      action: "backup.create",
      targetType: "backup",
      targetId: targetPath,
      requiredScope: "write",
      status: "success",
      summary: "创建统一数据层备份",
      metadata: { path: targetPath, collections: collections.length },
    });
    return { path: targetPath, exportedAt };
  }
}

export function getRequestActor(req: IncomingMessage): string {
  const forwardedUser = req.headers["x-qf-actor"];
  if (Array.isArray(forwardedUser)) return forwardedUser[0] ?? "external-agent";
  return forwardedUser || "external-agent";
}
