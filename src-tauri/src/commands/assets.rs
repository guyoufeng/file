use tauri::State;
use uuid::Uuid;

use crate::{
    commands::AppState,
    export::project_json::PROJECT_SCHEMA_VERSION,
    models::{AiModelConfig, Alert, AuditLog, Device, DeviceInput, ProjectJson, Rack, Room},
};

#[tauri::command]
pub async fn get_devices(
    state: State<'_, AppState>,
    rack_id: Option<String>,
) -> Result<Vec<Device>, String> {
    let devices = match rack_id {
    Some(rack_id) => {
      sqlx::query_as::<_, Device>(
        "SELECT id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip, ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at, hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json FROM devices WHERE rack_id = ? ORDER BY start_u DESC, name",
      )
      .bind(rack_id)
      .fetch_all(&state.pool)
      .await
    }
    None => {
      sqlx::query_as::<_, Device>(
        "SELECT id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip, ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at, hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json FROM devices ORDER BY rack_id, start_u DESC, name",
      )
      .fetch_all(&state.pool)
      .await
    }
  };

    devices.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn upsert_device(
    state: State<'_, AppState>,
    input: DeviceInput,
) -> Result<Device, String> {
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let ips_json = input.ips_json.unwrap_or_else(|| "[]".to_string());
    let metadata_json = input.metadata_json.unwrap_or_else(|| "{}".to_string());

    sqlx::query(
    r#"
    INSERT INTO devices (
      id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip, ips_json,
      purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at, hardware_spec,
      operating_system, side, start_u, end_u, height_u, status, metadata_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      rack_id = excluded.rack_id,
      category_id = excluded.category_id,
      subtype = excluded.subtype,
      name = excluded.name,
      computer_name = excluded.computer_name,
      business_ip = excluded.business_ip,
      management_ip = excluded.management_ip,
      ips_json = excluded.ips_json,
      purpose = excluded.purpose,
      owner = excluded.owner,
      vendor = excluded.vendor,
      model = excluded.model,
      serial_number = excluded.serial_number,
      asset_no = excluded.asset_no,
      warranty_expire_at = excluded.warranty_expire_at,
      hardware_spec = excluded.hardware_spec,
      operating_system = excluded.operating_system,
      side = excluded.side,
      start_u = excluded.start_u,
      end_u = excluded.end_u,
      height_u = excluded.height_u,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = CURRENT_TIMESTAMP
    "#,
  )
  .bind(&id)
  .bind(input.rack_id)
  .bind(input.category_id)
  .bind(input.subtype)
  .bind(input.name)
  .bind(input.computer_name)
  .bind(input.business_ip)
  .bind(input.management_ip)
  .bind(ips_json)
  .bind(input.purpose)
  .bind(input.owner)
  .bind(input.vendor)
  .bind(input.model)
  .bind(input.serial_number)
  .bind(input.asset_no)
  .bind(input.warranty_expire_at)
  .bind(input.hardware_spec)
  .bind(input.operating_system)
  .bind(input.side)
  .bind(input.start_u)
  .bind(input.end_u)
  .bind(input.height_u)
  .bind(input.status)
  .bind(metadata_json)
  .execute(&state.pool)
  .await
  .map_err(|error| error.to_string())?;

    sqlx::query_as::<_, Device>(
    "SELECT id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip, ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at, hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json FROM devices WHERE id = ?",
  )
  .bind(id)
  .fetch_one(&state.pool)
  .await
  .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_device(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM devices WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_project_json(state: State<'_, AppState>) -> Result<ProjectJson, String> {
    let rooms = sqlx::query_as::<_, Room>(
        "SELECT id, data_center_id, name, layout_type, default_rack_height_u FROM rooms ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let racks = sqlx::query_as::<_, Rack>(
        "SELECT id, room_id, micro_module_id, name, type, row_name, column_index, height_u, status, power_capacity_w, notes FROM racks ORDER BY room_id, row_name, column_index, name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let devices = sqlx::query_as::<_, Device>(
        "SELECT id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip, ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at, hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json FROM devices ORDER BY rack_id, start_u DESC, name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let alerts = sqlx::query_as::<_, Alert>(
        "SELECT id, device_id, source, level, status, title, description, started_at, recovered_at FROM alerts ORDER BY started_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let ai_model_configs = sqlx::query_as::<_, AiModelConfig>(
        "SELECT id, provider, name, base_url, model, api_key_ref, enabled FROM ai_model_configs ORDER BY provider, name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let audit_logs = sqlx::query_as::<_, AuditLog>(
        "SELECT id, actor, action, target_type, target_id, summary, metadata_json, created_at FROM audit_logs ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ProjectJson {
        schema_version: PROJECT_SCHEMA_VERSION.to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        data: serde_json::json!({
            "rooms": rooms,
            "racks": racks,
            "devices": devices,
            "alerts": alerts,
            "aiModelConfigs": ai_model_configs,
            "auditLogs": audit_logs
        }),
    })
}

#[tauri::command]
pub async fn import_project_json(_project: ProjectJson) -> Result<(), String> {
    Ok(())
}
