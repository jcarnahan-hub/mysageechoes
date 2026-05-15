// ── SAGEECHOES: Cloud Sync ──

const CLOUD_LAST_SYNC_KEY = 'ae-last-cloud-sync';

// ── SAVE TO CLOUD ──
async function cloudSave(books) {
  await authReady; // wait for Firebase to confirm auth state
  const user = getCurrentUser();
  if (!user) {
    console.warn('Cloud save skipped — no user signed in');
    return false;
  }

  try {
    const payload = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      totalBooks: books.length,
      books: books
    };

    await db.collection('users').doc(user.uid).collection('library').doc('data').set(payload);

    localStorage.setItem(CLOUD_LAST_SYNC_KEY, new Date().toISOString());
    updateCloudSyncLabel();
    console.log(`✅ Cloud save: ${books.length} books synced`);
    return true;
  } catch (err) {
    console.error('Cloud save error:', err);
    return false;
  }
}

// ── RESTORE FROM CLOUD ──
async function cloudRestore() {
  await authReady; // wait for Firebase to confirm auth state
  const user = getCurrentUser();
  if (!user) {
    backupToast('Sign in to restore from cloud.', 'warning');
    return;
  }

  try {
    backupToast('Restoring from cloud...', 'info');
    const doc = await db.collection('users').doc(user.uid).collection('library').doc('data').get();

    if (!doc.exists) {
      backupToast('No cloud backup found for your account.', 'warning');
      return;
    }

    const data = doc.data();
    const books = data.books || [];

    let added = 0, skipped = 0;
    for (const book of books) {
      try {
        const result = await upsertBook(book);
        if (result === 'added') added++;
        else skipped++;
      } catch (e) {
        skipped++;
      }
    }

    backupToast(`Cloud restore complete! ${added} books added, ${skipped} already existed.`, 'success');
    if (typeof saveLog === 'function') saveLog(`Cloud restore: ${added} added, ${skipped} skipped`);
    if (typeof renderLibrary === 'function') renderLibrary();
    if (typeof renderSeries === 'function') renderSeries();

  } catch (err) {
    backupToast('Cloud restore failed. Please try again.', 'error');
    console.error('Cloud restore error:', err);
  }
}

// ── UPDATE SYNC LABEL ──
function updateCloudSyncLabel() {
  const label = document.getElementById('cloudSyncLabel');
  const last = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
  if (label) {
    label.textContent = last
      ? `Last cloud sync: ${new Date(last).toLocaleString()}`
      : 'Never synced to cloud';
  }
}

// ── INJECT CLOUD UI INTO BACKUP MODAL ──
document.addEventListener('DOMContentLoaded', () => {
  const divider = document.querySelector('.backup-divider');
  if (!divider) return;

  const cloudSection = document.createElement('div');
  cloudSection.className = 'backup-section';
  cloudSection.style.marginBottom = '4px';
  cloudSection.innerHTML = `
    <h4 class="backup-section-title">☁️ Cloud Sync</h4>
    <p class="backup-section-desc">Save your library to the cloud and restore it on any device.</p>
    <button class="btn-primary" id="cloudSaveBtn" style="width:100%;">☁️ Save to Cloud Now</button>
    <button class="btn-secondary" id="cloudRestoreBtn" style="width:100%;margin-top:8px;">⬇️ Restore from Cloud</button>
    <p class="backup-last-saved" id="cloudSyncLabel">Checking...</p>
  `;

  divider.parentNode.insertBefore(cloudSection, divider);

  const newDivider = document.createElement('div');
  newDivider.className = 'backup-divider';
  divider.parentNode.insertBefore(newDivider, divider);

  document.getElementById('cloudSaveBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('cloudSaveBtn');
    btn.textContent = '☁️ Checking sign-in...';
    btn.disabled = true;
    await authReady;
    if (!getCurrentUser()) {
      backupToast('Please sign in to use cloud sync.', 'warning');
      btn.textContent = '☁️ Save to Cloud Now';
      btn.disabled = false;
      return;
    }
    btn.textContent = '☁️ Saving...';
    const books = await backupGetAllBooks();
    const success = await cloudSave(books);
    if (success) {
      backupToast(`${books.length} books saved to cloud!`, 'success');
      if (typeof saveLog === 'function') saveLog(`Cloud save: ${books.length} books`);
    } else {
      backupToast('Cloud save failed. Check your connection and try again.', 'error');
    }
    btn.textContent = '☁️ Save to Cloud Now';
    btn.disabled = false;
  });

  document.getElementById('cloudRestoreBtn')?.addEventListener('click', cloudRestore);

  updateCloudSyncLabel();
});
