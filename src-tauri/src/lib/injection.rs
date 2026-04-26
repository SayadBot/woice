use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

pub fn inject_text(text: &str, ignore_clipboard: bool) -> Result<(), String> {
  if text.is_empty() {
    return Ok(());
  }

  #[cfg(target_os = "windows")]
  {
    if ignore_clipboard {
      return windows::inject_text(text);
    }

    inject_text_via_clipboard(text)
  }

  #[cfg(target_os = "macos")]
  {
    let _ = ignore_clipboard;
    inject_text_via_clipboard(text)
  }

  #[cfg(target_os = "linux")]
  {
    if ignore_clipboard {
      return linux::inject_text(text);
    }

    inject_text_via_clipboard(text)
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
  {
    let _ = ignore_clipboard;
    inject_text_via_clipboard(text)
  }
}

fn inject_text_via_clipboard(text: &str) -> Result<(), String> {
  let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard init failed: {e}"))?;
  clipboard
    .set_text(text)
    .map_err(|e| format!("Clipboard set failed: {e}"))?;

  let mut enigo =
    Enigo::new(&Settings::default()).map_err(|e| format!("Input injection failed: {e}"))?;

  #[cfg(target_os = "macos")]
  let modifier = Key::Meta;
  #[cfg(not(target_os = "macos"))]
  let modifier = Key::Control;

  enigo
    .key(modifier, Direction::Press)
    .map_err(|e| e.to_string())?;

  enigo
    .key(Key::Unicode('v'), Direction::Click)
    .map_err(|e| e.to_string())?;

  enigo
    .key(modifier, Direction::Release)
    .map_err(|e| e.to_string())?;

  Ok(())
}

#[cfg(target_os = "windows")]
mod windows {
  use uiautomation::{
    patterns::{UITextPattern, UIValuePattern},
    types::TextPatternRangeEndpoint,
    UIAutomation,
  };
  use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
      Controls::EM_REPLACESEL,
      WindowsAndMessaging::{GetClassNameW, SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK},
    },
  };

  const SEND_MESSAGE_TIMEOUT_MS: u32 = 1500;

  pub fn inject_text(text: &str) -> Result<(), String> {
    let automation = UIAutomation::new().map_err(|e| e.to_string())?;
    let element = automation
      .get_focused_element()
      .map_err(|e| e.to_string())?;

    if try_replace_via_uia_value(&element, text).is_ok() {
      return Ok(());
    }

    if try_replace_via_uia_text(&element, text).is_ok() {
      return Ok(());
    }

    if try_replace_via_edit_message(&element, text).is_ok() {
      return Ok(());
    }

    Err("Focused target does not expose a writable semantic text interface on Windows".to_string())
  }

  fn try_replace_via_uia_value(
    element: &uiautomation::UIElement,
    text: &str,
  ) -> Result<(), String> {
    let pattern = element
      .get_pattern::<UIValuePattern>()
      .map_err(|e| e.to_string())?;

    if pattern.is_readonly().map_err(|e| e.to_string())? {
      return Err("Focused target is read-only".to_string());
    }

    pattern.set_value(text).map_err(|e| e.to_string())
  }

  fn try_replace_via_uia_text(element: &uiautomation::UIElement, text: &str) -> Result<(), String> {
    let pattern = element
      .get_pattern::<UITextPattern>()
      .map_err(|e| e.to_string())?;

    let selection = pattern.get_selection().map_err(|e| e.to_string())?;
    let range = selection
      .first()
      .cloned()
      .or_else(|| pattern.get_caret_range().ok().map(|(_, caret)| caret))
      .ok_or_else(|| "Focused target has no writable selection range".to_string())?;

    let start = range
      .clone()
      .compare_endpoints(
        TextPatternRangeEndpoint::Start,
        &pattern.get_document_range().map_err(|e| e.to_string())?,
        TextPatternRangeEndpoint::Start,
      )
      .map_err(|e| e.to_string())?;

    let selected_text = range.get_text(-1).map_err(|e| e.to_string())?;
    let end = start + selected_text.chars().count() as i32;

    let document = pattern.get_document_range().map_err(|e| e.to_string())?;
    let content = document.get_text(-1).map_err(|e| e.to_string())?;

    let start_index = char_to_byte_index(&content, start)?;
    let end_index = char_to_byte_index(&content, end)?;

    let mut next = String::with_capacity(content.len() - (end_index - start_index) + text.len());
    next.push_str(&content[..start_index]);
    next.push_str(text);
    next.push_str(&content[end_index..]);

    if let Ok(value_pattern) = element.get_pattern::<UIValuePattern>() {
      if !value_pattern.is_readonly().map_err(|e| e.to_string())? {
        return value_pattern.set_value(&next).map_err(|e| e.to_string());
      }
    }

    Err("Focused target exposes text selection but not writable value".to_string())
  }

  fn try_replace_via_edit_message(
    element: &uiautomation::UIElement,
    text: &str,
  ) -> Result<(), String> {
    let handle = element
      .get_native_window_handle()
      .map_err(|e| e.to_string())?;
    let handle: isize = handle.into();
    let hwnd = HWND(std::ptr::with_exposed_provenance_mut(handle as usize));
    if hwnd.0.is_null() {
      return Err("Focused target has no native window handle".to_string());
    }

    let class_name = window_class_name(hwnd)?;
    let normalized = class_name.to_ascii_lowercase();
    let is_edit = normalized == "edit" || normalized.starts_with("richedit");
    if !is_edit {
      return Err(format!("Unsupported window class '{class_name}'"));
    }

    let wide: Vec<u16> = text.encode_utf16().chain(Some(0)).collect();
    let mut result = 0usize;

    let send_result = unsafe {
      SendMessageTimeoutW(
        hwnd,
        EM_REPLACESEL,
        WPARAM(1),
        LPARAM(wide.as_ptr() as isize),
        SMTO_BLOCK | SMTO_ABORTIFHUNG,
        SEND_MESSAGE_TIMEOUT_MS,
        Some(&mut result),
      )
    };

    if send_result == LRESULT(0) {
      return Err("Timed out replacing text in focused edit control".to_string());
    }

    Ok(())
  }

  fn window_class_name(hwnd: HWND) -> Result<String, String> {
    let mut buffer = [0u16; 256];
    let length = unsafe { GetClassNameW(hwnd, &mut buffer) };

    if length == 0 {
      return Err("Failed to query focused window class".to_string());
    }

    Ok(String::from_utf16_lossy(&buffer[..length as usize]))
  }

  fn char_to_byte_index(text: &str, char_index: i32) -> Result<usize, String> {
    if char_index < 0 {
      return Err("Received negative text offset".to_string());
    }

    let char_index = char_index as usize;
    if char_index == 0 {
      return Ok(0);
    }

    text
      .char_indices()
      .nth(char_index)
      .map(|(index, _)| index)
      .or_else(|| (char_index == text.chars().count()).then_some(text.len()))
      .ok_or_else(|| "Text offset is outside the focused control contents".to_string())
  }
}

#[cfg(target_os = "linux")]
mod linux {
  use atspi::{
    proxy::{
      accessible::{AccessibleProxy, ObjectRefExt},
      bus::BusProxy,
      proxy_ext::ProxyExt,
    },
    AccessibilityConnection,
  };
  use zbus::Connection;

  pub fn inject_text(text: &str) -> Result<(), String> {
    tauri::async_runtime::block_on(async move {
      let connection = AccessibilityConnection::new()
        .await
        .map_err(|e| e.to_string())?;
      let root = connection
        .root_accessible_on_registry()
        .await
        .map_err(|e| e.to_string())?;

      let focused = find_focused_accessible(connection.connection(), &root).await?;
      let proxies = focused.proxies().await.map_err(|e| e.to_string())?;
      let text_proxy = proxies.text().await.map_err(|e| e.to_string())?;
      let editable = proxies
        .editable_text()
        .await
        .map_err(|_| "Focused target is not editable through AT-SPI".to_string())?;

      let character_count = text_proxy
        .character_count()
        .await
        .map_err(|e| e.to_string())?;
      let selection_count = text_proxy
        .get_nselections()
        .await
        .map_err(|e| e.to_string())?;
      let (start, end) = if selection_count > 0 {
        text_proxy
          .get_selection(0)
          .await
          .map_err(|e| e.to_string())?
      } else {
        let caret = text_proxy.caret_offset().await.map_err(|e| e.to_string())?;
        (caret, caret)
      };

      if end > start {
        let deleted = editable
          .delete_text(start, end)
          .await
          .map_err(|e| e.to_string())?;
        if !deleted {
          return Err("Focused target rejected semantic text deletion on Linux".to_string());
        }
      }

      let inserted = editable
        .insert_text(start, text, text.chars().count() as i32)
        .await
        .map_err(|e| e.to_string())?;
      if !inserted {
        return Err("Focused target rejected semantic text insertion on Linux".to_string());
      }

      let caret = start + text.chars().count() as i32;
      if caret <= character_count + text.chars().count() as i32 {
        let _ = text_proxy.set_caret_offset(caret).await;
      }

      Ok(())
    })
  }

  async fn find_focused_accessible<'a>(
    connection: &Connection,
    root: &AccessibleProxy<'a>,
  ) -> Result<AccessibleProxy<'a>, String> {
    if is_focused(root).await? {
      return Ok(root.clone());
    }

    let children = root.get_children().await.map_err(|e| e.to_string())?;
    for child in children {
      let child_proxy = child
        .as_accessible_proxy(connection)
        .await
        .map_err(|e| e.to_string())?;
      if let Ok(found) = find_focused_accessible(connection, &child_proxy).await {
        return Ok(found);
      }
    }

    Err("Focused target does not expose a writable semantic text interface on Linux".to_string())
  }

  async fn is_focused(proxy: &AccessibleProxy<'_>) -> Result<bool, String> {
    let attributes = proxy.get_attributes().await.map_err(|e| e.to_string())?;
    Ok(
      attributes
        .get("focused")
        .map(|value| value == "true")
        .unwrap_or(false),
    )
  }
}
