// ============================================
// src/deobfuscate.js
// Modul deobfuscation (SERVER-SIDE ONLY): extract chunks -> AES decrypt -> gunzip
// ============================================

const crypto = require('crypto');
const zlib = require('zlib');
const { deriveKey, SALT_LENGTH, IV_LENGTH } = require('./obfuscate');

/**
 * Ekstrak semua string chunk dari dalam table Lua "_4mankk_chunks = { ... }"
 */
function extractChunks(obfuscatedCode) {
  const tableMatch = obfuscatedCode.match(/_4mankk_chunks\s*=\s*\{([\s\S]*?)\}/);
  if (!tableMatch) {
    throw new Error('Format tidak valid: tidak ditemukan blok _4mankk_chunks. Pastikan ini hasil dari 4MankkDev Obfus Generator.');
  }

  const tableBody = tableMatch[1];
  const stringMatches = [...tableBody.matchAll(/"([^"]*)"/g)];

  if (stringMatches.length === 0) {
    throw new Error('Format tidak valid: tidak ada chunk data yang ditemukan.');
  }

  return stringMatches.map((m) => m[1]).join('');
}

/**
 * Fungsi utama: deobfuscate(obfuscatedCode) -> source asli
 */
function deobfuscate(obfuscatedCode) {
  if (typeof obfuscatedCode !== 'string' || obfuscatedCode.trim().length === 0) {
    throw new Error('Kode obfuscated kosong atau tidak valid');
  }

  // 1. Extract base64 payload dari chunks
  const base64Payload = extractChunks(obfuscatedCode);

  let combined;
  try {
    combined = Buffer.from(base64Payload, 'base64');
  } catch (err) {
    throw new Error('Gagal decode base64 payload. Kode mungkin corrupt.');
  }

  const minLength = SALT_LENGTH + IV_LENGTH + 16; // 16 = authTag length
  if (combined.length < minLength) {
    throw new Error('Payload terlalu pendek, kemungkinan corrupt atau bukan hasil dari tools ini.');
  }

  // 2. Pecah ulang: salt + iv + authTag + ciphertext
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + 16);

  // 3. Derive key yang sama persis (MASTER_SECRET + salt)
  const key = deriveKey(salt);

  // 4. Decrypt AES-256-GCM
  let decrypted;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error('Gagal dekripsi. Kode corrupt, diubah manual, atau bukan hasil dari 4MankkDev Obfus Generator ini.');
  }

  // 5. Decompress gzip
  let decompressed;
  try {
    decompressed = zlib.gunzipSync(decrypted);
  } catch (err) {
    throw new Error('Gagal dekompresi gzip. Data hasil dekripsi corrupt.');
  }

  return decompressed.toString('utf8');
}

module.exports = { deobfuscate, extractChunks };
