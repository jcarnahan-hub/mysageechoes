// ── AURELIA ECHOES: Google Books API (Phase 4) ──

const GOOGLE_BOOKS_API_KEY = 'AIzaSyACDkAs-5myPgb4Emn6YLqc_MAnOSzqynk';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1';

// ── SEARCH FOR BOOKS ──
async function searchGoogleBooks(query) {
  try {
    const url = `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(query)}&maxResults=40&key=${GOOGLE_BOOKS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.items) return [];
    return data.items.map(item => parseGoogleBook(item));
  } catch (err) {
    console.error('Google Books search error:', err);
    return [];
  }
}

// ── SEARCH FOR A SERIES ──
async function searchSeries(seriesName) {
  const results = await searchGoogleBooks(`intitle:"${seriesName}"`);
  return results.filter(book =>
    book.title.toLowerCase().includes(seriesName.toLowerCase()) ||
    (book.series && book.series.toLowerCase().includes(seriesName.toLowerCase()))
  );
}

// ── SEARCH BY AUTHOR ──
async function searchByAuthor(authorName) {
  return await searchGoogleBooks(`inauthor:"${authorName}"`);
}

// ── PARSE A GOOGLE BOOKS ITEM ──
function parseGoogleBook(item) {
  const info = item.volumeInfo || {};
  const cover = getBestCover(info.imageLinks);
  return {
    googleId: item.id || '',
    title: info.title || 'Unknown Title',
    author: (info.authors || ['Unknown Author']).join(', '),
    series: extractSeries(info.title, info.description),
    seriesNumber: extractSeriesNumber(info.title),
    coverUrl: cover,
    publishedDate: info.publishedDate || '',
    description: info.description || '',
    pageCount: info.pageCount || 0,
    categories: (info.categories || []).join(', '),
    status: 'owned'
  };
}

// ── GET BEST AVAILABLE COVER ──
function getBestCover(imageLinks) {
  if (!imageLinks) return '';
  const best =
    imageLinks.extraLarge ||
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail || '';
  // Force HTTPS and zoom for larger image
  return best
    .replace('http://', 'https://')
    .replace('&zoom=1', '&zoom=2')
    .replace('zoom=1', 'zoom=2');
}

// ── EXTRACT SERIES NAME FROM TITLE ──
function extractSeries(title, description) {
  if (!title) return '';
  const match = title.match(/\(([^,#)]+)[,#]/);
  return match ? match[1].trim() : '';
}

// ── EXTRACT SERIES NUMBER FROM TITLE ──
function extractSeriesNumber(title) {
  if (!title) return '';
  const match = title.match(/#(\d+\.?\d*)/);
  if (match) return match[1];
  const bookMatch = title.match(/Book\s+(\d+)/i);
  return bookMatch ? bookMatch[1] : '';
}

// ── FETCH COVER URL FOR A SPECIFIC BOOK ──
async function fetchCoverUrl(title, author) {
  try {
    // Try title + author first
    let url = `${GOOGLE_BOOKS_BASE}/volumes?q=intitle:"${encodeURIComponent(title)}"+inauthor:"${encodeURIComponent(author)}"&maxResults=1&key=${GOOGLE_BOOKS_API_KEY}`;
    let response = await fetch(url);
    let data = await response.json();

    // Fall back to title only if no results
    if (!data.items || !data.items[0]) {
      url = `${GOOGLE_BOOKS_BASE}/volumes?q=intitle:"${encodeURIComponent(title)}"&maxResults=1&key=${GOOGLE_BOOKS_API_KEY}`;
      response = await fetch(url);
      data = await response.json();
    }

    if (!data.items || !data.items[0]) return '';
    const info = data.items[0].volumeInfo || {};
    return getBestCover(info.imageLinks);
  } catch (err) {
    return '';
  }
}

// ── BATCH FETCH COVERS FOR MULTIPLE BOOKS ──
// Fetches covers for up to N books that are missing cover art
async function batchFetchCovers(maxBooks = 50) {
  const allBooks = await getAllBooks();
  const missing = allBooks.filter(b => !b.coverUrl && b.title);
  const toFetch = missing.slice(0, maxBooks);

  if (toFetch.length === 0) {
    showToast('All books already have covers!', 'success');
    return;
  }

  showToast(`Fetching covers for ${toFetch.length} books...`, 'info');
  let fetched = 0;

  for (const book of toFetch) {
    const coverUrl = await fetchCoverUrl(book.title, book.author);
    if (coverUrl) {
      book.coverUrl = coverUrl;
      await upsertBook(book);
      fetched++;
    }
  }

  saveLog(`Batch cover fetch: ${fetched} covers found out of ${toFetch.length} books`);
  showToast(`Found covers for ${fetched} of ${toFetch.length} books!`, 'success');
  renderLibrary();
}
