use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use url::Url;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentWorkspace {
    root_dir: String,
    content_dir: String,
    maps_dir: String,
    system_dir: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CloudProvider {
    GoogleDrive,
    YandexDisk,
}

#[derive(Clone)]
struct CloudProviderConfig {
    client_id: String,
    client_secret: Option<String>,
    redirect_uri: String,
    scope: Option<String>,
    folder_name: String,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudIntegrationStore {
    google_drive: Option<CloudTokenRecord>,
    yandex_disk: Option<CloudTokenRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudTokenRecord {
    access_token: String,
    refresh_token: Option<String>,
    expires_at_epoch_ms: Option<u64>,
    scope: Option<String>,
    account_label: Option<String>,
    last_backup_at_epoch_ms: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudProviderStatus {
    id: String,
    display_name: String,
    configured: bool,
    connected: bool,
    detail: String,
    account_label: Option<String>,
    last_backup_at_epoch_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudUploadResult {
    provider_id: String,
    file_name: String,
    remote_path: String,
    web_view_link: Option<String>,
    last_backup_at_epoch_ms: u64,
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    scope: Option<String>,
}

#[derive(Deserialize)]
struct GoogleListFilesResponse {
    files: Vec<GoogleFile>,
}

#[derive(Deserialize)]
struct GoogleFile {
    id: String,
    name: Option<String>,
    #[serde(rename = "webViewLink")]
    web_view_link: Option<String>,
}

#[derive(Deserialize)]
struct YandexUploadLinkResponse {
    href: String,
}

#[derive(Deserialize)]
struct YandexUserInfo {
    login: Option<String>,
    #[serde(rename = "display_name")]
    display_name: Option<String>,
    #[serde(rename = "default_email")]
    default_email: Option<String>,
    #[serde(rename = "real_name")]
    real_name: Option<String>,
}

#[derive(Debug)]
struct OAuthCallbackPayload {
    code: String,
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
fn write_content_file(
    content_root: String,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let path = resolve_content_file_path(&content_root, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.to_string_lossy()))?;
    }
    fs::write(&path, bytes)
        .map_err(|error| format!("Failed to write {}: {error}", path.to_string_lossy()))
}

#[tauri::command]
fn read_content_file(content_root: String, relative_path: String) -> Result<Vec<u8>, String> {
    let path = resolve_content_file_path(&content_root, &relative_path)?;
    fs::read(&path).map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))
}

#[tauri::command]
fn save_backup_zip(
    app: tauri::AppHandle,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let downloads_dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|error| format!("Failed to resolve backup folder: {error}"))?;
    fs::create_dir_all(&downloads_dir).map_err(|error| {
        format!(
            "Failed to create {}: {error}",
            downloads_dir.to_string_lossy()
        )
    })?;

    let path = downloads_dir.join(safe_file_name(&file_name));
    fs::write(&path, bytes)
        .map_err(|error| format!("Failed to write {}: {error}", path.to_string_lossy()))?;
    Ok(path_to_string(path))
}

#[tauri::command]
fn save_zip_to_path(path: String, bytes: Vec<u8>) -> Result<String, String> {
    let zip_path = PathBuf::from(path);
    if let Some(parent) = zip_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.to_string_lossy()))?;
    }
    fs::write(&zip_path, bytes)
        .map_err(|error| format!("Failed to write {}: {error}", zip_path.to_string_lossy()))?;
    Ok(path_to_string(zip_path))
}

#[tauri::command]
fn write_zip_chunk(path: String, bytes: Vec<u8>, append: bool) -> Result<String, String> {
    let zip_path = PathBuf::from(path);
    if let Some(parent) = zip_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create {}: {error}", parent.to_string_lossy()))?;
    }

    let mut options = fs::OpenOptions::new();
    options.create(true).write(true);
    if append {
        options.append(true);
    } else {
        options.truncate(true);
    }

    let mut file = options
        .open(&zip_path)
        .map_err(|error| format!("Failed to open {}: {error}", zip_path.to_string_lossy()))?;
    file.write_all(&bytes)
        .map_err(|error| format!("Failed to write {}: {error}", zip_path.to_string_lossy()))?;
    Ok(path_to_string(zip_path))
}

#[tauri::command]
fn read_zip_file(path: String) -> Result<Vec<u8>, String> {
    let zip_path = PathBuf::from(path);
    fs::read(&zip_path)
        .map_err(|error| format!("Failed to read {}: {error}", zip_path.to_string_lossy()))
}

#[tauri::command]
async fn cloud_provider_statuses(
    app: tauri::AppHandle,
) -> Result<Vec<CloudProviderStatus>, String> {
    let store = load_cloud_store(&app)?;
    Ok(vec![
        build_cloud_provider_status(
            CloudProvider::GoogleDrive,
            provider_config(CloudProvider::GoogleDrive),
            store.google_drive.as_ref(),
        ),
        build_cloud_provider_status(
            CloudProvider::YandexDisk,
            provider_config(CloudProvider::YandexDisk),
            store.yandex_disk.as_ref(),
        ),
    ])
}

#[tauri::command]
async fn start_cloud_provider_auth(
    app: tauri::AppHandle,
    provider_id: String,
) -> Result<CloudProviderStatus, String> {
    let provider = parse_provider(&provider_id)?;
    let config = provider_config(provider).ok_or_else(|| missing_cloud_config_message(provider))?;
    let pkce_verifier = random_string(96);
    let pkce_challenge = pkce_challenge(&pkce_verifier);
    let state = random_string(40);
    let authorize_url = build_authorize_url(provider, &config, &state, &pkce_challenge)?;
    let redirect_uri = Url::parse(&config.redirect_uri)
        .map_err(|error| format!("Invalid redirect URI: {error}"))?;

    open_browser(authorize_url.as_str())?;
    let callback = tauri::async_runtime::spawn_blocking(move || {
        wait_for_oauth_callback(&redirect_uri, &state, provider)
    })
    .await
    .map_err(|error| format!("OAuth callback task failed: {error}"))??;

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;

    let mut record =
        exchange_authorization_code(&client, provider, &config, callback.code, &pkce_verifier)
            .await?;
    if provider == CloudProvider::YandexDisk {
        record.account_label = fetch_yandex_account_label(&client, &record.access_token)
            .await
            .ok()
            .flatten();
    }

    let mut store = load_cloud_store(&app)?;
    set_store_record(&mut store, provider, Some(record.clone()));
    save_cloud_store(&app, &store)?;
    Ok(build_cloud_provider_status(
        provider,
        Some(config),
        Some(&record),
    ))
}

#[tauri::command]
async fn disconnect_cloud_provider(
    app: tauri::AppHandle,
    provider_id: String,
) -> Result<CloudProviderStatus, String> {
    let provider = parse_provider(&provider_id)?;
    let config = provider_config(provider);
    let client = reqwest::Client::new();
    let mut store = load_cloud_store(&app)?;

    if let Some(record) = get_store_record(&store, provider).cloned() {
        if provider == CloudProvider::GoogleDrive {
            let _ = client
                .post("https://oauth2.googleapis.com/revoke")
                .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
                .body(format!(
                    "token={}",
                    url::form_urlencoded::byte_serialize(record.access_token.as_bytes())
                        .collect::<String>()
                ))
                .send()
                .await;
        }
    }

    set_store_record(&mut store, provider, None);
    save_cloud_store(&app, &store)?;
    Ok(build_cloud_provider_status(provider, config, None))
}

#[tauri::command]
async fn upload_cloud_backup_archive(
    app: tauri::AppHandle,
    provider_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<CloudUploadResult, String> {
    let provider = parse_provider(&provider_id)?;
    let config = provider_config(provider).ok_or_else(|| missing_cloud_config_message(provider))?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;
    let mut store = load_cloud_store(&app)?;
    let access_token = ensure_access_token(&client, provider, &config, &mut store, &app).await?;

    let upload_result = match provider {
        CloudProvider::GoogleDrive => {
            upload_google_drive_backup(&client, &config, &access_token, &file_name, bytes).await?
        }
        CloudProvider::YandexDisk => {
            upload_yandex_disk_backup(&client, &config, &access_token, &file_name, bytes).await?
        }
    };

    let completed_at = now_epoch_ms();
    if let Some(record) = get_store_record_mut(&mut store, provider) {
        record.last_backup_at_epoch_ms = Some(completed_at);
    }
    save_cloud_store(&app, &store)?;

    Ok(CloudUploadResult {
        provider_id: provider.id().to_string(),
        file_name,
        remote_path: upload_result.0,
        web_view_link: upload_result.1,
        last_backup_at_epoch_ms: completed_at,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ensure_content_workspace,
            write_content_file,
            read_content_file,
            save_backup_zip,
            save_zip_to_path,
            write_zip_chunk,
            read_zip_file,
            cloud_provider_statuses,
            start_cloud_provider_auth,
            disconnect_cloud_provider,
            upload_cloud_backup_archive
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
    fs::create_dir_all(path)
        .map_err(|error| format!("Failed to create {}: {error}", path_to_string(path.clone())))
}

fn resolve_content_root(
    app: &tauri::AppHandle,
    content_root: Option<String>,
) -> Result<PathBuf, String> {
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
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
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
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
                || character == ' '
            {
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

fn safe_file_name(name: &str) -> String {
    let safe_name: String = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
                || character == '.'
                || character == ' '
            {
                character
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = safe_name.trim();

    if trimmed.is_empty() {
        "cs2-nades-backup.zip".to_string()
    } else {
        trimmed.to_string()
    }
}

fn parse_provider(provider_id: &str) -> Result<CloudProvider, String> {
    match provider_id {
        "googleDrive" => Ok(CloudProvider::GoogleDrive),
        "yandexDisk" => Ok(CloudProvider::YandexDisk),
        _ => Err(format!("Unsupported cloud provider: {provider_id}")),
    }
}

impl CloudProvider {
    fn id(self) -> &'static str {
        match self {
            Self::GoogleDrive => "googleDrive",
            Self::YandexDisk => "yandexDisk",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::GoogleDrive => "Google Drive",
            Self::YandexDisk => "Yandex.Disk",
        }
    }
}

fn provider_config(provider: CloudProvider) -> Option<CloudProviderConfig> {
    match provider {
        CloudProvider::GoogleDrive => {
            let client_id = env_value("CS2NADES_GOOGLE_DRIVE_CLIENT_ID")?;
            let redirect_uri = env_value("CS2NADES_GOOGLE_DRIVE_REDIRECT_URI")?;
            Some(CloudProviderConfig {
                client_id,
                client_secret: env_value("CS2NADES_GOOGLE_DRIVE_CLIENT_SECRET"),
                redirect_uri,
                scope: Some(
                    env_value("CS2NADES_GOOGLE_DRIVE_SCOPE").unwrap_or_else(|| {
                        "https://www.googleapis.com/auth/drive.file".to_string()
                    }),
                ),
                folder_name: env_value("CS2NADES_GOOGLE_DRIVE_FOLDER_NAME")
                    .unwrap_or_else(|| "CS2 Nades Backups".to_string()),
            })
        }
        CloudProvider::YandexDisk => {
            let client_id = env_value("CS2NADES_YANDEX_DISK_CLIENT_ID")?;
            let redirect_uri = env_value("CS2NADES_YANDEX_DISK_REDIRECT_URI")?;
            Some(CloudProviderConfig {
                client_id,
                client_secret: env_value("CS2NADES_YANDEX_DISK_CLIENT_SECRET"),
                redirect_uri,
                scope: env_value("CS2NADES_YANDEX_DISK_SCOPE"),
                folder_name: env_value("CS2NADES_YANDEX_DISK_FOLDER_NAME")
                    .unwrap_or_else(|| "CS2 Nades Backups".to_string()),
            })
        }
    }
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name).ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn missing_cloud_config_message(provider: CloudProvider) -> String {
    match provider {
    CloudProvider::GoogleDrive => {
      "Set CS2NADES_GOOGLE_DRIVE_CLIENT_ID and CS2NADES_GOOGLE_DRIVE_REDIRECT_URI in the environment.".to_string()
    }
    CloudProvider::YandexDisk => {
      "Set CS2NADES_YANDEX_DISK_CLIENT_ID and CS2NADES_YANDEX_DISK_REDIRECT_URI in the environment.".to_string()
    }
  }
}

fn cloud_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data folder: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create {}: {error}", dir.to_string_lossy()))?;
    Ok(dir.join("cloud-integrations.json"))
}

fn load_cloud_store(app: &tauri::AppHandle) -> Result<CloudIntegrationStore, String> {
    let path = cloud_store_path(app)?;
    if !path.exists() {
        return Ok(CloudIntegrationStore::default());
    }

    let bytes = fs::read(&path)
        .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
    serde_json::from_slice::<CloudIntegrationStore>(&bytes)
        .map_err(|error| format!("Failed to parse {}: {error}", path.to_string_lossy()))
}

fn save_cloud_store(app: &tauri::AppHandle, store: &CloudIntegrationStore) -> Result<(), String> {
    let path = cloud_store_path(app)?;
    let json = serde_json::to_vec_pretty(store)
        .map_err(|error| format!("Failed to serialize cloud integrations: {error}"))?;
    fs::write(&path, json)
        .map_err(|error| format!("Failed to write {}: {error}", path.to_string_lossy()))
}

fn get_store_record(
    store: &CloudIntegrationStore,
    provider: CloudProvider,
) -> Option<&CloudTokenRecord> {
    match provider {
        CloudProvider::GoogleDrive => store.google_drive.as_ref(),
        CloudProvider::YandexDisk => store.yandex_disk.as_ref(),
    }
}

fn get_store_record_mut(
    store: &mut CloudIntegrationStore,
    provider: CloudProvider,
) -> Option<&mut CloudTokenRecord> {
    match provider {
        CloudProvider::GoogleDrive => store.google_drive.as_mut(),
        CloudProvider::YandexDisk => store.yandex_disk.as_mut(),
    }
}

fn set_store_record(
    store: &mut CloudIntegrationStore,
    provider: CloudProvider,
    record: Option<CloudTokenRecord>,
) {
    match provider {
        CloudProvider::GoogleDrive => store.google_drive = record,
        CloudProvider::YandexDisk => store.yandex_disk = record,
    }
}

fn build_cloud_provider_status(
    provider: CloudProvider,
    config: Option<CloudProviderConfig>,
    record: Option<&CloudTokenRecord>,
) -> CloudProviderStatus {
    let detail = match (config.as_ref(), record) {
        (None, _) => missing_cloud_config_message(provider),
        (Some(config), Some(record)) => {
            let suffix = if let Some(label) = record.account_label.as_deref() {
                format!("Connected as {label}.")
            } else {
                "Connected and ready for ZIP backups.".to_string()
            };
            format!("Uploads go to {}. {}", config.folder_name, suffix)
        }
        (Some(config), None) => format!(
            "Open the default browser to connect. Backups will be stored in {}.",
            config.folder_name
        ),
    };

    CloudProviderStatus {
        id: provider.id().to_string(),
        display_name: provider.display_name().to_string(),
        configured: config.is_some(),
        connected: record.is_some(),
        detail,
        account_label: record.and_then(|value| value.account_label.clone()),
        last_backup_at_epoch_ms: record.and_then(|value| value.last_backup_at_epoch_ms),
    }
}

fn build_authorize_url(
    provider: CloudProvider,
    config: &CloudProviderConfig,
    state: &str,
    code_challenge: &str,
) -> Result<Url, String> {
    let base = match provider {
        CloudProvider::GoogleDrive => "https://accounts.google.com/o/oauth2/v2/auth",
        CloudProvider::YandexDisk => "https://oauth.yandex.com/authorize",
    };
    let mut url =
        Url::parse(base).map_err(|error| format!("Failed to build authorization URL: {error}"))?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("response_type", "code");
        query.append_pair("client_id", &config.client_id);
        query.append_pair("redirect_uri", &config.redirect_uri);
        query.append_pair("state", state);
        query.append_pair("code_challenge", code_challenge);
        query.append_pair("code_challenge_method", "S256");

        if let Some(scope) = config.scope.as_deref() {
            query.append_pair("scope", scope);
        }

        if provider == CloudProvider::GoogleDrive {
            query.append_pair("access_type", "offline");
            query.append_pair("include_granted_scopes", "true");
            query.append_pair("prompt", "consent");
        }
    }
    Ok(url)
}

fn random_string(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = sha2::Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn wait_for_oauth_callback(
    redirect_uri: &Url,
    expected_state: &str,
    provider: CloudProvider,
) -> Result<OAuthCallbackPayload, String> {
    let host = redirect_uri
        .host_str()
        .ok_or_else(|| "Redirect URI must include a hostname".to_string())?;
    let port = redirect_uri
        .port_or_known_default()
        .ok_or_else(|| "Redirect URI must include a port".to_string())?;
    let path = if redirect_uri.path().is_empty() {
        "/"
    } else {
        redirect_uri.path()
    };
    let bind_host = if host.eq_ignore_ascii_case("localhost") {
        "127.0.0.1"
    } else {
        host
    };
    let listener = TcpListener::bind((bind_host, port)).map_err(|error| {
        format!(
            "Failed to listen for {} OAuth callback on {}:{}: {error}",
            provider.display_name(),
            bind_host,
            port
        )
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to set callback listener mode: {error}"))?;

    let deadline = SystemTime::now()
        .checked_add(Duration::from_secs(180))
        .ok_or_else(|| "Failed to initialize OAuth timeout".to_string())?;

    loop {
        match listener.accept() {
            Ok((mut stream, _address)) => {
                return handle_oauth_callback_stream(&mut stream, path, expected_state, provider);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if SystemTime::now() >= deadline {
                    return Err(format!(
                        "Timed out waiting for {} OAuth callback",
                        provider.display_name()
                    ));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(format!("OAuth callback listener failed: {error}")),
        }
    }
}

fn handle_oauth_callback_stream(
    stream: &mut TcpStream,
    expected_path: &str,
    expected_state: &str,
    provider: CloudProvider,
) -> Result<OAuthCallbackPayload, String> {
    let mut request_line = String::new();
    {
        let mut reader = BufReader::new(&mut *stream);
        reader
            .read_line(&mut request_line)
            .map_err(|error| format!("Failed to read OAuth callback request: {error}"))?;
    }

    let target = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "OAuth callback request was malformed".to_string())?;
    let parsed = Url::parse(&format!("http://localhost{target}"))
        .map_err(|error| format!("Failed to parse OAuth callback URL: {error}"))?;

    if parsed.path() != expected_path {
        write_html_response(
            stream,
            404,
            &oauth_callback_html(
                provider.display_name(),
                "This callback URL does not match the configured desktop redirect.",
                false,
            ),
        )?;
        return Err(format!("Unexpected OAuth callback path: {}", parsed.path()));
    }

    let params = parsed.query_pairs().collect::<Vec<_>>();
    if let Some(error) = params
        .iter()
        .find(|(key, _value)| key == "error")
        .map(|(_key, value)| value.to_string())
    {
        write_html_response(
            stream,
            400,
            &oauth_callback_html(
                provider.display_name(),
                "Authorization was cancelled or failed. You can close this window and try again.",
                false,
            ),
        )?;
        return Err(format!(
            "{} authorization failed: {error}",
            provider.display_name()
        ));
    }

    let state = params
        .iter()
        .find(|(key, _value)| key == "state")
        .map(|(_key, value)| value.to_string())
        .unwrap_or_default();
    if state != expected_state {
        write_html_response(
            stream,
            400,
            &oauth_callback_html(
                provider.display_name(),
                "The desktop app rejected this callback because the state value did not match.",
                false,
            ),
        )?;
        return Err("OAuth state validation failed".to_string());
    }

    let code = params
        .iter()
        .find(|(key, _value)| key == "code")
        .map(|(_key, value)| value.to_string())
        .ok_or_else(|| "OAuth callback did not include an authorization code".to_string())?;

    write_html_response(
        stream,
        200,
        &oauth_callback_html(
            provider.display_name(),
            "Connection confirmed. Return to CS2 Nades.",
            true,
        ),
    )?;
    Ok(OAuthCallbackPayload { code })
}

fn write_html_response(stream: &mut TcpStream, status_code: u16, body: &str) -> Result<(), String> {
    let status_text = match status_code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "OK",
    };
    let response = format!(
    "HTTP/1.1 {status_code} {status_text}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  );
    stream
        .write_all(response.as_bytes())
        .map_err(|error| format!("Failed to write OAuth callback response: {error}"))
}

fn oauth_callback_html(provider_name: &str, message: &str, success: bool) -> String {
    let accent = if success { "#4fbf8f" } else { "#ff7a7a" };
    format!(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{provider_name}</title><style>body{{margin:0;font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#f3f4f6;display:grid;place-items:center;min-height:100vh}}main{{width:min(480px,calc(100vw - 32px));padding:28px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));box-shadow:0 24px 80px rgba(0,0,0,.35)}}strong{{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:{accent}}}h1{{margin:14px 0 8px;font-size:1.4rem}}p{{margin:0;color:#c8ced8;line-height:1.5}}</style></head><body><main><strong>{provider_name}</strong><h1>CS2 Nades</h1><p>{message}</p></main></body></html>"
  )
}

fn open_browser(url: &str) -> Result<(), String> {
    let result = if cfg!(target_os = "macos") {
        Command::new("open").arg(url).status()
    } else if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", url]).status()
    } else {
        Command::new("xdg-open").arg(url).status()
    };

    match result {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(format!(
            "Failed to open the default browser (exit status {status})"
        )),
        Err(error) => Err(format!("Failed to open the default browser: {error}")),
    }
}

async fn exchange_authorization_code(
    client: &reqwest::Client,
    provider: CloudProvider,
    config: &CloudProviderConfig,
    code: String,
    pkce_verifier: &str,
) -> Result<CloudTokenRecord, String> {
    let endpoint = match provider {
        CloudProvider::GoogleDrive => "https://oauth2.googleapis.com/token",
        CloudProvider::YandexDisk => "https://oauth.yandex.com/token",
    };

    let mut form = vec![
        ("grant_type", "authorization_code".to_string()),
        ("code", code),
        ("client_id", config.client_id.clone()),
        ("redirect_uri", config.redirect_uri.clone()),
        ("code_verifier", pkce_verifier.to_string()),
    ];
    if let Some(secret) = config.client_secret.clone() {
        form.push(("client_secret", secret));
    }

    let response = client
        .post(endpoint)
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("Failed to exchange OAuth code: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("OAuth code exchange was rejected: {error}"))?;
    let token = response
        .json::<OAuthTokenResponse>()
        .await
        .map_err(|error| format!("Failed to parse OAuth token response: {error}"))?;

    Ok(CloudTokenRecord {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at_epoch_ms: token
            .expires_in
            .map(|value| now_epoch_ms().saturating_add(value.saturating_mul(1000))),
        scope: token.scope,
        account_label: None,
        last_backup_at_epoch_ms: None,
    })
}

async fn ensure_access_token(
    client: &reqwest::Client,
    provider: CloudProvider,
    config: &CloudProviderConfig,
    store: &mut CloudIntegrationStore,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    let needs_refresh = {
        let record = get_store_record(store, provider)
            .ok_or_else(|| format!("{} is not connected", provider.display_name()))?;
        token_needs_refresh(record)
    };

    if !needs_refresh {
        return Ok(get_store_record(store, provider)
            .ok_or_else(|| format!("{} is not connected", provider.display_name()))?
            .access_token
            .clone());
    }

    let refresh_token = get_store_record(store, provider)
        .and_then(|record| record.refresh_token.clone())
        .ok_or_else(|| {
            format!(
                "{} needs to reconnect because the refresh token is missing",
                provider.display_name()
            )
        })?;
    let refreshed = refresh_access_token(client, provider, config, refresh_token).await?;

    if let Some(record) = get_store_record_mut(store, provider) {
        record.access_token = refreshed.access_token;
        if let Some(refresh_token) = refreshed.refresh_token {
            record.refresh_token = Some(refresh_token);
        }
        record.expires_at_epoch_ms = refreshed
            .expires_in
            .map(|value| now_epoch_ms().saturating_add(value.saturating_mul(1000)));
        if let Some(scope) = refreshed.scope {
            record.scope = Some(scope);
        }
    }
    save_cloud_store(app, store)?;

    Ok(get_store_record(store, provider)
        .ok_or_else(|| format!("{} is not connected", provider.display_name()))?
        .access_token
        .clone())
}

fn token_needs_refresh(record: &CloudTokenRecord) -> bool {
    match record.expires_at_epoch_ms {
        Some(expires_at) => expires_at <= now_epoch_ms().saturating_add(60_000),
        None => false,
    }
}

async fn refresh_access_token(
    client: &reqwest::Client,
    provider: CloudProvider,
    config: &CloudProviderConfig,
    refresh_token: String,
) -> Result<OAuthTokenResponse, String> {
    let endpoint = match provider {
        CloudProvider::GoogleDrive => "https://oauth2.googleapis.com/token",
        CloudProvider::YandexDisk => "https://oauth.yandex.com/token",
    };

    let mut form = vec![
        ("grant_type", "refresh_token".to_string()),
        ("refresh_token", refresh_token),
        ("client_id", config.client_id.clone()),
    ];
    if let Some(secret) = config.client_secret.clone() {
        form.push(("client_secret", secret));
    }

    let response = client
        .post(endpoint)
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("Failed to refresh OAuth token: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("OAuth token refresh was rejected: {error}"))?;
    response
        .json::<OAuthTokenResponse>()
        .await
        .map_err(|error| format!("Failed to parse refreshed OAuth token: {error}"))
}

async fn fetch_yandex_account_label(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<Option<String>, String> {
    let response = client
        .get("https://login.yandex.ru/info")
        .query(&[("format", "json")])
        .header(AUTHORIZATION, format!("OAuth {access_token}"))
        .send()
        .await
        .map_err(|error| format!("Failed to load Yandex account profile: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("Yandex account profile request was rejected: {error}"))?;
    let user = response
        .json::<YandexUserInfo>()
        .await
        .map_err(|error| format!("Failed to parse Yandex account profile: {error}"))?;

    Ok(user
        .default_email
        .or(user.display_name)
        .or(user.real_name)
        .or(user.login))
}

async fn upload_google_drive_backup(
    client: &reqwest::Client,
    config: &CloudProviderConfig,
    access_token: &str,
    file_name: &str,
    bytes: Vec<u8>,
) -> Result<(String, Option<String>), String> {
    let folder_id = ensure_google_drive_folder(client, config, access_token).await?;
    let boundary = format!("cs2nades-{}", random_string(20));
    let metadata = serde_json::json!({
      "name": file_name,
      "parents": [folder_id],
    });
    let metadata_json = serde_json::to_string(&metadata)
        .map_err(|error| format!("Failed to serialize Drive metadata: {error}"))?;
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata_json}\r\n").as_bytes());
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Type: application/zip\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(&bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let response = client
        .post("https://www.googleapis.com/upload/drive/v3/files")
        .query(&[
            ("uploadType", "multipart"),
            ("fields", "id,name,webViewLink"),
        ])
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(
            CONTENT_TYPE,
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .map_err(|error| format!("Failed to upload backup to Google Drive: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("Google Drive upload was rejected: {error}"))?;
    let file = response
        .json::<GoogleFile>()
        .await
        .map_err(|error| format!("Failed to parse Google Drive upload response: {error}"))?;

    let name = file.name.unwrap_or_else(|| file_name.to_string());
    Ok((
        format!("{}/{}", config.folder_name, name),
        file.web_view_link,
    ))
}

async fn ensure_google_drive_folder(
    client: &reqwest::Client,
    config: &CloudProviderConfig,
    access_token: &str,
) -> Result<String, String> {
    let query = format!(
        "name='{}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        config.folder_name.replace('\'', "\\'")
    );
    let search = client
        .get("https://www.googleapis.com/drive/v3/files")
        .query(&[
            ("q", query.as_str()),
            ("fields", "files(id,name)"),
            ("spaces", "drive"),
        ])
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|error| format!("Failed to query Google Drive folders: {error}"))?;
    let search = search
        .error_for_status()
        .map_err(|error| format!("Google Drive folder lookup was rejected: {error}"))?;
    let files = search
        .json::<GoogleListFilesResponse>()
        .await
        .map_err(|error| format!("Failed to parse Google Drive folder lookup: {error}"))?;
    if let Some(folder) = files.files.into_iter().next() {
        return Ok(folder.id);
    }

    let response = client
        .post("https://www.googleapis.com/drive/v3/files")
        .query(&[("fields", "id,name")])
        .header(AUTHORIZATION, format!("Bearer {access_token}"))
        .header(CONTENT_TYPE, "application/json")
        .json(&serde_json::json!({
          "name": config.folder_name,
          "mimeType": "application/vnd.google-apps.folder",
        }))
        .send()
        .await
        .map_err(|error| format!("Failed to create Google Drive folder: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("Google Drive folder creation was rejected: {error}"))?;
    let folder = response.json::<GoogleFile>().await.map_err(|error| {
        format!("Failed to parse Google Drive folder creation response: {error}")
    })?;

    Ok(folder.id)
}

async fn upload_yandex_disk_backup(
    client: &reqwest::Client,
    config: &CloudProviderConfig,
    access_token: &str,
    file_name: &str,
    bytes: Vec<u8>,
) -> Result<(String, Option<String>), String> {
    let folder_path = format!("/{}", config.folder_name);
    ensure_yandex_disk_folder(client, access_token, &folder_path).await?;
    let file_path = format!("{folder_path}/{}", safe_file_name(file_name));
    let upload_href = request_yandex_disk_upload_href(client, access_token, &file_path).await?;

    let response = client
        .put(upload_href)
        .header(CONTENT_TYPE, "application/zip")
        .body(bytes)
        .send()
        .await
        .map_err(|error| format!("Failed to upload backup to Yandex.Disk: {error}"))?;
    response
        .error_for_status()
        .map_err(|error| format!("Yandex.Disk upload was rejected: {error}"))?;

    Ok((file_path, None))
}

async fn ensure_yandex_disk_folder(
    client: &reqwest::Client,
    access_token: &str,
    path: &str,
) -> Result<(), String> {
    let response = client
        .put("https://cloud-api.yandex.net/v1/disk/resources")
        .query(&[("path", path)])
        .header(AUTHORIZATION, format!("OAuth {access_token}"))
        .send()
        .await
        .map_err(|error| format!("Failed to create Yandex.Disk folder: {error}"))?;

    let status = response.status();
    if status.is_success() || status.as_u16() == 409 {
        return Ok(());
    }

    Err(format!(
        "Yandex.Disk folder creation was rejected: HTTP {status}"
    ))
}

async fn request_yandex_disk_upload_href(
    client: &reqwest::Client,
    access_token: &str,
    path: &str,
) -> Result<String, String> {
    let response = client
        .get("https://cloud-api.yandex.net/v1/disk/resources/upload")
        .query(&[("path", path), ("overwrite", "true")])
        .header(AUTHORIZATION, format!("OAuth {access_token}"))
        .send()
        .await
        .map_err(|error| format!("Failed to request Yandex.Disk upload URL: {error}"))?;
    let response = response
        .error_for_status()
        .map_err(|error| format!("Yandex.Disk upload URL request was rejected: {error}"))?;
    let upload = response
        .json::<YandexUploadLinkResponse>()
        .await
        .map_err(|error| format!("Failed to parse Yandex.Disk upload URL response: {error}"))?;

    Ok(upload.href)
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_millis() as u64
}
