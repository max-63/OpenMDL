use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

mod binary_format;
mod lan_server;
mod mysql_storage;
mod sqlite_storage;

fn get_app_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn get_sqlite(app_handle: &tauri::AppHandle) -> Result<sqlite_storage::SqliteStorage, String> {
    sqlite_storage::SqliteStorage::new(get_app_dir(app_handle))
}

#[derive(serde::Serialize, Clone)]
pub struct BackupEntryDto {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_binary: bool,
    pub modified_secs: u64,
}

#[tauri::command]
fn pack_backup_binary(backup_json: String) -> Result<Vec<u8>, String> {
    binary_format::pack_mdlb(&backup_json)
}

#[tauri::command]
fn unpack_backup_binary(bytes: Vec<u8>) -> Result<String, String> {
    binary_format::unpack_mdlb(&bytes)
}

#[tauri::command]
fn save_backup_binary(
    app_handle: tauri::AppHandle,
    tag: String,
    data: String,
) -> Result<String, String> {
    let app_dir = get_app_dir(&app_handle);
    let backups_dir = app_dir.join("backups");

    if let Err(e) = fs::create_dir_all(&backups_dir) {
        return Err(format!("Impossible de créer le dossier backups: {}", e));
    }

    let mut safe_tag: String = tag
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if safe_tag.is_empty() {
        safe_tag = "export".to_string();
    }

    let timestamp = chrono_free_timestamp();
    let filename = format!("backup_{}_{}.mdlb", safe_tag, timestamp);
    let file_path = backups_dir.join(&filename);

    let binary_bytes = binary_format::pack_mdlb(&data)?;
    if let Err(e) = fs::write(&file_path, binary_bytes) {
        return Err(format!(
            "Erreur lors de l'écriture du backup binaire: {}",
            e
        ));
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_backups(app_handle: tauri::AppHandle) -> Result<Vec<BackupEntryDto>, String> {
    let app_dir = get_app_dir(&app_handle);
    let backups_dir = app_dir.join("backups");
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(backups_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".mdlb") || name.ends_with(".json") {
                    let metadata = entry.metadata().ok();
                    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let is_binary = name.ends_with(".mdlb");
                    list.push(BackupEntryDto {
                        file_name: name,
                        path: path.to_string_lossy().to_string(),
                        size_bytes: size,
                        is_binary,
                        modified_secs: modified,
                    });
                }
            }
        }
    }

    list.sort_by(|a, b| b.modified_secs.cmp(&a.modified_secs));
    Ok(list)
}

#[tauri::command]
fn read_backup_file(file_path: String) -> Result<String, String> {
    let bytes =
        fs::read(&file_path).map_err(|e| format!("Impossible de lire {}: {}", file_path, e))?;
    if bytes.starts_with(b"MDLB") {
        binary_format::unpack_mdlb(&bytes)
    } else {
        String::from_utf8(bytes).map_err(|e| format!("Erreur encodage UTF-8: {}", e))
    }
}

#[tauri::command]
fn write_binary_file(file_path: String, bytes: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, bytes).map_err(|e| {
        format!(
            "Impossible d'ecrire le fichier binaire sur {}: {}",
            file_path, e
        )
    })
}

#[tauri::command]
fn read_binary_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| {
        format!(
            "Impossible de lire le fichier binaire sur {}: {}",
            file_path, e
        )
    })
}

#[tauri::command]
fn save_backup(app_handle: tauri::AppHandle, tag: String, data: String) -> Result<String, String> {
    let app_dir = get_app_dir(&app_handle);
    let backups_dir = app_dir.join("backups");

    if let Err(e) = fs::create_dir_all(&backups_dir) {
        return Err(format!("Impossible de créer le dossier backups: {}", e));
    }

    // Assainissement strict du tag pour neutraliser tout risque de Path Traversal
    let mut safe_tag: String = tag
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if safe_tag.is_empty() {
        safe_tag = "export".to_string();
    }

    let timestamp = chrono_free_timestamp();
    let filename = format!("backup_{}_{}.json", safe_tag, timestamp);
    let file_path = backups_dir.join(&filename);

    if let Err(e) = fs::write(&file_path, data) {
        return Err(format!("Erreur lors de l'écriture du backup: {}", e));
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn append_log(app_handle: tauri::AppHandle, message: String) -> Result<(), String> {
    let app_dir = get_app_dir(&app_handle);
    let logs_dir = app_dir.join("logs");

    if let Err(e) = fs::create_dir_all(&logs_dir) {
        return Err(format!("Impossible de créer le dossier logs: {}", e));
    }

    let date_str = chrono_free_date();
    let log_file = logs_dir.join(format!("openmdl_{}.log", date_str));

    let mut file = match OpenOptions::new().create(true).append(true).open(log_file) {
        Ok(f) => f,
        Err(e) => return Err(format!("Erreur ouverture fichier log: {}", e)),
    };

    let log_entry = format!("[{}] {}\n", chrono_free_timestamp(), message);
    if let Err(e) = file.write_all(log_entry.as_bytes()) {
        return Err(format!("Erreur écriture log: {}", e));
    }

    Ok(())
}

fn chrono_free_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", duration.as_secs())
}

fn chrono_free_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    format!("day_{}", days)
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn start_lan_server(
    app_handle: tauri::AppHandle,
    port: u16,
    pin: Option<String>,
    db_json: String,
) -> Result<lan_server::LanServerInfo, String> {
    lan_server::start_server(app_handle, port, pin, db_json)
}

#[tauri::command]
fn take_lan_incoming_chat_messages() -> Result<Vec<serde_json::Value>, String> {
    Ok(lan_server::take_incoming_chat_messages())
}

#[tauri::command]
fn take_lan_incoming_visas() -> Result<Vec<serde_json::Value>, String> {
    Ok(lan_server::take_incoming_visas())
}

#[tauri::command]
fn stop_lan_server() -> Result<(), String> {
    lan_server::stop_server()
}

#[tauri::command]
fn get_lan_server_info() -> Result<lan_server::LanServerInfo, String> {
    Ok(lan_server::get_server_status())
}

#[tauri::command]
fn update_lan_server_db(db_json: String) -> Result<(), String> {
    lan_server::update_server_db(db_json)
}

#[tauri::command]
fn broadcast_lan_shutdown_alert(message: String) -> Result<(), String> {
    lan_server::broadcast_shutdown_alert(message)
}

#[tauri::command]
fn clear_lan_shutdown_alert() -> Result<(), String> {
    lan_server::clear_shutdown_alert()
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    Ok(lan_server::get_local_ip())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn write_file_to_path(file_path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, content)
        .map_err(|e| format!("Impossible d'ecrire le fichier sur {}: {}", file_path, e))
}

#[tauri::command]
fn read_file_from_path(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Impossible de lire le fichier sur {}: {}", file_path, e))
}

#[tauri::command]
fn sqlite_get_key(app_handle: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let storage = get_sqlite(&app_handle)?;
    storage.get_key(&key)
}

#[tauri::command]
fn sqlite_set_key(app_handle: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let storage = get_sqlite(&app_handle)?;
    storage.set_key(&key, &value)
}

#[tauri::command]
fn sqlite_get_all(app_handle: tauri::AppHandle) -> Result<Vec<(String, String)>, String> {
    let storage = get_sqlite(&app_handle)?;
    storage.get_all_keys()
}

#[tauri::command]
fn sqlite_delete_key(app_handle: tauri::AppHandle, key: String) -> Result<(), String> {
    let storage = get_sqlite(&app_handle)?;
    storage.delete_key(&key)
}

#[tauri::command]
fn sqlite_save_chat_message(
    app_handle: tauri::AppHandle,
    id: String,
    channel_id: String,
    author_id: String,
    author_name: String,
    author_role: String,
    author_avatar_color: Option<String>,
    author_bubble_color: Option<String>,
    content: String,
    timestamp: String,
    signature: String,
) -> Result<(), String> {
    let storage = get_sqlite(&app_handle)?;
    storage.save_chat_message(
        &id,
        &channel_id,
        &author_id,
        &author_name,
        &author_role,
        author_avatar_color.as_deref(),
        author_bubble_color.as_deref(),
        &content,
        &timestamp,
        &signature,
    )
}

#[tauri::command]
fn sqlite_get_chat_messages(
    app_handle: tauri::AppHandle,
    channel_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let storage = get_sqlite(&app_handle)?;
    storage.get_chat_messages(channel_id.as_deref())
}

#[tauri::command]
fn sqlite_reconcile_chat_votes(
    app_handle: tauri::AppHandle,
    candidate_messages: Vec<serde_json::Value>,
) -> Result<usize, String> {
    let storage = get_sqlite(&app_handle)?;
    storage.reconcile_client_votes(&candidate_messages)
}

#[tauri::command]
fn sqlite_pending_sync_count(app_handle: tauri::AppHandle) -> Result<usize, String> {
    let storage = get_sqlite(&app_handle)?;
    storage.count_pending_sync_ops()
}

#[tauri::command]
fn sqlite_clear_pending_sync_ops(app_handle: tauri::AppHandle) -> Result<(), String> {
    let storage = get_sqlite(&app_handle)?;
    storage.clear_pending_sync_ops()
}

#[tauri::command]
async fn mysql_test_connection(
    config: mysql_storage::MysqlConfig,
) -> Result<mysql_storage::MysqlTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || mysql_storage::test_connection(&config))
        .await
        .map_err(|e| format!("Erreur tâche MySQL : {}", e))?
}

fn flush_sqlite_ops_to_mysql(
    storage: &sqlite_storage::SqliteStorage,
    config: &mysql_storage::MysqlConfig,
) -> Result<(usize, usize, Option<String>), String> {
    let pending = storage.get_pending_sync_ops()?;
    if pending.is_empty() {
        return Ok((0, 0, None));
    }
    let total_before = pending.len();
    let (acked, err_opt) = mysql_storage::flush_ops(config, pending)?;
    for seq in &acked {
        let _ = storage.delete_sync_op(*seq);
    }
    let remaining = storage
        .count_pending_sync_ops()
        .unwrap_or_else(|_| total_before.saturating_sub(acked.len()));
    Ok((acked.len(), remaining, err_opt))
}

#[tauri::command]
async fn mysql_execute_op(
    app_handle: tauri::AppHandle,
    config: mysql_storage::MysqlConfig,
    op_type: String,
    payload: String,
) -> Result<mysql_storage::MysqlOpResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = get_sqlite(&app_handle)?;
        let (_flushed, remaining_before, flush_err) = flush_sqlite_ops_to_mysql(&storage, &config)?;

        if remaining_before > 0 {
            storage.enqueue_sync_op(&op_type, &payload)?;
            let count = storage.count_pending_sync_ops().unwrap_or(remaining_before + 1);
            return Ok(mysql_storage::MysqlOpResult {
                synced: false,
                queued: true,
                pending_count: count,
                error: flush_err,
            });
        }

        match mysql_storage::execute_atomic_op(&config, &op_type, &payload) {
            Ok(()) => Ok(mysql_storage::MysqlOpResult {
                synced: true,
                queued: false,
                pending_count: 0,
                error: None,
            }),
            Err(err) => {
                storage.enqueue_sync_op(&op_type, &payload)?;
                let count = storage.count_pending_sync_ops().unwrap_or(1);
                Ok(mysql_storage::MysqlOpResult {
                    synced: false,
                    queued: true,
                    pending_count: count,
                    error: Some(err),
                })
            }
        }
    })
    .await
    .map_err(|e| format!("Erreur tâche MySQL : {}", e))?
}

#[tauri::command]
async fn mysql_flush_pending_ops(
    app_handle: tauri::AppHandle,
    config: mysql_storage::MysqlConfig,
) -> Result<mysql_storage::MysqlFlushResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = get_sqlite(&app_handle)?;
        let (flushed_count, remaining_count, error) = flush_sqlite_ops_to_mysql(&storage, &config)?;
        Ok(mysql_storage::MysqlFlushResult {
            flushed_count,
            remaining_count,
            error,
        })
    })
    .await
    .map_err(|e| format!("Erreur tâche MySQL : {}", e))?
}

#[tauri::command]
async fn mysql_pull_snapshot(
    app_handle: tauri::AppHandle,
    config: mysql_storage::MysqlConfig,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = get_sqlite(&app_handle)?;
        let (_flushed, remaining, flush_err) = flush_sqlite_ops_to_mysql(&storage, &config)?;
        if remaining > 0 {
            return Err(format!(
                "Impossible de synchroniser depuis MySQL : {} opération(s) locale(s) en attente ({}).",
                remaining,
                flush_err.unwrap_or_else(|| "serveur hors-ligne".to_string())
            ));
        }

        let mut snapshot = mysql_storage::pull_snapshot(&config)?;
        if let Some(obj) = snapshot.as_object_mut() {
            obj.insert("pendingCount".to_string(), serde_json::json!(0));
        }
        Ok(snapshot)
    })
    .await
    .map_err(|e| format!("Erreur tâche MySQL : {}", e))?
}

#[tauri::command]
async fn mysql_push_snapshot(
    app_handle: tauri::AppHandle,
    config: mysql_storage::MysqlConfig,
    snapshot: serde_json::Value,
) -> Result<mysql_storage::MysqlMigrateResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = get_sqlite(&app_handle)?;
        let res = mysql_storage::push_snapshot(&config, &snapshot)?;
        let _ = storage.clear_pending_sync_ops();
        Ok(res)
    })
    .await
    .map_err(|e| format!("Erreur tâche MySQL : {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.maximize();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = lan_server::stop_server();
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_backup,
            save_backup_binary,
            list_backups,
            read_backup_file,
            pack_backup_binary,
            unpack_backup_binary,
            write_binary_file,
            read_binary_file,
            append_log,
            exit_app,
            start_lan_server,
            stop_lan_server,
            get_lan_server_info,
            update_lan_server_db,
            take_lan_incoming_chat_messages,
            take_lan_incoming_visas,
            get_local_ip,
            broadcast_lan_shutdown_alert,
            clear_lan_shutdown_alert,
            write_file_to_path,
            read_file_from_path,
            sqlite_get_key,
            sqlite_set_key,
            sqlite_get_all,
            sqlite_delete_key,
            sqlite_save_chat_message,
            sqlite_get_chat_messages,
            sqlite_reconcile_chat_votes,
            sqlite_pending_sync_count,
            sqlite_clear_pending_sync_ops,
            mysql_test_connection,
            mysql_execute_op,
            mysql_flush_pending_ops,
            mysql_pull_snapshot,
            mysql_push_snapshot,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
