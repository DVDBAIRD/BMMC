import { state } from './config.js';
import { loadCatalogData, filterCatalog, browseAllExhibits } from './data.js';
import { 
  toggleCollapsibleControls, updateThemeUI, scrollToGrid, 
  updateDynamicDropdowns, updateFavoritesBadge 
} from './ui.js';
import { loadVoices } from './tts.js';
import { initModalListeners, openModalByOriginalIndex } from './modal.js';

document.addEventListener('DOMContentLoaded', () => {
  // Theme & Voice Initialization
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Header & Controls Buttons
  document.getElementById('headerLogoLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    browseAllExhibits();
  });

  document.getElementById('btnBrowseAllHeader')?.addEventListener('click', browseAllExhibits);
  document.getElementById('btnBrowseAllPrompt')?.addEventListener('click', browseAllExhibits);

  document.getElementById('toggleControlsBtn')?.addEventListener('click', () => toggleCollapsibleControls());

  document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bMMC_theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
  });

  document.getElementById('btnFavorites')?.addEventListener('click', () => {
    state.showingFavoritesOnly = !state.showingFavoritesOnly;
    updateFavoritesBadge();
    filterCatalog(true);
  });

  document.getElementById('btn3DOnly')?.addEventListener('click', () => {
    state.only3DActive = !state.only3DActive;
    const btn = document.getElementById('btn3DOnly');
    if (state.only3DActive) {
      btn.classList.add('bg-purple-600', 'text-white', 'border-purple-600');
      btn.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-200', 'dark:border-slate-700');
    } else {
      btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-600');
      btn.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-200', 'border-slate-200', 'dark:border-slate-700');
    }
    filterCatalog(true);
  });

  document.getElementById('btnSurprise')?.addEventListener('click', () => {
    const rows = state.currentTab === 'exhibits' ? state.rawExhibitsRows : state.rawGramophoneRows;
    if (!rows || rows.length === 0) return;
    const randomIndex = Math.floor(Math.random() * rows.length);
    
    if (!state.isGridActive) {
      filterCatalog(true);
    }
    openModalByOriginalIndex(randomIndex);
  });

  document.getElementById('floatingJumpBtn')?.addEventListener('click', scrollToGrid);

  // Search & Sorting Listeners
  document.getElementById('searchInput')?.addEventListener('input', () => filterCatalog(true));
  document.getElementById('clearSearch')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    filterCatalog(true);
  });

  document.getElementById('sortBy')?.addEventListener('change', () => filterCatalog(true));
  document.getElementById('btnClearAllFilters')?.addEventListener('click', browseAllExhibits);

  // Dynamic Dropdown Event Listeners
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

  // Modal Keyboard & Navigation Listeners
  initModalListeners();

  // Load CSV Data & Initialize Catalog Engine
  loadCatalogData();
});