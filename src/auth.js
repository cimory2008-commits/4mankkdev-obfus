// ============================================
// src/auth.js
// Modul autentikasi: login, verifyToken, authMiddleware
// ============================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'mankk_token';

if (!JWT_SECRET || JWT_SECRET.includes('GANTI_INI')) {
  console.warn('[PERINGATAN] JWT_SECRET belum diganti dari default! Segera ganti di .env');
}

// Hash password admin sekali saat startup (disimpan di memori, bukan ditulis ulang ke .env)
let hashedAdminPassword = null;

function initAuth() {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD belum diset di .env!');
  }
  const salt = bcrypt.genSaltSync(10);
  hashedAdminPassword = bcrypt.hashSync(ADMIN_PASSWORD, salt);
  console.log('[AUTH] Password admin berhasil di-hash saat startup.');
}

/**
 * Verifikasi kredensial login
 */
function verifyCredentials(username, password) {
  if (!hashedAdminPassword) {
    throw new Error('Auth belum diinisialisasi. Panggil initAuth() dulu.');
  }
  if (username !== ADMIN_USERNAME) {
    return false;
  }
  return bcrypt.compareSync(password, hashedAdminPassword);
}

/**
 * Generate JWT token untuk user yang berhasil login
 */
function generateToken(username) {
  return jwt.sign({ username, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verifikasi JWT token, return payload atau null kalau invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware: cek httpOnly cookie, kalau valid lanjut, kalau tidak return 401
 */
function authMiddleware(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token) {
    return res.status(401).json({ error: 'Belum login. Silakan login terlebih dahulu.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesi tidak valid atau sudah expired. Silakan login ulang.' });
  }

  req.user = payload;
  next();
}

/**
 * Opsi cookie yang aman untuk set JWT
 */
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam ms
    path: '/',
  };
}

module.exports = {
  initAuth,
  verifyCredentials,
  generateToken,
  verifyToken,
  authMiddleware,
  getCookieOptions,
  COOKIE_NAME,
};
