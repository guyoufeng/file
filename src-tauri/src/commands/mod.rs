pub mod alerts;
pub mod assets;
pub mod governance;
pub mod rooms;
pub mod settings;

use sqlx::SqlitePool;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}
