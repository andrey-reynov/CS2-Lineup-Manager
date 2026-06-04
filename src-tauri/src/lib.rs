use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentWorkspace {
  root_dir: String,
  content_dir: String,
  maps_dir: String,
  system_dir: String,
}

#[tauri::command]
fn ensure_content_workspace(app: tauri::AppHandle, map_names: Vec<String>) -> Result<ContentWorkspace, String> {
  let root_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Failed to resolve app data folder: {error}"))?;
  let content_dir = root_dir.join("Content");
  let maps_dir = content_dir.join("Maps");
  let system_dir = root_dir.join("System");

  create_dir(&content_dir)?;
  create_dir(&maps_dir)?;
  create_dir(&system_dir)?;

  for map_name in map_names {
    let map_dir = maps_dir.join(safe_folder_name(&map_name));
    create_dir(&map_dir.join("Meta"))?;
    create_dir(&map_dir.join("User"))?;
    create_dir(&map_dir.join("User").join("Inbox"))?;
    create_dir(&map_dir.join("User").join("Media"))?;
  }

  Ok(ContentWorkspace {
    root_dir: path_to_string(root_dir),
    content_dir: path_to_string(content_dir),
    maps_dir: path_to_string(maps_dir),
    system_dir: path_to_string(system_dir),
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![ensure_content_workspace])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn create_dir(path: &PathBuf) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|error| format!("Failed to create {}: {error}", path_to_string(path.clone())))
}

fn path_to_string(path: PathBuf) -> String {
  path.to_string_lossy().into_owned()
}

fn safe_folder_name(name: &str) -> String {
  let safe_name: String = name
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || character == '-' || character == '_' || character == ' ' {
        character
      } else {
        '_'
      }
    })
    .collect();
  let trimmed = safe_name.trim();

  if trimmed.is_empty() {
    "_Unknown".to_string()
  } else {
    trimmed.to_string()
  }
}
