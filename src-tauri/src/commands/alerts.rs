use tauri::State;
use uuid::Uuid;

use crate::{
    commands::AppState,
    models::{Alert, AlertInput},
};

#[tauri::command]
pub async fn get_alerts(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<Vec<Alert>, String> {
    let alerts = match device_id {
    Some(device_id) => {
      sqlx::query_as::<_, Alert>(
        "SELECT id, device_id, source, level, status, title, description, started_at, recovered_at FROM alerts WHERE device_id = ? ORDER BY started_at DESC",
      )
      .bind(device_id)
      .fetch_all(&state.pool)
      .await
    }
    None => {
      sqlx::query_as::<_, Alert>(
        "SELECT id, device_id, source, level, status, title, description, started_at, recovered_at FROM alerts ORDER BY started_at DESC",
      )
      .fetch_all(&state.pool)
      .await
    }
  };

    alerts.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn upsert_alert(state: State<'_, AppState>, input: AlertInput) -> Result<Alert, String> {
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());

    sqlx::query(
    r#"
    INSERT INTO alerts (id, device_id, source, level, status, title, description, started_at, recovered_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      device_id = excluded.device_id,
      source = excluded.source,
      level = excluded.level,
      status = excluded.status,
      title = excluded.title,
      description = excluded.description,
      started_at = excluded.started_at,
      recovered_at = excluded.recovered_at,
      updated_at = CURRENT_TIMESTAMP
    "#,
  )
  .bind(&id)
  .bind(input.device_id)
  .bind(input.source)
  .bind(input.level)
  .bind(input.status)
  .bind(input.title)
  .bind(input.description)
  .bind(input.started_at)
  .bind(input.recovered_at)
  .execute(&state.pool)
  .await
  .map_err(|error| error.to_string())?;

    sqlx::query_as::<_, Alert>(
    "SELECT id, device_id, source, level, status, title, description, started_at, recovered_at FROM alerts WHERE id = ?",
  )
  .bind(id)
  .fetch_one(&state.pool)
  .await
  .map_err(|error| error.to_string())
}
