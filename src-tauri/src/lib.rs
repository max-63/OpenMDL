use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

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

    let timestamp = chrono_free_timestamp();
    let filename = format!("backup_{}_{}.json", tag, timestamp);
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
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", duration.as_secs())
}

fn chrono_free_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let days = secs / 86400;
    format!("day_{}", days)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_backup, append_log])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
