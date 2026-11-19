use mysql::prelude::Queryable;
use mysql::{Opts, OptsBuilder, Params, Pool, PooledConn, SslOpts, TxOpts, Value};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MysqlConfig {
    pub url: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub dialect: Option<String>,
    pub ssl: Option<bool>,
    pub accept_invalid_certs: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MysqlTestResult {
    pub success: bool,
    pub server_version: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MysqlOpResult {
    pub synced: bool,
    pub queued: bool,
    pub pending_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MysqlFlushResult {
    pub flushed_count: usize,
    pub remaining_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MysqlMigrateResult {
    pub success: bool,
    pub counts: JsonValue,
    pub message: String,
}

static MYSQL_POOL: Mutex<Option<(String, Pool)>> = Mutex::new(None);
static INITIALIZED_SCHEMAS: Mutex<Option<HashSet<String>>> = Mutex::new(None);

fn opt_str_val(v: Option<&str>) -> Value {
    match v {
        Some(s) => Value::from(s),
        None => Value::NULL,
    }
}

fn opt_f64_val(v: Option<f64>) -> Value {
    match v {
        Some(n) => Value::from(n),
        None => Value::NULL,
    }
}

fn opt_json_str(v: Option<&JsonValue>) -> Value {
    match v {
        Some(val) if !val.is_null() => Value::from(val.to_string()),
        _ => Value::NULL,
    }
}

fn build_opts(cfg: &MysqlConfig) -> Result<(String, OptsBuilder), String> {
    let mut use_ssl = cfg.ssl.unwrap_or(false);
    let mut accept_invalid = cfg.accept_invalid_certs.unwrap_or(false);
    let raw_url = cfg.url.as_deref().unwrap_or("").trim();

    let builder = if !raw_url.is_empty() {
        let normalized = if let Some(rest) = raw_url.strip_prefix("mariadb://") {
            format!("mysql://{}", rest)
        } else if raw_url.starts_with("mysql://") {
            raw_url.to_string()
        } else {
            format!("mysql://{}", raw_url)
        };

        let (base_url, query_part) = match normalized.split_once('?') {
            Some((base, q)) => (base.to_string(), Some(q)),
            None => (normalized.clone(), None),
        };

        if let Some(q) = query_part {
            let lower = q.to_lowercase();
            if lower.contains("ssl=true")
                || lower.contains("ssl=1")
                || lower.contains("sslmode=require")
                || lower.contains("ssl-mode=required")
            {
                use_ssl = true;
            }
            if lower.contains("danger_accept_invalid_certs=true")
                || lower.contains("danger_accept_invalid_certs=1")
                || lower.contains("acceptinvalidcerts=true")
            {
                accept_invalid = true;
            }
        }

        let opts = Opts::from_url(&base_url)
            .map_err(|e| format!("URL MySQL/MariaDB invalide : {}", e))?;
        OptsBuilder::from_opts(opts)
    } else {
        let host = cfg.host.as_deref().unwrap_or("127.0.0.1").trim();
        let port = cfg.port.unwrap_or(3306);
        let db_name = cfg.database.as_deref().unwrap_or("openmdl").trim();
        let user = cfg.username.as_deref().unwrap_or("root").trim();
        let pass = cfg.password.as_deref().unwrap_or("");

        if host.is_empty() || db_name.is_empty() || user.is_empty() {
            return Err(
                "Hôte, nom de base et utilisateur MySQL/MariaDB requis.".to_string(),
            );
        }

        OptsBuilder::new()
            .ip_or_hostname(Some(host))
            .tcp_port(port)
            .db_name(Some(db_name))
            .user(Some(user))
            .pass(Some(pass))
    };

    let mut builder = builder
        .tcp_connect_timeout(Some(Duration::from_secs(5)))
        .read_timeout(Some(Duration::from_secs(10)))
        .write_timeout(Some(Duration::from_secs(10)));

    if use_ssl {
        let ssl_opts = SslOpts::default().with_danger_accept_invalid_certs(accept_invalid);
        builder = builder.ssl_opts(Some(ssl_opts));
    }

    let key = format!(
        "{}|{}|{}|{}|{}|{}|{}|{}",
        raw_url,
        cfg.host.as_deref().unwrap_or(""),
        cfg.port.unwrap_or(3306),
        cfg.database.as_deref().unwrap_or(""),
        cfg.username.as_deref().unwrap_or(""),
        cfg.password.as_deref().unwrap_or(""),
        use_ssl,
        accept_invalid
    );

    Ok((key, builder))
}

fn get_conn(cfg: &MysqlConfig, ensure_schema: bool) -> Result<PooledConn, String> {
    let (key, opts_builder) = build_opts(cfg)?;

    let pool = {
        let mut lock = MYSQL_POOL.lock().map_err(|e| e.to_string())?;
        let need_new = match &*lock {
            Some((existing_key, _)) => existing_key != &key,
            None => true,
        };
        if need_new {
            let new_pool =
                Pool::new(opts_builder).map_err(|e| format!("Erreur pool MySQL : {}", e))?;
            *lock = Some((key.clone(), new_pool.clone()));
            if let Ok(mut init_lock) = INITIALIZED_SCHEMAS.lock() {
                if let Some(set) = init_lock.as_mut() {
                    set.remove(&key);
                }
            }
            new_pool
        } else {
            lock.as_ref().unwrap().1.clone()
        }
    };

    let mut conn = pool
        .get_conn()
        .map_err(|e| format!("Connexion MySQL/MariaDB impossible : {}", e))?;

    let needs_init = if ensure_schema {
        true
    } else {
        let lock = INITIALIZED_SCHEMAS.lock().map_err(|e| e.to_string())?;
        !lock
            .as_ref()
            .map(|s| s.contains(&key))
            .unwrap_or(false)
    };

    if needs_init {
        init_schema(&mut conn)?;
        if let Ok(mut lock) = INITIALIZED_SCHEMAS.lock() {
            let set = lock.get_or_insert_with(HashSet::new);
            set.insert(key);
        }
    }

    Ok(conn)
}

fn ensure_column(
    conn: &mut PooledConn,
    table: &str,
    column: &str,
    col_def: &str,
) -> Result<(), String> {
    let exists: Option<i64> = conn
        .exec_first(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            Params::Positional(vec![Value::from(table), Value::from(column)]),
        )
        .map_err(|e| format!("Erreur inspection colonne {}.{} MySQL : {}", table, column, e))?;

    if exists.unwrap_or(0) == 0 {
        let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, col_def);
        conn.query_drop(sql)
            .map_err(|e| format!("Erreur ajout colonne {}.{} MySQL : {}", table, column, e))?;
    }
    Ok(())
}

pub fn init_schema(conn: &mut PooledConn) -> Result<(), String> {
    let statements = [
        r#"CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(64) NOT NULL,
            price DOUBLE NOT NULL DEFAULT 0,
            cost_price DOUBLE NOT NULL DEFAULT 0,
            stock INT NOT NULL DEFAULT 0,
            min_stock_alert INT NOT NULL DEFAULT 0,
            image_url MEDIUMTEXT NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            is_favorite TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS sales (
            id VARCHAR(128) PRIMARY KEY,
            timestamp VARCHAR(64) NOT NULL,
            items_json LONGTEXT NOT NULL,
            total_amount DOUBLE NOT NULL DEFAULT 0,
            payment_method VARCHAR(32) NOT NULL,
            cash_received DOUBLE NULL,
            cash_returned DOUBLE NULL,
            cash_breakdown_json TEXT NULL,
            volunteer_id VARCHAR(128) NOT NULL,
            volunteer_name VARCHAR(255) NOT NULL,
            session_id VARCHAR(128) NOT NULL,
            is_cancelled TINYINT(1) NOT NULL DEFAULT 0,
            cancelled_at VARCHAR(64) NULL,
            INDEX idx_sales_ts (timestamp),
            INDEX idx_sales_session (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(128) PRIMARY KEY,
            start_time VARCHAR(64) NOT NULL,
            end_time VARCHAR(64) NULL,
            volunteer_id VARCHAR(128) NOT NULL,
            volunteer_name VARCHAR(255) NOT NULL,
            total_sales DOUBLE NOT NULL DEFAULT 0,
            total_cash DOUBLE NOT NULL DEFAULT 0,
            total_tpe DOUBLE NOT NULL DEFAULT 0,
            sales_count INT NOT NULL DEFAULT 0,
            incident_notes TEXT NULL,
            draft_notes TEXT NULL,
            draft_perk_product_id VARCHAR(128) NULL,
            draft_cash_counts_json TEXT NULL,
            cash_withdrawal_json LONGTEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            INDEX idx_sessions_start (start_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS volunteers (
            id VARCHAR(128) PRIMARY KEY,
            username VARCHAR(128) NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(128) NOT NULL,
            avatar_color VARCHAR(32) NOT NULL,
            avatar_url MEDIUMTEXT NULL,
            theme_settings_json TEXT NULL,
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            is_suspended TINYINT(1) NOT NULL DEFAULT 0,
            created_at VARCHAR(64) NULL,
            pin_code VARCHAR(64) NULL,
            public_key TEXT NULL,
            permissions_json TEXT NULL,
            perk_policy_json TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS restocks (
            id VARCHAR(128) PRIMARY KEY,
            product_id VARCHAR(128) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            quantity_added INT NOT NULL,
            previous_stock INT NOT NULL,
            new_stock INT NOT NULL,
            new_price DOUBLE NULL,
            cost_price DOUBLE NULL,
            timestamp VARCHAR(64) NOT NULL,
            volunteer_name VARCHAR(255) NOT NULL,
            INDEX idx_restocks_ts (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS volunteer_perks (
            id VARCHAR(128) PRIMARY KEY,
            volunteer_id VARCHAR(128) NOT NULL,
            volunteer_name VARCHAR(255) NOT NULL,
            product_id VARCHAR(128) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            cost_price DOUBLE NOT NULL DEFAULT 0,
            selling_price DOUBLE NOT NULL DEFAULT 0,
            perk_date VARCHAR(32) NOT NULL,
            timestamp VARCHAR(64) NOT NULL,
            session_id VARCHAR(128) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS activity_logs (
            id VARCHAR(128) PRIMARY KEY,
            timestamp VARCHAR(64) NOT NULL,
            log_type VARCHAR(32) NOT NULL,
            message TEXT NOT NULL,
            author VARCHAR(255) NOT NULL,
            INDEX idx_logs_ts (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS tpe_logs (
            id VARCHAR(128) PRIMARY KEY,
            timestamp VARCHAR(64) NOT NULL,
            amount DOUBLE NOT NULL,
            currency VARCHAR(16) NOT NULL,
            status VARCHAR(32) NOT NULL,
            reader_name VARCHAR(255) NOT NULL,
            card_brand VARCHAR(64) NULL,
            last4 VARCHAR(16) NULL,
            transaction_code VARCHAR(128) NOT NULL,
            volunteer_name VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS pacman_scores (
            id VARCHAR(128) PRIMARY KEY,
            volunteer_id VARCHAR(128) NULL,
            player_name VARCHAR(255) NOT NULL,
            score INT NOT NULL,
            timestamp VARCHAR(64) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS chat_channels (
            id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT NULL,
            is_private TINYINT(1) NOT NULL DEFAULT 0,
            member_ids_json TEXT NULL,
            is_direct_message TINYINT(1) NOT NULL DEFAULT 0,
            dm_target_volunteer_id VARCHAR(128) NULL,
            created_at VARCHAR(64) NOT NULL,
            created_by VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(128) PRIMARY KEY,
            channel_id VARCHAR(128) NOT NULL,
            author_id VARCHAR(128) NOT NULL,
            author_name VARCHAR(255) NOT NULL,
            author_role VARCHAR(128) NOT NULL,
            author_avatar_color VARCHAR(32) NULL,
            author_bubble_color VARCHAR(32) NULL,
            content TEXT NOT NULL,
            timestamp VARCHAR(64) NOT NULL,
            signature VARCHAR(128) NULL,
            is_system TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_chat_chan_ts (channel_id, timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
        r#"CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(128) PRIMARY KEY,
            value_json LONGTEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"#,
    ];

    for sql in statements {
        conn.query_drop(sql)
            .map_err(|e| format!("Erreur initialisation schéma MySQL : {}", e))?;
    }

    ensure_column(conn, "volunteers", "permissions_json", "TEXT NULL")?;
    ensure_column(conn, "volunteers", "perk_policy_json", "TEXT NULL")?;
    ensure_column(conn, "volunteer_perks", "session_id", "VARCHAR(128) NULL")?;

    Ok(())
}

pub fn test_connection(cfg: &MysqlConfig) -> Result<MysqlTestResult, String> {
    let mut conn = get_conn(cfg, true)?;
    let version: Option<String> = conn
        .query_first("SELECT VERSION()")
        .map_err(|e| format!("Erreur lecture version MySQL/MariaDB : {}", e))?;
    let ver = version.unwrap_or_else(|| "Inconnue".to_string());
    Ok(MysqlTestResult {
        success: true,
        server_version: ver.clone(),
        message: format!("Connexion réussie (Serveur {}, schéma prêt).", ver),
    })
}

fn upsert_product_tx(tx: &mut mysql::Transaction, p: &JsonValue) -> Result<(), String> {
    let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(());
    }
    let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let category = p.get("category").and_then(|v| v.as_str()).unwrap_or("autre");
    let price = p.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let cost_price = p.get("costPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let stock = p.get("stock").and_then(|v| v.as_i64()).unwrap_or(0);
    let min_stock_alert = p.get("minStockAlert").and_then(|v| v.as_i64()).unwrap_or(0);
    let image_url = p.get("imageUrl").and_then(|v| v.as_str()).unwrap_or("");
    let is_active = if p.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true) { 1 } else { 0 };
    let is_favorite = if p.get("isFavorite").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };

    tx.exec_drop(
        r#"INSERT INTO products (id, name, category, price, cost_price, stock, min_stock_alert, image_url, is_active, is_favorite)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             category = VALUES(category),
             price = VALUES(price),
             cost_price = VALUES(cost_price),
             stock = VALUES(stock),
             min_stock_alert = VALUES(min_stock_alert),
             image_url = VALUES(image_url),
             is_active = VALUES(is_active),
             is_favorite = VALUES(is_favorite)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(name),
            Value::from(category),
            Value::from(price),
            Value::from(cost_price),
            Value::from(stock),
            Value::from(min_stock_alert),
            Value::from(image_url),
            Value::from(is_active),
            Value::from(is_favorite),
        ]),
    )
    .map_err(|e| format!("Erreur upsert product MySQL : {}", e))?;

    Ok(())
}

fn upsert_session_tx(tx: &mut mysql::Transaction, s: &JsonValue) -> Result<(), String> {
    let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(());
    }
    let start_time = s.get("startTime").and_then(|v| v.as_str()).unwrap_or("");
    let end_time = s.get("endTime").and_then(|v| v.as_str());
    let volunteer_id = s.get("volunteerId").and_then(|v| v.as_str()).unwrap_or("");
    let volunteer_name = s.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("");
    let total_sales = s.get("totalSales").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let total_cash = s.get("totalCash").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let total_tpe = s.get("totalTpe").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let sales_count = s.get("salesCount").and_then(|v| v.as_i64()).unwrap_or(0);
    let incident_notes = s.get("incidentNotes").and_then(|v| v.as_str());
    let draft_notes = s.get("draftNotes").and_then(|v| v.as_str());
    let draft_perk_product_id = s.get("draftPerkProductId").and_then(|v| v.as_str());
    let draft_cash_counts = opt_json_str(s.get("draftCashCounts"));
    let cash_withdrawal = opt_json_str(s.get("cashWithdrawal"));
    let status = s.get("status").and_then(|v| v.as_str()).unwrap_or("active");

    tx.exec_drop(
        r#"INSERT INTO sessions (
             id, start_time, end_time, volunteer_id, volunteer_name,
             total_sales, total_cash, total_tpe, sales_count,
             incident_notes, draft_notes, draft_perk_product_id,
             draft_cash_counts_json, cash_withdrawal_json, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             start_time = VALUES(start_time),
             end_time = VALUES(end_time),
             volunteer_id = VALUES(volunteer_id),
             volunteer_name = VALUES(volunteer_name),
             total_sales = VALUES(total_sales),
             total_cash = VALUES(total_cash),
             total_tpe = VALUES(total_tpe),
             sales_count = VALUES(sales_count),
             incident_notes = VALUES(incident_notes),
             draft_notes = VALUES(draft_notes),
             draft_perk_product_id = VALUES(draft_perk_product_id),
             draft_cash_counts_json = VALUES(draft_cash_counts_json),
             cash_withdrawal_json = VALUES(cash_withdrawal_json),
             status = VALUES(status)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(start_time),
            opt_str_val(end_time),
            Value::from(volunteer_id),
            Value::from(volunteer_name),
            Value::from(total_sales),
            Value::from(total_cash),
            Value::from(total_tpe),
            Value::from(sales_count),
            opt_str_val(incident_notes),
            opt_str_val(draft_notes),
            opt_str_val(draft_perk_product_id),
            draft_cash_counts,
            cash_withdrawal,
            Value::from(status),
        ]),
    )
    .map_err(|e| format!("Erreur upsert session MySQL : {}", e))?;

    Ok(())
}

fn upsert_volunteer_tx(tx: &mut mysql::Transaction, v: &JsonValue) -> Result<(), String> {
    let id = v.get("id").and_then(|val| val.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(());
    }
    let username = v.get("username").and_then(|val| val.as_str()).unwrap_or("");
    let password = v.get("password").and_then(|val| val.as_str()).unwrap_or("");
    let name = v.get("name").and_then(|val| val.as_str()).unwrap_or("");
    let role = v.get("role").and_then(|val| val.as_str()).unwrap_or("Bénévole");
    let avatar_color = v.get("avatarColor").and_then(|val| val.as_str()).unwrap_or("#ea580c");
    let avatar_url = v.get("avatarUrl").and_then(|val| val.as_str());
    let theme_settings = opt_json_str(v.get("themeSettings"));
    let is_admin = if v.get("isAdmin").and_then(|val| val.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let is_suspended = if v.get("isSuspended").and_then(|val| val.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let created_at = v.get("createdAt").and_then(|val| val.as_str());
    let pin_code = v.get("pinCode").and_then(|val| val.as_str());
    let public_key = v.get("publicKey").and_then(|val| val.as_str());
    let permissions_json = opt_json_str(v.get("permissions"));
    let perk_policy_json = opt_json_str(v.get("perkPolicy"));

    tx.exec_drop(
        r#"INSERT INTO volunteers (
             id, username, password, name, role, avatar_color, avatar_url,
             theme_settings_json, is_admin, is_suspended, created_at, pin_code, public_key,
             permissions_json, perk_policy_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             username = VALUES(username),
             password = VALUES(password),
             name = VALUES(name),
             role = VALUES(role),
             avatar_color = VALUES(avatar_color),
             avatar_url = VALUES(avatar_url),
             theme_settings_json = VALUES(theme_settings_json),
             is_admin = VALUES(is_admin),
             is_suspended = VALUES(is_suspended),
             created_at = VALUES(created_at),
             pin_code = VALUES(pin_code),
             public_key = VALUES(public_key),
             permissions_json = VALUES(permissions_json),
             perk_policy_json = VALUES(perk_policy_json)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(username),
            Value::from(password),
            Value::from(name),
            Value::from(role),
            Value::from(avatar_color),
            opt_str_val(avatar_url),
            theme_settings,
            Value::from(is_admin),
            Value::from(is_suspended),
            opt_str_val(created_at),
            opt_str_val(pin_code),
            opt_str_val(public_key),
            permissions_json,
            perk_policy_json,
        ]),
    )
    .map_err(|e| format!("Erreur upsert volunteer MySQL : {}", e))?;

    Ok(())
}

fn insert_sale_ignore_tx(tx: &mut mysql::Transaction, s: &JsonValue) -> Result<bool, String> {
    let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(false);
    }
    let timestamp = s.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
    let items_json = s
        .get("items")
        .map(|v| v.to_string())
        .unwrap_or_else(|| "[]".to_string());
    let total_amount = s.get("totalAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let payment_method = s.get("paymentMethod").and_then(|v| v.as_str()).unwrap_or("especes");
    let cash_received = opt_f64_val(s.get("cashReceived").and_then(|v| v.as_f64()));
    let cash_returned = opt_f64_val(s.get("cashReturned").and_then(|v| v.as_f64()));
    let cash_breakdown_json = opt_json_str(s.get("cashBreakdown"));
    let volunteer_id = s.get("volunteerId").and_then(|v| v.as_str()).unwrap_or("");
    let volunteer_name = s.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("");
    let session_id = s.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
    let is_cancelled = if s.get("isCancelled").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let cancelled_at = opt_str_val(s.get("cancelledAt").and_then(|v| v.as_str()));

    tx.exec_drop(
        r#"INSERT IGNORE INTO sales (
             id, timestamp, items_json, total_amount, payment_method,
             cash_received, cash_returned, cash_breakdown_json,
             volunteer_id, volunteer_name, session_id, is_cancelled, cancelled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(timestamp),
            Value::from(items_json),
            Value::from(total_amount),
            Value::from(payment_method),
            cash_received,
            cash_returned,
            cash_breakdown_json,
            Value::from(volunteer_id),
            Value::from(volunteer_name),
            Value::from(session_id),
            Value::from(is_cancelled),
            cancelled_at,
        ]),
    )
    .map_err(|e| format!("Erreur insert sale MySQL : {}", e))?;

    Ok(tx.affected_rows() > 0)
}

fn upsert_chat_channel_tx(tx: &mut mysql::Transaction, ch: &JsonValue) -> Result<(), String> {
    let id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(());
    }
    let name = ch.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let description = opt_str_val(ch.get("description").and_then(|v| v.as_str()));
    let is_private = if ch.get("isPrivate").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let member_ids_json = opt_json_str(ch.get("memberIds"));
    let is_dm = if ch.get("isDirectMessage").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
    let dm_target = opt_str_val(ch.get("dmTargetVolunteerId").and_then(|v| v.as_str()));
    let created_at = ch.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
    let created_by = ch.get("createdBy").and_then(|v| v.as_str()).unwrap_or("system");

    tx.exec_drop(
        r#"INSERT INTO chat_channels (
             id, name, description, is_private, member_ids_json,
             is_direct_message, dm_target_volunteer_id, created_at, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             description = VALUES(description),
             is_private = VALUES(is_private),
             member_ids_json = VALUES(member_ids_json),
             is_direct_message = VALUES(is_direct_message),
             dm_target_volunteer_id = VALUES(dm_target_volunteer_id)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(name),
            description,
            Value::from(is_private),
            member_ids_json,
            Value::from(is_dm),
            dm_target,
            Value::from(created_at),
            Value::from(created_by),
        ]),
    )
    .map_err(|e| format!("Erreur upsert chat_channel MySQL : {}", e))?;

    Ok(())
}

fn insert_chat_message_tx(tx: &mut mysql::Transaction, m: &JsonValue) -> Result<(), String> {
    let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return Ok(());
    }
    let channel_id = m.get("channelId").and_then(|v| v.as_str()).unwrap_or("all");
    let author_id = m.get("authorId").and_then(|v| v.as_str()).unwrap_or("");
    let author_name = m.get("authorName").and_then(|v| v.as_str()).unwrap_or("");
    let author_role = m.get("authorRole").and_then(|v| v.as_str()).unwrap_or("");
    let avatar_color = opt_str_val(m.get("authorAvatarColor").and_then(|v| v.as_str()));
    let bubble_color = opt_str_val(m.get("authorBubbleColor").and_then(|v| v.as_str()));
    let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let timestamp = m.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
    let signature = opt_str_val(m.get("signature").and_then(|v| v.as_str()));
    let is_system = if m.get("isSystem").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };

    tx.exec_drop(
        r#"INSERT IGNORE INTO chat_messages (
             id, channel_id, author_id, author_name, author_role,
             author_avatar_color, author_bubble_color, content, timestamp, signature, is_system
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        Params::Positional(vec![
            Value::from(id),
            Value::from(channel_id),
            Value::from(author_id),
            Value::from(author_name),
            Value::from(author_role),
            avatar_color,
            bubble_color,
            Value::from(content),
            Value::from(timestamp),
            signature,
            Value::from(is_system),
        ]),
    )
    .map_err(|e| format!("Erreur insert chat_message MySQL : {}", e))?;

    Ok(())
}

fn execute_atomic_op_on_conn(
    conn: &mut PooledConn,
    op_type: &str,
    payload: &str,
) -> Result<(), String> {
    let data: JsonValue = serde_json::from_str(payload)
        .map_err(|e| format!("Payload JSON invalide pour {} : {}", op_type, e))?;

    let mut tx = conn
        .start_transaction(TxOpts::default())
        .map_err(|e| format!("Erreur démarrage transaction MySQL : {}", e))?;

    match op_type {
        "record_sale" => {
            let sale = data.get("sale").unwrap_or(&data);
            let inserted = insert_sale_ignore_tx(&mut tx, sale)?;
            if inserted {
                if let Some(items) = sale.get("items").and_then(|v| v.as_array()) {
                    for item in items {
                        let prod_id = item.get("productId").and_then(|v| v.as_str()).unwrap_or("");
                        let qty = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0);
                        if !prod_id.is_empty() && qty > 0 {
                            tx.exec_drop(
                                "UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?",
                                Params::Positional(vec![Value::from(qty), Value::from(prod_id)]),
                            )
                            .map_err(|e| format!("Erreur décrémentation stock MySQL : {}", e))?;
                        }
                    }
                }

                let session_id = sale.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
                let total_amount = sale.get("totalAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let method = sale.get("paymentMethod").and_then(|v| v.as_str()).unwrap_or("especes");
                let cash_delta = if method == "especes" { total_amount } else { 0.0 };
                let tpe_delta = if method == "especes" { 0.0 } else { total_amount };
                let draft_cash = data.get("draftCashCounts");

                if !session_id.is_empty() {
                    if let Some(dc) = draft_cash.filter(|v| !v.is_null()) {
                        tx.exec_drop(
                            r#"UPDATE sessions SET
                                 total_sales = total_sales + ?,
                                 total_cash = total_cash + ?,
                                 total_tpe = total_tpe + ?,
                                 sales_count = sales_count + 1,
                                 draft_cash_counts_json = ?
                               WHERE id = ?"#,
                            Params::Positional(vec![
                                Value::from(total_amount),
                                Value::from(cash_delta),
                                Value::from(tpe_delta),
                                Value::from(dc.to_string()),
                                Value::from(session_id),
                            ]),
                        )
                        .map_err(|e| format!("Erreur mise à jour session vente MySQL : {}", e))?;
                    } else {
                        tx.exec_drop(
                            r#"UPDATE sessions SET
                                 total_sales = total_sales + ?,
                                 total_cash = total_cash + ?,
                                 total_tpe = total_tpe + ?,
                                 sales_count = sales_count + 1
                               WHERE id = ?"#,
                            Params::Positional(vec![
                                Value::from(total_amount),
                                Value::from(cash_delta),
                                Value::from(tpe_delta),
                                Value::from(session_id),
                            ]),
                        )
                        .map_err(|e| format!("Erreur mise à jour session vente MySQL : {}", e))?;
                    }
                }
            }
        }
        "cancel_sale" => {
            let sale_id = data.get("saleId").and_then(|v| v.as_str()).unwrap_or("");
            let cancelled_at = data.get("cancelledAt").and_then(|v| v.as_str()).unwrap_or("");
            let restore_stock = data.get("restoreStock").and_then(|v| v.as_bool()).unwrap_or(true);
            if !sale_id.is_empty() {
                tx.exec_drop(
                    "UPDATE sales SET is_cancelled = 1, cancelled_at = ? WHERE id = ? AND is_cancelled = 0",
                    Params::Positional(vec![Value::from(cancelled_at), Value::from(sale_id)]),
                )
                .map_err(|e| format!("Erreur annulation vente MySQL : {}", e))?;

                if tx.affected_rows() > 0 && restore_stock {
                    let items_str: Option<String> = tx
                        .exec_first(
                            "SELECT items_json FROM sales WHERE id = ?",
                            Params::Positional(vec![Value::from(sale_id)]),
                        )
                        .map_err(|e| format!("Erreur lecture items vente annulée MySQL : {}", e))?;
                    if let Some(raw_items) = items_str {
                        if let Ok(JsonValue::Array(items)) = serde_json::from_str::<JsonValue>(&raw_items) {
                            for item in items {
                                let prod_id = item.get("productId").and_then(|v| v.as_str()).unwrap_or("");
                                let qty = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0);
                                if !prod_id.is_empty() && qty > 0 {
                                    tx.exec_drop(
                                        "UPDATE products SET stock = stock + ? WHERE id = ?",
                                        Params::Positional(vec![Value::from(qty), Value::from(prod_id)]),
                                    )
                                    .map_err(|e| format!("Erreur restauration stock MySQL : {}", e))?;
                                }
                            }
                        }
                    }
                }
            }
        }
        "apply_restock" => {
            let log = data.get("restockLog").unwrap_or(&data);
            let id = log.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                let prod_id = log.get("productId").and_then(|v| v.as_str()).unwrap_or("");
                let prod_name = log.get("productName").and_then(|v| v.as_str()).unwrap_or("");
                let qty_added = log.get("quantityAdded").and_then(|v| v.as_i64()).unwrap_or(0);
                let prev_stock = log.get("previousStock").and_then(|v| v.as_i64()).unwrap_or(0);
                let new_stock = log.get("newStock").and_then(|v| v.as_i64()).unwrap_or(0);
                let new_price = opt_f64_val(
                    data.get("newPrice")
                        .and_then(|v| v.as_f64())
                        .or_else(|| log.get("newPrice").and_then(|v| v.as_f64())),
                );
                let cost_price = opt_f64_val(
                    data.get("costPrice")
                        .and_then(|v| v.as_f64())
                        .or_else(|| log.get("costPrice").and_then(|v| v.as_f64())),
                );
                let timestamp = log.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                let volunteer_name = log.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("Inconnu");

                tx.exec_drop(
                    r#"INSERT IGNORE INTO restocks (
                         id, product_id, product_name, quantity_added, previous_stock,
                         new_stock, new_price, cost_price, timestamp, volunteer_name
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                    Params::Positional(vec![
                        Value::from(id),
                        Value::from(prod_id),
                        Value::from(prod_name),
                        Value::from(qty_added),
                        Value::from(prev_stock),
                        Value::from(new_stock),
                        new_price.clone(),
                        cost_price.clone(),
                        Value::from(timestamp),
                        Value::from(volunteer_name),
                    ]),
                )
                .map_err(|e| format!("Erreur insert restock MySQL : {}", e))?;

                if tx.affected_rows() > 0 && !prod_id.is_empty() {
                    tx.exec_drop(
                        r#"UPDATE products SET
                             stock = stock + ?,
                             price = COALESCE(?, price),
                             cost_price = COALESCE(?, cost_price)
                           WHERE id = ?"#,
                        Params::Positional(vec![
                            Value::from(qty_added),
                            new_price,
                            cost_price,
                            Value::from(prod_id),
                        ]),
                    )
                    .map_err(|e| format!("Erreur update stock restock MySQL : {}", e))?;
                }
            }
        }
        "claim_perk" => {
            let perk = data.get("perk").unwrap_or(&data);
            let id = perk.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                let vol_id = perk.get("volunteerId").and_then(|v| v.as_str()).unwrap_or("");
                let vol_name = perk.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("");
                let prod_id = perk.get("productId").and_then(|v| v.as_str()).unwrap_or("");
                let prod_name = perk.get("productName").and_then(|v| v.as_str()).unwrap_or("");
                let cost_price = perk.get("costPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let selling_price = perk.get("sellingPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let perk_date = perk.get("date").and_then(|v| v.as_str()).unwrap_or("");
                let timestamp = perk.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                let session_id = opt_str_val(perk.get("sessionId").and_then(|v| v.as_str()));

                tx.exec_drop(
                    r#"INSERT IGNORE INTO volunteer_perks (
                         id, volunteer_id, volunteer_name, product_id, product_name,
                         cost_price, selling_price, perk_date, timestamp, session_id
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                    Params::Positional(vec![
                        Value::from(id),
                        Value::from(vol_id),
                        Value::from(vol_name),
                        Value::from(prod_id),
                        Value::from(prod_name),
                        Value::from(cost_price),
                        Value::from(selling_price),
                        Value::from(perk_date),
                        Value::from(timestamp),
                        session_id,
                    ]),
                )
                .map_err(|e| format!("Erreur insert perk MySQL : {}", e))?;

                if tx.affected_rows() > 0 && !prod_id.is_empty() {
                    tx.exec_drop(
                        "UPDATE products SET stock = GREATEST(0, stock - 1) WHERE id = ?",
                        Params::Positional(vec![Value::from(prod_id)]),
                    )
                    .map_err(|e| format!("Erreur décrémentation stock perk MySQL : {}", e))?;
                }
            }
        }
        "upsert_product" => {
            upsert_product_tx(&mut tx, &data)?;
        }
        "delete_product" => {
            let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                tx.exec_drop(
                    "DELETE FROM products WHERE id = ?",
                    Params::Positional(vec![Value::from(id)]),
                )
                .map_err(|e| format!("Erreur suppression product MySQL : {}", e))?;
            }
        }
        "upsert_session" => {
            upsert_session_tx(&mut tx, &data)?;
        }
        "visa_session" => {
            let session_id = data.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
            let visa_by = data.get("visaBy").and_then(|v| v.as_str()).unwrap_or("");
            let visa_date = data.get("visaDate").and_then(|v| v.as_str()).unwrap_or("");
            let visa_notes = data.get("visaNotes").and_then(|v| v.as_str()).unwrap_or("");

            if !session_id.is_empty() && !visa_by.is_empty() {
                let row: Option<Option<String>> = tx
                    .exec_first(
                        "SELECT cash_withdrawal_json FROM sessions WHERE id = ? FOR UPDATE",
                        Params::Positional(vec![Value::from(session_id)]),
                    )
                    .map_err(|e| format!("Erreur lecture visa session MySQL : {}", e))?;

                if let Some(Some(cw_raw)) = row {
                    if let Ok(mut cw_val) = serde_json::from_str::<JsonValue>(&cw_raw) {
                        if let Some(obj) = cw_val.as_object_mut() {
                            obj.insert("visaBy".to_string(), JsonValue::String(visa_by.to_string()));
                            obj.insert("visaDate".to_string(), JsonValue::String(visa_date.to_string()));
                            obj.insert("visaNotes".to_string(), JsonValue::String(visa_notes.to_string()));
                            tx.exec_drop(
                                "UPDATE sessions SET cash_withdrawal_json = ? WHERE id = ?",
                                Params::Positional(vec![
                                    Value::from(cw_val.to_string()),
                                    Value::from(session_id),
                                ]),
                            )
                            .map_err(|e| format!("Erreur écriture visa session MySQL : {}", e))?;
                        }
                    }
                }
            }
        }
        "upsert_volunteer" => {
            upsert_volunteer_tx(&mut tx, &data)?;
        }
        "delete_volunteer" => {
            let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                tx.exec_drop(
                    "DELETE FROM volunteers WHERE id = ?",
                    Params::Positional(vec![Value::from(id)]),
                )
                .map_err(|e| format!("Erreur suppression volunteer MySQL : {}", e))?;
            }
        }
        "upsert_chat_channel" => {
            upsert_chat_channel_tx(&mut tx, &data)?;
        }
        "insert_chat_message" => {
            if let Some(arr) = data.as_array() {
                for m in arr {
                    insert_chat_message_tx(&mut tx, m)?;
                }
            } else {
                insert_chat_message_tx(&mut tx, &data)?;
            }
        }
        "purge_chat_messages" => {
            let cutoff = data.get("cutoffIso").and_then(|v| v.as_str()).unwrap_or("");
            if !cutoff.is_empty() {
                tx.exec_drop(
                    "DELETE FROM chat_messages WHERE timestamp < ?",
                    Params::Positional(vec![Value::from(cutoff)]),
                )
                .map_err(|e| format!("Erreur purge chat MySQL : {}", e))?;
            }
        }
        "insert_activity_log" => {
            let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                let ts = data.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                let log_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("INFO");
                let msg = data.get("message").and_then(|v| v.as_str()).unwrap_or("");
                let author = data.get("author").and_then(|v| v.as_str()).unwrap_or("Système");
                tx.exec_drop(
                    "INSERT IGNORE INTO activity_logs (id, timestamp, log_type, message, author) VALUES (?, ?, ?, ?, ?)",
                    Params::Positional(vec![
                        Value::from(id),
                        Value::from(ts),
                        Value::from(log_type),
                        Value::from(msg),
                        Value::from(author),
                    ]),
                )
                .map_err(|e| format!("Erreur insert activity_log MySQL : {}", e))?;
            }
        }
        "insert_tpe_log" => {
            let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                let ts = data.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                let amount = data.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let currency = data.get("currency").and_then(|v| v.as_str()).unwrap_or("EUR");
                let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("SUCCESS");
                let reader_name = data.get("readerName").and_then(|v| v.as_str()).unwrap_or("");
                let card_brand = opt_str_val(data.get("cardBrand").and_then(|v| v.as_str()));
                let last4 = opt_str_val(data.get("last4").and_then(|v| v.as_str()));
                let tx_code = data.get("transactionCode").and_then(|v| v.as_str()).unwrap_or("");
                let vol_name = data.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("");
                tx.exec_drop(
                    r#"INSERT IGNORE INTO tpe_logs (
                         id, timestamp, amount, currency, status, reader_name,
                         card_brand, last4, transaction_code, volunteer_name
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                    Params::Positional(vec![
                        Value::from(id),
                        Value::from(ts),
                        Value::from(amount),
                        Value::from(currency),
                        Value::from(status),
                        Value::from(reader_name),
                        card_brand,
                        last4,
                        Value::from(tx_code),
                        Value::from(vol_name),
                    ]),
                )
                .map_err(|e| format!("Erreur insert tpe_log MySQL : {}", e))?;
            }
        }
        "insert_pacman_score" => {
            let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if !id.is_empty() {
                let vol_id = opt_str_val(data.get("volunteerId").and_then(|v| v.as_str()));
                let player_name = data.get("playerName").and_then(|v| v.as_str()).unwrap_or("Anonyme");
                let score = data.get("score").and_then(|v| v.as_i64()).unwrap_or(0);
                let ts = data.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                tx.exec_drop(
                    "INSERT IGNORE INTO pacman_scores (id, volunteer_id, player_name, score, timestamp) VALUES (?, ?, ?, ?, ?)",
                    Params::Positional(vec![
                        Value::from(id),
                        vol_id,
                        Value::from(player_name),
                        Value::from(score),
                        Value::from(ts),
                    ]),
                )
                .map_err(|e| format!("Erreur insert score MySQL : {}", e))?;
            }
        }
        "clear_pacman_scores" => {
            tx.query_drop("DELETE FROM pacman_scores")
                .map_err(|e| format!("Erreur clear scores MySQL : {}", e))?;
        }
        "upsert_setting" => {
            let key = data.get("key").and_then(|v| v.as_str()).unwrap_or("");
            if !key.is_empty() {
                let value_json = data
                    .get("value")
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "{}".to_string());
                tx.exec_drop(
                    "INSERT INTO app_settings (setting_key, value_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)",
                    Params::Positional(vec![Value::from(key), Value::from(value_json)]),
                )
                .map_err(|e| format!("Erreur upsert setting MySQL : {}", e))?;
            }
        }
        "reset_operational_data" => {
            let reset_products = data.get("resetProducts").and_then(|v| v.as_bool()).unwrap_or(true);
            let reset_volunteers = data.get("resetVolunteers").and_then(|v| v.as_bool()).unwrap_or(false);
            for tbl in [
                "sales",
                "sessions",
                "restocks",
                "volunteer_perks",
                "tpe_logs",
                "pacman_scores",
                "activity_logs",
            ] {
                tx.query_drop(format!("DELETE FROM {}", tbl))
                    .map_err(|e| format!("Erreur reset {} MySQL : {}", tbl, e))?;
            }
            if reset_products {
                tx.query_drop("DELETE FROM products")
                    .map_err(|e| format!("Erreur reset products MySQL : {}", e))?;
            }
            if reset_volunteers {
                tx.query_drop("DELETE FROM volunteers")
                    .map_err(|e| format!("Erreur reset volunteers MySQL : {}", e))?;
            }
        }
        _ => {
            return Err(format!("Opération MySQL inconnue : {}", op_type));
        }
    }

    tx.commit()
        .map_err(|e| format!("Erreur commit transaction MySQL : {}", e))?;
    Ok(())
}

pub fn execute_atomic_op(cfg: &MysqlConfig, op_type: &str, payload: &str) -> Result<(), String> {
    let mut conn = get_conn(cfg, false)?;
    execute_atomic_op_on_conn(&mut conn, op_type, payload)
}

pub fn flush_ops(
    cfg: &MysqlConfig,
    ops: Vec<(i64, String, String)>,
) -> Result<(Vec<i64>, Option<String>), String> {
    if ops.is_empty() {
        return Ok((Vec::new(), None));
    }

    let mut conn = match get_conn(cfg, false) {
        Ok(c) => c,
        Err(e) => return Ok((Vec::new(), Some(e))),
    };

    let mut acked = Vec::new();
    for (seq, op_type, payload) in ops {
        match execute_atomic_op_on_conn(&mut conn, &op_type, &payload) {
            Ok(()) => acked.push(seq),
            Err(e) => {
                if e.starts_with("Payload JSON invalide") || e.starts_with("Opération MySQL inconnue") {
                    log::warn!("Opération hors-ligne corrompue ignorée (seq={}): {}", seq, e);
                    acked.push(seq);
                } else {
                    return Ok((acked, Some(e)));
                }
            }
        }
    }

    Ok((acked, None))
}

pub fn pull_snapshot(cfg: &MysqlConfig) -> Result<JsonValue, String> {
    let mut conn = get_conn(cfg, true)?;

    let server_version: String = conn
        .query_first::<String, _>("SELECT VERSION()")
        .map_err(|e| format!("Erreur VERSION() MySQL : {}", e))?
        .unwrap_or_else(|| "MySQL/MariaDB".to_string());

    let product_rows: Vec<(String, String, String, f64, f64, i64, i64, String, i64, i64)> = conn
        .query(
            "SELECT id, name, category, price, cost_price, stock, min_stock_alert, image_url, is_active, is_favorite FROM products",
        )
        .map_err(|e| format!("Erreur lecture products MySQL : {}", e))?;
    let products: Vec<JsonValue> = product_rows
        .into_iter()
        .map(|(id, name, category, price, cost_price, stock, min_stock_alert, image_url, is_active, is_favorite)| {
            json!({
                "id": id,
                "name": name,
                "category": category,
                "price": price,
                "costPrice": cost_price,
                "stock": stock,
                "minStockAlert": min_stock_alert,
                "imageUrl": image_url,
                "isActive": is_active != 0,
                "isFavorite": is_favorite != 0
            })
        })
        .collect();

    let sales: Vec<JsonValue> = conn
        .query_map(
            "SELECT id, timestamp, items_json, total_amount, payment_method, cash_received, cash_returned, cash_breakdown_json, volunteer_id, volunteer_name, session_id, is_cancelled, cancelled_at FROM sales ORDER BY timestamp DESC",
            |mut row: mysql::Row| {
                let id: String = row.take(0).unwrap_or_default();
                let timestamp: String = row.take(1).unwrap_or_default();
                let items_json: String = row.take(2).unwrap_or_else(|| "[]".to_string());
                let total_amount: f64 = row.take(3).unwrap_or(0.0);
                let payment_method: String = row.take(4).unwrap_or_else(|| "especes".to_string());
                let cash_received: Option<f64> = row.take::<Option<f64>, _>(5).unwrap_or(None);
                let cash_returned: Option<f64> = row.take::<Option<f64>, _>(6).unwrap_or(None);
                let cash_breakdown_json: Option<String> = row.take::<Option<String>, _>(7).unwrap_or(None);
                let volunteer_id: String = row.take(8).unwrap_or_default();
                let volunteer_name: String = row.take(9).unwrap_or_default();
                let session_id: String = row.take(10).unwrap_or_default();
                let is_cancelled: i64 = row.take(11).unwrap_or(0);
                let cancelled_at: Option<String> = row.take::<Option<String>, _>(12).unwrap_or(None);

                let items: JsonValue = serde_json::from_str(&items_json).unwrap_or_else(|_| json!([]));
                let mut obj = serde_json::Map::new();
                obj.insert("id".to_string(), json!(id));
                obj.insert("timestamp".to_string(), json!(timestamp));
                obj.insert("items".to_string(), items);
                obj.insert("totalAmount".to_string(), json!(total_amount));
                obj.insert("paymentMethod".to_string(), json!(payment_method));
                if let Some(cr) = cash_received {
                    obj.insert("cashReceived".to_string(), json!(cr));
                }
                if let Some(cret) = cash_returned {
                    obj.insert("cashReturned".to_string(), json!(cret));
                }
                if let Some(cb) = cash_breakdown_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("cashBreakdown".to_string(), cb);
                }
                obj.insert("volunteerId".to_string(), json!(volunteer_id));
                obj.insert("volunteerName".to_string(), json!(volunteer_name));
                obj.insert("sessionId".to_string(), json!(session_id));
                if is_cancelled != 0 {
                    obj.insert("isCancelled".to_string(), json!(true));
                }
                if let Some(ca) = cancelled_at {
                    obj.insert("cancelledAt".to_string(), json!(ca));
                }
                JsonValue::Object(obj)
            },
        )
        .map_err(|e| format!("Erreur lecture sales MySQL : {}", e))?;

    let sessions: Vec<JsonValue> = conn
        .query_map(
            "SELECT id, start_time, end_time, volunteer_id, volunteer_name, total_sales, total_cash, total_tpe, sales_count, incident_notes, draft_notes, draft_perk_product_id, draft_cash_counts_json, cash_withdrawal_json, status FROM sessions ORDER BY start_time DESC",
            |mut row: mysql::Row| {
                let id: String = row.take(0).unwrap_or_default();
                let start_time: String = row.take(1).unwrap_or_default();
                let end_time: Option<String> = row.take::<Option<String>, _>(2).unwrap_or(None);
                let volunteer_id: String = row.take(3).unwrap_or_default();
                let volunteer_name: String = row.take(4).unwrap_or_default();
                let total_sales: f64 = row.take(5).unwrap_or(0.0);
                let total_cash: f64 = row.take(6).unwrap_or(0.0);
                let total_tpe: f64 = row.take(7).unwrap_or(0.0);
                let sales_count: i64 = row.take(8).unwrap_or(0);
                let incident_notes: Option<String> = row.take::<Option<String>, _>(9).unwrap_or(None);
                let draft_notes: Option<String> = row.take::<Option<String>, _>(10).unwrap_or(None);
                let draft_perk_product_id: Option<String> = row.take::<Option<String>, _>(11).unwrap_or(None);
                let draft_cash_counts_json: Option<String> = row.take::<Option<String>, _>(12).unwrap_or(None);
                let cash_withdrawal_json: Option<String> = row.take::<Option<String>, _>(13).unwrap_or(None);
                let status: String = row.take(14).unwrap_or_else(|| "active".to_string());

                let mut obj = serde_json::Map::new();
                obj.insert("id".to_string(), json!(id));
                obj.insert("startTime".to_string(), json!(start_time));
                if let Some(et) = end_time {
                    obj.insert("endTime".to_string(), json!(et));
                }
                obj.insert("volunteerId".to_string(), json!(volunteer_id));
                obj.insert("volunteerName".to_string(), json!(volunteer_name));
                obj.insert("totalSales".to_string(), json!(total_sales));
                obj.insert("totalCash".to_string(), json!(total_cash));
                obj.insert("totalTpe".to_string(), json!(total_tpe));
                obj.insert("salesCount".to_string(), json!(sales_count));
                if let Some(notes) = incident_notes {
                    obj.insert("incidentNotes".to_string(), json!(notes));
                }
                if let Some(dn) = draft_notes {
                    obj.insert("draftNotes".to_string(), json!(dn));
                }
                if let Some(dp) = draft_perk_product_id {
                    obj.insert("draftPerkProductId".to_string(), json!(dp));
                }
                if let Some(dc) = draft_cash_counts_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("draftCashCounts".to_string(), dc);
                }
                if let Some(cw) = cash_withdrawal_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("cashWithdrawal".to_string(), cw);
                }
                obj.insert("status".to_string(), json!(status));
                JsonValue::Object(obj)
            },
        )
        .map_err(|e| format!("Erreur lecture sessions MySQL : {}", e))?;

    let volunteers: Vec<JsonValue> = conn
        .query_map(
            "SELECT id, username, password, name, role, avatar_color, avatar_url, theme_settings_json, is_admin, is_suspended, created_at, pin_code, public_key, permissions_json, perk_policy_json FROM volunteers",
            |mut row: mysql::Row| {
                let id: String = row.take(0).unwrap_or_default();
                let username: String = row.take(1).unwrap_or_default();
                let password: String = row.take(2).unwrap_or_default();
                let name: String = row.take(3).unwrap_or_default();
                let role: String = row.take(4).unwrap_or_else(|| "Bénévole".to_string());
                let avatar_color: String = row.take(5).unwrap_or_else(|| "#ea580c".to_string());
                let avatar_url: Option<String> = row.take::<Option<String>, _>(6).unwrap_or(None);
                let theme_settings_json: Option<String> = row.take::<Option<String>, _>(7).unwrap_or(None);
                let is_admin: i64 = row.take(8).unwrap_or(0);
                let is_suspended: i64 = row.take(9).unwrap_or(0);
                let created_at: Option<String> = row.take::<Option<String>, _>(10).unwrap_or(None);
                let pin_code: Option<String> = row.take::<Option<String>, _>(11).unwrap_or(None);
                let public_key: Option<String> = row.take::<Option<String>, _>(12).unwrap_or(None);
                let permissions_json: Option<String> = row.take::<Option<String>, _>(13).unwrap_or(None);
                let perk_policy_json: Option<String> = row.take::<Option<String>, _>(14).unwrap_or(None);

                let mut obj = serde_json::Map::new();
                obj.insert("id".to_string(), json!(id));
                obj.insert("username".to_string(), json!(username));
                obj.insert("password".to_string(), json!(password));
                obj.insert("name".to_string(), json!(name));
                obj.insert("role".to_string(), json!(role));
                obj.insert("avatarColor".to_string(), json!(avatar_color));
                if let Some(au) = avatar_url {
                    obj.insert("avatarUrl".to_string(), json!(au));
                }
                if let Some(ts) = theme_settings_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("themeSettings".to_string(), ts);
                }
                obj.insert("isAdmin".to_string(), json!(is_admin != 0));
                obj.insert("isSuspended".to_string(), json!(is_suspended != 0));
                if let Some(ca) = created_at {
                    obj.insert("createdAt".to_string(), json!(ca));
                }
                if let Some(pc) = pin_code {
                    obj.insert("pinCode".to_string(), json!(pc));
                }
                if let Some(pk) = public_key {
                    obj.insert("publicKey".to_string(), json!(pk));
                }
                if let Some(perms) = permissions_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("permissions".to_string(), perms);
                }
                if let Some(pp) = perk_policy_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                    obj.insert("perkPolicy".to_string(), pp);
                }
                JsonValue::Object(obj)
            },
        )
        .map_err(|e| format!("Erreur lecture volunteers MySQL : {}", e))?;

    let restock_rows: Vec<(String, String, String, i64, i64, i64, Option<f64>, Option<f64>, String, String)> = conn
        .query(
            "SELECT id, product_id, product_name, quantity_added, previous_stock, new_stock, new_price, cost_price, timestamp, volunteer_name FROM restocks ORDER BY timestamp DESC",
        )
        .map_err(|e| format!("Erreur lecture restocks MySQL : {}", e))?;
    let restocks: Vec<JsonValue> = restock_rows
        .into_iter()
        .map(|(id, product_id, product_name, quantity_added, previous_stock, new_stock, new_price, cost_price, timestamp, volunteer_name)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            obj.insert("productId".to_string(), json!(product_id));
            obj.insert("productName".to_string(), json!(product_name));
            obj.insert("quantityAdded".to_string(), json!(quantity_added));
            obj.insert("previousStock".to_string(), json!(previous_stock));
            obj.insert("newStock".to_string(), json!(new_stock));
            if let Some(np) = new_price {
                obj.insert("newPrice".to_string(), json!(np));
            }
            if let Some(cp) = cost_price {
                obj.insert("costPrice".to_string(), json!(cp));
            }
            obj.insert("timestamp".to_string(), json!(timestamp));
            obj.insert("volunteerName".to_string(), json!(volunteer_name));
            JsonValue::Object(obj)
        })
        .collect();

    let perk_rows: Vec<(String, String, String, String, String, f64, f64, String, String, Option<String>)> = conn
        .query(
            "SELECT id, volunteer_id, volunteer_name, product_id, product_name, cost_price, selling_price, perk_date, timestamp, session_id FROM volunteer_perks ORDER BY timestamp DESC",
        )
        .map_err(|e| format!("Erreur lecture volunteer_perks MySQL : {}", e))?;
    let volunteer_perks: Vec<JsonValue> = perk_rows
        .into_iter()
        .map(|(id, volunteer_id, volunteer_name, product_id, product_name, cost_price, selling_price, date, timestamp, session_id)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            obj.insert("volunteerId".to_string(), json!(volunteer_id));
            obj.insert("volunteerName".to_string(), json!(volunteer_name));
            obj.insert("productId".to_string(), json!(product_id));
            obj.insert("productName".to_string(), json!(product_name));
            obj.insert("costPrice".to_string(), json!(cost_price));
            obj.insert("sellingPrice".to_string(), json!(selling_price));
            obj.insert("date".to_string(), json!(date));
            obj.insert("timestamp".to_string(), json!(timestamp));
            if let Some(sid) = session_id {
                obj.insert("sessionId".to_string(), json!(sid));
            }
            JsonValue::Object(obj)
        })
        .collect();

    let log_rows: Vec<(String, String, String, String, String)> = conn
        .query("SELECT id, timestamp, log_type, message, author FROM activity_logs ORDER BY timestamp DESC LIMIT 500")
        .map_err(|e| format!("Erreur lecture activity_logs MySQL : {}", e))?;
    let logs: Vec<JsonValue> = log_rows
        .into_iter()
        .map(|(id, timestamp, log_type, message, author)| {
            json!({
                "id": id,
                "timestamp": timestamp,
                "type": log_type,
                "message": message,
                "author": author
            })
        })
        .collect();

    let tpe_rows: Vec<(String, String, f64, String, String, String, Option<String>, Option<String>, String, String)> = conn
        .query(
            "SELECT id, timestamp, amount, currency, status, reader_name, card_brand, last4, transaction_code, volunteer_name FROM tpe_logs ORDER BY timestamp DESC LIMIT 200",
        )
        .map_err(|e| format!("Erreur lecture tpe_logs MySQL : {}", e))?;
    let tpe_logs: Vec<JsonValue> = tpe_rows
        .into_iter()
        .map(|(id, timestamp, amount, currency, status, reader_name, card_brand, last4, transaction_code, volunteer_name)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            obj.insert("timestamp".to_string(), json!(timestamp));
            obj.insert("amount".to_string(), json!(amount));
            obj.insert("currency".to_string(), json!(currency));
            obj.insert("status".to_string(), json!(status));
            obj.insert("readerName".to_string(), json!(reader_name));
            if let Some(cb) = card_brand {
                obj.insert("cardBrand".to_string(), json!(cb));
            }
            if let Some(l4) = last4 {
                obj.insert("last4".to_string(), json!(l4));
            }
            obj.insert("transactionCode".to_string(), json!(transaction_code));
            obj.insert("volunteerName".to_string(), json!(volunteer_name));
            JsonValue::Object(obj)
        })
        .collect();

    let score_rows: Vec<(String, Option<String>, String, i64, String)> = conn
        .query("SELECT id, volunteer_id, player_name, score, timestamp FROM pacman_scores ORDER BY score DESC LIMIT 50")
        .map_err(|e| format!("Erreur lecture pacman_scores MySQL : {}", e))?;
    let snake_scores: Vec<JsonValue> = score_rows
        .into_iter()
        .map(|(id, volunteer_id, player_name, score, timestamp)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            if let Some(vi) = volunteer_id {
                obj.insert("volunteerId".to_string(), json!(vi));
            }
            obj.insert("playerName".to_string(), json!(player_name));
            obj.insert("score".to_string(), json!(score));
            obj.insert("timestamp".to_string(), json!(timestamp));
            JsonValue::Object(obj)
        })
        .collect();

    let channel_rows: Vec<(String, String, Option<String>, i64, Option<String>, i64, Option<String>, String, String)> = conn
        .query(
            "SELECT id, name, description, is_private, member_ids_json, is_direct_message, dm_target_volunteer_id, created_at, created_by FROM chat_channels",
        )
        .map_err(|e| format!("Erreur lecture chat_channels MySQL : {}", e))?;
    let chat_channels: Vec<JsonValue> = channel_rows
        .into_iter()
        .map(|(id, name, description, is_private, member_ids_json, is_dm, dm_target, created_at, created_by)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            obj.insert("name".to_string(), json!(name));
            if let Some(desc) = description {
                obj.insert("description".to_string(), json!(desc));
            }
            obj.insert("isPrivate".to_string(), json!(is_private != 0));
            if let Some(mids) = member_ids_json.and_then(|s| serde_json::from_str::<JsonValue>(&s).ok()) {
                obj.insert("memberIds".to_string(), mids);
            }
            if is_dm != 0 {
                obj.insert("isDirectMessage".to_string(), json!(true));
            }
            if let Some(dt) = dm_target {
                obj.insert("dmTargetVolunteerId".to_string(), json!(dt));
            }
            obj.insert("createdAt".to_string(), json!(created_at));
            obj.insert("createdBy".to_string(), json!(created_by));
            JsonValue::Object(obj)
        })
        .collect();

    let msg_rows: Vec<(String, String, String, String, String, Option<String>, Option<String>, String, String, Option<String>, i64)> = conn
        .query(
            "SELECT id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature, is_system FROM chat_messages ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Erreur lecture chat_messages MySQL : {}", e))?;
    let chat_messages: Vec<JsonValue> = msg_rows
        .into_iter()
        .map(|(id, channel_id, author_id, author_name, author_role, avatar_color, bubble_color, content, timestamp, signature, is_system)| {
            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), json!(id));
            obj.insert("channelId".to_string(), json!(channel_id));
            obj.insert("authorId".to_string(), json!(author_id));
            obj.insert("authorName".to_string(), json!(author_name));
            obj.insert("authorRole".to_string(), json!(author_role));
            if let Some(ac) = avatar_color {
                obj.insert("authorAvatarColor".to_string(), json!(ac));
            }
            if let Some(bc) = bubble_color {
                obj.insert("authorBubbleColor".to_string(), json!(bc));
            }
            obj.insert("content".to_string(), json!(content));
            obj.insert("timestamp".to_string(), json!(timestamp));
            if let Some(sig) = signature {
                obj.insert("signature".to_string(), json!(sig));
            }
            if is_system != 0 {
                obj.insert("isSystem".to_string(), json!(true));
            }
            JsonValue::Object(obj)
        })
        .collect();

    let setting_rows: Vec<(String, String)> = conn
        .query("SELECT setting_key, value_json FROM app_settings")
        .map_err(|e| format!("Erreur lecture app_settings MySQL : {}", e))?;

    let mut result = serde_json::Map::new();
    result.insert("serverVersion".to_string(), json!(server_version));
    result.insert("products".to_string(), JsonValue::Array(products));
    result.insert("sales".to_string(), JsonValue::Array(sales));
    result.insert("sessions".to_string(), JsonValue::Array(sessions));
    result.insert("volunteers".to_string(), JsonValue::Array(volunteers));
    result.insert("restocks".to_string(), JsonValue::Array(restocks));
    result.insert("volunteerPerks".to_string(), JsonValue::Array(volunteer_perks));
    result.insert("logs".to_string(), JsonValue::Array(logs));
    result.insert("tpeLogs".to_string(), JsonValue::Array(tpe_logs));
    result.insert("snakeScores".to_string(), JsonValue::Array(snake_scores));
    result.insert("chatChannels".to_string(), JsonValue::Array(chat_channels));
    result.insert("chatMessages".to_string(), JsonValue::Array(chat_messages));

    for (k, val_str) in setting_rows {
        if let Ok(parsed) = serde_json::from_str::<JsonValue>(&val_str) {
            match k.as_str() {
                "perk_settings" => {
                    result.insert("perkSettings".to_string(), parsed);
                }
                "cash_float_settings" => {
                    result.insert("cashFloatSettings".to_string(), parsed);
                }
                "tpe_settings" => {
                    result.insert("tpeSettings".to_string(), parsed);
                }
                "chat_settings" => {
                    result.insert("chatSettings".to_string(), parsed);
                }
                _ => {}
            }
        }
    }

    Ok(JsonValue::Object(result))
}

pub fn push_snapshot(cfg: &MysqlConfig, snapshot: &JsonValue) -> Result<MysqlMigrateResult, String> {
    let mut conn = get_conn(cfg, true)?;
    let mut tx = conn
        .start_transaction(TxOpts::default())
        .map_err(|e| format!("Erreur démarrage transaction migration MySQL : {}", e))?;

    let mut prod_count = 0usize;
    let mut sales_count = 0usize;
    let mut sess_count = 0usize;
    let mut vol_count = 0usize;
    let mut msg_count = 0usize;

    if let Some(arr) = snapshot.get("products").and_then(|v| v.as_array()) {
        for p in arr {
            upsert_product_tx(&mut tx, p)?;
            prod_count += 1;
        }
    }

    if let Some(arr) = snapshot.get("volunteers").and_then(|v| v.as_array()) {
        for v in arr {
            upsert_volunteer_tx(&mut tx, v)?;
            vol_count += 1;
        }
    }

    if let Some(arr) = snapshot.get("sessions").and_then(|v| v.as_array()) {
        for s in arr {
            upsert_session_tx(&mut tx, s)?;
            sess_count += 1;
        }
    }

    if let Some(active) = snapshot.get("activeSession").filter(|v| v.is_object()) {
        upsert_session_tx(&mut tx, active)?;
    }

    if let Some(arr) = snapshot.get("sales").and_then(|v| v.as_array()) {
        for s in arr {
            let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            let timestamp = s.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            let items_json = s
                .get("items")
                .map(|v| v.to_string())
                .unwrap_or_else(|| "[]".to_string());
            let total_amount = s.get("totalAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let payment_method = s.get("paymentMethod").and_then(|v| v.as_str()).unwrap_or("especes");
            let cash_received = opt_f64_val(s.get("cashReceived").and_then(|v| v.as_f64()));
            let cash_returned = opt_f64_val(s.get("cashReturned").and_then(|v| v.as_f64()));
            let cash_breakdown_json = opt_json_str(s.get("cashBreakdown"));
            let volunteer_id = s.get("volunteerId").and_then(|v| v.as_str()).unwrap_or("");
            let volunteer_name = s.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("");
            let session_id = s.get("sessionId").and_then(|v| v.as_str()).unwrap_or("");
            let is_cancelled = if s.get("isCancelled").and_then(|v| v.as_bool()).unwrap_or(false) { 1 } else { 0 };
            let cancelled_at = opt_str_val(s.get("cancelledAt").and_then(|v| v.as_str()));

            tx.exec_drop(
                r#"INSERT INTO sales (
                     id, timestamp, items_json, total_amount, payment_method,
                     cash_received, cash_returned, cash_breakdown_json,
                     volunteer_id, volunteer_name, session_id, is_cancelled, cancelled_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     is_cancelled = VALUES(is_cancelled),
                     cancelled_at = VALUES(cancelled_at)"#,
                Params::Positional(vec![
                    Value::from(id),
                    Value::from(timestamp),
                    Value::from(items_json),
                    Value::from(total_amount),
                    Value::from(payment_method),
                    cash_received,
                    cash_returned,
                    cash_breakdown_json,
                    Value::from(volunteer_id),
                    Value::from(volunteer_name),
                    Value::from(session_id),
                    Value::from(is_cancelled),
                    cancelled_at,
                ]),
            )
            .map_err(|e| format!("Erreur migration sale MySQL : {}", e))?;
            sales_count += 1;
        }
    }

    if let Some(arr) = snapshot.get("restocks").and_then(|v| v.as_array()) {
        for r in arr {
            let id = r.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            tx.exec_drop(
                r#"INSERT IGNORE INTO restocks (
                     id, product_id, product_name, quantity_added, previous_stock,
                     new_stock, new_price, cost_price, timestamp, volunteer_name
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                Params::Positional(vec![
                    Value::from(id),
                    Value::from(r.get("productId").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(r.get("productName").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(r.get("quantityAdded").and_then(|v| v.as_i64()).unwrap_or(0)),
                    Value::from(r.get("previousStock").and_then(|v| v.as_i64()).unwrap_or(0)),
                    Value::from(r.get("newStock").and_then(|v| v.as_i64()).unwrap_or(0)),
                    opt_f64_val(r.get("newPrice").and_then(|v| v.as_f64())),
                    opt_f64_val(r.get("costPrice").and_then(|v| v.as_f64())),
                    Value::from(r.get("timestamp").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(r.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("Inconnu")),
                ]),
            )
            .map_err(|e| format!("Erreur migration restock MySQL : {}", e))?;
        }
    }

    if let Some(arr) = snapshot.get("volunteerPerks").and_then(|v| v.as_array()) {
        for p in arr {
            let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            tx.exec_drop(
                r#"INSERT IGNORE INTO volunteer_perks (
                     id, volunteer_id, volunteer_name, product_id, product_name,
                     cost_price, selling_price, perk_date, timestamp, session_id
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                Params::Positional(vec![
                    Value::from(id),
                    Value::from(p.get("volunteerId").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(p.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(p.get("productId").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(p.get("productName").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(p.get("costPrice").and_then(|v| v.as_f64()).unwrap_or(0.0)),
                    Value::from(p.get("sellingPrice").and_then(|v| v.as_f64()).unwrap_or(0.0)),
                    Value::from(p.get("date").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(p.get("timestamp").and_then(|v| v.as_str()).unwrap_or("")),
                    opt_str_val(p.get("sessionId").and_then(|v| v.as_str())),
                ]),
            )
            .map_err(|e| format!("Erreur migration perk MySQL : {}", e))?;
        }
    }

    if let Some(arr) = snapshot.get("logs").and_then(|v| v.as_array()) {
        for l in arr {
            let id = l.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            tx.exec_drop(
                "INSERT IGNORE INTO activity_logs (id, timestamp, log_type, message, author) VALUES (?, ?, ?, ?, ?)",
                Params::Positional(vec![
                    Value::from(id),
                    Value::from(l.get("timestamp").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(l.get("type").and_then(|v| v.as_str()).unwrap_or("INFO")),
                    Value::from(l.get("message").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(l.get("author").and_then(|v| v.as_str()).unwrap_or("Système")),
                ]),
            )
            .map_err(|e| format!("Erreur migration activity_log MySQL : {}", e))?;
        }
    }

    if let Some(arr) = snapshot.get("tpeLogs").and_then(|v| v.as_array()) {
        for t in arr {
            let id = t.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            tx.exec_drop(
                r#"INSERT IGNORE INTO tpe_logs (
                     id, timestamp, amount, currency, status, reader_name,
                     card_brand, last4, transaction_code, volunteer_name
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                Params::Positional(vec![
                    Value::from(id),
                    Value::from(t.get("timestamp").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(t.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0)),
                    Value::from(t.get("currency").and_then(|v| v.as_str()).unwrap_or("EUR")),
                    Value::from(t.get("status").and_then(|v| v.as_str()).unwrap_or("SUCCESS")),
                    Value::from(t.get("readerName").and_then(|v| v.as_str()).unwrap_or("")),
                    opt_str_val(t.get("cardBrand").and_then(|v| v.as_str())),
                    opt_str_val(t.get("last4").and_then(|v| v.as_str())),
                    Value::from(t.get("transactionCode").and_then(|v| v.as_str()).unwrap_or("")),
                    Value::from(t.get("volunteerName").and_then(|v| v.as_str()).unwrap_or("")),
                ]),
            )
            .map_err(|e| format!("Erreur migration tpe_log MySQL : {}", e))?;
        }
    }

    if let Some(arr) = snapshot.get("snakeScores").and_then(|v| v.as_array()) {
        for sc in arr {
            let id = sc.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if id.is_empty() {
                continue;
            }
            tx.exec_drop(
                "INSERT IGNORE INTO pacman_scores (id, volunteer_id, player_name, score, timestamp) VALUES (?, ?, ?, ?, ?)",
                Params::Positional(vec![
                    Value::from(id),
                    opt_str_val(sc.get("volunteerId").and_then(|v| v.as_str())),
                    Value::from(sc.get("playerName").and_then(|v| v.as_str()).unwrap_or("Anonyme")),
                    Value::from(sc.get("score").and_then(|v| v.as_i64()).unwrap_or(0)),
                    Value::from(sc.get("timestamp").and_then(|v| v.as_str()).unwrap_or("")),
                ]),
            )
            .map_err(|e| format!("Erreur migration score MySQL : {}", e))?;
        }
    }

    if let Some(arr) = snapshot.get("chatChannels").and_then(|v| v.as_array()) {
        for ch in arr {
            upsert_chat_channel_tx(&mut tx, ch)?;
        }
    }

    if let Some(arr) = snapshot.get("chatMessages").and_then(|v| v.as_array()) {
        for m in arr {
            insert_chat_message_tx(&mut tx, m)?;
            msg_count += 1;
        }
    }

    for (json_key, setting_key) in [
        ("perkSettings", "perk_settings"),
        ("cashFloatSettings", "cash_float_settings"),
        ("tpeSettings", "tpe_settings"),
        ("chatSettings", "chat_settings"),
    ] {
        if let Some(val) = snapshot.get(json_key).filter(|v| !v.is_null()) {
            tx.exec_drop(
                "INSERT INTO app_settings (setting_key, value_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)",
                Params::Positional(vec![Value::from(setting_key), Value::from(val.to_string())]),
            )
            .map_err(|e| format!("Erreur migration setting {} MySQL : {}", setting_key, e))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("Erreur commit migration MySQL : {}", e))?;

    Ok(MysqlMigrateResult {
        success: true,
        counts: json!({
            "products": prod_count,
            "sales": sales_count,
            "sessions": sess_count,
            "volunteers": vol_count,
            "chatMessages": msg_count
        }),
        message: format!(
            "Migration terminée : {} produits, {} ventes, {} séances, {} bénévoles, {} messages.",
            prod_count, sales_count, sess_count, vol_count, msg_count
        ),
    })
}
