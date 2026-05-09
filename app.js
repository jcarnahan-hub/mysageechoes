// ── AURELIA ECHOES: Main App (Phase 4 — Series Cleanup) ──

// ── TAB NAVIGATION ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'library') renderLibrary();
    if (btn.dataset.tab === 'wishlist') renderWishlist();
    if (btn.dataset.tab === 'series') renderSeries();
    if (btn.dataset.tab === 'logs') renderLogs();
  });
});

// ── TOAST NOTIFICATIONS ──
function showToast(message, type = 'info') {
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
    font-size: 0.88rem; font-family: var(--font-body);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 999; max-width: 320px;
    border: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
    animation: slideIn 0.3s ease;
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── RENDER LIBRARY ──
async function renderLibrary() {
  const grid = document.getElementById('libraryGrid');
  const countLabel = document.getElementById('bookCount');
  grid.innerHTML = '<p style="color:var(--text-muted)">Loading your library...</p>';
  const books = await getBooksByStatus('owned');
  if (countLabel) countLabel.textContent = `${books.length} books`;
  grid.innerHTML = books.length
    ? books.map(b => bookCardHTML(b, false)).join('')
    : '<p style="color:var(--text-muted)">No books yet. Use the Import tab to add your library!</p>';
}

// ── RENDER WISHLIST ──
async function renderWishlist() {
  const grid = document.getElementById('wishlistGrid');
  grid.innerHTML = '<p style="color:var(--text-muted)">Loading wishlist...</p>';
  const books = await getBooksByStatus('wishlist');
  grid.innerHTML = books.length
    ? books.map(b => bookCardHTML(b, true)).join('')
    : '<p style="color:var(--text-muted)">Your wishlist is empty.</p>';
  attachWishlistActions();
}

// ── RENDER SERIES ──
async function renderSeries() {
  const grid = document.getElementById('seriesGrid');
  grid.innerHTML = '<p style="color:var(--text-muted)">Loading series...</p>';
  const books = await getAllBooks();
  const seriesMap = {};

  books.forEach(book => {
    // Skip books with no series or clearly bad series names
    if (!book.series) return;
    const seriesName = book.series.trim();
    if (!seriesName) return;
    if (seriesName.toLowerCase().startsWith('book ')) return;
    if (/^book\s*\d+$/i.test(seriesName)) return;

    if (!seriesMap[seriesName]) {
      seriesMap[seriesName] = {
        author: '',
        owned: [],
        missing: [],
        upcoming: []
      };
    }

    // Set author — prefer non-empty, non-Unknown value
    if (book.author && book.author !== 'Unknown Author') {
      seriesMap[seriesName].author = book.author;
    }

    if (book.status === 'owned') seriesMap[seriesName].owned.push(book);
    else if (book.status === 'missing') seriesMap[seriesName].missing.push(book);
    else if (book.status === 'upcoming') seriesMap[seriesName].upcoming.push(book);
  });

  // Sort series alphabetically
  const names = Object.keys(seriesMap).sort((a, b) => a.localeCompare(b));

  if (!names.length) {
    grid.innerHTML = '<p style="color:var(--text-muted)">No series found. Import books with series data or use "+ Track New Series".</p>';
    return;
  }

  grid.innerHTML = names.map(name => {
    const s = seriesMap[name];
    const total = s.owned.length + s.missing.length + s.upcoming.length;
    const pct = total ? Math.round((s.owned.length / total) * 100) : 0;
    const authorDisplay = s.author || 'Unknown Author';

    // Sort books by series number within each group
    const sortByNum = arr => arr.sort((a, b) => {
      const na = parseFloat(a.seriesNumber) || 0;
      const nb = parseFloat(b.seriesNumber) || 0;
      return na - nb;
    });

    return `
      <div class="series-card" data-series="${name}">
        <div class="series-title">${name}</div>
        <div class="series-author">by ${authorDisplay}</div>
        <div class="series-progress-bar">
          <div class="series-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="series-count">
          ✅ ${s.owned.length} owned
          ${s.missing.length ? `· ❌ ${s.missing.length} missing` : ''}
          ${s.upcoming.length ? `· 🔜 ${s.upcoming.length} upcoming` : ''}
          · ${pct}% complete
        </div>
        <div class="series-books">
          ${sortByNum(s.owned).map(b => miniBookCard(b, 'owned')).join('')}
          ${sortByNum(s.missing).map(b => miniBookCard(b, 'missing')).join('')}
          ${sortByNum(s.upcoming).map(b => miniBookCard(b, 'upcoming')).join('')}
        </div>
        <button class="btn-secondary series-refresh-btn"
          data-series="${name}" data-author="${authorDisplay}"
          style="margin-top:14px;font-size:0.8rem;padding:6px 14px;">
          🔍 Find Missing Books
        </button>
      </div>`;
  }).join('');

  document.querySelectorAll('.series-refresh-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      findMissingBooks(btn.dataset.series, btn.dataset.author));
  });
}

// ── MINI BOOK CARD ──
function miniBookCard(book, status) {
  const cover = book.coverUrl
    ? `<img src="${book.coverUrl}" alt="${book.title}"
        style="width:100%;height:100%;object-fit:cover;border-radius:6px;"
        onerror="this.style.display='none'">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;
        justify-content:center;font-size:1.2rem;background:var(--bg-secondary);
        border-radius:6px;">🎧</div>`;

  const overlayColor = status === 'missing' ? 'var(--accent-warm)' : 'var(--accent-gold)';
  const overlayText = status === 'missing' ? 'MISSING' : status === 'upcoming' ? 'UPCOMING' : '';
  const overlay = overlayText
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);
        border-radius:6px;display:flex;align-items:center;justify-content:center;
        font-size:0.6rem;color:${overlayColor};font-weight:700;">${overlayText}</div>`
    : '';

  return `<div style="position:relative;width:60px;height:90px;flex-shrink:0;"
    title="${book.title}">${cover}${overlay}</div>`;
}

// ── FIND MISSING BOOKS ──
async function findMissingBooks(seriesName, author) {
  const btn = document.querySelector(`.series-refresh-btn[data-series="${seriesName}"]`);
  if (btn) { btn.textContent = '🔍 Searching...'; btn.disabled = true; }
  showToast(`Searching for missing books in "${seriesName}"...`, 'info');

  const results = await searchSeries(seriesName);
  const ownedBooks = await getBooksByStatus('owned');
  const ownedTitles = ownedBooks.map(b => b.title.toLowerCase());

  let added = 0;
  for (const book of results) {
    const isOwned = ownedTitles.some(t =>
      t.includes(book.title.toLowerCase()) ||
      book.title.toLowerCase().includes(t)
    );
    if (!isOwned) {
      const isUpcoming = book.publishedDate &&
        new Date(book.publishedDate) > new Date();
      book.status = isUpcoming ? 'upcoming' : 'missing';
      book.series = seriesName;
      book.author = author || book.author;
      const result = await upsertBook(book);
      if (result === 'added') added++;
    }
  }

  saveLog(`Series refresh: "${seriesName}" — found ${added} new missing/upcoming books`);
  if (btn) { btn.textContent = '🔍 Find Missing Books'; btn.disabled = false; }
  renderSeries();

  if (added === 0) {
    showToast(`"${seriesName}" looks complete — no new books found!`, 'success');
  } else {
    showToast(`Found ${added} missing/upcoming books for "${seriesName}"!`, 'success');
  }
}

// ── RENDER LOGS ──
async function renderLogs() {
  const viewer = document.getElementById('logViewer');
  const logs = await getAllLogs();
  viewer.textContent = logs.length
    ? logs.sort((a, b) => b.timestamp - a.timestamp)
        .map(l => `[${l.date}] ${l.message}`).join('\n')
    : 'No log entries yet. Import a file to see activity here.';
}

// ── SHARE LOG ──
document.getElementById('shareLogBtn')?.addEventListener('click', async () => {
  const logs = await getAllLogs();
  const content = logs
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(l => `[${l.date}] ${l.message}`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = `aurelia-echoes-log-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  showToast('Log exported successfully!', 'success');
});

// ── BOOK CARD HTML ──
function bookCardHTML(book, isWishlist) {
  const cover = book.coverUrl
    ? `<img class="book-cover" src="${book.coverUrl}" alt="${book.title}"
        loading="lazy" onerror="this.parentElement.innerHTML='<div class=book-cover-placeholder>🎧</div>'">`
    : `<div class="book-cover-placeholder">🎧</div>`;

  const wishlistActions = isWishlist ? `
    <div class="wishlist-actions">
      <button class="btn-own" data-id="${book.id}">✅ Purchased</button>
      <button class="btn-remove" data-id="${book.id}">🗑️ Remove</button>
    </div>` : '';

  return `
    <div class="book-card" data-id="${book.id}">
      ${cover}
      <div class="book-info">
        <div class="book-title">${book.title}</div>
        <div class="book-author">${book.author || ''}</div>
        ${book.series
          ? `<div class="book-series">📖 ${book.series}${book.seriesNumber ? ` #${book.seriesNumber}` : ''}</div>`
          : ''}
      </div>
      ${wishlistActions}
    </div>`;
}

// ── WISHLIST ACTIONS ──
function attachWishlistActions() {
  document.querySelectorAll('.btn-own').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markBookAsOwned(btn.dataset.id);
      saveLog(`Moved to library: book ID ${btn.dataset.id}`);
      showToast('Book moved to your library!', 'success');
      renderWishlist();
    });
  });

  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Remove this book from your wishlist?')) {
        await deleteBook(btn.dataset.id);
        saveLog(`Removed from wishlist: book ID ${btn.dataset.id}`);
        showToast('Book removed from wishlist.', 'info');
        renderWishlist();
      }
    });
  });
}

// ── ADD SERIES DIALOG ──
const seriesOverlay = document.getElementById('seriesDialogOverlay');
const seriesNameInput = document.getElementById('seriesNameInput');
const seriesAuthorInput = document.getElementById('seriesAuthorInput');

document.getElementById('addSeriesBtn')?.addEventListener('click', () => {
  if (!seriesOverlay) { console.error('❌ Series dialog not found'); return; }
  seriesNameInput.value = '';
  seriesAuthorInput.value = '';
  seriesOverlay.style.display = 'flex';
  seriesOverlay.classList.remove('hidden');
  setTimeout(() => seriesNameInput.focus(), 150);
});

document.getElementById('cancelSeriesBtn')?.addEventListener('click', () => {
  seriesOverlay.style.display = 'none';
  seriesOverlay.classList.add('hidden');
});

document.getElementById('confirmSeriesBtn')?.addEventListener('click', () => {
  const name = seriesNameInput.value.trim();
  const author = seriesAuthorInput.value.trim();
  if (!name) {
    seriesNameInput.style.borderColor = 'var(--accent-warm)';
    seriesNameInput.focus();
    return;
  }
  seriesOverlay.style.display = 'none';
  seriesOverlay.classList.add('hidden');
  findMissingBooks(name, author);
});

seriesOverlay?.addEventListener('click', (e) => {
  if (e.target === seriesOverlay) {
    seriesOverlay.style.display = 'none';
    seriesOverlay.classList.add('hidden');
  }
});

seriesAuthorInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('confirmSeriesBtn').click();
});

// ── SEARCH BAR ──
document.getElementById('searchBar')?.addEventListener('input', async (e) => {
  const q = e.target.value.toLowerCase().trim();
  const grid = document.getElementById('libraryGrid');
  const countLabel = document.getElementById('bookCount');

  if (!q) {
    renderLibrary();
    return;
  }

  const books = await getAllBooks();
  const filtered = books.filter(b =>
    b.status === 'owned' && (
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.series || '').toLowerCase().includes(q) ||
      (b.narrator || '').toLowerCase().includes(q)
    )
  );

  if (countLabel) countLabel.textContent = `${filtered.length} results`;
  grid.innerHTML = filtered.length
    ? filtered.map(b => bookCardHTML(b, false)).join('')
    : '<p style="color:var(--text-muted)">No results found.</p>';
});

// ── FETCH MISSING COVERS BUTTON ──
document.getElementById('fetchCoversBtn')?.addEventListener('click', () => {
  batchFetchCovers(50);
});

// ── THEME TOGGLE ──
const themeToggle = document.getElementById('themeToggle');
const toggleLabel = document.getElementById('toggleLabel');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ae-theme', theme);
  if (toggleLabel) toggleLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

themeToggle?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/aureliaechoes/sw.js')
    .then(() => console.log('✅ Service Worker registered'));
}

// ── INITIALIZE ──
document.addEventListener('DOMContentLoaded', async () => {
  const savedTheme = localStorage.getItem('ae-theme') || 'light';
  applyTheme(savedTheme);
  await openLocalDB();
  pruneOldLogs();
  renderLibrary();
  console.log('🎧 Aurelia Echoes Phase 4 running!');
});
