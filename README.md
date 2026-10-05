# 4MankkDev Obfus Generator

Tools obfuscator & deobfuscator script Lua pribadi, full-stack (Node.js + Express + Vanilla JS), tema **Black & Gold**.

Fitur:
- 🔒 **Obfuscate**: minify → gzip → AES-256-GCM (key via PBKDF2 100.000 iterasi) → bungkus jadi Lua loader yang tidak bisa jalan standalone.
- 🔓 **Deobfuscate**: 100% dilakukan di server (butuh login), tidak pernah expose `MASTER_SECRET` ke client.
- 🔑 Single admin login (JWT di httpOnly cookie, password di-hash bcrypt).
- 🛡️ Rate limiting, Helmet (CSP), input validation.

---

## 1. Instalasi Lokal

### Prasyarat
- Node.js versi 18 ke atas
- npm

### Langkah

```bash
# 1. Masuk ke folder project
cd 4mankkdev-obfus

# 2. Install dependencies
npm install

# 3. Konfigurasi .env (WAJIB, lihat bagian 2 di bawah)

# 4. Jalankan server
npm start
```

Server akan jalan di `http://localhost:3000` (atau sesuai `PORT` di `.env`).

---

## 2. Konfigurasi `.env` (WAJIB DIGANTI!)

Buka file `.env` dan **ganti semua nilai default**, jangan ada yang dibiarkan sama seperti contoh:

```env
PORT=3000
MASTER_SECRET=ganti_dengan_string_random_panjang_minimal_32_karakter
ADMIN_USERNAME=username_kamu
ADMIN_PASSWORD=password_kuat_kamu
JWT_SECRET=ganti_dengan_string_random_lain_yang_berbeda_dari_master_secret
NODE_ENV=production
```

### Cara generate string random yang aman

Jalankan ini di terminal (butuh Node.js):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Jalankan **dua kali** — satu buat `MASTER_SECRET`, satu lagi buat `JWT_SECRET`. **Jangan pernah pakai nilai yang sama untuk keduanya.**

> ⚠️ **PENTING**: `MASTER_SECRET` adalah kunci utama enkripsi. Kalau diganti setelah kamu sudah punya script yang di-obfuscate, script lama **tidak akan bisa di-deobfuscate lagi**. Simpan baik-baik dan backup di tempat aman (password manager, dsb), jangan hanya di `.env` server.

---

## 3. Mengganti Password Admin

Cukup ubah nilai `ADMIN_PASSWORD` di `.env`, lalu restart server. Password di-hash otomatis pakai bcrypt saat server start — kamu tidak perlu hash manual.

---

## 4. Mengganti Logo

1. Siapkan file logo kamu (disarankan format PNG transparan, ukuran lebar sekitar 200-900px).
2. Rename jadi `logo.png`.
3. Replace file `public/logo.png` dengan file logo kamu.
4. Logo otomatis dipakai di halaman login dan topbar — tidak perlu ubah kode HTML/CSS.

Kalau mau pakai nama file berbeda, cari dan ganti semua `src="logo.png"` di `public/index.html` dan `href="logo.png"` di bagian favicon.

---

## 5. Deploy ke Vercel

Project ini sudah dilengkapi `vercel.json` supaya bisa jalan sebagai serverless function di Vercel.

### Langkah deploy

```bash
# 1. Install Vercel CLI (kalau belum ada)
npm install -g vercel

# 2. Login ke akun Vercel
vercel login

# 3. Deploy dari folder project
cd 4mankkdev-obfus
vercel
```

### Set Environment Variables di Vercel

**JANGAN** upload file `.env` ke Vercel/Git. Set environment variables langsung lewat dashboard Vercel atau CLI:

**Lewat Dashboard:**
1. Buka project di [vercel.com/dashboard](https://vercel.com/dashboard)
2. Masuk ke tab **Settings → Environment Variables**
3. Tambahkan satu per satu: `MASTER_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`
4. Redeploy project

**Lewat CLI:**
```bash
vercel env add MASTER_SECRET
vercel env add ADMIN_USERNAME
vercel env add ADMIN_PASSWORD
vercel env add JWT_SECRET
vercel env add NODE_ENV
```

Lalu deploy ulang ke production:
```bash
vercel --prod
```

### Catatan soal Vercel
- Vercel menjalankan `server.js` sebagai serverless function (bukan proses `node` yang terus menyala), jadi konsol ASCII box saat startup hanya muncul di log cold-start, itu normal.
- Rate limiter (`express-rate-limit`) berbasis memory per-instance — di lingkungan serverless dengan banyak instance, limit efektif bisa sedikit lebih longgar dibanding server tradisional. Untuk penggunaan pribadi ini biasanya tidak masalah.
- Cookie `secure: true` otomatis aktif saat `NODE_ENV=production`, jadi pastikan akses selalu lewat HTTPS (Vercel otomatis HTTPS).

---

## 6. Cara Pakai

1. Buka web, login pakai `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
2. Tab **🔒 Obfuscate**: paste source Lua di kolom kiri, klik **GENERATE**, hasil muncul di kolom kanan. Bisa di-copy atau download `.lua`.
3. Tab **🔓 Deobfuscate**: paste kode hasil obfuscate dari tools ini, klik **DECODE**, source asli muncul kembali. Hanya bisa dilakukan setelah login karena proses dekripsi 100% di server.

---

## 7. Struktur Project

```
4mankkdev-obfus/
├── package.json
├── .env                  # JANGAN di-commit ke git!
├── .gitignore
├── server.js              # Entry point Express
├── vercel.json             # Konfigurasi deploy Vercel
├── README.md
├── src/
│   ├── auth.js             # Login, JWT, bcrypt
│   ├── obfuscate.js        # Minify + gzip + AES-256-GCM + Lua loader
│   └── deobfuscate.js      # Extract + decrypt + gunzip
└── public/
    ├── index.html
    ├── style.css
    ├── app.js
    └── logo.png             # Logo 4MankkDev
```

---

## 8. Keamanan

- `MASTER_SECRET` **tidak pernah** dikirim ke client — seluruh proses dekripsi terjadi di server.
- Password admin di-hash pakai bcrypt (salt 10 rounds), bukan disimpan plaintext.
- JWT disimpan di httpOnly cookie (`SameSite=strict`, `secure` saat production), tidak bisa diakses lewat JavaScript di browser — mencegah XSS mencuri token.
- Rate limiting 30 request/menit untuk semua endpoint `/api/`, dan limit lebih ketat (10 percobaan/15 menit) khusus `/api/login` untuk mencegah brute force.
- Helmet mengaktifkan Content-Security-Policy ketat, tidak ada resource dari CDN eksternal.
- Semua input divalidasi tipe dan ukurannya (`source` Lua max 500KB) sebelum diproses.

---

## 9. Troubleshooting

**Server tidak mau start, error "Environment variable belum diset"**
→ Pastikan semua variabel wajib (`MASTER_SECRET`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`) sudah diisi di `.env` (lokal) atau Environment Variables (Vercel).

**Deobfuscate selalu gagal dengan "Gagal dekripsi"**
→ Pastikan `MASTER_SECRET` yang dipakai sama persis dengan yang dipakai waktu obfuscate. Kalau secret pernah diganti, script lama tidak akan bisa didekripsi lagi.

**Lupa password admin**
→ Ubah `ADMIN_PASSWORD` di `.env` / Environment Variables, lalu restart/redeploy server.

---

© 2025 4MankkDev — Obfus Generator Pribadi
