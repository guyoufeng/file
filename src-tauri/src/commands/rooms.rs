use tauri::State;

use crate::{
    commands::AppState,
    models::{Rack, Room},
};

#[tauri::command]
pub async fn get_rooms(state: State<'_, AppState>) -> Result<Vec<Room>, String> {
    sqlx::query_as::<_, Room>(
    "SELECT id, data_center_id, name, layout_type, default_rack_height_u FROM rooms ORDER BY name",
  )
  .fetch_all(&state.pool)
  .await
  .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_racks(
    state: State<'_, AppState>,
    room_id: Option<String>,
) -> Result<Vec<Rack>, String> {
    let racks = match room_id {
    Some(room_id) => {
      sqlx::query_as::<_, Rack>(
        "SELECT id, room_id, micro_module_id, name, type, row_name, column_index, height_u, status, power_capacity_w, notes FROM racks WHERE room_id = ? ORDER BY row_name, column_index, name",
      )
      .bind(room_id)
      .fetch_all(&state.pool)
      .await
    }
    None => {
      sqlx::query_as::<_, Rack>(
        "SELECT id, room_id, micro_module_id, name, type, row_name, column_index, height_u, status, power_capacity_w, notes FROM racks ORDER BY room_id, row_name, column_index, name",
      )
      .fetch_all(&state.pool)
      .await
    }
  };

    racks.map_err(|error| error.to_string())
}
