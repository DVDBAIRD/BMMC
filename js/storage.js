import { CACHE_TTL_MS, state } from './config.js';
import { updateFavoritesBadge } from './ui.js';
import { filterCatalog } from './data.js';

export async function fetchCSVWithCache(url, cacheKey) {
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

export function getFavorites() {
  try {
    const key = state.currentTab === 'exhibits' ? 'bMMC_favorites' : 'bMMC_gramophone_favorites';
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch(e) { return []; }
}

export function toggleFavorite(rowIndex, event) {
  if (event) event.stopPropagation();
  let favs = getFavorites();
  const key = state.currentTab === 'exhibits' ? 'bMMC_favorites' : 'bMMC_gramophone_favorites';
  const adding = !favs.includes(rowIndex);
  
  if (adding) {
    favs.push(rowIndex);
    import('./ui.js').then(m => m.showToast('Saved to your collection', '❤️'));
  } else {
    favs = favs.filter(i => i !== rowIndex);
    import('./ui.js').then(m => m.showToast('Removed from saved items', '🤍'));
  }
  
  localStorage.setItem(key, JSON.stringify(favs));
  updateFavoritesBadge();
  
  if (state.isGridActive) {
    filterCatalog(true);
  }
}