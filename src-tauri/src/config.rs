use std::fs;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserConfig {
  pub settings: SettingsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsConfig {
  #[serde(default)]
  pub groq_api_key: String,
  #[serde(default = "default_whisper_model")]
  pub whisper_model: String,
  #[serde(default = "default_hotkey")]
  pub hotkey: String,
  #[serde(default = "default_language")]
  pub language: String,
  #[serde(default)]
  pub start_on_login: bool,
  #[serde(default)]
  pub use_env: bool,
}

fn default_whisper_model() -> String {
  "whisper-large-v3".to_string()
}

fn default_hotkey() -> String {
  "Ctrl+Shift+Space".to_string()
}

fn default_language() -> String {
  "en".to_string()
}

pub fn load_user_config<R: Runtime>(app: &AppHandle<R>) -> Result<UserConfig, String> {
  let path = config_path(app)?;
  if !path.exists() {
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let initial = serde_json::json!({
      "settings": {
        "groqApiKey": "",
        "whisperModel": "whisper-large-v3",
        "hotkey": "Ctrl+Shift+Space",
        "language": "en",
        "startOnLogin": false,
        "useEnv": false
      }
    });

    let contents = serde_json::to_string_pretty(&initial)
      .map_err(|e| format!("Failed to serialize initial config: {e}"))?;
    fs::write(&path, contents).map_err(|e| format!("Failed to write config file: {e}"))?;
  }

  let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  serde_json::from_str::<UserConfig>(&contents).map_err(|e| e.to_string())
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
  let dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
  Ok(dir.join("config.json"))
}
