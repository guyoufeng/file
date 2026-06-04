import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "src-tauri", "src", "db", "migrations", "0002_operational_agent_data.sql"),
  "utf8",
);

describe("SQLite operational schema contract", () => {
  it("keeps the v0.1 operational and agent tables available for Tauri migration", () => {
    [
      "access_records",
      "change_events",
      "virtual_servers",
      "managed_connections",
      "connection_views",
      "agent_run_records",
      "knowledge_entries",
      "custom_agent_skills",
      "gateway_configs",
      "gateway_sessions",
      "agent_api_keys",
      "agent_credentials",
      "alert_webhooks",
      "table_column_preferences",
    ].forEach((tableName) => {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    });
  });

  it("stores secrets by reference or hash instead of raw token columns", () => {
    expect(migrationSql).toContain("token_hash TEXT NOT NULL");
    expect(migrationSql).toContain("secret_ref TEXT");
    expect(migrationSql).toContain("token_ref TEXT");
    expect(migrationSql).not.toContain("secret TEXT");
  });
});
