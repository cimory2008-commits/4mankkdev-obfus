// ============================================
// src/obfuscate.js
// Modul obfuscation: minify -> gzip -> AES-256-GCM -> bungkus Lua loader
// ============================================

const crypto = require('crypto');
const zlib = require('zlib');

const MASTER_SECRET = process.env.MASTER_SECRET;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bit
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM standar pakai 12 byte
const CHUNK_SIZE = 80;

if (!MASTER_SECRET || MASTER_SECRET.includes('GANTI_INI')) {
  console.warn('[PERINGATAN] MASTER_SECRET belum diganti dari default! Segera ganti di .env');
}

/**
 * Minify source Lua sederhana:
 * - Hapus komentar blok --[[ ... ]]
 * - Hapus komentar baris -- ... (hati-hati jangan kena string literal, pakai pendekatan line-based aman)
 * - Hapus baris kosong & trim whitespace berlebih
 */
function minifyLua(source) {
  // Hapus komentar blok --[[ ... ]] (non-greedy, termasuk multiline)
  let code = source.replace(/--\[\[[\s\S]*?\]\]/g, '');

  const lines = code.split('\n');
  const resultLines = [];

  for (let line of lines) {
    let inString = false;
    let stringChar = '';
    let cleanLine = '';
    let i = 0;

    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];

      // Deteksi mulai/akhir string literal supaya komentar di dalam string tidak terhapus
      if (!inString && (ch === '"' || ch === "'")) {
        inString = true;
        stringChar = ch;
        cleanLine += ch;
        i++;
        continue;
      }
      if (inString && ch === stringChar && line[i - 1] !== '\\') {
        inString = false;
        cleanLine += ch;
        i++;
        continue;
      }

      // Kalau ketemu komentar baris -- di luar string, potong sisa baris
      if (!inString && ch === '-' && next === '-') {
        break;
      }

      cleanLine += ch;
      i++;
    }

    const trimmed = cleanLine.replace(/\s+$/g, '').replace(/^\s+/, (m) => (m.length > 0 ? ' ' : ''));
    if (trimmed.trim().length > 0) {
      resultLines.push(trimmed.trim());
    }
  }

  return resultLines.join('\n');
}

/**
 * Derive key AES dari MASTER_SECRET + salt pakai PBKDF2-SHA256
 */
function deriveKey(salt) {
  return crypto.pbkdf2Sync(MASTER_SECRET, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Pecah string base64 jadi chunks sepanjang CHUNK_SIZE karakter
 */
function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bungkus payload terenkripsi jadi Lua loader yang tidak bisa jalan standalone
 */
function wrapLuaLoader(base64Payload, metadata) {
  const chunks = chunkString(base64Payload, CHUNK_SIZE);
  const chunksLua = chunks.map((c) => `  "${c}"`).join(',\n');

  const timestamp = new Date().toISOString();

  return `--[[
  ============================================
  4MankkDev Obfus Generator
  Script ini dilindungi enkripsi AES-256-GCM.
  Dibuat: ${timestamp}
  Ukuran asli: ${metadata.originalSize} bytes
  ============================================
  Script ini TIDAK BISA dijalankan secara standalone.
  Dekripsi hanya bisa dilakukan lewat server 4MankkDev Obfus Generator
  yang memegang MASTER_SECRET. Jangan coba decode manual, chunks di bawah
  terenkripsi AES-256-GCM dengan key hasil derivasi PBKDF2 (100000 iterasi).
]]

local _4mankk_chunks = {
${chunksLua}
}

local function _4mankk_protected_error()
  error("[4MankkDev Obfus] Script ini terenkripsi dan hanya bisa dijalankan setelah " ..
        "didekripsi melalui server 4MankkDev Obfus Generator. Silakan hubungi pemilik tools.", 0)
end

return _4mankk_protected_error()
`;
}

/**
 * Fungsi utama: obfuscate(source) -> { obfuscated, metadata }
 */
function obfuscate(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error('Source Lua kosong atau tidak valid');
  }

  const MAX_SIZE = 500 * 1024; // 500 KB
  const originalSize = Buffer.byteLength(source, 'utf8');
  if (originalSize > MAX_SIZE) {
    throw new Error(`Source terlalu besar (${originalSize} bytes). Maksimal 500KB.`);
  }

  // 1. Minify
  const minified = minifyLua(source);
  const minifiedSize = Buffer.byteLength(minified, 'utf8');

  // 2. Compress gzip
  const compressed = zlib.gzipSync(Buffer.from(minified, 'utf8'));

  // 3. Generate salt + IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // 4. Derive key
  const key = deriveKey(salt);

  // 5. Encrypt AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 6. Gabung: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, ciphertext]);

  // 7. Encode base64
  const base64Payload = combined.toString('base64');
  const encryptedSize = Buffer.byteLength(base64Payload, 'utf8');

  const metadata = {
    originalSize,
    minifiedSize,
    encryptedSize,
    compressedRatio: ((1 - minifiedSize / originalSize) * 100).toFixed(1),
  };

  // 8-10. Bungkus jadi Lua loader dengan chunks
  const obfuscatedCode = wrapLuaLoader(base64Payload, metadata);

  return { obfuscated: obfuscatedCode, metadata };
}

module.exports = { obfuscate, minifyLua, deriveKey, PBKDF2_ITERATIONS, SALT_LENGTH, IV_LENGTH };
