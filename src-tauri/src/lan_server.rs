use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tiny_http::{Header, Method, Response, Server};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LanServerInfo {
    pub running: bool,
    pub port: u16,
    pub ip: String,
    pub has_pin: bool,
    pub client_count: u32,
}

struct ServerControl {
    running: Arc<AtomicBool>,
    port: u16,
    ip: String,
    pin: Option<String>,
    db_json: Arc<Mutex<String>>,
    client_count: Arc<Mutex<u32>>,
}

static SERVER_CONTROL: Mutex<Option<ServerControl>> = Mutex::new(None);

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

    let running = Arc::new(AtomicBool::new(true));
    let db_json = Arc::new(Mutex::new(initial_db));
    let client_count: Arc<Mutex<u32>> = Arc::new(Mutex::new(0u32));
    let ip = get_local_ip();

    let server_running = running.clone();
    let server_db = db_json.clone();
    let server_pin = pin.clone();
    let server_client_count = client_count.clone();

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
                    let cors_headers = Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, X-Pin, Authorization"[..]).unwrap();

                    if method == Method::Options {
                        let mut resp = Response::empty(204);
                        resp.add_header(cors_origin);
                        resp.add_header(cors_methods);
                        resp.add_header(cors_headers);
                        let _ = request.respond(resp);
                        continue;
                    }

                    // Vérification du code PIN si configuré
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
                        let json = r#"{"status": "ok", "app": "OpenMDL", "role": "server", "version": "1.0.5"}"#;
                        let mut resp = Response::from_string(json);
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
                        let mut resp = Response::from_string(current_db);
                        resp.add_header(cors_origin);
                        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        let _ = request.respond(resp);
                    } else if url.starts_with("/api/db") && method == Method::Post {
                        let mut body_buf = String::new();
                        let _ = std::io::Read::read_to_string(&mut request.as_reader(), &mut body_buf);

                        if !body_buf.trim().is_empty() {
                            if let Ok(mut guard) = server_db.lock() {
                                *guard = body_buf;
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
    };

    *lock = Some(ServerControl {
        running,
        port,
        ip,
        pin,
        db_json,
        client_count,
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

pub fn update_server_db(new_db: String) -> Result<(), String> {
    let lock = SERVER_CONTROL.lock().map_err(|e| e.to_string())?;
    if let Some(ref ctrl) = *lock {
        if let Ok(mut guard) = ctrl.db_json.lock() {
            *guard = new_db;
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
            return LanServerInfo {
                running: is_running,
                port: ctrl.port,
                ip: ctrl.ip.clone(),
                has_pin: ctrl.pin.is_some() && !ctrl.pin.as_ref().unwrap().is_empty(),
                client_count: count,
            };
        }
    }

    LanServerInfo {
        running: false,
        port: 4123,
        ip: get_local_ip(),
        has_pin: false,
        client_count: 0,
    }
}
