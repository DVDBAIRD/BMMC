import { state } from './config.js';
import { getFavorites } from './storage.js';

export function showToast(msg, icon = '✨') {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').textContent = icon;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
  setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
  }, 2500);
}

export function initTheme() {
  const savedTheme = localStorage.getItem('bMMC_theme');
  const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeUI(isDark);
}

export function updateThemeUI(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (icon && text) {
    icon.textContent = isDark ? '☀️' : '🌙';
    text.textContent = isDark ? 'Day Mode' : 'Night Mode';
  }
}

export function toggleCollapsibleControls(show) {
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

export function scrollToGrid() {
  const header = document.getElementById('mainHeader');
  const headerHeight = header ? header.offsetHeight : 100;
  const gridElem = document.getElementById('gridSection');
  if (!gridElem) return;
  const targetPos = gridElem.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
  window.scrollTo({ top: Math.max(0, targetPos), behavior: 'smooth' });
}

export function updateFavoritesBadge() {
  const favs = getFavorites();
  const heartIcon = document.getElementById('favHeartIcon');
  const favCountText = document.getElementById('favCountText');
  const btnFav = document.getElementById('btnFavorites');

  if (favCountText) favCountText.textContent = `Saved (${favs.length})`;
  if (heartIcon) heartIcon.textContent = favs.length > 0 ? '❤️' : '🤍';

  if (btnFav) {
    if (state.showingFavoritesOnly) {
      btnFav.classList.add('bg-rose-600', 'text-white', 'border-rose-600');
      btnFav.classList.remove('bg-slate-100', 'text-slate-700', 'border-slate-200', 'dark:bg-slate-800', 'dark:text-slate-200');
    } else {
      btnFav.classList.remove('bg-rose-600', 'text-white', 'border-rose-600');
      btnFav.classList.add('bg-slate-100', 'text-slate-700', 'border-slate-200', 'dark:bg-slate-800', 'dark:text-slate-200');
    }
  }
}

export function updateDynamicDropdowns() {
  import('./utils.js').then(m => {
    if (state.currentTab === 'exhibits') {
      const catVal = document.getElementById('filterCategory').value;
      const typeVal = document.getElementById('filterType').value;

      let availableRows = state.rawExhibitsRows;
      if (catVal) availableRows = availableRows.filter(r => m.getVal(r, 15).toLowerCase().includes(catVal.toLowerCase()));
      if (typeVal) availableRows = availableRows.filter(r => m.getVal(r, 14).toLowerCase().includes(typeVal.toLowerCase()));

      updateSelectOptions('filterAge', state.rawExhibitsRows.map(r => m.getVal(r, 13)));
      updateSelectOptions('filterType', state.rawExhibitsRows.map(r => m.getVal(r, 14)));
      updateSelectOptions('filterCategory', state.rawExhibitsRows.map(r => m.getVal(r, 15)));
      updateSelectOptions('filterSubcategory', availableRows.map(r => m.getVal(r, 16)));
    } else {
      const artistVal = document.getElementById('filterArtist').value;
      let availableRows = state.rawGramophoneRows;
      if (artistVal) availableRows = availableRows.filter(r => m.getVal(r, 1) === artistVal);

      updateSelectOptions('filterArtist', state.rawGramophoneRows.map(r => m.getVal(r, 1)));
      updateSelectOptions('filterLabel', availableRows.map(r => m.getVal(r, 3)));
      updateSelectOptions('filterFormat', availableRows.map(r => m.getVal(r, 4)));
      updateSelectOptions('filterYear', availableRows.map(r => m.getVal(r, 6)));
    }
  });
}

export function updateSelectOptions(elementId, values) {
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

export function renderActiveFilterPills() {
  const container = document.getElementById('activeFiltersContainer');
  const bar = document.getElementById('activeFiltersBar');
  if (!container || !bar) return;

  container.innerHTML = '';
  const filters = [];

  const searchVal = document.getElementById('searchInput').value;

  if (state.currentTab === 'exhibits') {
    const ageVal = document.getElementById('filterAge').value;
    const typeVal = document.getElementById('filterType').value;
    const catVal = document.getElementById('filterCategory').value;
    const subCatVal = document.getElementById('filterSubcategory').value;

    if (searchVal) filters.push({ label: `Search: "${searchVal}"`, clear: () => { document.getElementById('searchInput').value = ''; } });
    if (ageVal) filters.push({ label: `Age: ${ageVal}`, clear: () => { document.getElementById('filterAge').value = ''; } });
    if (typeVal) filters.push({ label: `Type: ${typeVal}`, clear: () => { document.getElementById('filterType').value = ''; } });
    if (catVal) filters.push({ label: `Category: ${catVal}`, clear: () => { document.getElementById('filterCategory').value = ''; } });
    if (subCatVal) filters.push({ label: `Subcategory: ${subCatVal}`, clear: () => { document.getElementById('filterSubcategory').value = ''; } });
    if (state.only3DActive) filters.push({ label: `3D Models Only`, clear: () => { document.getElementById('btn3DOnly').click(); return false; } });
  } else {
    filters.push({ label: `Archive Mode: Gramophone`, clear: () => import('./data.js').then(m => m.browseAllExhibits()) });
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

  if (state.showingFavoritesOnly) filters.push({ label: `Saved Items`, clear: () => { state.showingFavoritesOnly = false; updateFavoritesBadge(); } });

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
        import('./data.js').then(m => m.filterCatalog(true));
      });
      container.appendChild(pill);
    });
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}