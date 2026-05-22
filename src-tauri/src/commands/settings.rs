use tauri::State;
use uuid::Uuid;

use crate::{
    commands::AppState,
    models::{AiModelConfig, AiModelConfigInput, AuditLog},
};

#[tauri::command]
pub async fn get_ai_model_configs(
    state: State<'_, AppState>,
) -> Result<Vec<AiModelConfig>, String> {
    sqlx::query_as::<_, AiModelConfig>(
    "SELECT id, provider, name, base_url, model, api_key_ref, enabled FROM ai_model_configs ORDER BY provider, name",
  )
  .fetch_all(&state.pool)
  .await
  .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_ai_model_config(
    state: State<'_, AppState>,
    input: AiModelConfigInput,
) -> Result<AiModelConfig, String> {
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let enabled = i64::from(input.enabled);

    if enabled == 1 {
        sqlx::query("UPDATE ai_model_configs SET enabled = 0")
            .execute(&state.pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    sqlx::query(
    r#"
    INSERT INTO ai_model_configs (id, provider, name, base_url, model, api_key_ref, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      name = excluded.name,
      base_url = excluded.base_url,
      model = excluded.model,
      api_key_ref = excluded.api_key_ref,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
    "#,
  )
  .bind(&id)
  .bind(input.provider)
  .bind(input.name)
  .bind(input.base_url)
  .bind(input.model)
  .bind(input.api_key_ref)
  .bind(enabled)
  .execute(&state.pool)
  .await
  .map_err(|error| error.to_string())?;

    sqlx::query_as::<_, AiModelConfig>(
    "SELECT id, provider, name, base_url, model, api_key_ref, enabled FROM ai_model_configs WHERE id = ?",
  )
  .bind(id)
  .fetch_one(&state.pool)
  .await
  .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_audit_logs(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<AuditLog>, String> {
    let limit = limit.unwrap_or(100).clamp(1, 500);

    sqlx::query_as::<_, AuditLog>(
    "SELECT id, actor, action, target_type, target_id, summary, metadata_json, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ?",
  )
  .bind(limit)
  .fetch_all(&state.pool)
  .await
  .map_err(|error| error.to_string())
}
