use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;

pub struct SqliteStorage {
    db_path: PathBuf,
}

impl SqliteStorage {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        let db_dir = app_dir.join("database");
        fs::create_dir_all(&db_dir).map_err(|e| format!("Impossible de créer le dossier database: {}", e))?;
        let db_path = db_dir.join("openmdl.sqlite");

        let storage = Self { db_path };
        storage.init_tables()?;
        Ok(storage)
    }

    fn connect(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|e| format!("Erreur ouverture SQLite: {}", e))
    }

    pub fn init_tables(&self) -> Result<(), String> {
        let conn = self.connect()?;

        // Table clé-valeur pour stocker les entités et métadonnées avec index et transactions
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| format!("Erreur création table app_state: {}", e))?;

        // Table relationnelle dédiée aux messages de chat pour le vote de réconciliation et l'intégrité
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_role TEXT NOT NULL,
                author_avatar_color TEXT,
                author_bubble_color TEXT,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                signature TEXT NOT NULL,
                vote_count INTEGER DEFAULT 1,
                is_reconciled INTEGER DEFAULT 1
            )",
            [],
        ).map_err(|e| format!("Erreur création table chat_messages: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_channel_ts ON chat_messages(channel_id, timestamp)",
            [],
        ).map_err(|e| format!("Erreur création index chat_messages: {}", e))?;

        Ok(())
    }

    pub fn get_key(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT value FROM app_state WHERE key = ?1").map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;

        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let val: String = row.get(0).map_err(|e| e.to_string())?;
            Ok(Some(val))
        } else {
            Ok(None)
        }
    }

    pub fn set_key(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO app_state (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
            params![key, value],
        ).map_err(|e| format!("Erreur set_key SQLite: {}", e))?;
        Ok(())
    }

    pub fn get_all_keys(&self) -> Result<Vec<(String, String)>, String> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT key, value FROM app_state").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| e.to_string())?;

        let mut res = Vec::new();
        for r in rows {
            if let Ok(entry) = r {
                res.push(entry);
            }
        }
        Ok(res)
    }

    pub fn delete_key(&self, key: &str) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM app_state WHERE key = ?1", params![key]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_chat_message(
        &self,
        id: &str,
        channel_id: &str,
        author_id: &str,
        author_name: &str,
        author_role: &str,
        avatar_color: Option<&str>,
        bubble_color: Option<&str>,
        content: &str,
        timestamp: &str,
        signature: &str,
    ) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO chat_messages (id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature, vote_count, is_reconciled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, 1)
             ON CONFLICT(id) DO NOTHING",
            params![id, channel_id, author_id, author_name, author_role, avatar_color, bubble_color, content, timestamp, signature],
        ).map_err(|e| format!("Erreur insertion chat_message SQLite: {}", e))?;
        Ok(())
    }

    pub fn get_chat_messages(&self, channel_id: Option<&str>) -> Result<Vec<serde_json::Value>, String> {
        let conn = self.connect()?;
        if let Some(chan) = channel_id {
            let mut stmt = conn.prepare(
                "SELECT id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature
                 FROM chat_messages WHERE channel_id = ?1 ORDER BY timestamp ASC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![chan], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "channelId": row.get::<_, String>(1)?,
                    "authorId": row.get::<_, String>(2)?,
                    "authorName": row.get::<_, String>(3)?,
                    "authorRole": row.get::<_, String>(4)?,
                    "authorAvatarColor": row.get::<_, Option<String>>(5)?,
                    "authorBubbleColor": row.get::<_, Option<String>>(6)?,
                    "content": row.get::<_, String>(7)?,
                    "timestamp": row.get::<_, String>(8)?,
                    "signature": row.get::<_, String>(9)?,
                }))
            }).map_err(|e| e.to_string())?;
            let mut list = Vec::new();
            for r in rows {
                if let Ok(item) = r {
                    list.push(item);
                }
            }
            return Ok(list);
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature
                 FROM chat_messages ORDER BY timestamp ASC"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "channelId": row.get::<_, String>(1)?,
                    "authorId": row.get::<_, String>(2)?,
                    "authorName": row.get::<_, String>(3)?,
                    "authorRole": row.get::<_, String>(4)?,
                    "authorAvatarColor": row.get::<_, Option<String>>(5)?,
                    "authorBubbleColor": row.get::<_, Option<String>>(6)?,
                    "content": row.get::<_, String>(7)?,
                    "timestamp": row.get::<_, String>(8)?,
                    "signature": row.get::<_, String>(9)?,
                }))
            }).map_err(|e| e.to_string())?;
            let mut list = Vec::new();
            for r in rows {
                if let Ok(item) = r {
                    list.push(item);
                }
            }
            return Ok(list);
        };
    }

    /// Réconciliation par vote à la majorité des messages hors-ligne soumis par les clients
    pub fn reconcile_client_votes(&self, candidate_messages: &[serde_json::Value]) -> Result<usize, String> {
        let mut conn = self.connect()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let mut adopted_count = 0;

        for msg in candidate_messages {
            let id = msg.get("id").and_then(|v| v.as_str());
            let channel_id = msg.get("channelId").and_then(|v| v.as_str());
            let author_id = msg.get("authorId").and_then(|v| v.as_str());
            let author_name = msg.get("authorName").and_then(|v| v.as_str());
            let author_role = msg.get("authorRole").and_then(|v| v.as_str()).unwrap_or("Bénévole");
            let author_avatar_color = msg.get("authorAvatarColor").and_then(|v| v.as_str());
            let author_bubble_color = msg.get("authorBubbleColor").and_then(|v| v.as_str());
            let content = msg.get("content").and_then(|v| v.as_str());
            let timestamp = msg.get("timestamp").and_then(|v| v.as_str());
            let signature = msg.get("signature").and_then(|v| v.as_str());

            if let (Some(id), Some(channel_id), Some(author_id), Some(author_name), Some(content), Some(timestamp), Some(signature)) =
                (id, channel_id, author_id, author_name, content, timestamp, signature)
            {
                // Vérifier si le message existe déjà
                let mut check_stmt = tx.prepare("SELECT vote_count FROM chat_messages WHERE id = ?1").map_err(|e| e.to_string())?;
                let mut rows = check_stmt.query(params![id]).map_err(|e| e.to_string())?;

                if let Some(row) = rows.next().map_err(|e| e.to_string())? {
                    let current_votes: i64 = row.get(0).unwrap_or(1);
                    // Incrémenter le vote de confirmation du message
                    tx.execute(
                        "UPDATE chat_messages SET vote_count = ?1 + 1 WHERE id = ?2",
                        params![current_votes, id],
                    ).map_err(|e| e.to_string())?;
                } else {
                    // Nouveau message rapporté par les clients, inséré avec vote initial
                    tx.execute(
                        "INSERT INTO chat_messages (id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature, vote_count, is_reconciled)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, 1)",
                        params![id, channel_id, author_id, author_name, author_role, author_avatar_color, author_bubble_color, content, timestamp, signature],
                    ).map_err(|e| e.to_string())?;
                    adopted_count += 1;
                }
            }
        }

        tx.commit().map_err(|e| e.to_string())?;
        Ok(adopted_count)
    }
}
