use core_foundation::base::TCFType;
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::CFString;
use core_graphics::event_source::CGEventSourceStateID;
use std::io::Write;
use std::process::{Command, Stdio};

pub fn inject_text(text: &str) -> Result<(), String> {
  if text.is_empty() {
    return Ok(());
  }

  if !has_accessibility_permission() {
    return Err(
      "Accessibility permission is required for text injection on macOS. \
        Please grant access in System Settings > Privacy & Security > Accessibility."
        .to_string(),
    );
  }

  let mut pbcopy = Command::new("pbcopy")
    .stdin(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to launch pbcopy: {e}"))?;

  if let Some(stdin) = pbcopy.stdin.as_mut() {
    stdin
      .write_all(text.as_bytes())
      .map_err(|e| format!("Failed to write clipboard content: {e}"))?;
  } else {
    return Err("Failed to open pbcopy stdin".to_string());
  }

  let pbcopy_status = pbcopy
    .wait()
    .map_err(|e| format!("Failed waiting for pbcopy: {e}"))?;
  if !pbcopy_status.success() {
    return Err("pbcopy failed to set clipboard content".to_string());
  }

  let output = Command::new("osascript")
    .arg("-e")
    .arg("tell application \"System Events\" to keystroke \"v\" using command down")
    .output()
    .map_err(|e| format!("Failed to run osascript: {e}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!("macOS paste keystroke failed: {}", stderr.trim()));
  }

  Ok(())
}

fn has_accessibility_permission() -> bool {
  let event_source =
    core_graphics::event_source::CGEventSource::new(CGEventSourceStateID::CombinedSessionState);

  event_source.is_some()
}
