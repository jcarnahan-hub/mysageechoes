// ── AURELIA ECHOES: Import Manager (Phase 4) ──

let importFileData = null;

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileImport');
  const runBtn = document.getElementById('runImportBtn');
  const fileLabel = document.querySelector('label[for="fileImport"]');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      importFileData = e.target.files[0];
      if (fileLabel) fileLabel.textContent = `📂 ${importFileData.name}`;
      if (typeof showToast === 'function')
        showToast(`File selected: ${importFileData.name}`, 'info');
    });
  }

  if (runBtn) runBtn.addEventListener('click', runImport);
});

// ── MAIN IMPORT FUNCTION ──
async function runImport() {
  if (!importFileData) {
    if (typeof showToast === 'function') showToast('Please choose a file first.', 'warning');
    return;
  }

  if (typeof showToast === 'function') showToast('Reading your file...', 'info');
  const text = await importFileData.text();
  let books = [];

  try {
    if (importFileData.name.endsWith('.json')) {
  const parsed = JSON.parse(text);
  books = Array.isArray(parsed) ? parsed : [];
} else {
  books = parseCSV(text);
}
  } catch (err) {
    if (typeof showToast === 'function') showToast('Could not read file. Check format.', 'error');
    if (typeof saveLog === 'function') saveLog(`IMPORT ERROR: ${err.message}`);
    return;
  }

  if (books.length === 0) {
    if (typeof showToast === 'function') showToast('No books found in this file.', 'warning');
    return;
  }

  if (typeof showToast === 'function')
    showToast(`Validating ${books.length} entries...`, 'info');

  const { valid, errors } = validateBooks(books);

  if (errors.length > 0 && typeof saveLog === 'function') {
    saveLog(`VALIDATION: ${errors.length} issues — ${errors.slice(0,3).join(' | ')}`);
  }

  let added = 0, updated = 0, skipped = 0;

  for (const book of valid) {
    try {
      // Fetch cover art if missing
      if (!book.coverUrl && book.title && book.author &&
          book.author !== 'Unknown Author' &&
          typeof fetchCoverUrl === 'function') {
        book.coverUrl = await fetchCoverUrl(book.title, book.author);
      }
      const result = await upsertBook(book);
      if (result === 'added') added++;
      else updated++;
    } catch (e) {
      skipped++;
      if (typeof saveLog === 'function')
        saveLog(`SKIP: "${book.title}" — ${e.message}`);
    }
  }

  const skippedTotal = skipped + (books.length - valid.length);
  const summary = `Import complete — Added: ${added}, Updated: ${updated}, Skipped: ${skippedTotal}`;
  if (typeof saveLog === 'function') saveLog(summary);

  document.getElementById('summaryText').textContent =
    `✅ Added ${added} · 🔄 Updated ${updated} · ⏭️ Skipped ${skippedTotal}`;
  document.getElementById('importSummary').classList.remove('hidden');

  if (typeof showToast === 'function')
    showToast(`Import complete! Added ${added} books.`, 'success');
  if (typeof renderLibrary === 'function') renderLibrary();
  if (typeof renderSeries === 'function') renderSeries();
}

// ── PARSE CSV ──
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/"/g, '').replace(/\s+/g, '')
  );

  console.log('📋 CSV Headers detected:', headers);

  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    values.push(current.trim());
    const book = {};
    headers.forEach((h, i) => { book[h] = values[i] || ''; });
    return book;
  }).filter(b => b && Object.keys(b).length > 0);
}

// ── VALIDATE & NORMALIZE BOOKS ──
function validateBooks(books) {
  const valid = [];
  const errors = [];

  // Log first book's keys so we can see what columns exist
  if (books.length > 0) {
    console.log('📖 First book raw data:', books[0]);
    console.log('📖 Available keys:', Object.keys(books[0]));
  }

  books.forEach((book, idx) => {
    const row = idx + 2;

    // ── TITLE: try every known column name ──
    const title =
      book['title'] || book['booktitle'] || book['book title'] ||
      book['Title'] || book['BookTitle'] || book['name'] || '';

    if (!title) {
      errors.push(`Row ${row}: Missing title`);
      return;
    }

    // ── AUTHOR: Audible Library Extractor uses "authorname" or "author" ──
    const author =
      book['authorname'] || book['author name'] || book['author'] ||
      book['Author'] || book['AuthorName'] || book['authors'] ||
      book['creatorname'] || book['creator'] || '';

    // ── SERIES ──
    const rawSeries =
      book['seriesname'] || book['series name'] || book['series'] ||
      book['Series'] || book['SeriesName'] || '';

    // Clean up series name — remove "book X" suffixes
    const series = cleanSeriesName(rawSeries);

    // ── SERIES NUMBER ──
    const seriesNumber =
      book['seriesno'] || book['series#'] || book['seriesnumber'] ||
      book['series number'] || book['SeriesNumber'] || book['position'] ||
      book['bookno'] || extractSeriesNumber(rawSeries) || '';

    // ── STATUS ──
    const rawStatus = book['status'] || book['Status'] || 'owned';
    const status = ['owned','wishlist','missing','upcoming'].includes(
      rawStatus.toLowerCase()) ? rawStatus.toLowerCase() : 'owned';

    // ── COVER ──
    const coverUrl =
      book['coverurl'] || book['cover'] || book['imageurl'] ||
      book['image url'] || book['cover url'] || book['coverimage'] ||
      book['productimage'] || book['image'] || '';

    // ── OTHER FIELDS ──
    const asin = book['asin'] || book['ASIN'] || '';
    const narrator = book['narratorname'] || book['narrator'] ||
                     book['Narrator'] || '';
    const duration = book['duration'] || book['Duration'] ||
                     book['length'] || '';
    const rating = book['myrating'] || book['rating'] ||
                   book['Rating'] || '';

    valid.push({
      title: title.trim(),
      author: author.trim() || 'Unknown Author',
      series: series.trim(),
      seriesNumber: seriesNumber.toString().trim(),
      status,
      coverUrl: coverUrl.trim(),
      asin: asin.trim(),
      narrator: narrator.trim(),
      duration: duration.trim(),
      rating: rating.trim()
    });
  });

  return { valid, errors };
}

// ── CLEAN SERIES NAME ──
// Removes "book 2", "(book 2)", "series book 2" suffixes
function cleanSeriesName(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s*[\(\[]?book\s*\d+[\)\]]?\s*/gi, '')
    .replace(/\s*,?\s*#?\d+(\.\d+)?\s*$/gi, '')
    .replace(/\s*[\(\[]\s*[\)\]]\s*/g, '')
    .trim();
}

// ── EXTRACT SERIES NUMBER FROM NAME ──
function extractSeriesNumber(raw) {
  if (!raw) return '';
  const match = raw.match(/book\s*(\d+)/i) || raw.match(/#(\d+)/);
  return match ? match[1] : '';
}

// ── CLOSE SUMMARY ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('closeSummaryBtn')?.addEventListener('click', () => {
    document.getElementById('importSummary').classList.add('hidden');
  });
});
