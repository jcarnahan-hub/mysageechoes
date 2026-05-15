// ── SAGEECHOES: Local Database (IndexedDB) ──

const DB_NAME = 'AureliaEchoesDB'; // ⚠️ Do not rename — preserves existing user data
const DB_VERSION = 2;
let localDB;

function openLocalDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Books store
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('status', 'status', { unique: false });
        bookStore.createIndex('series', 'series', { unique: false });
        bookStore.createIndex('author', 'author', { unique: false });
      }

      // Series store
      if (!db.objectStoreNames.contains('series')) {
        const seriesStore = db.createObjectStore('series', { keyPath: 'id' });
        seriesStore.createIndex('name', 'name', { unique: false });
      }

      // Wishlist store
      if (!db.objectStoreNames.contains('wishlist')) {
        const wishStore = db.createObjectStore('wishlist', { keyPath: 'id' });
        wishStore.createIndex('author', 'author', { unique: false });
      }

      // Logs store
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (e) => {
      localDB = e.target.result;
      console.log('✅ Local database ready (v2)');
      resolve(localDB);
    };

    request.onerror = () => reject(request.error);
  });
}

// Generate a unique ID for a book
function generateId(book) {
  const raw = `${(book.title || '').toLowerCase().trim()}-${(book.author || '').toLowerCase().trim()}`;
  return raw.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

// Add or update a book (prevents duplicates)
function upsertBook(book) {
  return new Promise((resolve, reject) => {
    book.id = book.id || generateId(book);
    const tx = localDB.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    const getReq = store.get(book.id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...book });
        resolve('updated');
      } else {
        store.put(book);
        resolve('added');
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Get all books
function getAllBooks() {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('books', 'readonly');
    const req = tx.objectStore('books').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Get books by status
function getBooksByStatus(status) {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('books', 'readonly');
    const index = tx.objectStore('books').index('status');
    const req = index.getAll(status);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Delete a book by ID
function deleteBook(id) {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('books', 'readwrite');
    tx.objectStore('books').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Move a book from wishlist to owned
function markBookAsOwned(id) {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        const updated = { ...req.result, status: 'owned' };
        store.put(updated);
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// Save a tracked series
function saveSeries(series) {
  return new Promise((resolve, reject) => {
    series.id = series.id || series.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const tx = localDB.transaction('series', 'readwrite');
    tx.objectStore('series').put(series);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get all tracked series
function getAllSeries() {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('series', 'readonly');
    const req = tx.objectStore('series').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Save a log entry
function saveLog(message) {
  const today = new Date().toISOString().split('T')[0];
  const tx = localDB.transaction('logs', 'readwrite');
  tx.objectStore('logs').add({ date: today, message, timestamp: Date.now() });
}

// Get all logs
function getAllLogs() {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction('logs', 'readonly');
    const req = tx.objectStore('logs').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Clean up logs older than 7 days
function pruneOldLogs() {
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const tx = localDB.transaction('logs', 'readwrite');
  const store = tx.objectStore('logs');
  const req = store.openCursor();
  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      if (cursor.value.timestamp < cutoff) cursor.delete();
      cursor.continue();
    }
  };
}

// ── ONE-TIME SERIES NAME CLEANUP ──
// Fixes malformed series names already stored in IndexedDB.
// Audible CSV exports series as "Five Island Cove-3)" — the number and
// closing paren get stored verbatim. This strips them out in place.
// Runs once per device; skips if already done (tracked in localStorage).
async function fixMalformedSeriesNames() {
  const DONE_KEY = 'ae-series-cleanup-v1';
  if (localStorage.getItem(DONE_KEY)) return;

  const books = await getAllBooks();
  let fixed = 0;

  for (const book of books) {
    if (!book.series) continue;
    const cleaned = book.series
      .replace(/\s*-\s*\d+(\.\d+)?\s*\)?\s*$/g, '')   // "-3)" or "-3" at end
      .replace(/\s*,?\s*#?\d+(\.\d+)?\s*$/g, '')        // "#2" or ",2" at end
      .replace(/\s*[\(\[]?book\s*\d+[\)\]]?\s*$/gi, '') // "book 2" at end
      .replace(/\s*\)\s*$/, '')                          // stray trailing ")"
      .trim();

    if (cleaned !== book.series) {
      book.series = cleaned;
      // Also fix the seriesKey to match
      book.seriesKey = cleaned
        .replace(/^the\s+/i, '')
        .replace(/^an?\s+/i, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      await upsertBook(book);
      fixed++;
    }
  }

  localStorage.setItem(DONE_KEY, '1');
  if (fixed > 0) {
    console.log(`✅ Series cleanup: fixed ${fixed} books`);
    saveLog(`Series name cleanup: fixed ${fixed} books with malformed series names`);
  }
}
