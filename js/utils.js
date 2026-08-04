export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function unescapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function getVal(row, colIndex) {
  if (!row || !Array.isArray(row)) return '';
  const raw = colIndex < row.length && row[colIndex] != null ? String(row[colIndex]).trim() : '';
  return escapeHTML(raw);
}

export function buildArchiveSearchUrl(rawTitle, catalogNum) {
  const cleanTitle = unescapeHTML(rawTitle || '');
  const cleanCat = unescapeHTML(catalogNum || '');
  const combinedStr = `${cleanTitle} ${cleanCat}`.trim();

  const encodedQuery = encodeURIComponent(combinedStr)
    .replace(/'/g, '%27')
    .replace(/%20/g, '+');
  return `https://archive.org/details/78rpm?tab=collection&query=${encodedQuery}`;
}

export function parseDiscogsVal(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (!str) return '';

  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  if (str.toLowerCase().includes('discogs.com')) return `https://${str.replace(/^https?:\/\//i, '')}`;

  const cleanId = str.replace(/[^0-9]/g, '');
  if (cleanId.length >= 4) return `https://www.discogs.com/release/${cleanId}`;
  return '';
}

export function getDiscogsUrl(row) {
  if (!row || !Array.isArray(row)) return '';
  const candidateIndices = [9, 7, 12, 8];
  for (let idx of candidateIndices) {
    const val = getVal(row, idx);
    if (val) {
      const url = parseDiscogsVal(val);
      if (url) return url;
    }
  }

  for (let i = 0; i < row.length; i++) {
    const val = getVal(row, i);
    if (val && (val.includes('discogs') || val.startsWith('http'))) {
      const url = parseDiscogsVal(val);
      if (url) return url;
    }
  }
  return '';
}

export function checkIfHasRecording(row) {
  const colM = getVal(row, 12);
  return /recording/i.test(colM);
}

export function getGramophoneRawTitle(row) {
  const t2 = getVal(row, 2);
  const t9 = getVal(row, 9);

  if (t9 && (t9.includes('discogs') || t9.startsWith('http') || /^[0-9]+$/.test(t9))) {
    return t2 || 'Untitled Record';
  }

  if (t2 && t9 && t2 !== t9) {
    return `${t2} / ${t9}`;
  }

  return t2 || t9 || 'Untitled Record';
}

export function formatGramophoneTitle(rawTitle) {
  if (!rawTitle) return '';
  const parts = rawTitle.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    let p1 = parts[0];
    let p2 = parts[1];
    if (!/^A[\s\.:-]/i.test(p1)) p1 = `A: ${p1}`;
    if (!/^B[\s\.:-]/i.test(p2)) p2 = `B: ${p2}`;
    return `<span class="block">${p1}</span><span class="block mt-0.5 text-slate-600 dark:text-slate-400 font-medium">${p2}</span>`;
  } else {
    let p1 = parts[0] || rawTitle;
    if (!/^A[\s\.:-]/i.test(p1)) p1 = `A: ${p1}`;
    return `<span class="block">${p1}</span>`;
  }
}

export function formatTitleWithSlashes(title) {
  if (!title) return '';
  const parts = String(title).split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return title;
  return parts.map(p => `<span class="block">${p}</span>`).join('');
}

export function parseYearForSort(val) {
  if (!val) return 99999;
  const str = String(val).trim();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num === 0) return 99999;
  return num;
}

export function formatImageUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) return '';
  
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

export function parseTitleAndDetails(rawText) {
  if (!rawText) return { title: '', details: '' };
  const lines = String(rawText).split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '', details: '' };

  let title = lines[0].replace(/^#\s*/, '');
  let details = lines.slice(1).map(line => line.replace(/^#\s*/, '')).join('\n');
  return { title, details };
}

export function googleItemSearch(title, category, details) {
  const cleanTitle = unescapeHTML(title);
  const cleanCat = unescapeHTML(category);
  const cleanDetails = unescapeHTML(details || '').replace(/^#\s*/, '').replace(/\s+/g, ' ').trim();
  const shortDetails = cleanDetails.slice(0, 200);
  const query = `${cleanTitle} ${cleanCat || ''} Historical Artifact ${shortDetails}`.trim();
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
}

export function getAgeBadgeStyle(ageStr) {
  if (!ageStr) return 'bg-slate-900/80 text-white font-extrabold';
  const lower = ageStr.toLowerCase().trim();

  if (lower.includes('pre')) {
    return 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-extrabold';
  } else if (lower.includes('post')) {
    return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-extrabold';
  } else {
    const num = parseInt(lower.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      if (num < 1950) return 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-extrabold';
      if (num >= 1950) return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-extrabold';
    }
  }
  return 'bg-slate-900/80 text-white font-extrabold';
}