use std::{
  collections::{HashMap, HashSet},
  sync::{
    atomic::{AtomicBool, AtomicI64, AtomicU64},
    Mutex,
  },
};

use crate::platform::audio::RecorderHandle;

pub struct AppState {
  pub active_sessions: Mutex<HashMap<String, RecordingSession>>,
  pub processing_sessions: Mutex<HashSet<String>>,
  pub next_session_id: AtomicU64,
  pub injection_lock: Mutex<()>,
  pub overlay_active: AtomicBool,
  pub overlay_recording: AtomicBool,
  pub overlay_started_at: AtomicI64,
  pub overlay_monitor: Mutex<Option<crate::platform::active_window::ActiveWindowMonitor>>,
}

impl AppState {
  pub fn new() -> Self {
    Self {
      active_sessions: Mutex::new(HashMap::new()),
      processing_sessions: Mutex::new(HashSet::new()),
      next_session_id: AtomicU64::new(1),
      injection_lock: Mutex::new(()),
      overlay_active: AtomicBool::new(false),
      overlay_recording: AtomicBool::new(false),
      overlay_started_at: AtomicI64::new(0),
      overlay_monitor: Mutex::new(None),
    }
  }
}

pub struct RecordingSession {
  pub id: String,
  pub groq_api_key: String,
  pub whisper_model: String,
  pub language: String,
  pub started_at: i64,
  pub recording_started_at: i64,
  pub recorder: RecorderHandle,
}
