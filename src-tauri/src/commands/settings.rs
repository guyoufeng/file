use tauri::State;
use uuid::Uuid;

use crate::{
    commands::AppState,
    db::seed,
    models::{AiModelConfig, AiModelConfigInput, AuditLog},
};

#[derive(serde::Deserialize)]
struct OpenAiModelList {
    data: Vec<OpenAiModelItem>,
}

#[derive(serde::Deserialize)]
struct OpenAiModelItem {
    id: String,
}

#[derive(serde::Deserialize)]
struct OllamaModelList {
    models: Vec<OllamaModelItem>,
}

#[derive(serde::Deserialize)]
struct OllamaModelItem {
    name: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessageInput {
    role: String,
    content: String,
}

#[derive(serde::Serialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<AiChatMessageInput>,
    temperature: f32,
}

#[derive(serde::Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChatChoice>,
}

#[derive(serde::Deserialize)]
struct OpenAiChatChoice {
    message: OpenAiChatMessage,
}

#[derive(serde::Deserialize)]
struct OpenAiChatMessage {
    content: String,
}

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
pub async fn discover_ai_models(input: AiModelConfigInput) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let base_url = input.base_url.trim_end_matches('/');

    match input.provider.as_str() {
        "ollama" => {
            let response = client
                .get(format!("{base_url}/api/tags"))
                .send()
                .await
                .map_err(|error| error.to_string())?;

            if !response.status().is_success() {
                return Err(format!("模型发现失败：HTTP {}", response.status()));
            }

            let data: OllamaModelList = response.json().await.map_err(|error| error.to_string())?;
            Ok(data.models.into_iter().map(|item| item.name).collect())
        }
        "gemini" => {
            if input.model.trim().is_empty() {
                Err("Gemini 需要手工填写模型标识".to_string())
            } else {
                Ok(vec![input.model])
            }
        }
        _ => {
            let mut request = client.get(format!("{base_url}/models"));
            if let Some(api_key) = input.api_key_ref.filter(|value| !value.trim().is_empty()) {
                request = request.bearer_auth(api_key);
            }

            let response = request.send().await.map_err(|error| error.to_string())?;
            if !response.status().is_success() {
                return Err(format!("模型发现失败：HTTP {}", response.status()));
            }

            let data: OpenAiModelList = response.json().await.map_err(|error| error.to_string())?;
            Ok(data.data.into_iter().map(|item| item.id).collect())
        }
    }
}

#[tauri::command]
pub async fn chat_with_ai_model(
    input: AiModelConfigInput,
    messages: Vec<AiChatMessageInput>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let base_url = input.base_url.trim_end_matches('/');

    match input.provider.as_str() {
        "ollama" => {
            let response = client
                .post(format!("{base_url}/api/chat"))
                .json(&serde_json::json!({
                    "model": input.model,
                    "messages": messages,
                    "stream": false
                }))
                .send()
                .await
                .map_err(|error| error.to_string())?;

            if !response.status().is_success() {
                return Err(format!("模型调用失败：HTTP {}", response.status()));
            }

            let data: serde_json::Value =
                response.json().await.map_err(|error| error.to_string())?;
            Ok(data
                .get("message")
                .and_then(|message| message.get("content"))
                .and_then(|content| content.as_str())
                .unwrap_or_default()
                .to_string())
        }
        _ => {
            let mut request = client.post(format!("{base_url}/chat/completions"));
            if let Some(api_key) = input.api_key_ref.filter(|value| !value.trim().is_empty()) {
                request = request.bearer_auth(api_key);
            }

            let response = request
                .json(&OpenAiChatRequest {
                    model: input.model,
                    messages,
                    temperature: 0.2,
                })
                .send()
                .await
                .map_err(|error| error.to_string())?;

            if !response.status().is_success() {
                return Err(format!("模型调用失败：HTTP {}", response.status()));
            }

            let data: OpenAiChatResponse =
                response.json().await.map_err(|error| error.to_string())?;
            Ok(data
                .choices
                .into_iter()
                .next()
                .map(|choice| choice.message.content)
                .unwrap_or_default())
        }
    }
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

#[tauri::command]
pub async fn restore_sample_data(
    state: State<'_, AppState>,
    confirmed: bool,
) -> Result<(), String> {
    seed::restore_sample_data(&state.pool, confirmed)
        .await
        .map_err(|error| error.to_string())
}
