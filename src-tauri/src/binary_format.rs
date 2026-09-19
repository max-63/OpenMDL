use std::io::{Read, Write};
use std::time::{SystemTime, UNIX_EPOCH};
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;

pub const MDLX_MAGIC: &[u8; 4] = b"MDLX";
pub const MDLB_MAGIC: &[u8; 4] = b"MDLB";
pub const FORMAT_VERSION: u16 = 1;

/// Pack an addon JSON string into an OpenMDL Extension (.mdlx) binary package.
pub fn pack_mdlx(json_str: &str) -> Result<Vec<u8>, String> {
    let uncompressed = json_str.as_bytes();
    let uncompressed_len = uncompressed.len() as u32;

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
    encoder
        .write_all(uncompressed)
        .map_err(|e| format!("Erreur de compression zlib: {}", e))?;
    let compressed = encoder
        .finish()
        .map_err(|e| format!("Erreur finalisation compression: {}", e))?;
    let compressed_len = compressed.len() as u32;

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(uncompressed);
    let crc = hasher.finalize();

    // 20-byte header:
    // [0..4]   Magic: b"MDLX"
    // [4..6]   Version: u16 (BE)
    // [6..8]   Flags: u16 (BE)
    // [8..12]  Uncompressed length: u32 (BE)
    // [12..16] Compressed length: u32 (BE)
    // [16..20] Checksum CRC32: u32 (BE)
    let mut output = Vec::with_capacity(20 + compressed.len());
    output.extend_from_slice(MDLX_MAGIC);
    output.extend_from_slice(&FORMAT_VERSION.to_be_bytes());
    output.extend_from_slice(&0u16.to_be_bytes()); // flags
    output.extend_from_slice(&uncompressed_len.to_be_bytes());
    output.extend_from_slice(&compressed_len.to_be_bytes());
    output.extend_from_slice(&crc.to_be_bytes());
    output.extend_from_slice(&compressed);

    Ok(output)
}

/// Unpack an OpenMDL Extension (.mdlx) binary package into a JSON string.
pub fn unpack_mdlx(bytes: &[u8]) -> Result<String, String> {
    // If it's legacy JSON text starting with '{', gracefully decode as string
    if bytes.starts_with(b"{") {
        return String::from_utf8(bytes.to_vec())
            .map_err(|e| format!("Encodage UTF-8 invalide: {}", e));
    }

    if bytes.len() < 20 {
        return Err("Fichier addon trop court ou corrompu (en-tete manquant)".to_string());
    }

    if &bytes[0..4] != MDLX_MAGIC {
        return Err("Format invalide: signature binaire OpenMDL (MDLX) manquante".to_string());
    }

    let version = u16::from_be_bytes([bytes[4], bytes[5]]);
    if version != FORMAT_VERSION {
        return Err(format!("Version de format .mdlx non supportee: v{}", version));
    }

    let _flags = u16::from_be_bytes([bytes[6], bytes[7]]);
    let uncompressed_len = u32::from_be_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;
    let compressed_len = u32::from_be_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]) as usize;
    let expected_crc = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);

    let payload = &bytes[20..];
    if payload.len() < compressed_len {
        return Err("Payload tronque ou donnees manquantes".to_string());
    }

    let mut decoder = ZlibDecoder::new(&payload[..compressed_len]);
    let mut decompressed = Vec::with_capacity(uncompressed_len);
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| format!("Erreur de decompression zlib: {}", e))?;

    if decompressed.len() != uncompressed_len {
        return Err("Incoherence de taille apres decompression".to_string());
    }

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&decompressed);
    let actual_crc = hasher.finalize();

    if actual_crc != expected_crc {
        return Err(format!(
            "Echec de verification d'integrite (CRC mismatch: 0x{:08X} != 0x{:08X})",
            actual_crc, expected_crc
        ));
    }

    String::from_utf8(decompressed).map_err(|e| format!("Contenu non UTF-8: {}", e))
}

/// Pack a database backup JSON string into an OpenMDL Binary Backup (.mdlb).
pub fn pack_mdlb(json_str: &str) -> Result<Vec<u8>, String> {
    let uncompressed = json_str.as_bytes();
    let uncompressed_len = uncompressed.len() as u32;

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
    encoder
        .write_all(uncompressed)
        .map_err(|e| format!("Erreur de compression backup: {}", e))?;
    let compressed = encoder
        .finish()
        .map_err(|e| format!("Erreur finalisation compression backup: {}", e))?;
    let compressed_len = compressed.len() as u32;

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(uncompressed);
    let crc = hasher.finalize();

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // 28-byte header:
    // [0..4]   Magic: b"MDLB"
    // [4..6]   Version: u16 (BE)
    // [6..8]   Flags: u16 (BE)
    // [8..16]  Timestamp: u64 (BE)
    // [16..20] Uncompressed length: u32 (BE)
    // [20..24] Compressed length: u32 (BE)
    // [24..28] Checksum CRC32: u32 (BE)
    let mut output = Vec::with_capacity(28 + compressed.len());
    output.extend_from_slice(MDLB_MAGIC);
    output.extend_from_slice(&FORMAT_VERSION.to_be_bytes());
    output.extend_from_slice(&0u16.to_be_bytes());
    output.extend_from_slice(&timestamp.to_be_bytes());
    output.extend_from_slice(&uncompressed_len.to_be_bytes());
    output.extend_from_slice(&compressed_len.to_be_bytes());
    output.extend_from_slice(&crc.to_be_bytes());
    output.extend_from_slice(&compressed);

    Ok(output)
}

/// Unpack an OpenMDL Binary Backup (.mdlb) into a JSON string.
pub fn unpack_mdlb(bytes: &[u8]) -> Result<String, String> {
    // If it's legacy JSON text starting with '{', gracefully decode as string
    if bytes.starts_with(b"{") {
        return String::from_utf8(bytes.to_vec())
            .map_err(|e| format!("Encodage UTF-8 invalide: {}", e));
    }

    if bytes.len() < 28 {
        return Err("Fichier de sauvegarde trop court (en-tete MDLB manquant)".to_string());
    }

    if &bytes[0..4] != MDLB_MAGIC {
        return Err("Format invalide: signature binaire OpenMDL (MDLB) manquante".to_string());
    }

    let version = u16::from_be_bytes([bytes[4], bytes[5]]);
    if version != FORMAT_VERSION {
        return Err(format!("Version de format .mdlb non supportee: v{}", version));
    }

    let _flags = u16::from_be_bytes([bytes[6], bytes[7]]);
    let _timestamp = u64::from_be_bytes([
        bytes[8], bytes[9], bytes[10], bytes[11],
        bytes[12], bytes[13], bytes[14], bytes[15],
    ]);
    let uncompressed_len = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]) as usize;
    let compressed_len = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]) as usize;
    let expected_crc = u32::from_be_bytes([bytes[24], bytes[25], bytes[26], bytes[27]]);

    let payload = &bytes[28..];
    if payload.len() < compressed_len {
        return Err("Payload backup tronque ou donnees manquantes".to_string());
    }

    let mut decoder = ZlibDecoder::new(&payload[..compressed_len]);
    let mut decompressed = Vec::with_capacity(uncompressed_len);
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| format!("Erreur de decompression backup: {}", e))?;

    if decompressed.len() != uncompressed_len {
        return Err("Incoherence de taille apres decompression du backup".to_string());
    }

    let mut hasher = crc32fast::Hasher::new();
    hasher.update(&decompressed);
    let actual_crc = hasher.finalize();

    if actual_crc != expected_crc {
        return Err(format!(
            "Echec de verification d'integrite backup (CRC mismatch: 0x{:08X} != 0x{:08X})",
            actual_crc, expected_crc
        ));
    }

    String::from_utf8(decompressed).map_err(|e| format!("Contenu non UTF-8: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_unpack_mdlx() {
        let sample = r#"{"manifest":{"id":"test-addon","name":"Test"},"files":[]}"#;
        let packed = pack_mdlx(sample).expect("pack failed");
        assert_eq!(&packed[0..4], b"MDLX");
        let unpacked = unpack_mdlx(&packed).expect("unpack failed");
        assert_eq!(unpacked, sample);
    }

    #[test]
    fn test_pack_unpack_mdlb() {
        let sample = r#"{"version":"1.0.6","products":[],"sales":[]}"#;
        let packed = pack_mdlb(sample).expect("pack backup failed");
        assert_eq!(&packed[0..4], b"MDLB");
        let unpacked = unpack_mdlb(&packed).expect("unpack backup failed");
        assert_eq!(unpacked, sample);
    }

    #[test]
    fn test_unpack_legacy_json() {
        let sample = r#"{"legacy":true}"#;
        let unpacked = unpack_mdlx(sample.as_bytes()).expect("unpack legacy json failed");
        assert_eq!(unpacked, sample);
        let unpacked_b = unpack_mdlb(sample.as_bytes()).expect("unpack legacy json backup failed");
        assert_eq!(unpacked_b, sample);
    }
}
