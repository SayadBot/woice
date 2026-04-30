pub mod active_window;
pub mod audio;
pub mod db;
pub mod overlay;
pub mod sounds;
pub mod tray;

#[cfg(target_os = "windows")]
pub mod injection_win;
#[cfg(target_os = "windows")]
pub use injection_win as injection;

#[cfg(target_os = "macos")]
pub mod injection_mac;
#[cfg(target_os = "macos")]
pub use injection_mac as injection;

#[cfg(target_os = "linux")]
pub mod injection_linux;
#[cfg(target_os = "linux")]
pub use injection_linux as injection;
