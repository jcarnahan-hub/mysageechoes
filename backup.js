// ── AURELIA ECHOES: Backup & Restore System ──

const LAST_BACKUP_KEY = 'ae-last-backup';

// ── OPEN / CLOSE MODAL ──
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('backupOverlay');

  document.getElementById('openBackupBtn')?.addEventListener('click', () => {
    updateLastBackupLabel();
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
  });

  document.getElementById('closeBackupBtn')?.addEventListener('click', () => {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  });

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
    }
  });

  document.getElementById('exportBackupBtn')?.addEventListener('click', exportBackup);

  const restoreInput = document.getElementById('restoreFileInput');
  const restoreLabel = document.querySelector('label[for="restoreFileInput"]');
  restoreInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && restoreLabel) restoreLabel.textContent = `📂 ${file.name}`;
  });

  document.getElementById('runRestoreBtn')?.addEventListener('click', restoreBackup);
});

// ── UPDATE LAST BACKUP LABEL ──
function updateLastBackupLabel() {
  const label = document.getElementById('lastBackupLabel');
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  if (label) {
    label.textContent = last
      ? `Last backup: ${new Date(last).toLocaleString()}`
      : 'Last backup: Never';
  }
}

// ── BACKUP TOAST (self-contained so backup.js needs no other file) ──
function backupToast(message, type = 'info') {
  const existing = document.getElementById('ae-toast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#2D6A4F', text: '#D8F3DC' },
    error:   { bg: '#7B2D2D', text: '#FFE0E0' },
    warning: { bg: '#7B6B2D', text: '#FFF8DC' },
    info:    { bg: 'var(--bg-card)', text: 'var(--text-primary)' }
  };
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'ae-toast';
  toast.style.cssText = `
    position: fixed; bottom: 90px; right: 24px;
    background: ${c.bg}; color: ${c.text};
    padding: 12px 18px; border-radius: 12px;
    font-size: 0.88rem; font-family: sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 9999; max-width: 320px;
    border: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── GET ALL BOOKS (safe wrapper) ──
async function backupGetAllBooks() {
  if (typeof getAllBooks === 'function') return await getAllBooks();
  return [];
}

// ── GET ALL LOGS (safe wrapper) ──
async function backupGetAllLogs() {
  if (typeof getAllLogs === 'function') return await getAllLogs();
  return [];
}

// ── SAVE LOG (safe wrapper) ──
function backupSaveLog(message) {
  if (typeof saveLog === 'function') saveLog(message);
}

// ── EXPORT BACKUP ──
async function exportBackup() {
  try {
    backupToast('Preparing your backup...', 'info');

    const books = await backupGetAllBooks();
    const logs = await backupGetAllLogs();
    const theme = localStorage.getItem('ae-theme') || 'light';

    const backup = {
      version: '1.0',
      appName: 'AureliaEchoes',
      exportDate: new Date().toISOString(),
      totalBooks: books.length,
      data: { books, logs, settings: { theme } }
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];

    const a = document.createElement('a');
    a.href = url;
    a.download = `AureliaEchoes_Backup_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, now);
    updateLastBackupLabel();

    backupSaveLog(`Backup exported: ${books.length} books saved to file`);
    backupToast(`Backup complete! ${books.length} books exported.`, 'success');

  } catch (err) {
    backupToast('Backup failed. Please try again.', 'error');
    backupSaveLog(`BACKUP ERROR: ${err.message}`);
    console.error('Backup error:', err);
  }
}

// ── RESTORE BACKUP ──
async function restoreBackup() {
  const fileInput = document.getElementById('restoreFileInput');
  const resultBox = document.getElementById('restoreResult');

  if (!fileInput?.files[0]) {
    backupToast('Please choose a backup file first.', 'warning');
    return;
  }

  try {
    backupToast('Reading backup file...', 'info');
    const text = await fileInput.files[0].text();
    const backup = JSON.parse(text);

    if (!backup.appName || backup.appName !== 'AureliaEchoes') {
      backupToast('This does not appear to be an Aurelia Echoes backup file.', 'error');
      return;
    }

    if (!backup.data?.books) {
      backupToast('Backup file appears to be empty or corrupted.', 'error');
      return;
    }

    const books = backup.data.books || [];
    backupToast(`Processing ${books.length} books...`, 'info');

    let added = 0, skipped = 0;

    for (const book of books) {
      try {
        if (typeof getBookById === 'function') {
          const existing = await getBookById(book.id);
          if (existing) { skipped++; continue; }
        }
        if (typeof upsertBook === 'function') {
          await upsertBook(book);
          added++;
        }
      } catch (e) {
        skipped++;
      }
    }

    if (backup.data.logs?.length > 0) {
      for (const log of backup.data.logs) {
        backupSaveLog(`[RESTORED] ${log.message}`);
      }
    }

    if (backup.data.settings?.theme && typeof applyTheme === 'function') {
      applyTheme(backup.data.settings.theme);
    }

    const resultMsg = `✅ ${added} books added · ⏭️ ${skipped} skipped (already exist)`;
    backupSaveLog(`Backup restored: ${resultMsg}`);

    if (resultBox) {
      resultBox.textContent = resultMsg;
      resultBox.classList.remove('hidden');
    }

    backupToast(`Restore complete! ${added} books added.`, 'success');

    if (typeof renderLibrary === 'function') renderLibrary();
    if (typeof renderSeries === 'function') renderSeries();

  } catch (err) {
    backupToast('Restore failed. Is this a valid backup file?', 'error');
    backupSaveLog(`RESTORE ERROR: ${err.message}`);
    console.error('Restore error:', err);
  }
}
