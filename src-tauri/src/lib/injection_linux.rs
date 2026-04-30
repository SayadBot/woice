use atspi::{
  proxy::{
    accessible::{AccessibleProxy, ObjectRefExt},
    proxy_ext::ProxyExt,
  },
  AccessibilityConnection,
};
use zbus::Connection;

pub fn inject_text(text: &str) -> Result<(), String> {
  if text.is_empty() {
    return Ok(());
  }

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
