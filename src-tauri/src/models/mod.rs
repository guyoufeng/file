use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectJson {
    pub schema_version: String,
    pub exported_at: String,
    pub data: serde_json::Value,
}
