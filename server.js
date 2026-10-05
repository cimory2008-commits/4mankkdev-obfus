// ============================================
// server.js
// 4MankkDev Obfus Generator - Entry point utama
// ============================================

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const {
  initAuth,
  verifyCredentials,
  generateToken,
  authMiddleware,
  getCookieOptions,
  COOKIE_NAME,
} = require('./src/auth');
const { obfuscate } = require('./src/obfuscate');
const { deobfuscate } = require('./src/deobfuscate');

const app = express();
const PORT = process.env.PORT || 3000;

// Validasi env wajib sebelum start
const requiredEnv = ['MASTER_SECRET', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[FATAL] Environment variable belum diset: ${missingEnv.join(', ')}`);
  console.error('Silakan isi file .env terlebih dahulu. Lihat README.md.');
  process.exit(1);
}

// Inisialisasi auth (hash password admin)
initAuth();

// ============================================
// Middleware
// ============================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: '2mb' })); // max body size, cukup untuk source Lua 500KB + overhead base64
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter: 30 request/menit per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
});

app.use('/api/', apiLimiter);

// Rate limiter khusus login lebih ketat (anti brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

// ============================================
// Routes - Auth
// ============================================

app.post('/api/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const isValid = verifyCredentials(username, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const token = generateToken(username);
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({ success: true, username });
  } catch (err) {
    console.error('[ERROR /api/login]', err.message);
    return res.status(500).json({ error: 'Terjadi kesalahan server saat login.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  return res.json({ username: req.user.username });
});

// ============================================
// Routes - Obfuscate / Deobfuscate (butuh auth)
// ============================================

app.post('/api/obfuscate', authMiddleware, (req, res) => {
  try {
    const { source } = req.body;

    if (!source || typeof source !== 'string') {
      return res.status(400).json({ error: 'Field "source" wajib diisi dengan string.' });
    }

    const result = obfuscate(source);
    return res.json({ success: true, obfuscated: result.obfuscated, metadata: result.metadata });
  } catch (err) {
    console.error('[ERROR /api/obfuscate]', err.message);
    return res.status(400).json({ error: err.message || 'Gagal melakukan obfuscate.' });
  }
});

app.post('/api/deobfuscate', authMiddleware, (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Field "code" wajib diisi dengan string.' });
    }

    const source = deobfuscate(code);
    return res.json({ success: true, source });
  } catch (err) {
    console.error('[ERROR /api/deobfuscate]', err.message);
    return res.status(400).json({ error: err.message || 'Gagal melakukan deobfuscate.' });
  }
});

// ============================================
// Fallback: serve index.html untuk root
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler untuk API
app.use('/api/', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

// Error handler terakhir
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'Terjadi kesalahan internal server.' });
});

// ============================================
// Start server (skip listen kalau di-import Vercel serverless)
// ============================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                     ║
║        4MANKK DEV — Obfus Generator Pribadi        ║
║                                                     ║
╠═══════════════════════════════════════════════════╣
║                                                     ║
║   Status   : ONLINE                                ║
║   Port     : ${String(PORT).padEnd(39)}║
║   Mode     : ${String(process.env.NODE_ENV || 'development').padEnd(39)}║
║   URL      : http://localhost:${String(PORT).padEnd(21)}║
║                                                     ║
║   Auth     : Single admin (lihat .env)             ║
║   Crypto   : AES-256-GCM + PBKDF2 (100k iterasi)   ║
║                                                     ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
