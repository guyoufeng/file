CREATE TABLE IF NOT EXISTS business_collections (
  name TEXT PRIMARY KEY,
  records_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_write_approvals (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  decision_by TEXT,
  decision_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gateway_messages_created_at
  ON gateway_messages(created_at);
