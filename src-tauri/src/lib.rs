mod commands;
mod db;
mod models;

use commands::{
    alerts::{get_alerts, upsert_alert},
    assets::{delete_device, export_project_json, get_devices, import_project_json, upsert_device},
    rooms::{get_racks, get_rooms},
    settings::{get_ai_model_configs, get_audit_logs, save_ai_model_config},
    AppState,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init(app.handle()))
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            app.manage(AppState { pool });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_rooms,
            get_racks,
            get_devices,
            upsert_device,
            delete_device,
            get_alerts,
            upsert_alert,
            get_ai_model_configs,
            save_ai_model_config,
            get_audit_logs,
            export_project_json,
            import_project_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
