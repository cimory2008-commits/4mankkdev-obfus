// ============================================
// public/app.js
// Logic frontend: login, tabs, API call, copy, download
// ============================================

(function () {
  'use strict';

  // ----- Elemen DOM -----
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const userInfo = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Obfuscate elements
  const obfInput = document.getElementById('obfInput');
  const obfOutput = document.getElementById('obfOutput');
  const obfInputSize = document.getElementById('obfInputSize');
  const obfOutputSize = document.getElementById('obfOutputSize');
  const obfGenerateBtn = document.getElementById('obfGenerateBtn');
  const obfCopyBtn = document.getElementById('obfCopyBtn');
  const obfDownloadBtn = document.getElementById('obfDownloadBtn');
  const obfClearBtn = document.getElementById('obfClearBtn');
  const obfMeta = document.getElementById('obfMeta');
  const obfStatus = document.getElementById('obfStatus');
  const metaOriginal = document.getElementById('metaOriginal');
  const metaMinified = document.getElementById('metaMinified');
  const metaEncrypted = document.getElementById('metaEncrypted');
  const metaRatio = document.getElementById('metaRatio');

  // Deobfuscate elements
  const deobfInput = document.getElementById('deobfInput');
  const deobfOutput = document.getElementById('deobfOutput');
  const deobfInputSize = document.getElementById('deobfInputSize');
  const deobfOutputSize = document.getElementById('deobfOutputSize');
  const deobfGenerateBtn = document.getElementById('deobfGenerateBtn');
  const deobfCopyBtn = document.getElementById('deobfCopyBtn');
  const deobfDownloadBtn = document.getElementById('deobfDownloadBtn');
  const deobfClearBtn = document.getElementById('deobfClearBtn');
  const deobfStatus = document.getElementById('deobfStatus');

  // ----- Helper -----
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function byteLength(str) {
    return new Blob([str]).size;
  }

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = 'status-msg ' + type;
    el.classList.remove('hidden');
  }

  function hideStatus(el) {
    el.classList.add('hidden');
  }

  async function apiCall(url, options) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request gagal (${res.status})`);
    }
    return data;
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback untuk browser lama
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  }

  // ----- Auth: cek sesi saat load -----
  async function checkSession() {
    try {
      const data = await apiCall('/api/me');
      showMainApp(data.username);
    } catch (err) {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
  }

  function showMainApp(username) {
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    userInfo.textContent = username;
  }

  // ----- Login -----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus(loginError);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    loginBtn.disabled = true;
    loginBtn.textContent = 'MEMPROSES...';

    try {
      const data = await apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      loginForm.reset();
      showMainApp(data.username);
    } catch (err) {
      showStatus(loginError, err.message, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'MASUK';
    }
  });

  // ----- Logout -----
  logoutBtn.addEventListener('click', async () => {
    try {
      await apiCall('/api/logout', { method: 'POST' });
    } catch (err) {
      // Abaikan error logout, tetap tampilkan login screen
    }
    showLoginScreen();
  });

  // ----- Tabs -----
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    });
  });

  // ----- Obfuscate: update size counter -----
  obfInput.addEventListener('input', () => {
    obfInputSize.textContent = formatBytes(byteLength(obfInput.value));
  });

  // ----- Obfuscate: generate -----
  obfGenerateBtn.addEventListener('click', async () => {
    hideStatus(obfStatus);
    obfMeta.classList.add('hidden');

    const source = obfInput.value;
    if (!source.trim()) {
      showStatus(obfStatus, 'Source Lua tidak boleh kosong.', 'error');
      return;
    }

    obfGenerateBtn.disabled = true;
    obfGenerateBtn.textContent = '⏳ MEMPROSES...';

    try {
      const data = await apiCall('/api/obfuscate', {
        method: 'POST',
        body: JSON.stringify({ source }),
      });

      obfOutput.value = data.obfuscated;
      obfOutputSize.textContent = formatBytes(byteLength(data.obfuscated));

      metaOriginal.textContent = formatBytes(data.metadata.originalSize);
      metaMinified.textContent = formatBytes(data.metadata.minifiedSize);
      metaEncrypted.textContent = formatBytes(data.metadata.encryptedSize);
      metaRatio.textContent = data.metadata.compressedRatio + '%';
      obfMeta.classList.remove('hidden');

      showStatus(obfStatus, '✅ Berhasil di-obfuscate!', 'success');
    } catch (err) {
      showStatus(obfStatus, '❌ ' + err.message, 'error');
    } finally {
      obfGenerateBtn.disabled = false;
      obfGenerateBtn.textContent = '⚡ GENERATE';
    }
  });

  obfCopyBtn.addEventListener('click', async () => {
    if (!obfOutput.value) {
      showStatus(obfStatus, 'Tidak ada hasil untuk di-copy.', 'error');
      return;
    }
    await copyToClipboard(obfOutput.value);
    showStatus(obfStatus, '📋 Hasil berhasil di-copy ke clipboard!', 'success');
  });

  obfDownloadBtn.addEventListener('click', () => {
    if (!obfOutput.value) {
      showStatus(obfStatus, 'Tidak ada hasil untuk didownload.', 'error');
      return;
    }
    downloadFile('obfuscated_4mankk.lua', obfOutput.value);
  });

  obfClearBtn.addEventListener('click', () => {
    obfInput.value = '';
    obfOutput.value = '';
    obfInputSize.textContent = '0 bytes';
    obfOutputSize.textContent = '0 bytes';
    obfMeta.classList.add('hidden');
    hideStatus(obfStatus);
  });

  // ----- Deobfuscate: update size counter -----
  deobfInput.addEventListener('input', () => {
    deobfInputSize.textContent = formatBytes(byteLength(deobfInput.value));
  });

  // ----- Deobfuscate: generate -----
  deobfGenerateBtn.addEventListener('click', async () => {
    hideStatus(deobfStatus);

    const code = deobfInput.value;
    if (!code.trim()) {
      showStatus(deobfStatus, 'Kode obfuscated tidak boleh kosong.', 'error');
      return;
    }

    deobfGenerateBtn.disabled = true;
    deobfGenerateBtn.textContent = '⏳ MEMPROSES...';

    try {
      const data = await apiCall('/api/deobfuscate', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      deobfOutput.value = data.source;
      deobfOutputSize.textContent = formatBytes(byteLength(data.source));

      showStatus(deobfStatus, '✅ Berhasil di-decode!', 'success');
    } catch (err) {
      showStatus(deobfStatus, '❌ ' + err.message, 'error');
    } finally {
      deobfGenerateBtn.disabled = false;
      deobfGenerateBtn.textContent = '⚡ DECODE';
    }
  });

  deobfCopyBtn.addEventListener('click', async () => {
    if (!deobfOutput.value) {
      showStatus(deobfStatus, 'Tidak ada hasil untuk di-copy.', 'error');
      return;
    }
    await copyToClipboard(deobfOutput.value);
    showStatus(deobfStatus, '📋 Hasil berhasil di-copy ke clipboard!', 'success');
  });

  deobfDownloadBtn.addEventListener('click', () => {
    if (!deobfOutput.value) {
      showStatus(deobfStatus, 'Tidak ada hasil untuk didownload.', 'error');
      return;
    }
    downloadFile('deobfuscated_4mankk.lua', deobfOutput.value);
  });

  deobfClearBtn.addEventListener('click', () => {
    deobfInput.value = '';
    deobfOutput.value = '';
    deobfInputSize.textContent = '0 bytes';
    deobfOutputSize.textContent = '0 bytes';
    hideStatus(deobfStatus);
  });

  // ----- Init -----
  checkSession();
})();
