use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

mod lan_server;

fn get_app_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
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

#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct AddonFileDto {
    pub path: String,
    pub content: String,
}

#[tauri::command]
fn open_in_external_editor(
    app_handle: tauri::AppHandle,
    addon_id: String,
    files: Vec<AddonFileDto>,
) -> Result<String, String> {
    let app_dir = get_app_dir(&app_handle);
    let safe_id: String = addon_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    let safe_id = if safe_id.is_empty() {
        "addon".to_string()
    } else {
        safe_id
    };

    let addon_dir = app_dir.join("addons_dev").join(&safe_id);
    if let Err(e) = fs::create_dir_all(&addon_dir) {
        return Err(format!("Impossible de créer le dossier de développement: {}", e));
    }

    for file in files {
        let clean_rel = file.path.trim_start_matches('/');
        let target_file_path = addon_dir.join(clean_rel);
        if let Some(parent) = target_file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(target_file_path, file.content);
    }

    // Assurer la présence de tsconfig.json et openmdl.d.ts pour zéro erreur dans VS Code
    let tsconfig_path = addon_dir.join("tsconfig.json");
    if !tsconfig_path.exists() {
        let tsconfig_content = r#"{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*", "openmdl.d.ts"]
}
"#;
        let _ = fs::write(tsconfig_path, tsconfig_content);
    }

    let dts_path = addon_dir.join("openmdl.d.ts");
    if !dts_path.exists() {
        let dts_content = include_str!("../../docs/api/openmdl.d.ts");
        let _ = fs::write(dts_path, dts_content);
    }

    let target_str = addon_dir.to_string_lossy().to_string();
    let editors = ["code", "lapce", "zed", "codium", "cursor"];
    let mut launched_editor = None;

    for ed in editors {
        if std::process::Command::new(ed).arg(&target_str).spawn().is_ok() {
            launched_editor = Some(ed.to_string());
            break;
        }
    }

    if launched_editor.is_none() {
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("xdg-open").arg(&target_str).spawn();
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("open").arg(&target_str).spawn();
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("explorer").arg(&target_str).spawn();
    }

    Ok(format!(
        "Dossier ouvert dans {} ({})",
        launched_editor.unwrap_or_else(|| "gestionnaire de fichiers".to_string()),
        target_str
    ))
}

#[tauri::command]
fn read_addon_files_from_disk(
    app_handle: tauri::AppHandle,
    addon_id: String,
) -> Result<Vec<AddonFileDto>, String> {
    let app_dir = get_app_dir(&app_handle);
    let safe_id: String = addon_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    let safe_id = if safe_id.is_empty() {
        "addon".to_string()
    } else {
        safe_id
    };

    let addon_dir = app_dir.join("addons_dev").join(&safe_id);
    if !addon_dir.exists() {
        return Err("Dossier de développement introuvable sur le disque".to_string());
    }

    let mut result = Vec::new();
    read_dir_recursive(&addon_dir, &addon_dir, &mut result)?;
    Ok(result)
}

fn read_dir_recursive(
    base_dir: &PathBuf,
    current_dir: &PathBuf,
    acc: &mut Vec<AddonFileDto>,
) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(current_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                read_dir_recursive(base_dir, &path, acc)?;
            } else if path.is_file() {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(rel) = path.strip_prefix(base_dir) {
                        let rel_str = format!("/{}", rel.to_string_lossy().replace('\\', "/"));
                        acc.push(AddonFileDto {
                            path: rel_str,
                            content,
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn start_lan_server(port: u16, pin: Option<String>, db_json: String) -> Result<lan_server::LanServerInfo, String> {
    lan_server::start_server(port, pin, db_json)
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
fn get_local_ip() -> Result<String, String> {
    Ok(lan_server::get_local_ip())
}

#[tauri::command]
fn write_file_to_path(file_path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, content).map_err(|e| format!("Impossible d'ecrire le fichier sur {}: {}", file_path, e))
}

#[tauri::command]
fn read_file_from_path(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Impossible de lire le fichier sur {}: {}", file_path, e))
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
            append_log,
            exit_app,
            open_in_external_editor,
            read_addon_files_from_disk,
            start_lan_server,
            stop_lan_server,
            get_lan_server_info,
            update_lan_server_db,
            get_local_ip,
            write_file_to_path,
            read_file_from_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
