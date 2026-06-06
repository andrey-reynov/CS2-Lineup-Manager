use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
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
fn ensure_content_workspace(
  app: tauri::AppHandle,
  map_names: Vec<String>,
  content_root: Option<String>,
) -> Result<ContentWorkspace, String> {
  let root_dir = resolve_content_root(&app, content_root)?;
  let content_dir = root_dir.join("Content");
  let maps_dir = content_dir.join("Maps");
  let content_system_dir = content_dir.join("System");
  let system_dir = root_dir.join("System");

  create_dir(&content_dir)?;
  create_dir(&maps_dir)?;
  create_dir(&content_system_dir)?;
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

#[tauri::command]
fn write_content_file(content_root: String, relative_path: String, bytes: Vec<u8>) -> Result<(), String> {
  let path = resolve_content_file_path(&content_root, &relative_path)?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("Failed to create {}: {error}", parent.to_string_lossy()))?;
  }
  fs::write(&path, bytes).map_err(|error| format!("Failed to write {}: {error}", path.to_string_lossy()))
}

#[tauri::command]
fn read_content_file(content_root: String, relative_path: String) -> Result<Vec<u8>, String> {
  let path = resolve_content_file_path(&content_root, &relative_path)?;
  fs::read(&path).map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      ensure_content_workspace,
      write_content_file,
      read_content_file
    ])
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

fn resolve_content_root(app: &tauri::AppHandle, content_root: Option<String>) -> Result<PathBuf, String> {
  match content_root {
    Some(root) if !root.trim().is_empty() => Ok(PathBuf::from(root)),
    _ => app
      .path()
      .app_data_dir()
      .map_err(|error| format!("Failed to resolve app data folder: {error}")),
  }
}

fn resolve_content_file_path(content_root: &str, relative_path: &str) -> Result<PathBuf, String> {
  let relative = Path::new(relative_path);
  if relative.is_absolute()
    || relative
      .components()
      .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_) | Component::RootDir))
  {
    return Err("Content path escapes the selected content root".to_string());
  }

  Ok(PathBuf::from(content_root).join(relative))
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
