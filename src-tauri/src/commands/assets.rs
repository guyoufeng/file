use tauri::State;
use uuid::Uuid;

use crate::{
    commands::AppState,
    export::project_json::PROJECT_SCHEMA_VERSION,
    models::{
        AiModelConfig, Alert, AuditLog, DataCenter, Device, DeviceInput, MicroModule, ProjectJson,
        Rack, Room,
    },
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
    let data_centers = sqlx::query_as::<_, DataCenter>(
        "SELECT id, name, location FROM data_centers ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let rooms = sqlx::query_as::<_, Room>(
        "SELECT id, data_center_id, name, layout_type, default_rack_height_u FROM rooms ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| error.to_string())?;

    let micro_modules = sqlx::query_as::<_, MicroModule>(
        "SELECT id, room_id, name, rows, columns FROM micro_modules ORDER BY room_id, name",
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
            "dataCenters": data_centers,
            "rooms": rooms,
            "microModules": micro_modules,
            "racks": racks,
            "devices": devices,
            "alerts": alerts,
            "aiModelConfigs": ai_model_configs,
            "auditLogs": audit_logs
        }),
    })
}

#[tauri::command]
pub async fn import_project_json(
    state: State<'_, AppState>,
    project: ProjectJson,
) -> Result<(), String> {
    if project.schema_version != PROJECT_SCHEMA_VERSION {
        return Err("仅支持 v0.1.0 项目 JSON".to_string());
    }

    let data_centers: Vec<DataCenter> =
        serde_json::from_value(project.data.get("dataCenters").cloned().unwrap_or_default())
            .unwrap_or_default();
    let rooms: Vec<Room> = serde_json::from_value(
        project
            .data
            .get("rooms")
            .cloned()
            .ok_or_else(|| "项目 JSON 缺少 rooms".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let micro_modules: Vec<MicroModule> =
        serde_json::from_value(project.data.get("microModules").cloned().unwrap_or_default())
            .unwrap_or_default();
    let racks: Vec<Rack> = serde_json::from_value(
        project
            .data
            .get("racks")
            .cloned()
            .ok_or_else(|| "项目 JSON 缺少 racks".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let devices: Vec<Device> = serde_json::from_value(
        project
            .data
            .get("devices")
            .cloned()
            .ok_or_else(|| "项目 JSON 缺少 devices".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let alerts: Vec<Alert> = serde_json::from_value(
        project
            .data
            .get("alerts")
            .cloned()
            .ok_or_else(|| "项目 JSON 缺少 alerts".to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let mut tx = state.pool.begin().await.map_err(|error| error.to_string())?;

    for table in [
        "alerts",
        "devices",
        "racks",
        "micro_modules",
        "rooms",
        "data_centers",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
    }

    ensure_default_categories(&mut tx).await?;

    if data_centers.is_empty() {
        for data_center_id in rooms
            .iter()
            .map(|room| room.data_center_id.clone())
            .collect::<std::collections::HashSet<_>>()
        {
            sqlx::query("INSERT INTO data_centers (id, name, location) VALUES (?, ?, '')")
                .bind(&data_center_id)
                .bind(&data_center_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| error.to_string())?;
        }
    } else {
        for data_center in data_centers {
            sqlx::query("INSERT INTO data_centers (id, name, location) VALUES (?, ?, ?)")
                .bind(data_center.id)
                .bind(data_center.name)
                .bind(data_center.location)
                .execute(&mut *tx)
                .await
                .map_err(|error| error.to_string())?;
        }
    }

    for room in rooms {
        sqlx::query(
            "INSERT INTO rooms (id, data_center_id, name, layout_type, default_rack_height_u) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(room.id)
        .bind(room.data_center_id)
        .bind(room.name)
        .bind(room.layout_type)
        .bind(room.default_rack_height_u)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for module in micro_modules {
        sqlx::query("INSERT INTO micro_modules (id, room_id, name, rows, columns) VALUES (?, ?, ?, ?, ?)")
            .bind(module.id)
            .bind(module.room_id)
            .bind(module.name)
            .bind(module.rows)
            .bind(module.columns)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
    }

    for rack in racks {
        sqlx::query(
            "INSERT INTO racks (id, room_id, micro_module_id, name, type, row_name, column_index, height_u, status, power_capacity_w, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(rack.id)
        .bind(rack.room_id)
        .bind(rack.micro_module_id)
        .bind(rack.name)
        .bind(rack.r#type)
        .bind(rack.row_name)
        .bind(rack.column_index)
        .bind(rack.height_u)
        .bind(rack.status)
        .bind(rack.power_capacity_w)
        .bind(rack.notes)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for device in devices {
        sqlx::query(
            r#"
            INSERT INTO devices (
              id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip,
              ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at,
              hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(device.id)
        .bind(device.rack_id)
        .bind(device.category_id)
        .bind(device.subtype)
        .bind(device.name)
        .bind(device.computer_name)
        .bind(device.business_ip)
        .bind(device.management_ip)
        .bind(device.ips_json)
        .bind(device.purpose)
        .bind(device.owner)
        .bind(device.vendor)
        .bind(device.model)
        .bind(device.serial_number)
        .bind(device.asset_no)
        .bind(device.warranty_expire_at)
        .bind(device.hardware_spec)
        .bind(device.operating_system)
        .bind(device.side)
        .bind(device.start_u)
        .bind(device.end_u)
        .bind(device.height_u)
        .bind(device.status)
        .bind(device.metadata_json)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    for alert in alerts {
        sqlx::query(
            "INSERT INTO alerts (id, device_id, source, level, status, title, description, started_at, recovered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(alert.id)
        .bind(alert.device_id)
        .bind(alert.source)
        .bind(alert.level)
        .bind(alert.status)
        .bind(alert.title)
        .bind(alert.description)
        .bind(alert.started_at)
        .bind(alert.recovered_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    tx.commit().await.map_err(|error| error.to_string())
}

async fn ensure_default_categories(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    for (id, name, major, subtypes_json) in [
        (
            "server",
            "服务器",
            "server",
            r#"["物理服务器","数据库服务器","虚拟化服务器","超融合服务器"]"#,
        ),
        (
            "network",
            "网络设备",
            "network",
            r#"["核心交换机","接入交换机","路由器","负载均衡"]"#,
        ),
        (
            "security",
            "安全设备",
            "security",
            r#"["防火墙","堡垒机","入侵防护","日志审计"]"#,
        ),
        (
            "storage",
            "存储设备",
            "storage",
            r#"["SAN存储","NAS存储","备份一体机","磁带库"]"#,
        ),
        (
            "facility",
            "基础设施",
            "facility",
            r#"["列头柜","精密空调","UPS","PDU"]"#,
        ),
        (
            "patching",
            "配线设备",
            "patching",
            r#"["配线架","ODF","MDF"]"#,
        ),
        ("other", "其他设备", "other", r#"["其他"]"#),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO device_categories (id, name, major, subtypes_json) VALUES (?, ?, ?, ?)",
        )
        .bind(id)
        .bind(name)
        .bind(major)
        .bind(subtypes_json)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}
