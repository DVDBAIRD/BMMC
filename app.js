// Tailwind Configuration
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        }
      }
    }
  }
};

const EXHIBITS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1U3V1JIatKpTOyAHEMnscs0mdZ4vDNf4C7eX_fuUbj_s/gviz/tq?tqx=out:csv&gid=1146027655';
const GRAMOPHONE_CSV_URL = 'https://docs.google.com/spreadsheets/d/1U3V1JIatKpTOyAHEMnscs0mdZ4vDNf4C7eX_fuUbj_s/gviz/tq?tqx=out:csv&gid=606568772';
const NO_IMAGE_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22300%22%20viewBox%3D%220%200%20400%20300%22%3E%3Crect%20fill%3D%22%23f1f5f9%22%20width%3D%22400%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3ENo%20Image%20Available%3C%2Ftext%3E%3C%2Fsvg%3E';

const MAIN_HUB_CATEGORIES = ["War", "Photography", "Survey", "General", "Documentation", "Household", "Collections"];
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour Cache

let currentTab = 'exhibits';
let rawExhibitsRows = [];
let rawGramophoneRows = [];
let currentFilteredRows = [];
let currentModalIndex = -1;
let currentlySpeakingIndex = null;
let only3DActive = false;
let showingFavoritesOnly = false;
let isGridActive = false;
let currentSpeechUtterance = null;
let availableVoices = [];

// Fuse.js Fuzzy Search instances
let fuseExhibits = null;
let fuseGramophone = null;

// HTML Sanitization / Security Helpers
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function getVal(row, colIndex) {
  if (!row || !Array.isArray(row)) return '';
  const raw = colIndex < row.length && row[colIndex] != null ? String(row[colIndex]).trim() : '';
  return escapeHTML(raw);
}

function buildArchiveSearchUrl(rawTitle, catalogNum) {
  const cleanTitle = unescapeHTML(rawTitle || '');
  const cleanCat = unescapeHTML(catalogNum || '');
  const combinedStr = `${cleanTitle} ${cleanCat}`.trim();

  const encodedQuery = encodeURIComponent(combinedStr)
    .replace(/'/g, '%27')
    .replace(/%20/g, '+');
  return `https://archive.org/details/78rpm?tab=collection&query=${encodedQuery}`;
}

// Controls Toggle Logic
function toggleCollapsibleControls(show) {
  const collapsibleControls = document.getElementById('collapsibleControls');
  const toggleChevron = document.getElementById('toggleChevron');
  const toggleControlsBtn = document.getElementById('toggleControlsBtn');

  if (!collapsibleControls) return;
  const shouldShow = show !== undefined ? show : collapsibleControls.classList.contains('hidden');
  
  if (shouldShow) {
    collapsibleControls.classList.remove('hidden');
    if (toggleChevron) toggleChevron.style.transform = 'rotate(0deg)';
    if (toggleControlsBtn) {
      toggleControlsBtn.classList.add('bg-blue-50', 'dark:bg-blue-950/60', 'text-blue-700', 'dark:text-blue-300', 'border-blue-300');
    }
  } else {
    collapsibleControls.classList.add('hidden');
    if (toggleChevron) toggleChevron.style.transform = 'rotate(180deg)';
    if (toggleControlsBtn) {
      toggleControlsBtn.classList.remove('bg-blue-50', 'dark:bg-blue-950/60', 'text-blue-700', 'dark:text-blue-300', 'border-blue-300');
    }
  }
}

// Caching CSV Fetcher
async function fetchCSVWithCache(url, cacheKey) {
  const cached = sessionStorage.getItem(cacheKey);
  const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

  if (cached && cacheTime && (Date.now() - Number(cacheTime) < CACHE_TTL_MS)) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn("Error parsing session cache, re-fetching URL:", e);
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(results.data));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now());
        } catch (e) {
          console.warn("Storage full, skipped caching:", e);
        }
        resolve(results.data);
      },
      error: (err) => reject(err)
    });
  });
}

function parseDiscogsVal(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (!str) return '';

  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  if (str.toLowerCase().includes('discogs.com')) return `https://${str.replace(/^https?:\/\//i, '')}`;

  const cleanId = str.replace(/[^0-9]/g, '');
  if (cleanId.length >= 4) return `https://www.discogs.com/release/${cleanId}`;
  return '';
}

function getDiscogsUrl(row) {
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

function checkIfHasRecording(row) {
  const colM = getVal(row, 12);
  return /recording/i.test(colM);
}

function getGramophoneRawTitle(row) {
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

function formatGramophoneTitle(rawTitle) {
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

function formatTitleWithSlashes(title) {
  if (!title) return '';
  const parts = String(title).split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return title;
  return parts.map(p => `<span class="block">${p}</span>`).join('');
}

function parseYearForSort(val) {
  if (!val) return 99999;
  const str = String(val).trim();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num === 0) return 99999;
  return num;
}

function showToast(msg, icon = '✨') {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').textContent = icon;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
  setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
  }, 2500);
}

function getAgeBadgeStyle(ageStr) {
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

function initTheme() {
  const savedTheme = localStorage.getItem('bMMC_theme');
  const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeUI(isDark);
}

function updateThemeUI(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (icon && text) {
    icon.textContent = isDark ? '☀️' : '🌙';
    text.textContent = isDark ? 'Day Mode' : 'Night Mode';
  }
}

// Speech Synthesis
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  availableVoices = voices.filter(v => v.lang.startsWith('en'));
  const highQualityKeywords = ['natural', 'neural', 'enhanced', 'premium', 'google', 'online', 'siri', 'edge'];
  availableVoices.sort((a, b) => {
    const aScore = highQualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
    const bScore = highQualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
    return bScore - aScore;
  });
  populateVoiceDropdown();
}

function getSelectedVoice() {
  if (availableVoices.length === 0) return null;
  const savedName = localStorage.getItem('bMMC_selectedVoiceName');
  if (savedName) {
    const found = availableVoices.find(v => v.name === savedName);
    if (found) return found;
  }
  return availableVoices[0];
}

function populateVoiceDropdown() {
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  select.innerHTML = '';
  const currentVoice = getSelectedVoice();

  availableVoices.forEach(voice => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    const isNatural = ['natural', 'neural', 'enhanced', 'premium', 'google', 'online', 'siri', 'edge'].some(k => voice.name.toLowerCase().includes(k));
    opt.textContent = `${voice.name} ${isNatural ? '✨' : ''}`;
    if (currentVoice && currentVoice.name === voice.name) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = function() {
    localStorage.setItem('bMMC_selectedVoiceName', this.value);
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      const btnModal = document.getElementById('btnAudioGuide');
      if (btnModal && btnModal.getAttribute('data-row')) {
        speakAudioGuide(parseInt(btnModal.getAttribute('data-row'), 10));
      }
    }
  };
}

if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function scrollToGrid() {
  const header = document.getElementById('mainHeader');
  const headerHeight = header ? header.offsetHeight : 100;
  const gridElem = document.getElementById('gridSection');
  if (!gridElem) return;
  const targetPos = gridElem.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
  window.scrollTo({ top: Math.max(0, targetPos), behavior: 'smooth' });
}

function getFavorites() {
  try {
    const key = currentTab === 'exhibits' ? 'bMMC_favorites' : 'bMMC_gramophone_favorites';
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch(e) { return []; }
}

function toggleFavorite(rowIndex, event) {
  if (event) event.stopPropagation();
  let favs = getFavorites();
  const key = currentTab === 'exhibits' ? 'bMMC_favorites' : 'bMMC_gramophone_favorites';
  const adding = !favs.includes(rowIndex);
  
  if (adding) {
    favs.push(rowIndex);
    showToast('Saved to your collection', '❤️');
  } else {
    favs = favs.filter(i => i !== rowIndex);
    showToast('Removed from saved items', '🤍');
  }
  
  localStorage.setItem(key, JSON.stringify(favs));
  updateFavoritesBadge();
  
  if (isGridActive) {
    filterCatalog(true);
  }
}

function updateFavoritesBadge() {
  const favs = getFavorites();
  const heartIcon = document.getElementById('favHeartIcon');
  const favCountText = document.getElementById('favCountText');
  const btnFav = document.getElementById('btnFavorites');

  if (favCountText) favCountText.textContent = `Saved (${favs.length})`;
  if (heartIcon) heartIcon.textContent = favs.length > 0 ? '❤️' : '🤍';

  if (btnFav) {
    if (showingFavoritesOnly) {
      btnFav.classList.add('bg-rose-600', 'text-white', 'border-rose-600');
      btnFav.classList.remove('bg-slate-100', 'text-slate-700', 'border-slate-200', 'dark:bg-slate-800', 'dark:text-slate-200');
    } else {
      btnFav.classList.remove('bg-rose-600', 'text-white', 'border-rose-600');
      btnFav.classList.add('bg-slate-100', 'text-slate-700', 'border-slate-200', 'dark:bg-slate-800', 'dark:text-slate-200');
    }
  }
}

function formatImageUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) return '';
  
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

function parseTitleAndDetails(rawText) {
  if (!rawText) return { title: '', details: '' };
  const lines = String(rawText).split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '', details: '' };

  let title = lines[0].replace(/^#\s*/, '');
  let details = lines.slice(1).map(line => line.replace(/^#\s*/, '')).join('\n');
  return { title, details };
}

function googleItemSearch(title, category, details) {
  const cleanTitle = unescapeHTML(title);
  const cleanCat = unescapeHTML(category);
  const cleanDetails = unescapeHTML(details || '').replace(/^#\s*/, '').replace(/\s+/g, ' ').trim();
  const shortDetails = cleanDetails.slice(0, 200);
  const query = `${cleanTitle} ${cleanCat || ''} Historical Artifact ${shortDetails}`.trim();
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
}

function browseAllExhibits() {
  if (currentTab !== 'exhibits') {
    setTab('exhibits');
  }

  document.getElementById('searchInput').value = '';
  document.getElementById('filterAge').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterSubcategory').value = '';
  document.getElementById('filterArtist').value = '';
  document.getElementById('filterLabel').value = '';
  document.getElementById('filterFormat').value = '';
  document.getElementById('filterYear').value = '';

  only3DActive = false;
  showingFavoritesOnly = false;
  
  const btn3D = document.getElementById('btn3DOnly');
  if (btn3D) {
    btn3D.classList.remove('bg-purple-600', 'text-white', 'border-purple-600');
    btn3D.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-200', 'dark:border-slate-700');
  }
  
  updateFavoritesBadge();
  updateDynamicDropdowns();
  filterCatalog(true);
  scrollToGrid();
}

function setTab(tabName) {
  currentTab = tabName;
  stopAudioGuide();

  const exhibitsFilterGrid = document.getElementById('exhibitsFilterGrid');
  const gramophoneFilterGrid = document.getElementById('gramophoneFilterGrid');
  const headerTitle = document.getElementById('headerTitleText');
  const headerIcon = document.getElementById('headerLogoIcon');
  const subhead = document.getElementById('subheadingText');

  if (tabName === 'exhibits') {
    exhibitsFilterGrid.classList.remove('hidden');
    gramophoneFilterGrid.classList.add('hidden');

    headerTitle.textContent = 'BMMC Showcase';
    headerIcon.textContent = '🏛️';
    subhead.textContent = 'The Bonniefields Museum preserves historical artifacts, technical equipment, and memorabilia for a nostalgic glimpse into the past.';
    
    document.getElementById('promptIcon').textContent = '🔍';
    document.getElementById('promptTitle').textContent = 'Ready to Explore Exhibits';
    document.getElementById('promptDesc').textContent = 'Select a Collection Hub above, search by keyword, or view all items in the BMMC archive.';
  } else {
    gramophoneFilterGrid.classList.remove('hidden');
    exhibitsFilterGrid.classList.add('hidden');

    headerTitle.textContent = 'BMMC Gramophone Archive';
    headerIcon.textContent = '🎵';
    subhead.textContent = 'Gramophone Catalog (1916 – 1953): Shellac, vinyl, and early 20th-century audio recordings preserved in the BMMC music collection.';
    
    document.getElementById('promptIcon').textContent = '🎵';
    document.getElementById('promptTitle').textContent = 'Explore Vintage Audio Records';
    document.getElementById('promptDesc').textContent = 'Search vintage gramophone recordings by artist, title, record label, or release year (1916 - 1953).';
  }

  updateFavoritesBadge();
  updateDynamicDropdowns();
  filterCatalog(true);
}

function initFuseSearch() {
  if (typeof Fuse === 'undefined') return;

  if (rawExhibitsRows.length > 0) {
    const exhibitsList = rawExhibitsRows.map((row, index) => {
      const { title, details } = parseTitleAndDetails(getVal(row, 2) || getVal(row, 0));
      return {
        originalIndex: index,
        title,
        details,
        notes: getVal(row, 4),
        age: getVal(row, 13),
        type: getVal(row, 14),
        category: getVal(row, 15),
        subcategory: getVal(row, 16)
      };
    });

    fuseExhibits = new Fuse(exhibitsList, {
      keys: ['title', 'details', 'notes', 'type', 'category', 'subcategory', 'age'],
      threshold: 0.35,
      ignoreLocation: true
    });
  }

  if (rawGramophoneRows.length > 0) {
    const gramophoneList = rawGramophoneRows.map((row, index) => ({
      originalIndex: index,
      catalog: getVal(row, 0),
      artist: getVal(row, 1),
      title: getGramophoneRawTitle(row),
      label: getVal(row, 3),
      format: getVal(row, 4),
      year: getVal(row, 6),
      details: getVal(row, 12)
    }));

    fuseGramophone = new Fuse(gramophoneList, {
      keys: ['artist', 'title', 'label', 'catalog', 'details', 'year', 'format'],
      threshold: 0.35,
      ignoreLocation: true
    });
  }
}

async function loadCatalogData() {
  initTheme();

  try {
    const exhibitsData = await fetchCSVWithCache(EXHIBITS_CSV_URL, 'bMMC_cached_exhibits');
    rawExhibitsRows = exhibitsData.slice(1);
    populateInitialDropdowns();

    try {
      const gramophoneData = await fetchCSVWithCache(GRAMOPHONE_CSV_URL, 'bMMC_cached_gramophone');
      rawGramophoneRows = gramophoneData.filter(r => {
        const c0 = getVal(r, 0).toLowerCase();
        const c1 = getVal(r, 1).toLowerCase();
        return r.length >= 2 && !c0.includes('gramophone catalog') && !c0.includes('catalog#') && !c1.includes('artist');
      });
    } catch (gramErr) {
      console.warn("Could not load Gramophone sheet, falling back to exhibits:", gramErr);
    }

    initFuseSearch();
    renderCollectionHubs(rawExhibitsRows);
    updateDynamicDropdowns();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gridPrompt').classList.remove('hidden');

    updateFavoritesBadge();
    checkUrlHashForExhibit();

  } catch (err) {
    console.error("Failed to load catalog data:", err);
    document.getElementById('loading').innerHTML = `
      <div class="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900">
        <p class="text-rose-600 dark:text-rose-400 font-bold text-base mb-1">Error loading Google Sheet data</p>
        <p class="text-xs text-slate-500 mb-4">Please check your connection or retry fetching the catalog archive.</p>
        <button onclick="sessionStorage.clear(); location.reload();" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow">
          🔄 Retry Fetching
        </button>
      </div>
    `;
  }
}

function checkUrlHashForExhibit() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#exhibit-')) {
    const index = parseInt(hash.replace('#exhibit-', ''), 10);
    if (!isNaN(index) && rawExhibitsRows[index]) {
      filterCatalog(true);
      openModalByOriginalIndex(index);
    }
  } else if (hash && hash.startsWith('#gramophone-')) {
    const index = parseInt(hash.replace('#gramophone-', ''), 10);
    if (!isNaN(index) && rawGramophoneRows[index]) {
      setTab('gramophone');
      openModalByOriginalIndex(index);
    }
  }
}

function renderCollectionHubs(rows) {
  const hubsGrid = document.getElementById('hubsGrid');
  if (!hubsGrid) return;
  hubsGrid.innerHTML = '';

  MAIN_HUB_CATEGORIES.forEach(catName => {
    const baseName = catName.toLowerCase().replace(/s$/, '');
    const matchingRows = rows.filter(r => {
      const catVal = getVal(r, 15).toLowerCase();
      const typeVal = getVal(r, 14).toLowerCase();
      return catVal.includes(baseName) || typeVal.includes(baseName);
    });

    const count = matchingRows.length;
    if (count === 0) return;

    const firstImgRow = matchingRows.find(r => getVal(r, 20) !== '');
    const firstImgRaw = firstImgRow ? getVal(firstImgRow, 20) : '';
    const previewImg = formatImageUrl(firstImgRaw) || NO_IMAGE_SVG;

    const hubCard = document.createElement('div');
    hubCard.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition duration-300 cursor-pointer flex flex-col group relative';
    hubCard.innerHTML = `
      <div class="h-20 bg-slate-100/90 dark:bg-slate-800/90 relative overflow-hidden flex items-center justify-center p-1.5">
        <img src="${previewImg}" class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300" onError="this.src='${NO_IMAGE_SVG}'" alt="${catName}" />
        <span class="absolute top-1.5 right-1.5 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">${count}</span>
      </div>
      <div class="p-2 flex-1 flex flex-col justify-between">
        <h3 class="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">${catName}</h3>
        <span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-0.5">Explore →</span>
      </div>
    `;

    hubCard.addEventListener('click', () => {
      setTab('exhibits');
      const catSelect = document.getElementById('filterCategory');
      const typeSelect = document.getElementById('filterType');
      
      if (catSelect) catSelect.value = '';
      if (typeSelect) typeSelect.value = '';

      let matched = false;
      if (typeSelect) {
        for (let opt of typeSelect.options) {
          if (opt.value.toLowerCase().includes(baseName)) {
            typeSelect.value = opt.value;
            matched = true;
            break;
          }
        }
      }
      if (!matched && catSelect) {
        for (let opt of catSelect.options) {
          if (opt.value.toLowerCase().includes(baseName)) {
            catSelect.value = opt.value;
            matched = true;
            break;
          }
        }
      }

      updateDynamicDropdowns();
      filterCatalog(true);
      scrollToGrid();
    });

    hubsGrid.appendChild(hubCard);
  });

  const gramophoneHubCard = document.createElement('div');
  gramophoneHubCard.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition duration-300 cursor-pointer flex flex-col group relative';
  gramophoneHubCard.innerHTML = `
    <div class="h-20 bg-slate-100/90 dark:bg-slate-800/90 relative overflow-hidden flex items-center justify-center p-1.5 text-3xl">
      🎵
      <span class="absolute top-1.5 right-1.5 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">${rawGramophoneRows.length}</span>
    </div>
    <div class="p-2 flex-1 flex flex-col justify-between">
      <h3 class="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">Gramophone Archive</h3>
      <span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-0.5">1916–1953 →</span>
    </div>
  `;

  gramophoneHubCard.addEventListener('click', () => {
    setTab('gramophone');
    scrollToGrid();
  });

  hubsGrid.appendChild(gramophoneHubCard);
  document.getElementById('collectionHubsSection').classList.remove('hidden');
}

function populateInitialDropdowns() {
  document.getElementById('sortBy').addEventListener('change', () => filterCatalog(true));
  document.getElementById('btnClearAllFilters').addEventListener('click', browseAllExhibits);

  ['filterAge', 'filterType', 'filterCategory', 'filterSubcategory', 'filterArtist', 'filterLabel', 'filterFormat', 'filterYear'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.addEventListener('change', () => {
        updateDynamicDropdowns();
        filterCatalog(true);
        scrollToGrid();
      });
    }
  });
}

function updateDynamicDropdowns() {
  if (currentTab === 'exhibits') {
    const catVal = document.getElementById('filterCategory').value;
    const typeVal = document.getElementById('filterType').value;

    let availableRows = rawExhibitsRows;
    if (catVal) availableRows = availableRows.filter(r => getVal(r, 15).toLowerCase().includes(catVal.toLowerCase()));
    if (typeVal) availableRows = availableRows.filter(r => getVal(r, 14).toLowerCase().includes(typeVal.toLowerCase()));

    updateSelectOptions('filterAge', rawExhibitsRows.map(r => getVal(r, 13)));
    updateSelectOptions('filterType', rawExhibitsRows.map(r => getVal(r, 14)));
    updateSelectOptions('filterCategory', rawExhibitsRows.map(r => getVal(r, 15)));
    updateSelectOptions('filterSubcategory', availableRows.map(r => getVal(r, 16)));
  } else {
    const artistVal = document.getElementById('filterArtist').value;
    let availableRows = rawGramophoneRows;
    if (artistVal) availableRows = availableRows.filter(r => getVal(r, 1) === artistVal);

    updateSelectOptions('filterArtist', rawGramophoneRows.map(r => getVal(r, 1)));
    updateSelectOptions('filterLabel', availableRows.map(r => getVal(r, 3)));
    updateSelectOptions('filterFormat', availableRows.map(r => getVal(r, 4)));
    updateSelectOptions('filterYear', availableRows.map(r => getVal(r, 6)));
  }
}

function updateSelectOptions(elementId, values) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const currentSelection = select.value;

  const uniqueValues = [...new Set(values.filter(Boolean))].sort();
  select.innerHTML = `<option value="">All ${elementId.replace('filter', '')}s</option>`;

  uniqueValues.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    if (val === currentSelection) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderActiveFilterPills() {
  const container = document.getElementById('activeFiltersContainer');
  const bar = document.getElementById('activeFiltersBar');
  if (!container || !bar) return;

  container.innerHTML = '';
  const filters = [];

  const searchVal = document.getElementById('searchInput').value;

  if (currentTab === 'exhibits') {
    const ageVal = document.getElementById('filterAge').value;
    const typeVal = document.getElementById('filterType').value;
    const catVal = document.getElementById('filterCategory').value;
    const subCatVal = document.getElementById('filterSubcategory').value;

    if (searchVal) filters.push({ label: `Search: "${searchVal}"`, clear: () => { document.getElementById('searchInput').value = ''; } });
    if (ageVal) filters.push({ label: `Age: ${ageVal}`, clear: () => { document.getElementById('filterAge').value = ''; } });
    if (typeVal) filters.push({ label: `Type: ${typeVal}`, clear: () => { document.getElementById('filterType').value = ''; } });
    if (catVal) filters.push({ label: `Category: ${catVal}`, clear: () => { document.getElementById('filterCategory').value = ''; } });
    if (subCatVal) filters.push({ label: `Subcategory: ${subCatVal}`, clear: () => { document.getElementById('filterSubcategory').value = ''; } });
    if (only3DActive) filters.push({ label: `3D Models Only`, clear: () => { document.getElementById('btn3DOnly').click(); return false; } });
  } else {
    filters.push({ label: `Archive Mode: Gramophone`, clear: () => browseAllExhibits() });
    const artistVal = document.getElementById('filterArtist').value;
    const labelVal = document.getElementById('filterLabel').value;
    const formatVal = document.getElementById('filterFormat').value;
    const yearVal = document.getElementById('filterYear').value;

    if (searchVal) filters.push({ label: `Search: "${searchVal}"`, clear: () => { document.getElementById('searchInput').value = ''; } });
    if (artistVal) filters.push({ label: `Artist: ${artistVal}`, clear: () => { document.getElementById('filterArtist').value = ''; } });
    if (labelVal) filters.push({ label: `Label: ${labelVal}`, clear: () => { document.getElementById('filterLabel').value = ''; } });
    if (formatVal) filters.push({ label: `Format: ${formatVal}`, clear: () => { document.getElementById('filterFormat').value = ''; } });
    if (yearVal) filters.push({ label: `Year: ${yearVal}`, clear: () => { document.getElementById('filterYear').value = ''; } });
  }

  if (showingFavoritesOnly) filters.push({ label: `Saved Items`, clear: () => { showingFavoritesOnly = false; updateFavoritesBadge(); } });

  if (filters.length > 0) {
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    filters.forEach(f => {
      const pill = document.createElement('span');
      pill.className = 'inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full';
      pill.innerHTML = `${f.label} <button class="hover:text-red-500 font-bold ml-0.5">✕</button>`;
      pill.querySelector('button').addEventListener('click', () => {
        f.clear();
        updateDynamicDropdowns();
        filterCatalog(true);
      });
      container.appendChild(pill);
    });
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}

function filterCatalog(forceShowGrid = false) {
  const searchVal = (document.getElementById('searchInput').value || '').trim();
  const sortBy = document.getElementById('sortBy').value;
  const favs = getFavorites();

  document.getElementById('clearSearch').classList.toggle('hidden', !searchVal);
  renderActiveFilterPills();

  if (currentTab === 'exhibits') {
    const ageVal = document.getElementById('filterAge').value;
    const typeVal = document.getElementById('filterType').value;
    const catVal = document.getElementById('filterCategory').value;
    const subCatVal = document.getElementById('filterSubcategory').value;

    const isFiltering = searchVal || ageVal || typeVal || catVal || subCatVal || only3DActive || showingFavoritesOnly;

    if (isFiltering || forceShowGrid) {
      isGridActive = true;
      document.getElementById('gridPrompt').classList.add('hidden');
      document.getElementById('grid').classList.remove('hidden');
      document.getElementById('floatingJumpBtn').classList.remove('hidden');
    } else if (!isGridActive) {
      document.getElementById('gridPrompt').classList.remove('hidden');
      document.getElementById('grid').classList.add('hidden');
      document.getElementById('floatingJumpBtn').classList.add('hidden');
      document.getElementById('itemCount').textContent = '';
      return;
    }

    let matchedOriginalIndices = null;
    if (searchVal && fuseExhibits) {
      const searchResults = fuseExhibits.search(searchVal);
      matchedOriginalIndices = new Set(searchResults.map(res => res.item.originalIndex));
    }

    currentFilteredRows = rawExhibitsRows.map((row, index) => ({ row, originalIndex: index })).filter(({ row, originalIndex }) => {
      const searchMatch = !searchVal || (matchedOriginalIndices ? matchedOriginalIndices.has(originalIndex) : row.join(' ').toLowerCase().includes(searchVal.toLowerCase()));
      const ageMatch = !ageVal || getVal(row, 13) === ageVal;
      const typeMatch = !typeVal || getVal(row, 14).toLowerCase().includes(typeVal.toLowerCase());
      const catMatch = !catVal || getVal(row, 15).toLowerCase().includes(catVal.toLowerCase());
      const subCatMatch = !subCatVal || getVal(row, 16) === subCatVal;
      const match3D = !only3DActive || getVal(row, 17) !== '';
      const matchFav = !showingFavoritesOnly || favs.includes(originalIndex);

      return searchMatch && ageMatch && typeMatch && catMatch && subCatMatch && match3D && matchFav;
    });

    if (sortBy === 'title-asc') {
      currentFilteredRows.sort((a, b) => parseTitleAndDetails(getVal(a.row, 2) || getVal(a.row, 0)).title.localeCompare(parseTitleAndDetails(getVal(b.row, 2) || getVal(b.row, 0)).title));
    } else if (sortBy === 'title-desc') {
      currentFilteredRows.sort((a, b) => parseTitleAndDetails(getVal(b.row, 2) || getVal(b.row, 0)).title.localeCompare(parseTitleAndDetails(getVal(a.row, 2) || getVal(a.row, 0)).title));
    } else if (sortBy === 'age-oldest') {
      currentFilteredRows.sort((a, b) => getVal(a.row, 13).localeCompare(getVal(b.row, 13)));
    } else if (sortBy === 'age-newest') {
      currentFilteredRows.sort((a, b) => getVal(b.row, 13).localeCompare(getVal(a.row, 13)));
    }

    renderExhibitsGrid();

  } else {
    const artistVal = document.getElementById('filterArtist').value;
    const labelVal = document.getElementById('filterLabel').value;
    const formatVal = document.getElementById('filterFormat').value;
    const yearVal = document.getElementById('filterYear').value;

    const isFiltering = searchVal || artistVal || labelVal || formatVal || yearVal || showingFavoritesOnly;

    if (isFiltering || forceShowGrid) {
      isGridActive = true;
      document.getElementById('gridPrompt').classList.add('hidden');
      document.getElementById('grid').classList.remove('hidden');
      document.getElementById('floatingJumpBtn').classList.remove('hidden');
    } else if (!isGridActive) {
      document.getElementById('gridPrompt').classList.remove('hidden');
      document.getElementById('grid').classList.add('hidden');
      document.getElementById('floatingJumpBtn').classList.add('hidden');
      document.getElementById('itemCount').textContent = '';
      return;
    }

    let matchedOriginalIndices = null;
    if (searchVal && fuseGramophone) {
      const searchResults = fuseGramophone.search(searchVal);
      matchedOriginalIndices = new Set(searchResults.map(res => res.item.originalIndex));
    }

    currentFilteredRows = rawGramophoneRows.map((row, index) => ({ row, originalIndex: index })).filter(({ row, originalIndex }) => {
      const searchMatch = !searchVal || (matchedOriginalIndices ? matchedOriginalIndices.has(originalIndex) : row.join(' ').toLowerCase().includes(searchVal.toLowerCase()));
      const artistMatch = !artistVal || getVal(row, 1) === artistVal;
      const labelMatch = !labelVal || getVal(row, 3) === labelVal;
      const formatMatch = !formatVal || getVal(row, 4) === formatVal;
      const yearMatch = !yearVal || getVal(row, 6) === yearVal;
      const matchFav = !showingFavoritesOnly || favs.includes(originalIndex);

      return searchMatch && artistMatch && labelMatch && formatMatch && yearMatch && matchFav;
    });

    if (sortBy === 'default' || sortBy === 'age-oldest') {
      currentFilteredRows.sort((a, b) => parseYearForSort(getVal(a.row, 6)) - parseYearForSort(getVal(b.row, 6)));
    } else if (sortBy === 'age-newest') {
      currentFilteredRows.sort((a, b) => {
        const yA = parseYearForSort(getVal(a.row, 6));
        const yB = parseYearForSort(getVal(b.row, 6));
        if (yA === 99999) return 1;
        if (yB === 99999) return -1;
        return yB - yA;
      });
    } else if (sortBy === 'title-asc') {
      currentFilteredRows.sort((a, b) => getGramophoneRawTitle(a.row).localeCompare(getGramophoneRawTitle(b.row)));
    } else if (sortBy === 'title-desc') {
      currentFilteredRows.sort((a, b) => getGramophoneRawTitle(b.row).localeCompare(getGramophoneRawTitle(a.row)));
    }

    renderGramophoneGrid();
  }
}

function speakAudioGuide(originalIndex, event) {
  if (event) event.stopPropagation();

  if (currentlySpeakingIndex === originalIndex && window.speechSynthesis && window.speechSynthesis.speaking) {
    stopAudioGuide();
    return;
  }

  const row = rawExhibitsRows[originalIndex];
  if (!row) return;

  const notes = getVal(row, 4);
  if (!notes || notes.trim() === '') {
    showToast('No Museum Notes available for audio narration', 'ℹ️');
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    currentlySpeakingIndex = originalIndex;
    const cleanNotes = notes.replace(/^#\s*/, '');
    const textToSpeak = `Museum Note: ${cleanNotes}`;
    currentSpeechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    
    const chosenVoice = getSelectedVoice();
    if (chosenVoice) currentSpeechUtterance.voice = chosenVoice;

    currentSpeechUtterance.rate = 0.92;
    currentSpeechUtterance.pitch = 1.0;
    
    currentSpeechUtterance.onend = () => { currentlySpeakingIndex = null; updateAudioUI(); };
    currentSpeechUtterance.onerror = () => { currentlySpeakingIndex = null; updateAudioUI(); };

    window.speechSynthesis.speak(currentSpeechUtterance);
    updateAudioUI();
  } else {
    alert('Speech Synthesis is not supported in this browser.');
  }
}

function stopAudioGuide() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentlySpeakingIndex = null;
  updateAudioUI();
}

function updateAudioUI() {
  const isSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;

  document.querySelectorAll('[data-grid-audio-idx]').forEach(btn => {
    const idx = parseInt(btn.getAttribute('data-grid-audio-idx'), 10);
    if (currentlySpeakingIndex === idx && isSpeaking) {
      btn.classList.add('animate-pulse', 'bg-blue-600', 'text-white', 'ring-2', 'ring-blue-400');
      btn.classList.remove('bg-white/90', 'dark:bg-slate-800/90', 'text-blue-600', 'dark:text-blue-400');
      btn.innerHTML = `<span class="flex items-center gap-1 text-[11px] px-1 font-bold">🔊 <span class="eq-bar"></span><span class="eq-bar"></span></span>`;
    } else {
      btn.classList.remove('animate-pulse', 'bg-blue-600', 'text-white', 'ring-2', 'ring-blue-400');
      btn.classList.add('bg-white/90', 'dark:bg-slate-800/90', 'text-blue-600', 'dark:text-blue-400');
      btn.innerHTML = '🔊';
    }
  });

  const btnModal = document.getElementById('btnAudioGuide');
  if (btnModal) {
    const modalRowIdx = parseInt(btnModal.getAttribute('data-row'), 10);
    if (currentlySpeakingIndex === modalRowIdx && isSpeaking) {
      btnModal.innerHTML = `
        <span class="flex items-center gap-1 text-xs font-bold">
          <span class="inline-flex items-center gap-0.5 text-blue-200">
            <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
          </span>
          <span>Stop</span>
        </span>
      `;
      btnModal.onclick = stopAudioGuide;
    } else {
      btnModal.innerHTML = '🔊 Listen';
      btnModal.onclick = () => speakAudioGuide(modalRowIdx);
    }
  }
}

function renderExhibitsGrid() {
  const grid = document.getElementById('grid');
  const itemCount = document.getElementById('itemCount');
  const favs = getFavorites();

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
  grid.innerHTML = '';
  if (itemCount) itemCount.textContent = `Showing ${currentFilteredRows.length} exhibit${currentFilteredRows.length === 1 ? '' : 's'}`;

  if (currentFilteredRows.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <span class="text-3xl mb-2 block">🔍</span>
        <p class="text-slate-600 dark:text-slate-300 font-bold text-sm">No exhibit results match your selected filters.</p>
        <button onclick="browseAllExhibits()" class="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Reset search and filters</button>
      </div>`;
    return;
  }

  currentFilteredRows.forEach(({ row, originalIndex }, arrayIndex) => {
    const rawContent = getVal(row, 2) || getVal(row, 0);
    const { title, details } = parseTitleAndDetails(rawContent);
    const displayTitle = title || `Exhibit Item #${originalIndex + 1}`;
    const slashFormattedTitle = formatTitleWithSlashes(displayTitle);

    const notes = getVal(row, 4);
    const age = getVal(row, 13);
    const type = getVal(row, 14);
    const category = getVal(row, 15);
    const subcategory = getVal(row, 16);
    const d3d = getVal(row, 17);
    const ddoc = getVal(row, 18);
    const dweb = getVal(row, 19);
    
    const img1Raw = getVal(row, 20);
    const img1 = formatImageUrl(img1Raw) || NO_IMAGE_SVG;
    const isFav = favs.includes(originalIndex);
    const ageBadgeClass = getAgeBadgeStyle(age);

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group relative';
    
    card.innerHTML = `
      <div class="h-56 bg-slate-100/80 dark:bg-slate-800/80 relative overflow-hidden flex items-center justify-center p-2">
        <a href="${img1}" target="_blank" onclick="event.stopPropagation()" title="Open image in new tab" class="w-full h-full flex items-center justify-center relative group/img">
          <img src="${img1}" class="max-w-full max-h-full object-contain group-hover/img:scale-105 transition-transform duration-300" alt="${displayTitle}" loading="lazy" onError="this.src='${NO_IMAGE_SVG}'" />
        </a>

        <button onclick="toggleFavorite(${originalIndex}, event)" aria-label="Favorite item" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}" class="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md transition shadow-sm hover:scale-110 flex items-center justify-center">
          ${isFav ? '❤️' : '🤍'}
        </button>

        ${notes ? `
          <button data-grid-audio-idx="${originalIndex}" onclick="speakAudioGuide(${originalIndex}, event)" aria-label="Listen to notes" title="Listen to Museum Notes" class="absolute top-12 right-3 p-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-blue-600 dark:text-blue-400 hover:text-blue-700 backdrop-blur-md transition shadow-sm text-xs font-bold">
            🔊
          </button>
        ` : ''}

        ${age ? `<span class="absolute top-3 left-3 ${ageBadgeClass} backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs sm:text-sm shadow-md pointer-events-none">${age}</span>` : ''}
      </div>
      
      <div class="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div class="flex gap-1.5 flex-wrap text-[11px] mb-2 font-semibold">
            ${category ? `<span class="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">${category}</span>` : ''}
            ${type ? `<span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full">${type}</span>` : ''}
            ${subcategory ? `<span class="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900">${subcategory}</span>` : ''}
          </div>
          
          <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">${slashFormattedTitle}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">${details || 'Click for full details and museum notes.'}</p>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Details <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </span>
          
          <div class="flex gap-1.5" onclick="event.stopPropagation()">
            ${d3d ? `<a href="${d3d}" target="_blank" title="3D Model" class="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white px-2.5 py-1 rounded-md text-xs font-semibold border border-purple-200 dark:border-purple-800 transition">3D</a>` : ''}
            ${ddoc ? `<a href="${ddoc}" target="_blank" title="Documentation" class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-800 hover:text-white px-2.5 py-1 rounded-md text-xs font-semibold transition">Doc</a>` : ''}
            ${dweb ? `<a href="${dweb}" target="_blank" title="Website" class="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-800 transition">Web</a>` : ''}
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openModalByFilteredIndex(arrayIndex));
    grid.appendChild(card);
  });

  updateAudioUI();
}

function renderGramophoneGrid() {
  const grid = document.getElementById('grid');
  const itemCount = document.getElementById('itemCount');
  const favs = getFavorites();

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5';
  grid.innerHTML = '';
  if (itemCount) itemCount.textContent = `Showing ${currentFilteredRows.length} gramophone record${currentFilteredRows.length === 1 ? '' : 's'}`;

  if (currentFilteredRows.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <span class="text-3xl mb-2 block">🎵</span>
        <p class="text-slate-600 dark:text-slate-300 font-bold text-sm">No gramophone records match your selected filters.</p>
        <button onclick="browseAllExhibits()" class="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Return to Main Museum Exhibits</button>
      </div>`;
    return;
  }

  currentFilteredRows.forEach(({ row, originalIndex }, arrayIndex) => {
    const artist = getVal(row, 1) || 'Unknown Artist';
    const rawTitle = getGramophoneRawTitle(row);
    const formattedTitleHTML = formatGramophoneTitle(rawTitle);

    const label = getVal(row, 3);
    const format = getVal(row, 4) || '78 RPM';
    const released = getVal(row, 6);
    const discogsUrl = getDiscogsUrl(row);
    const hasDiscogsRecording = checkIfHasRecording(row);
    const hasArchiveRecording = getVal(row, 11).toLowerCase().includes('yes');
    const isFav = favs.includes(originalIndex);

    const catalogNum = getVal(row, 0);
    const archiveUrl = buildArchiveSearchUrl(rawTitle, catalogNum);

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer group relative';

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${released ? `<span class="bg-amber-500/90 text-slate-950 font-extrabold px-3 py-1 rounded-lg text-xs shadow-sm">${released}</span>` : '<span class="bg-slate-200 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold">19??</span>'}
            ${label ? `<span class="text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80">${label}</span>` : ''}
            ${format ? `<span class="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">${format}</span>` : ''}
          </div>

          <button onclick="toggleFavorite(${originalIndex}, event)" aria-label="Favorite item" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>

        <p class="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">${artist}</p>
        <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">${formattedTitleHTML}</h3>
      </div>

      <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2" onclick="event.stopPropagation()">
        <span class="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          Details <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </span>

        <div class="flex items-center gap-1.5 flex-wrap justify-end">
          ${hasDiscogsRecording ? `
            <a href="${discogsUrl || '#'}" target="_blank" class="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-1 rounded-lg text-[10px] font-extrabold shadow-sm transition hover:bg-emerald-200 flex items-center gap-1">
              🎙️ Discogs Recording
            </a>
          ` : ''}

          ${hasArchiveRecording ? `
            <a href="${archiveUrl}" target="_blank" class="bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 px-2 py-1 rounded-lg text-[10px] font-extrabold shadow-sm transition hover:bg-sky-200 flex items-center gap-1">
              📻 Archives 78s Recording
            </a>
          ` : ''}

          ${discogsUrl && !hasDiscogsRecording ? `
            <a href="${discogsUrl}" target="_blank" class="bg-slate-800 hover:bg-black text-white px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
              📀 Discogs ↗
            </a>
          ` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => openModalByFilteredIndex(arrayIndex));
    grid.appendChild(card);
  });
}

function openModalByOriginalIndex(origIdx) {
  const filteredIndex = currentFilteredRows.findIndex(item => item.originalIndex === origIdx);
  if (filteredIndex !== -1) {
    openModalByFilteredIndex(filteredIndex);
  } else {
    const rows = currentTab === 'exhibits' ? rawExhibitsRows : rawGramophoneRows;
    if (rows[origIdx]) openModal(rows[origIdx], origIdx);
  }
}

function openModalByFilteredIndex(filteredIndex) {
  if (filteredIndex < 0 || filteredIndex >= currentFilteredRows.length) return;
  currentModalIndex = filteredIndex;
  const { row, originalIndex } = currentFilteredRows[filteredIndex];
  openModal(row, originalIndex);
}

function openModal(row, originalIndex) {
  stopAudioGuide();
  
  const modalContent = document.getElementById('modalContent');
  const counterElem = document.getElementById('modalCounter');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  const favs = getFavorites();
  const isFav = favs.includes(originalIndex);

  if (currentTab === 'exhibits') {
    window.history.replaceState(null, '', `#exhibit-${originalIndex}`);

    const rawContent = getVal(row, 2) || getVal(row, 0);
    const { title, details } = parseTitleAndDetails(rawContent);
    const displayTitle = title || 'Exhibit Item Details';

    const notes = getVal(row, 4);
    const age = getVal(row, 13);
    const type = getVal(row, 14);
    const category = getVal(row, 15);
    const subcategory = getVal(row, 16);
    const d3d = getVal(row, 17);
    const ddoc = getVal(row, 18);
    const dweb = getVal(row, 19);
    
    const img1 = formatImageUrl(getVal(row, 20));
    const img2 = formatImageUrl(getVal(row, 21));
    const ageBadgeClass = getAgeBadgeStyle(age);
    const hasTwoImages = Boolean(img1 && img2);

    if (currentModalIndex !== -1 && currentFilteredRows.length > 0) {
      counterElem.textContent = `${currentModalIndex + 1} of ${currentFilteredRows.length}`;
      prevBtn.disabled = currentModalIndex === 0;
      nextBtn.disabled = currentModalIndex === currentFilteredRows.length - 1;
      prevBtn.classList.toggle('opacity-40', currentModalIndex === 0);
      nextBtn.classList.toggle('opacity-40', currentModalIndex === currentFilteredRows.length - 1);
    } else {
      counterElem.textContent = '';
    }

    document.getElementById('btnShareExhibit').onclick = () => {
      const url = `${window.location.origin}${window.location.pathname}#exhibit-${originalIndex}`;
      navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!', '🔗'));
    };

    modalContent.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-2">
        <h2 id="modalTitle" class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">${displayTitle}</h2>
        <button onclick="toggleFavorite(${originalIndex}, event)" class="px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1 shrink-0 ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
          ${isFav ? '❤️ Saved' : '🤍 Save'}
        </button>
      </div>

      <div class="flex flex-wrap gap-2 text-xs mb-3.5">
        ${age ? `<span class="${ageBadgeClass} px-3 py-0.5 rounded-full"><strong>Age:</strong> ${age}</span>` : ''}
        ${type ? `<span class="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-0.5 rounded-full font-medium"><strong>Type:</strong> ${type}</span>` : ''}
        ${category ? `<span class="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900 px-3 py-0.5 rounded-full font-medium"><strong>Category:</strong> ${category}</span>` : ''}
        ${subcategory ? `<span class="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-900 px-3 py-0.5 rounded-full font-medium"><strong>Subcategory:</strong> ${subcategory}</span>` : ''}
      </div>

      <div class="grid grid-cols-1 ${img2 ? 'sm:grid-cols-2' : ''} gap-4 mb-4">
        ${img1 ? `
          <div>
            <div class="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Primary Image</p>
              ${notes ? `
                <div class="flex items-center gap-1 shrink-0">
                  <button id="btnAudioGuide" data-row="${originalIndex}" onclick="speakAudioGuide(${originalIndex})" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition shadow-sm">
                    🔊 Listen
                  </button>
                  <select id="voiceSelect" class="text-[10px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded p-0.5 font-medium max-w-[100px] truncate outline-none">
                  </select>
                </div>
              ` : ''}
              ${!hasTwoImages ? `<button id="btnGoogleSearchMain" class="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0 ml-auto">🔍 Google Item</button>` : ''}
            </div>
            <a href="${img1}" target="_blank" title="Click to view full image" class="block group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-2">
              <img src="${img1}" class="w-full h-56 sm:h-60 object-contain rounded-xl group-hover:scale-105 transition-transform duration-300" onError="this.src='${NO_IMAGE_SVG}'" alt="${displayTitle}" />
              <span class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow">Open Full Image ↗</span>
            </a>
          </div>` : ''}

        ${img2 ? `
          <div>
            <div class="flex items-center justify-between gap-1.5 mb-1.5">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Second Image</p>
              <button id="btnGoogleSearchSec" class="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0 ml-auto">🔍 Google Item</button>
            </div>
            <a href="${img2}" target="_blank" title="Click to view second image" class="block group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-2">
              <img src="${img2}" class="w-full h-56 sm:h-60 object-contain rounded-xl group-hover:scale-105 transition-transform duration-300" onError="this.src='${NO_IMAGE_SVG}'" alt="${displayTitle}" />
              <span class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow">Open Full Image ↗</span>
            </a>
          </div>` : ''}
      </div>

      ${details ? `<div class="mb-4"><h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Details</h4><div class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">${details}</div></div>` : ''}
      ${notes ? `<div class="mb-4"><h4 class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">Museum Notes</h4><div class="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-line bg-amber-50/70 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/60">${notes}</div></div>` : ''}
      ${d3d && (d3d.endsWith('.glb') || d3d.endsWith('.gltf')) ? `<div class="mb-4"><h4 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1.5">Interactive 3D Viewer</h4><model-viewer src="${d3d}" camera-controls auto-rotate class="w-full h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner"></model-viewer></div>` : ''}

      <div class="flex flex-wrap gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        ${d3d ? `<a href="${d3d}" target="_blank" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">3D Model ↗</a>` : ''}
        ${ddoc ? `<a href="${ddoc}" target="_blank" class="bg-slate-800 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">Documentation ↗</a>` : ''}
        ${dweb ? `<a href="${dweb}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">Web Link ↗</a>` : ''}
      </div>
    `;

    const btnMain = document.getElementById('btnGoogleSearchMain');
    const btnSec = document.getElementById('btnGoogleSearchSec');
    if (btnMain) btnMain.onclick = () => googleItemSearch(displayTitle, category, details);
    if (btnSec) btnSec.onclick = () => googleItemSearch(displayTitle, category, details);
    populateVoiceDropdown();

  } else {
    window.history.replaceState(null, '', `#gramophone-${originalIndex}`);

    const catalogNum = getVal(row, 0);
    const artist = getVal(row, 1) || 'Unknown Artist';
    const rawTitle = getGramophoneRawTitle(row);
    const formattedTitleHTML = formatGramophoneTitle(rawTitle);

    const label = getVal(row, 3) || 'Unspecified Label';
    const format = getVal(row, 4) || '';
    const released = getVal(row, 6) || '';
    const colMDetails = getVal(row, 12);
    const discogsUrl = getDiscogsUrl(row);
    const hasDiscogsRecording = checkIfHasRecording(row);
    const hasArchiveRecording = getVal(row, 11).toLowerCase().includes('yes');
    const hasAnyRecording = hasDiscogsRecording || hasArchiveRecording;

    const archiveUrl = buildArchiveSearchUrl(rawTitle, catalogNum);
    const cleanArtist = unescapeHTML(artist);
    const cleanTitle = unescapeHTML(rawTitle);
    const ytQuery = encodeURIComponent(`${cleanArtist} ${cleanTitle}`.replace(/^[AB][\s\.:-]+/gi, '').trim()).replace(/%20/g, '+');

    if (currentModalIndex !== -1 && currentFilteredRows.length > 0) {
      counterElem.textContent = `${currentModalIndex + 1} of ${currentFilteredRows.length}`;
      prevBtn.disabled = currentModalIndex === 0;
      nextBtn.disabled = currentModalIndex === currentFilteredRows.length - 1;
      prevBtn.classList.toggle('opacity-40', currentModalIndex === 0);
      nextBtn.classList.toggle('opacity-40', currentModalIndex === currentFilteredRows.length - 1);
    } else {
      counterElem.textContent = '';
    }

    document.getElementById('btnShareExhibit').onclick = () => {
      const url = `${window.location.origin}${window.location.pathname}#gramophone-${originalIndex}`;
      navigator.clipboard.writeText(url).then(() => showToast('Record link copied to clipboard!', '🔗'));
    };

    modalContent.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-2">
        <div>
          <h2 id="modalTitle" class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">${formattedTitleHTML}</h2>
        </div>
        <button onclick="toggleFavorite(${originalIndex}, event)" class="px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1 shrink-0 ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
          ${isFav ? '❤️ Saved' : '🤍 Save'}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs mb-4">
        ${released ? `<span class="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 px-3 py-0.5 rounded-full font-bold"><strong>Year:</strong> ${released}</span>` : ''}
        ${label ? `<span class="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-0.5 rounded-full font-medium"><strong>Label:</strong> ${label}</span>` : ''}
        ${format ? `<span class="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900 px-3 py-0.5 rounded-full font-medium"><strong>Format:</strong> ${format}</span>` : ''}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 items-stretch">
        <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-6 text-center flex flex-col items-center justify-center relative shadow-inner h-full min-h-[180px]">
          <div class="w-32 h-32 rounded-full border-4 border-amber-500/20 bg-slate-950 flex items-center justify-center shadow-2xl relative">
            <div class="w-12 h-12 rounded-full bg-amber-600 border-2 border-amber-300 flex items-center justify-center text-[9px] font-bold text-amber-100 text-center p-1 leading-tight">
              ${label}
            </div>
          </div>
        </div>

        <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 flex flex-col justify-center">
          <p><strong>Artist:</strong> <span class="font-semibold text-slate-900 dark:text-slate-100">${artist}</span></p>
          <p><strong>Record Label:</strong> ${label}</p>
          ${format ? `<p><strong>Format:</strong> ${format}</p>` : ''}
          <p><strong>Release Year:</strong> ${released || 'Unknown'}</p>
          ${catalogNum ? `<p><strong>Catalog No.:</strong> <span class="font-mono font-semibold">${catalogNum}</span></p>` : ''}
        </div>
      </div>

      ${colMDetails ? `
        <div class="mb-5">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Details</h4>
          <div class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">${colMDetails}</div>
        </div>
      ` : ''}

      <div class="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
        ${discogsUrl ? `
          <a href="${discogsUrl}" target="_blank" class="bg-slate-800 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2">
            <span>${hasDiscogsRecording ? '📀 Discogs Recording ↗' : '📀 Discogs ↗'}</span>
            ${hasDiscogsRecording ? `<span class="bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">🎙️ Recording</span>` : ''}
          </a>
        ` : ''}

        ${hasArchiveRecording ? `
          <a href="${archiveUrl}" target="_blank" class="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2">
            <span>📻 Archives 78s Recording ↗</span>
          </a>
        ` : ''}

        ${!hasAnyRecording ? `
          <a href="https://www.youtube.com/results?search_query=${ytQuery}" target="_blank" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5">
            <span>🎵 Search YouTube ↗</span>
          </a>
          <a href="${archiveUrl}" target="_blank" class="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5" title="Search the 78 RPM Collection on Internet Archive">
            <span>📻 Search Archive 78s ↗</span>
          </a>
        ` : ''}
      </div>
    `;
  }

  document.body.classList.add('overflow-hidden');
  document.getElementById('detailModal').classList.remove('hidden');
  document.getElementById('closeModal').focus();
}

function closeModal() {
  stopAudioGuide();
  document.body.classList.remove('overflow-hidden');
  document.getElementById('detailModal').classList.add('hidden');
  window.history.replaceState(null, '', ' ');
}

// Bind Event Listeners on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Header
  document.getElementById('brandLogoLink').addEventListener('click', (e) => {
    e.preventDefault();
    browseAllExhibits();
  });
  document.getElementById('btnBrowseAllHeader').addEventListener('click', browseAllExhibits);
  document.getElementById('btnBrowseAllPrompt').addEventListener('click', browseAllExhibits);

  document.getElementById('btnSurprise').addEventListener('click', () => {
    const rows = currentTab === 'exhibits' ? rawExhibitsRows : rawGramophoneRows;
    if (!rows || rows.length === 0) return;
    const randomIndex = Math.floor(Math.random() * rows.length);
    
    if (!isGridActive) {
      filterCatalog(true);
    }
    openModalByOriginalIndex(randomIndex);
  });

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bMMC_theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
  });

  const toggleControlsBtn = document.getElementById('toggleControlsBtn');
  if (toggleControlsBtn) {
    toggleControlsBtn.addEventListener('click', () => toggleCollapsibleControls());
  }

  document.getElementById('btn3DOnly').addEventListener('click', () => {
    only3DActive = !only3DActive;
    const btn = document.getElementById('btn3DOnly');
    if (only3DActive) {
      btn.classList.add('bg-purple-600', 'text-white', 'border-purple-600');
      btn.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-200', 'dark:border-slate-700');
    } else {
      btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-600');
      btn.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-200', 'dark:border-slate-700');
    }
    filterCatalog(true);
  });

  document.getElementById('btnFavorites').addEventListener('click', () => {
    showingFavoritesOnly = !showingFavoritesOnly;
    updateFavoritesBadge();
    filterCatalog(true);
  });

  document.getElementById('floatingJumpBtn').addEventListener('click', () => {
    scrollToGrid();
  });

  // Search & Filters
  document.getElementById('searchInput').addEventListener('input', () => filterCatalog(true));
  document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    filterCatalog(true);
  });

  // Modal Handlers
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('detailModal')) closeModal();
  });

  document.getElementById('modalPrevBtn').addEventListener('click', () => {
    if (currentModalIndex > 0) openModalByFilteredIndex(currentModalIndex - 1);
  });

  document.getElementById('modalNextBtn').addEventListener('click', () => {
    if (currentModalIndex < currentFilteredRows.length - 1) openModalByFilteredIndex(currentModalIndex + 1);
  });

  // Keyboard Shortcuts & Navigation
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('detailModal');
    if (modal.classList.contains('hidden')) return;

    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft' && currentModalIndex > 0) openModalByFilteredIndex(currentModalIndex - 1);
    if (e.key === 'ArrowRight' && currentModalIndex < currentFilteredRows.length - 1) openModalByFilteredIndex(currentModalIndex + 1);

    if (e.key === 'Tab') {
      const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });

  // Start Catalog Fetch & Initialization
  loadCatalogData();
});