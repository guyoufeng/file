use std::fs;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::commands::AppState;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BusinessCollectionSummary {
    pub name: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AgentWriteApproval {
    pub id: String,
    pub actor: String,
    pub module: String,
    pub action: String,
    pub summary: String,
    pub payload_json: String,
    pub status: String,
    pub decision_by: Option<String>,
    pub decision_note: Option<String>,
    pub decided_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentWriteApprovalInput {
    pub actor: Option<String>,
    pub module: String,
    pub action: String,
    pub summary: String,
    pub payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentWriteApprovalDecision {
    pub id: String,
    pub status: String,
    pub decision_by: String,
    pub decision_note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GatewayMessage {
    pub id: String,
    pub provider: String,
    pub external_user_id: String,
    pub display_name: String,
    pub direction: String,
    pub content: String,
    pub raw_payload_json: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayMessageInput {
    pub provider: String,
    pub external_user_id: String,
    pub display_name: String,
    pub direction: String,
    pub content: String,
    pub raw_payload: Value,
}

#[tauri::command]
pub async fn list_business_collections(
    state: State<'_, AppState>,
) -> Result<Vec<BusinessCollectionSummary>, String> {
    sqlx::query_as::<_, BusinessCollectionSummary>(
        "SELECT name, updated_at FROM business_collections ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_business_collection(
    state: State<'_, AppState>,
    name: String,
) -> Result<Value, String> {
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT records_json FROM business_collections WHERE name = ?",
    )
    .bind(name)
    .fetch_optional(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    serde_json::from_str(row.as_ref().map(|item| item.0.as_str()).unwrap_or("[]"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn put_business_collection(
    state: State<'_, AppState>,
    name: String,
    records: Value,
    actor: Option<String>,
) -> Result<(), String> {
    if !records.is_array() {
        return Err("业务集合写入必须是数组。".to_string());
    }
    let records_json = serde_json::to_string(&records).map_err(|error| error.to_string())?;
    sqlx::query(
        "INSERT INTO business_collections (name, records_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET records_json = excluded.records_json, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(&name)
    .bind(records_json)
    .execute(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    write_audit_log(
        &state.pool,
        actor.as_deref().unwrap_or("admin"),
        "business_collection.write",
        "business_collection",
        Some(&name),
        &format!("写入业务集合 {name}"),
        &serde_json::json!({ "collection": name }).to_string(),
    )
    .await
}

#[tauri::command]
pub async fn create_agent_write_approval(
    state: State<'_, AppState>,
    input: AgentWriteApprovalInput,
) -> Result<AgentWriteApproval, String> {
    let id = Uuid::new_v4().to_string();
    let actor = input.actor.unwrap_or_else(|| "ai-agent".to_string());
    let payload_json = serde_json::to_string(&input.payload).map_err(|error| error.to_string())?;
    sqlx::query(
        "INSERT INTO agent_write_approvals (id, actor, module, action, summary, payload_json, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
    )
    .bind(&id)
    .bind(&actor)
    .bind(input.module)
    .bind(input.action)
    .bind(input.summary)
    .bind(payload_json)
    .execute(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    write_audit_log(
        &state.pool,
        &actor,
        "agent_write.approval.create",
        "agent_write_approval",
        Some(&id),
        "创建 Agent 写入审批",
        "{}",
    )
    .await?;

    get_agent_write_approval_by_id(&state.pool, &id).await
}

#[tauri::command]
pub async fn list_agent_write_approvals(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<AgentWriteApproval>, String> {
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    sqlx::query_as::<_, AgentWriteApproval>(
        "SELECT id, actor, module, action, summary, payload_json, status, decision_by, decision_note, decided_at, created_at, updated_at FROM agent_write_approvals ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn decide_agent_write_approval(
    state: State<'_, AppState>,
    decision: AgentWriteApprovalDecision,
) -> Result<AgentWriteApproval, String> {
    if !matches!(
        decision.status.as_str(),
        "approved" | "rejected" | "applied"
    ) {
        return Err("审批状态只能是 approved、rejected 或 applied。".to_string());
    }
    sqlx::query(
        "UPDATE agent_write_approvals SET status = ?, decision_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&decision.status)
    .bind(&decision.decision_by)
    .bind(&decision.decision_note)
    .bind(&decision.id)
    .execute(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    write_audit_log(
        &state.pool,
        &decision.decision_by,
        "agent_write.approval.decide",
        "agent_write_approval",
        Some(&decision.id),
        &format!("处理 Agent 写入审批：{}", decision.status),
        &serde_json::json!({ "decisionNote": decision.decision_note }).to_string(),
    )
    .await?;

    get_agent_write_approval_by_id(&state.pool, &decision.id).await
}

#[tauri::command]
pub async fn append_gateway_message(
    state: State<'_, AppState>,
    input: GatewayMessageInput,
) -> Result<GatewayMessage, String> {
    let id = Uuid::new_v4().to_string();
    let raw_payload_json =
        serde_json::to_string(&input.raw_payload).map_err(|error| error.to_string())?;
    sqlx::query(
        "INSERT INTO gateway_messages (id, provider, external_user_id, display_name, direction, content, raw_payload_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'received')",
    )
    .bind(&id)
    .bind(input.provider)
    .bind(input.external_user_id)
    .bind(input.display_name)
    .bind(input.direction)
    .bind(input.content)
    .bind(raw_payload_json)
    .execute(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    get_gateway_message_by_id(&state.pool, &id).await
}

#[tauri::command]
pub async fn create_backend_backup(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let backup_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
    let file_name = format!(
        "qf-ai-dcim-backup-{}.json",
        Utc::now().format("%Y%m%d%H%M%S")
    );
    let backup_path = backup_dir.join(file_name);

    let collections = sqlx::query_as::<_, (String, String, String)>(
        "SELECT name, records_json, updated_at FROM business_collections ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;
    let approvals = sqlx::query_as::<_, AgentWriteApproval>(
        "SELECT id, actor, module, action, summary, payload_json, status, decision_by, decision_note, decided_at, created_at, updated_at FROM agent_write_approvals ORDER BY created_at DESC LIMIT 1000",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;
    let gateway_messages = sqlx::query_as::<_, GatewayMessage>(
        "SELECT id, provider, external_user_id, display_name, direction, content, raw_payload_json, status, created_at FROM gateway_messages ORDER BY created_at DESC LIMIT 1000",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let backup = serde_json::json!({
        "schemaVersion": "0.1.0",
        "exportedAt": Utc::now().to_rfc3339(),
        "collections": collections.into_iter().map(|(name, records_json, updated_at)| {
            serde_json::json!({ "name": name, "records": serde_json::from_str::<Value>(&records_json).unwrap_or(Value::Array(vec![])), "updatedAt": updated_at })
        }).collect::<Vec<_>>(),
        "agentWriteApprovals": approvals,
        "gatewayMessages": gateway_messages
    });
    fs::write(
        &backup_path,
        serde_json::to_vec_pretty(&backup).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    Ok(backup_path.to_string_lossy().to_string())
}

async fn get_agent_write_approval_by_id(
    pool: &sqlx::SqlitePool,
    id: &str,
) -> Result<AgentWriteApproval, String> {
    sqlx::query_as::<_, AgentWriteApproval>(
        "SELECT id, actor, module, action, summary, payload_json, status, decision_by, decision_note, decided_at, created_at, updated_at FROM agent_write_approvals WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

async fn get_gateway_message_by_id(
    pool: &sqlx::SqlitePool,
    id: &str,
) -> Result<GatewayMessage, String> {
    sqlx::query_as::<_, GatewayMessage>(
        "SELECT id, provider, external_user_id, display_name, direction, content, raw_payload_json, status, created_at FROM gateway_messages WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

async fn write_audit_log(
    pool: &sqlx::SqlitePool,
    actor: &str,
    action: &str,
    target_type: &str,
    target_id: Option<&str>,
    summary: &str,
    metadata_json: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO audit_logs (id, actor, action, target_type, target_id, summary, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(actor)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(summary)
    .bind(metadata_json)
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|error| error.to_string())
}
