use std::{
  sync::{atomic::Ordering, Arc},
  time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, Runtime};

use crate::{
  config::load_user_config,
  platform::{
    audio::{resample_to_16k, start_recording},
    db::{Database, HistoryInsertData},
    overlay,
    sounds::play_error_sound,
  },
  process,
  state::{AppState, RecordingSession},
};

const MIN_RECORDING_MS: i64 = 200;

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_millis() as i64
}

fn earliest_recording_started_at(app_state: &Arc<AppState>) -> Option<i64> {
  let sessions = app_state.active_sessions.lock().unwrap();
  sessions.values().map(|session| session.started_at).min()
}

fn recording_sessions_count(app_state: &Arc<AppState>) -> usize {
  app_state.active_sessions.lock().unwrap().len()
}

fn processing_sessions_count(app_state: &Arc<AppState>) -> usize {
  app_state.processing_sessions.lock().unwrap().len()
}

fn refresh_overlay_state<R: Runtime>(app: &AppHandle<R>, app_state: &Arc<AppState>) {
  let recording_count = recording_sessions_count(app_state);
  if recording_count > 0 {
    let started_at = earliest_recording_started_at(app_state).unwrap_or_else(now_ms);
    overlay::start_overlay(app, app_state, started_at);
    return;
  }

  let processing_count = processing_sessions_count(app_state);
  if processing_count > 0 {
    overlay::stop_overlay_recording(app_state);
    overlay::set_overlay_status(app, app_state, "processing");
    return;
  }

  overlay::stop_overlay(app, app_state);
}

fn take_active_session(app_state: &Arc<AppState>) -> Option<RecordingSession> {
  let mut sessions = app_state.active_sessions.lock().unwrap();
  sessions
    .iter()
    .max_by_key(|(_, session)| session.recording_started_at)
    .map(|(session_id, _)| session_id.clone())
    .and_then(|session_id| sessions.remove(&session_id))
}

pub(super) fn begin_recording<R: Runtime>(
  app: &AppHandle<R>,
  app_state: &Arc<AppState>,
) -> Result<(), String> {
  let started_at = now_ms();
  let user_config = load_user_config(app)?;

  let groq_api_key = if user_config.settings.use_env {
    std::env::var("WOICE_API_KEY")
      .or_else(|_| std::env::var("GROQ_API_KEY"))
      .unwrap_or_default()
  } else {
    user_config.settings.groq_api_key
  };

  let handle = start_recording()?;

  let recording_started_at = now_ms();
  let session_id = app_state.next_session_id.fetch_add(1, Ordering::SeqCst);
  let session = RecordingSession {
    id: format!("session-{}", session_id),
    groq_api_key,
    whisper_model: user_config.settings.whisper_model,
    language: user_config.settings.language,
    ignore_clipboard: user_config.settings.ignore_clipboard,
    started_at,
    recording_started_at,
    recorder: handle,
  };

  {
    let mut sessions = app_state.active_sessions.lock().unwrap();
    sessions.insert(session.id.clone(), session);
  }

  refresh_overlay_state(app, app_state);
  Ok(())
}

pub(super) fn end_recording<R: Runtime>(
  app: &AppHandle<R>,
  app_state: &Arc<AppState>,
) -> Result<(), String> {
  let session = take_active_session(app_state);
  let Some(session) = session else {
    return Ok(());
  };

  {
    let mut processing_sessions = app_state.processing_sessions.lock().unwrap();
    processing_sessions.insert(session.id.clone());
  }

  refresh_overlay_state(app, app_state);

  let app_handle = app.clone();
  let state = app_state.clone();
  let session_id = session.id.clone();

  let recording_completed_at = now_ms();

  tauri::async_runtime::spawn(async move {
    let RecordingSession {
      groq_api_key,
      whisper_model,
      language,
      ignore_clipboard,
      started_at,
      recording_started_at,
      recorder,
      ..
    } = session;

    let recorded = recorder.stop();

    let recording_duration_ms = recording_completed_at.saturating_sub(recording_started_at);
    if recording_duration_ms < MIN_RECORDING_MS {
      {
        let mut processing_sessions = state.processing_sessions.lock().unwrap();
        processing_sessions.remove(&session_id);
      }

      refresh_overlay_state(&app_handle, &state);
      return;
    }

    let resampling_started_at = now_ms();
    let audio = resample_to_16k(&recorded);
    let resampling_completed_at = now_ms();

    let mode_output = process::groq::run(
      &app_handle,
      &state,
      &groq_api_key,
      &whisper_model,
      &language,
      &audio,
    )
    .await;

    let injection_started_at = now_ms();
    {
      if mode_output.transcription_error.is_some() {
        play_error_sound();
      } else if !mode_output.final_text.trim().is_empty() {
        let _inject_guard = state.injection_lock.lock().unwrap();
        let _ =
          crate::platform::injection::inject_text(mode_output.final_text.trim(), ignore_clipboard);
      }
    }
    let injection_completed_at = now_ms();

    let completed_at = now_ms();

    let db_app = app_handle.clone();
    let db_audio = audio;
    let db_transcription_output = mode_output.transcription_output;
    let db_transcription_model = mode_output.transcription_model;
    let db_transcription_error = mode_output.transcription_error;
    let db_started_at = started_at;
    let db_completed_at = completed_at;
    let db_recording_started_at = Some(recording_started_at);
    let db_recording_completed_at = recording_completed_at;
    let db_resampling_started_at = resampling_started_at;
    let db_resampling_completed_at = resampling_completed_at;
    let db_transcription_started_at = mode_output.transcription_started_at;
    let db_transcription_completed_at = mode_output.transcription_completed_at;
    let db_injection_started_at = Some(injection_started_at);
    let db_injection_completed_at = Some(injection_completed_at);
    let db_language = language;

    tauri::async_runtime::spawn(async move {
      if let Some(db) = db_app.try_state::<Arc<Database>>() {
        let _ = db
          .insert(
            &db_app,
            HistoryInsertData {
              transcription_model: db_transcription_model,
              transcription_output: db_transcription_output,
              transcription_error: db_transcription_error,
              audio_data: db_audio,
              started_at: db_started_at,
              completed_at: db_completed_at,
              recording_started_at: db_recording_started_at,
              recording_completed_at: Some(db_recording_completed_at),
              resampling_started_at: Some(db_resampling_started_at),
              resampling_completed_at: Some(db_resampling_completed_at),
              transcription_started_at: db_transcription_started_at,
              transcription_completed_at: db_transcription_completed_at,
              injection_started_at: db_injection_started_at,
              injection_completed_at: db_injection_completed_at,
              language: db_language,
            },
          )
          .await;
      }
    });

    {
      let mut processing_sessions = state.processing_sessions.lock().unwrap();
      processing_sessions.remove(&session_id);
    }

    refresh_overlay_state(&app_handle, &state);
  });

  Ok(())
}
