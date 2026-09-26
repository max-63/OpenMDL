use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Method, Response, Server};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LanServerInfo {
    pub running: bool,
    pub port: u16,
    pub ip: String,
    pub has_pin: bool,
    pub client_count: u32,
    pub db_hash: String,
    pub shutdown_alert: bool,
}

struct ServerControl {
    running: Arc<AtomicBool>,
    port: u16,
    ip: String,
    pin: Option<String>,
    db_json: Arc<Mutex<String>>,
    db_hash: Arc<Mutex<String>>,
    db_version: Arc<Mutex<u64>>,
    db_timestamp: Arc<Mutex<u64>>,
    client_count: Arc<Mutex<u32>>,
    shutdown_alert: Arc<AtomicBool>,
    shutdown_message: Arc<Mutex<String>>,
}

static SERVER_CONTROL: Mutex<Option<ServerControl>> = Mutex::new(None);

pub fn compute_hash(data: &str) -> String {
    let crc = crc32fast::hash(data.as_bytes());
    format!("{:08x}", crc)
}

pub fn get_local_ip() -> String {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip != "0.0.0.0" {
                    return ip;
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

pub fn start_server(port: u16, pin: Option<String>, initial_db: String) -> Result<LanServerInfo, String> {
    let mut lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;

    // Si déjà actif, arrêter le précédent
    if let Some(ref ctrl) = *lock {
        ctrl.running.store(false, Ordering::SeqCst);
    }

    let bind_addr = format!("0.0.0.0:{}", port);
    let server = Server::http(&bind_addr).map_err(|e| format!("Erreur démarrage serveur sur {}: {}", bind_addr, e))?;

    let initial_hash = compute_hash(&initial_db);
    let current_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let running = Arc::new(AtomicBool::new(true));
    let db_json = Arc::new(Mutex::new(initial_db));
    let db_hash = Arc::new(Mutex::new(initial_hash.clone()));
    let db_version = Arc::new(Mutex::new(1u64));
    let db_timestamp = Arc::new(Mutex::new(current_ts));
    let client_count: Arc<Mutex<u32>> = Arc::new(Mutex::new(0u32));
    let shutdown_alert = Arc::new(AtomicBool::new(false));
    let shutdown_message = Arc::new(Mutex::new(String::new()));
    let ip = get_local_ip();

    let server_running = running.clone();
    let server_db = db_json.clone();
    let server_hash = db_hash.clone();
    let server_version = db_version.clone();
    let server_timestamp = db_timestamp.clone();
    let server_pin = pin.clone();
    let server_client_count = client_count.clone();
    let server_shutdown_alert = shutdown_alert.clone();
    let server_shutdown_message = shutdown_message.clone();

    // Démarrage de la boucle d'écoute dans un thread d'arrière-plan
    thread::spawn(move || {
        while server_running.load(Ordering::SeqCst) {
            match server.recv_timeout(Duration::from_millis(400)) {
                Ok(Some(mut request)) => {
                    let method = request.method().clone();
                    let url = request.url().to_string();

                    // En-têtes CORS universels
                    let cors_origin = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap();
                    let cors_methods = Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap();
                    let cors_headers = Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, X-Pin, Authorization, X-DB-Hash"[..]).unwrap();

                    if method == Method::Options {
                        let mut resp = Response::empty(204);
                        resp.add_header(cors_origin);
                        resp.add_header(cors_methods);
                        resp.add_header(cors_headers);
                        let _ = request.respond(resp);
                        continue;
                    }

                    // Vérification du code PIN si configuré (sauf pour /api/ping)
                    if let Some(ref expected_pin) = server_pin {
                        let header_pin = request
                            .headers()
                            .iter()
                            .find(|h| h.field.equiv("X-Pin"))
                            .map(|h| h.value.as_str().to_string());

                        let query_pin = if url.contains("pin=") {
                            url.split("pin=").nth(1).and_then(|s| s.split('&').next()).map(|s| s.to_string())
                        } else {
                            None
                        };

                        let provided = header_pin.or(query_pin);
                        if provided.as_deref() != Some(expected_pin.as_str()) && !url.starts_with("/api/ping") {
                            let json_err = r#"{"error": "Code PIN invalide ou manquant"}"#;
                            let mut resp = Response::from_string(json_err).with_status_code(401);
                            resp.add_header(cors_origin);
                            resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                            let _ = request.respond(resp);
                            continue;
                        }
                    }

                    if url.starts_with("/api/ping") {
                        let is_alert = server_shutdown_alert.load(Ordering::SeqCst);
                        let alert_msg = server_shutdown_message.lock().map(|m| m.clone()).unwrap_or_default();
                        let current_hash = server_hash.lock().map(|h| h.clone()).unwrap_or_default();
                        let current_ver = server_version.lock().map(|v| *v).unwrap_or(0);
                        let current_ts = server_timestamp.lock().map(|t| *t).unwrap_or(0);

                        let json = format!(
                            r#"{{"status": "ok", "app": "OpenMDL", "role": "server", "version": "1.0.7", "db_hash": "{}", "db_version": {}, "db_timestamp": {}, "shutdown_alert": {}, "shutdown_message": "{}"}}"#,
                            current_hash, current_ver, current_ts, is_alert, alert_msg.replace('"', "\\\"")
                        );

                        let mut resp = Response::from_string(json);
                        resp.add_header(cors_origin);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        resp.add_header(Header::from_bytes(&b"X-DB-Hash"[..], current_hash.as_bytes()).unwrap());
                        let _ = request.respond(resp);
                    } else if url.starts_with("/api/shutdown_alert") && method == Method::Post {
                        let mut body_buf = String::new();
                        let _ = std::io::Read::read_to_string(&mut request.as_reader(), &mut body_buf);
                        let msg = if !body_buf.trim().is_empty() {
                            body_buf
                        } else {
                            "La permanence du foyer se termine. Le poste va devenir inaccessible.".to_string()
                        };

                        server_shutdown_alert.store(true, Ordering::SeqCst);
                        if let Ok(mut guard) = server_shutdown_message.lock() {
                            *guard = msg;
                        }

                        let ok_json = r#"{"success": true, "message": "Alerte de fermeture envoyee aux clients"}"#;
                        let mut resp = Response::from_string(ok_json);
                        resp.add_header(cors_origin);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        let _ = request.respond(resp);
                    } else if url.starts_with("/api/db") && method == Method::Get {
                        if let Ok(mut count) = server_client_count.lock() {
                            *count += 1;
                        }
                        let current_db = match server_db.lock() {
                            Ok(guard) => guard.clone(),
                            Err(_) => "{}".to_string(),
                        };
                        let current_hash = match server_hash.lock() {
                            Ok(guard) => guard.clone(),
                            Err(_) => compute_hash(&current_db),
                        };

                        let mut resp = Response::from_string(current_db);
                        resp.add_header(cors_origin);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        resp.add_header(Header::from_bytes(&b"X-DB-Hash"[..], current_hash.as_bytes()).unwrap());
                        let _ = request.respond(resp);
                    } else if url.starts_with("/api/db") && method == Method::Post {
                        let mut body_buf = String::new();
                        let _ = std::io::Read::read_to_string(&mut request.as_reader(), &mut body_buf);

                        if !body_buf.trim().is_empty() {
                            let new_hash = compute_hash(&body_buf);
                            if let Ok(mut guard) = server_db.lock() {
                                *guard = body_buf;
                            }
                            if let Ok(mut guard) = server_hash.lock() {
                                *guard = new_hash;
                            }
                            if let Ok(mut guard) = server_version.lock() {
                                *guard += 1;
                            }
                            if let Ok(mut guard) = server_timestamp.lock() {
                                *guard = SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64;
                            }
                        }

                        let ok_json = r#"{"success": true, "message": "Base de donnees mise a jour avec succes"}"#;
                        let mut resp = Response::from_string(ok_json);
                        resp.add_header(cors_origin);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        let _ = request.respond(resp);
                    } else {
                        let not_found = r#"{"error": "Route inconnue"}"#;
                        let mut resp = Response::from_string(not_found).with_status_code(404);
                        resp.add_header(cors_origin);
                        let _ = request.respond(resp);
                    }
                }
                Ok(None) => {}
                Err(_) => {}
            }
        }
    });

    let has_pin = pin.is_some() && !pin.as_ref().unwrap().is_empty();
    let info = LanServerInfo {
        running: true,
        port,
        ip: ip.clone(),
        has_pin,
        client_count: 0,
        db_hash: initial_hash.clone(),
        shutdown_alert: false,
    };

    *lock = Some(ServerControl {
        running,
        port,
        ip,
        pin,
        db_json,
        db_hash,
        db_version,
        db_timestamp,
        client_count,
        shutdown_alert,
        shutdown_message,
    });

    Ok(info)
}

pub fn stop_server() -> Result<(), String> {
    let mut lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;
    if let Some(ref ctrl) = *lock {
        ctrl.running.store(false, Ordering::SeqCst);
    }
    *lock = None;
    Ok(())
}

pub fn broadcast_shutdown_alert(message: String) -> Result<(), String> {
    let lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;
    if let Some(ref ctrl) = *lock {
        ctrl.shutdown_alert.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = ctrl.shutdown_message.lock() {
            *guard = message;
        }
    }
    Ok(())
}

pub fn clear_shutdown_alert() -> Result<(), String> {
    let lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;
    if let Some(ref ctrl) = *lock {
        ctrl.shutdown_alert.store(false, Ordering::SeqCst);
        if let Ok(mut guard) = ctrl.shutdown_message.lock() {
            *guard = String::new();
        }
    }
    Ok(())
}

pub fn update_server_db(new_db: String) -> Result<(), String> {
    let lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;
    if let Some(ref ctrl) = *lock {
        let new_hash = compute_hash(&new_db);
        if let Ok(mut guard) = ctrl.db_json.lock() {
            *guard = new_db;
        }
        if let Ok(mut guard) = ctrl.db_hash.lock() {
            *guard = new_hash;
        }
        if let Ok(mut guard) = ctrl.db_version.lock() {
            *guard += 1;
        }
        if let Ok(mut guard) = ctrl.db_timestamp.lock() {
            *guard = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
        }
    }
    Ok(())
}

pub fn get_server_status() -> LanServerInfo {
    let lock = SERVER_CONTROL.lock();
    if let Ok(ref guard) = lock {
        if let Some(ref ctrl) = **guard {
            let is_running = ctrl.running.load(Ordering::SeqCst);
            let count = ctrl.client_count.lock().map(|c| *c).unwrap_or(0);
            let current_hash = ctrl.db_hash.lock().map(|h| h.clone()).unwrap_or_default();
            let alert = ctrl.shutdown_alert.load(Ordering::SeqCst);

            return LanServerInfo {
                running: is_running,
                port: ctrl.port,
                ip: ctrl.ip.clone(),
                has_pin: ctrl.pin.is_some() && !ctrl.pin.as_ref().unwrap().is_empty(),
                client_count: count,
                db_hash: current_hash,
                shutdown_alert: alert,
            };
        }
    }

    LanServerInfo {
        running: false,
        port: 4123,
        ip: get_local_ip(),
        has_pin: false,
        client_count: 0,
        db_hash: String::new(),
        shutdown_alert: false,
    }
}
