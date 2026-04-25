use std::{fs, io::Write, path::PathBuf, sync::Arc};

use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::{DbInstances, DbPool};
use uuid::Uuid;

pub struct HistoryInsertData {
  pub transcription_model: String,
  pub transcription_output: String,
  pub transcription_error: Option<String>,
  pub audio_data: Vec<f32>,
  pub started_at: i64,
  pub completed_at: i64,
  pub recording_started_at: Option<i64>,
  pub recording_completed_at: Option<i64>,
  pub resampling_started_at: Option<i64>,
  pub resampling_completed_at: Option<i64>,
  pub transcription_started_at: Option<i64>,
  pub transcription_completed_at: Option<i64>,
  pub injection_started_at: Option<i64>,
  pub injection_completed_at: Option<i64>,
  pub language: String,
}

pub struct Database {
  audio_dir: PathBuf,
}

impl Database {
  pub fn new(data_dir: PathBuf) -> Result<Self, String> {
    let audio_dir = data_dir.join("audio");

    fs::create_dir_all(&audio_dir).map_err(|e| format!("Failed to create audio dir: {e}"))?;

    Ok(Database { audio_dir })
  }

  async fn pool<R: Runtime>(&self, app: &AppHandle<R>) -> Result<SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;
    let pool = guard
      .get("sqlite:woice.db")
      .ok_or("Database connection not initialized")?;
    match pool {
      DbPool::Sqlite(pool) => Ok(pool.clone()),
    }
  }

  pub async fn insert<R: Runtime>(
    &self,
    app: &AppHandle<R>,
    data: HistoryInsertData,
  ) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let audio_filename = format!("{}.wav", id);
    let audio_path = self.audio_dir.join(&audio_filename);

    let HistoryInsertData {
      transcription_model,
      transcription_output,
      transcription_error,
      audio_data,
      started_at,
      completed_at,
      recording_started_at,
      recording_completed_at,
      resampling_started_at,
      resampling_completed_at,
      transcription_started_at,
      transcription_completed_at,
      injection_started_at,
      injection_completed_at,
      language,
    } = data;

    write_wav_file(&audio_path, &audio_data, 16000)?;

    let pool = self.pool(app).await?;
    sqlx::query(
      "INSERT INTO history (
        id, input_audio, transcription_model, transcription_output, transcription_error,
        started_at, completed_at, recording_started_at, recording_completed_at,
        resampling_started_at, resampling_completed_at, transcription_started_at, transcription_completed_at,
        injection_started_at, injection_completed_at, language
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
    )
    .bind(&id)
    .bind(&audio_filename)
    .bind(&transcription_model)
    .bind(&transcription_output)
    .bind(transcription_error.as_deref())
    .bind(started_at)
    .bind(completed_at)
    .bind(recording_started_at)
    .bind(recording_completed_at)
    .bind(resampling_started_at)
    .bind(resampling_completed_at)
    .bind(transcription_started_at)
    .bind(transcription_completed_at)
    .bind(injection_started_at)
    .bind(injection_completed_at)
    .bind(&language)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to insert record: {e}"))?;

    Ok(())
  }
}

fn write_wav_file(path: &PathBuf, samples: &[f32], sample_rate: u32) -> Result<(), String> {
  let num_samples = samples.len() as u32;
  let num_channels: u16 = 1;
  let bits_per_sample: u16 = 16;
  let byte_rate = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
  let block_align = num_channels * bits_per_sample / 8;
  let data_size = num_samples * 2;

  let mut file = fs::File::create(path).map_err(|e| format!("Failed to create wav file: {e}"))?;

  file.write_all(b"RIFF").map_err(|e| e.to_string())?;
  file
    .write_all(&(36 + data_size).to_le_bytes())
    .map_err(|e| e.to_string())?;
  file.write_all(b"WAVE").map_err(|e| e.to_string())?;
  file.write_all(b"fmt ").map_err(|e| e.to_string())?;
  file
    .write_all(&16u32.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&1u16.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&num_channels.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&sample_rate.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&byte_rate.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&block_align.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file
    .write_all(&bits_per_sample.to_le_bytes())
    .map_err(|e| e.to_string())?;
  file.write_all(b"data").map_err(|e| e.to_string())?;
  file
    .write_all(&data_size.to_le_bytes())
    .map_err(|e| e.to_string())?;

  for &sample in samples {
    let value = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
    file
      .write_all(&value.to_le_bytes())
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

pub fn get_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to get app data dir: {e}"))
}

pub fn init_database<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Database>, String> {
  let data_dir = get_data_dir(app)?;
  fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data dir: {e}"))?;
  let db = Database::new(data_dir)?;
  Ok(Arc::new(db))
}
