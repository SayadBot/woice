use std::sync::Arc;

use tauri::{AppHandle, Runtime};

use crate::{
  process::{now_ms, wav_bytes_from_f32_16k, ModeRunOutput},
  state::AppState,
};

pub async fn run<R: Runtime>(
  _app: &AppHandle<R>,
  _state: &Arc<AppState>,
  api_key: &str,
  model: &str,
  language: &str,
  audio_16k: &[f32],
) -> ModeRunOutput {
  if api_key.is_empty() {
    return ModeRunOutput {
      transcription_model: model.to_string(),
      transcription_output: String::new(),
      transcription_error: Some("API key is not configured".to_string()),
      final_text: String::new(),
      transcription_started_at: None,
      transcription_completed_at: None,
    };
  }

  let wav_bytes = wav_bytes_from_f32_16k(audio_16k);
  let transcription_started_at = now_ms();

  match transcribe_with_groq(api_key, model, language, wav_bytes).await {
    Ok(text) => {
      let transcription_completed_at = now_ms();
      ModeRunOutput {
        transcription_model: model.to_string(),
        transcription_output: text.clone(),
        transcription_error: None,
        final_text: text,
        transcription_started_at: Some(transcription_started_at),
        transcription_completed_at: Some(transcription_completed_at),
      }
    }
    Err(err) => {
      let transcription_completed_at = now_ms();
      ModeRunOutput {
        transcription_model: model.to_string(),
        transcription_output: String::new(),
        transcription_error: Some(err),
        final_text: String::new(),
        transcription_started_at: Some(transcription_started_at),
        transcription_completed_at: Some(transcription_completed_at),
      }
    }
  }
}

async fn transcribe_with_groq(
  api_key: &str,
  model: &str,
  language: &str,
  wav_bytes: Vec<u8>,
) -> Result<String, String> {
  let client = reqwest::Client::new();

  let mut form = reqwest::multipart::Form::new()
    .part(
      "file",
      reqwest::multipart::Part::bytes(wav_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?,
    )
    .text("model", model.to_string());

  if !language.is_empty() && language != "auto" {
    form = form.text("language", language.to_string());
  }

  let response = client
    .post("https://api.groq.com/openai/v1/audio/transcriptions")
    .header("Authorization", format!("Bearer {}", api_key))
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("API request failed: {}", e))?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("API error {}: {}", status, body));
  }

  let json: serde_json::Value = response
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  json
    .get("text")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string())
    .ok_or_else(|| "Response missing 'text' field".to_string())
}
