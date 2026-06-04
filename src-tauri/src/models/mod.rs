use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataCenter {
    pub id: String,
    pub name: String,
    pub location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub data_center_id: String,
    pub name: String,
    pub layout_type: String,
    pub default_rack_height_u: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MicroModule {
    pub id: String,
    pub room_id: String,
    pub name: String,
    pub rows: i64,
    pub columns: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Rack {
    pub id: String,
    pub room_id: String,
    pub micro_module_id: Option<String>,
    pub name: String,
    pub r#type: String,
    pub row_name: Option<String>,
    pub column_index: Option<i64>,
    pub height_u: i64,
    pub status: String,
    pub power_capacity_w: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub rack_id: String,
    pub category_id: String,
    pub subtype: Option<String>,
    pub name: String,
    pub computer_name: Option<String>,
    pub business_ip: Option<String>,
    pub management_ip: Option<String>,
    pub ips_json: String,
    pub purpose: Option<String>,
    pub owner: Option<String>,
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub asset_no: Option<String>,
    pub warranty_expire_at: Option<String>,
    pub hardware_spec: Option<String>,
    pub operating_system: Option<String>,
    pub side: String,
    pub start_u: i64,
    pub end_u: i64,
    pub height_u: i64,
    pub status: String,
    pub metadata_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInput {
    pub id: Option<String>,
    pub rack_id: String,
    pub category_id: String,
    pub subtype: Option<String>,
    pub name: String,
    pub computer_name: Option<String>,
    pub business_ip: Option<String>,
    pub management_ip: Option<String>,
    pub ips_json: Option<String>,
    pub purpose: Option<String>,
    pub owner: Option<String>,
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub asset_no: Option<String>,
    pub warranty_expire_at: Option<String>,
    pub hardware_spec: Option<String>,
    pub operating_system: Option<String>,
    pub side: String,
    pub start_u: i64,
    pub end_u: i64,
    pub height_u: i64,
    pub status: String,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub device_id: String,
    pub source: String,
    pub level: String,
    pub status: String,
    pub title: String,
    pub description: Option<String>,
    pub started_at: String,
    pub recovered_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertInput {
    pub id: Option<String>,
    pub device_id: String,
    pub source: String,
    pub level: String,
    pub status: String,
    pub title: String,
    pub description: Option<String>,
    pub started_at: String,
    pub recovered_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiModelConfig {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key_ref: Option<String>,
    pub enabled: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelConfigInput {
    pub id: Option<String>,
    pub provider: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key_ref: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AuditLog {
    pub id: String,
    pub actor: String,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<String>,
    pub summary: String,
    pub metadata_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AccessRecord {
    pub id: String,
    pub date: String,
    pub unit: String,
    pub visitor_name: String,
    pub enter_time: String,
    pub leave_time: Option<String>,
    pub reason: String,
    pub is_server_repair: i64,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub fault_description: Option<String>,
    pub result: Option<String>,
    pub attachments_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChangeEvent {
    pub id: String,
    pub title: String,
    pub r#type: String,
    pub status: String,
    pub room_id: Option<String>,
    pub room_name: Option<String>,
    pub rack_id: Option<String>,
    pub rack_name: Option<String>,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub business_ip: Option<String>,
    pub operator: String,
    pub changed_at: String,
    pub content: String,
    pub impact: Option<String>,
    pub result: Option<String>,
    pub related_connection_id: Option<String>,
    pub attachments_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VirtualServer {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub business_ip: Option<String>,
    pub os: Option<String>,
    pub purpose: Option<String>,
    pub owner: Option<String>,
    pub host_device_id: Option<String>,
    pub host_device_name: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ManagedConnection {
    pub id: String,
    pub source_device_id: String,
    pub source_device_name: String,
    pub source_port_name: String,
    pub target_device_id: String,
    pub target_device_name: String,
    pub target_port_name: String,
    pub cable_no: Option<String>,
    pub cable_type: Option<String>,
    pub direction: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionView {
    pub id: String,
    pub name: String,
    pub selected_device_ids_json: String,
    pub keyword: String,
    pub zoom: f64,
    pub node_positions_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunRecord {
    pub id: String,
    pub session_id: String,
    pub question: String,
    pub answer: String,
    pub tool_name: String,
    pub data_source: String,
    pub used_model: Option<String>,
    pub fallback_reason: Option<String>,
    pub status: String,
    pub duration_ms: i64,
    pub events_json: String,
    pub target_json: String,
    pub attachments_json: String,
    pub started_at: String,
    pub ended_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source_type: String,
    pub tags_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CustomAgentSkill {
    pub name: String,
    pub description: String,
    pub rules_json: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GatewaySession {
    pub id: String,
    pub provider: String,
    pub external_user_id: String,
    pub display_name: String,
    pub skill_scope: String,
    pub messages_json: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectJson {
    pub schema_version: String,
    pub exported_at: String,
    pub data: serde_json::Value,
}
