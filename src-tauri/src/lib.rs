mod app;
mod config;
mod migrations;
#[path = "lib/mod.rs"]
mod platform;
mod process;
mod state;

use std::sync::Arc;

use tauri::Manager;

use crate::{
  app::{init_state, preload_models, setup_shortcut, sync_shortcut},
  state::AppState,
};

#[tauri::command]
fn sync_hotkey_command(
  app: tauri::AppHandle,
  app_state: tauri::State<'_, Arc<AppState>>,
  previous_hotkey: String,
  next_hotkey: String,
) -> Result<(), String> {
  sync_shortcut(&app, app_state.inner(), &previous_hotkey, &next_hotkey)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::Builder::new().build())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:woice.db", migrations::get_migrations())
        .build(),
    )
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      use tauri_plugin_dialog::DialogExt;
      app
        .dialog()
        .message("Woice is already running.\n\nOnly one instance of Woice can run at a time.")
        .title("Woice")
        .show(|_| {});
    }))
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      let state = match init_state(app.handle()) {
        Ok(state) => Arc::new(state),
        Err(e) => {
          eprintln!("State init error: {}", e);
          return Err(e.into());
        }
      };
      app.manage(state.clone());
      let database = match platform::db::init_database(app.handle()) {
        Ok(db) => db,
        Err(e) => {
          eprintln!("Database error: {}", e);
          return Err(e.into());
        }
      };
      app.manage(database);
      if let Err(e) = platform::tray::create_tray(app.handle(), state.clone()) {
        eprintln!("Tray error: {}", e);
      }
      if let Err(e) = setup_shortcut(app.handle(), state.clone()) {
        eprintln!("Shortcut error: {}", e);
        return Err(e.into());
      }
      if let Err(e) = platform::overlay::ensure_overlay_window(app.handle()) {
        eprintln!("Overlay error: {}", e);
      }
      let state = app.state::<Arc<AppState>>();
      let app_handle = app.handle().clone();
      let state_for_preload = state.inner().clone();
      std::thread::spawn(move || {
        if let Err(e) = preload_models(&app_handle, &state_for_preload) {
          eprintln!("Preload error: {}", e);
        }
      });
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .invoke_handler(tauri::generate_handler![sync_hotkey_command,])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
