CREATE TABLE IF NOT EXISTS access_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  unit TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  enter_time TEXT NOT NULL,
  leave_time TEXT,
  reason TEXT NOT NULL,
  is_server_repair INTEGER NOT NULL DEFAULT 0,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  device_name TEXT,
  fault_description TEXT,
  result TEXT,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_records_date ON access_records(date);
CREATE INDEX IF NOT EXISTS idx_access_records_device_id ON access_records(device_id);

CREATE TABLE IF NOT EXISTS change_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_name TEXT,
  rack_id TEXT REFERENCES racks(id) ON DELETE SET NULL,
  rack_name TEXT,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  device_name TEXT,
  business_ip TEXT,
  operator TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  content TEXT NOT NULL,
  impact TEXT,
  result TEXT,
  related_connection_id TEXT,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_events_changed_at ON change_events(changed_at);
CREATE INDEX IF NOT EXISTS idx_change_events_device_id ON change_events(device_id);

CREATE TABLE IF NOT EXISTS virtual_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  business_ip TEXT,
  os TEXT,
  purpose TEXT,
  owner TEXT,
  host_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  host_device_name TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_virtual_servers_business_ip ON virtual_servers(business_ip);
CREATE INDEX IF NOT EXISTS idx_virtual_servers_host_device_id ON virtual_servers(host_device_id);

CREATE TABLE IF NOT EXISTS managed_connections (
  id TEXT PRIMARY KEY,
  source_device_id TEXT NOT NULL,
  source_device_name TEXT NOT NULL,
  source_port_name TEXT NOT NULL,
  target_device_id TEXT NOT NULL,
  target_device_name TEXT NOT NULL,
  target_port_name TEXT NOT NULL,
  cable_no TEXT,
  cable_type TEXT,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_managed_connections_source ON managed_connections(source_device_id);
CREATE INDEX IF NOT EXISTS idx_managed_connections_target ON managed_connections(target_device_id);

CREATE TABLE IF NOT EXISTS connection_views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  selected_device_ids_json TEXT NOT NULL DEFAULT '[]',
  keyword TEXT NOT NULL DEFAULT '',
  zoom REAL NOT NULL DEFAULT 1,
  node_positions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_run_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  data_source TEXT NOT NULL,
  used_model TEXT,
  fallback_reason TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  events_json TEXT NOT NULL DEFAULT '[]',
  target_json TEXT NOT NULL DEFAULT '{}',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_run_records_started_at ON agent_run_records(started_at);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_agent_skills (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gateway_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  endpoint TEXT NOT NULL DEFAULT '',
  token_ref TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gateway_sessions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  skill_scope TEXT NOT NULL DEFAULT 'shared',
  messages_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '["read"]',
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_credentials (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint TEXT,
  username TEXT,
  secret_ref TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  token_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_column_preferences (
  table_id TEXT PRIMARY KEY,
  columns_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
