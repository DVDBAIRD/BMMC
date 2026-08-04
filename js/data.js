import { EXHIBITS_CSV_URL, GRAMOPHONE_CSV_URL, state } from './config.js';
import { getVal, parseTitleAndDetails, parseYearForSort, getGramophoneRawTitle } from './utils.js';
import { fetchCSVWithCache, getFavorites } from './storage.js';
import { renderCollectionHubs, renderExhibitsGrid, renderGramophoneGrid } from './render.js';
import { updateFavoritesBadge, updateDynamicDropdowns, renderActiveFilterPills, scrollToGrid } from './ui.js';
import { stopAudioGuide } from './tts.js';
import { openModalByOriginalIndex } from './modal.js';

export function initFuseSearch() {
  if (typeof Fuse === 'undefined') return;

  if (state.rawExhibitsRows.length > 0) {
    const exhibitsList = state.rawExhibitsRows.map((row, index) => {
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

    state.fuseExhibits = new Fuse(exhibitsList, {
      keys: ['title', 'details', 'notes', 'type', 'category', 'subcategory', 'age'],
      threshold: 0.35,
      ignoreLocation: true
    });
  }

  if (state.rawGramophoneRows.length > 0) {
    const gramophoneList = state.rawGramophoneRows.map((row, index) => ({
      originalIndex: index,
      catalog: getVal(row, 0),
      artist: getVal(row, 1),
      title: getGramophoneRawTitle(row),
      label: getVal(row, 3),
      format: getVal(row, 4),
      year: getVal(row, 6),
      details: getVal(row, 12)
    }));

    state.fuseGramophone = new Fuse(gramophoneList, {
      keys: ['artist', 'title', 'label', 'catalog', 'details', 'year', 'format'],
      threshold: 0.35,
      ignoreLocation: true
    });
  }
}

export async function loadCatalogData() {
  import('./ui.js').then(m => m.initTheme());

  try {
    const exhibitsData = await fetchCSVWithCache(EXHIBITS_CSV_URL, 'bMMC_cached_exhibits');
    state.rawExhibitsRows = exhibitsData.slice(1);

    try {
      const gramophoneData = await fetchCSVWithCache(GRAMOPHONE_CSV_URL, 'bMMC_cached_gramophone');
      state.rawGramophoneRows = gramophoneData.filter(r => {
        const c0 = getVal(r, 0).toLowerCase();
        const c1 = getVal(r, 1).toLowerCase();
        return r.length >= 2 && !c0.includes('gramophone catalog') && !c0.includes('catalog#') && !c1.includes('artist');
      });
    } catch (gramErr) {
      console.warn("Could not load Gramophone sheet, falling back to exhibits:", gramErr);
    }

    initFuseSearch();
    renderCollectionHubs(state.rawExhibitsRows);
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

export function checkUrlHashForExhibit() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#exhibit-')) {
    const index = parseInt(hash.replace('#exhibit-', ''), 10);
    if (!isNaN(index) && state.rawExhibitsRows[index]) {
      filterCatalog(true);
      openModalByOriginalIndex(index);
    }
  } else if (hash && hash.startsWith('#gramophone-')) {
    const index = parseInt(hash.replace('#gramophone-', ''), 10);
    if (!isNaN(index) && state.rawGramophoneRows[index]) {
      setTab('gramophone');
      openModalByOriginalIndex(index);
    }
  }
}

export function browseAllExhibits() {
  if (state.currentTab !== 'exhibits') {
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

  state.only3DActive = false;
  state.showingFavoritesOnly = false;
  
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

export function setTab(tabName) {
  state.currentTab = tabName;
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

export function filterCatalog(forceShowGrid = false) {
  const searchVal = (document.getElementById('searchInput').value || '').trim();
  const sortBy = document.getElementById('sortBy').value;
  const favs = getFavorites();

  document.getElementById('clearSearch').classList.toggle('hidden', !searchVal);
  renderActiveFilterPills();

  if (state.currentTab === 'exhibits') {
    const ageVal = document.getElementById('filterAge').value;
    const typeVal = document.getElementById('filterType').value;
    const catVal = document.getElementById('filterCategory').value;
    const subCatVal = document.getElementById('filterSubcategory').value;

    const isFiltering = searchVal || ageVal || typeVal || catVal || subCatVal || state.only3DActive || state.showingFavoritesOnly;

    if (isFiltering || forceShowGrid) {
      state.isGridActive = true;
      document.getElementById('gridPrompt').classList.add('hidden');
      document.getElementById('grid').classList.remove('hidden');
      document.getElementById('floatingJumpBtn').classList.remove('hidden');
    } else if (!state.isGridActive) {
      document.getElementById('gridPrompt').classList.remove('hidden');
      document.getElementById('grid').classList.add('hidden');
      document.getElementById('floatingJumpBtn').classList.add('hidden');
      document.getElementById('itemCount').textContent = '';
      return;
    }

    let matchedOriginalIndices = null;
    if (searchVal && state.fuseExhibits) {
      const searchResults = state.fuseExhibits.search(searchVal);
      matchedOriginalIndices = new Set(searchResults.map(res => res.item.originalIndex));
    }

    state.currentFilteredRows = state.rawExhibitsRows.map((row, index) => ({ row, originalIndex: index })).filter(({ row, originalIndex }) => {
      const searchMatch = !searchVal || (matchedOriginalIndices ? matchedOriginalIndices.has(originalIndex) : row.join(' ').toLowerCase().includes(searchVal.toLowerCase()));
      const ageMatch = !ageVal || getVal(row, 13) === ageVal;
      const typeMatch = !typeVal || getVal(row, 14).toLowerCase().includes(typeVal.toLowerCase());
      const catMatch = !catVal || getVal(row, 15).toLowerCase().includes(catVal.toLowerCase());
      const subCatMatch = !subCatVal || getVal(row, 16) === subCatVal;
      const match3D = !state.only3DActive || getVal(row, 17) !== '';
      const matchFav = !state.showingFavoritesOnly || favs.includes(originalIndex);

      return searchMatch && ageMatch && typeMatch && catMatch && subCatMatch && match3D && matchFav;
    });

    if (sortBy === 'title-asc') {
      state.currentFilteredRows.sort((a, b) => parseTitleAndDetails(getVal(a.row, 2) || getVal(a.row, 0)).title.localeCompare(parseTitleAndDetails(getVal(b.row, 2) || getVal(b.row, 0)).title));
    } else if (sortBy === 'title-desc') {
      state.currentFilteredRows.sort((a, b) => parseTitleAndDetails(getVal(b.row, 2) || getVal(b.row, 0)).title.localeCompare(parseTitleAndDetails(getVal(a.row, 2) || getVal(a.row, 0)).title));
    } else if (sortBy === 'age-oldest') {
      state.currentFilteredRows.sort((a, b) => getVal(a.row, 13).localeCompare(getVal(b.row, 13)));
    } else if (sortBy === 'age-newest') {
      state.currentFilteredRows.sort((a, b) => getVal(b.row, 13).localeCompare(getVal(a.row, 13)));
    }

    renderExhibitsGrid();

  } else {
    const artistVal = document.getElementById('filterArtist').value;
    const labelVal = document.getElementById('filterLabel').value;
    const formatVal = document.getElementById('filterFormat').value;
    const yearVal = document.getElementById('filterYear').value;

    const isFiltering = searchVal || artistVal || labelVal || formatVal || yearVal || state.showingFavoritesOnly;

    if (isFiltering || forceShowGrid) {
      state.isGridActive = true;
      document.getElementById('gridPrompt').classList.add('hidden');
      document.getElementById('grid').classList.remove('hidden');
      document.getElementById('floatingJumpBtn').classList.remove('hidden');
    } else if (!state.isGridActive) {
      document.getElementById('gridPrompt').classList.remove('hidden');
      document.getElementById('grid').classList.add('hidden');
      document.getElementById('floatingJumpBtn').classList.add('hidden');
      document.getElementById('itemCount').textContent = '';
      return;
    }

    let matchedOriginalIndices = null;
    if (searchVal && state.fuseGramophone) {
      const searchResults = state.fuseGramophone.search(searchVal);
      matchedOriginalIndices = new Set(searchResults.map(res => res.item.originalIndex));
    }

    state.currentFilteredRows = state.rawGramophoneRows.map((row, index) => ({ row, originalIndex: index })).filter(({ row, originalIndex }) => {
      const searchMatch = !searchVal || (matchedOriginalIndices ? matchedOriginalIndices.has(originalIndex) : row.join(' ').toLowerCase().includes(searchVal.toLowerCase()));
      const artistMatch = !artistVal || getVal(row, 1) === artistVal;
      const labelMatch = !labelVal || getVal(row, 3) === labelVal;
      const formatMatch = !formatVal || getVal(row, 4) === formatVal;
      const yearMatch = !yearVal || getVal(row, 6) === yearVal;
      const matchFav = !state.showingFavoritesOnly || favs.includes(originalIndex);

      return searchMatch && artistMatch && labelMatch && formatMatch && yearMatch && matchFav;
    });

    if (sortBy === 'default' || sortBy === 'age-oldest') {
      state.currentFilteredRows.sort((a, b) => parseYearForSort(getVal(a.row, 6)) - parseYearForSort(getVal(b.row, 6)));
    } else if (sortBy === 'age-newest') {
      state.currentFilteredRows.sort((a, b) => {
        const yA = parseYearForSort(getVal(a.row, 6));
        const yB = parseYearForSort(getVal(b.row, 6));
        if (yA === 99999) return 1;
        if (yB === 99999) return -1;
        return yB - yA;
      });
    } else if (sortBy === 'title-asc') {
      state.currentFilteredRows.sort((a, b) => getGramophoneRawTitle(a.row).localeCompare(getGramophoneRawTitle(b.row)));
    } else if (sortBy === 'title-desc') {
      state.currentFilteredRows.sort((a, b) => getGramophoneRawTitle(b.row).localeCompare(getGramophoneRawTitle(a.row)));
    }

    renderGramophoneGrid();
  }
}