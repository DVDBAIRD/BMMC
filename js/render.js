import { state, MAIN_HUB_CATEGORIES, NO_IMAGE_SVG } from './config.js';
import { 
  getVal, formatImageUrl, parseTitleAndDetails, formatTitleWithSlashes, 
  getAgeBadgeStyle, getGramophoneRawTitle, formatGramophoneTitle, 
  getDiscogsUrl, checkIfHasRecording, buildArchiveSearchUrl 
} from './utils.js';
import { getFavorites } from './storage.js';
import { updateAudioUI } from './tts.js';
import { openModalByFilteredIndex } from './modal.js';

export function renderCollectionHubs(rows) {
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
      import('./data.js').then(m => {
        m.setTab('exhibits');
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

        import('./ui.js').then(ui => {
          ui.updateDynamicDropdowns();
          m.filterCatalog(true);
          ui.scrollToGrid();
        });
      });
    });

    hubsGrid.appendChild(hubCard);
  });

  const gramophoneHubCard = document.createElement('div');
  gramophoneHubCard.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition duration-300 cursor-pointer flex flex-col group relative';
  gramophoneHubCard.innerHTML = `
    <div class="h-20 bg-slate-100/90 dark:bg-slate-800/90 relative overflow-hidden flex items-center justify-center p-1.5 text-3xl">
      🎵
      <span class="absolute top-1.5 right-1.5 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">${state.rawGramophoneRows.length}</span>
    </div>
    <div class="p-2 flex-1 flex flex-col justify-between">
      <h3 class="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">Gramophone Archive</h3>
      <span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-0.5">1916–1953 →</span>
    </div>
  `;

  gramophoneHubCard.addEventListener('click', () => {
    import('./data.js').then(m => m.setTab('gramophone'));
    import('./ui.js').then(ui => ui.scrollToGrid());
  });

  hubsGrid.appendChild(gramophoneHubCard);
  document.getElementById('collectionHubsSection').classList.remove('hidden');
}

export function renderExhibitsGrid() {
  const grid = document.getElementById('grid');
  const itemCount = document.getElementById('itemCount');
  const favs = getFavorites();

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
  grid.innerHTML = '';
  if (itemCount) itemCount.textContent = `Showing ${state.currentFilteredRows.length} exhibit${state.currentFilteredRows.length === 1 ? '' : 's'}`;

  if (state.currentFilteredRows.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <span class="text-3xl mb-2 block">🔍</span>
        <p class="text-slate-600 dark:text-slate-300 font-bold text-sm">No exhibit results match your selected filters.</p>
        <button id="btnResetExhibitsPrompt" class="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Reset search and filters</button>
      </div>`;
    document.getElementById('btnResetExhibitsPrompt')?.addEventListener('click', () => {
      import('./data.js').then(m => m.browseAllExhibits());
    });
    return;
  }

  state.currentFilteredRows.forEach(({ row, originalIndex }, arrayIndex) => {
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

        <button data-fav-idx="${originalIndex}" aria-label="Favorite item" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}" class="btn-fav-toggle absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md transition shadow-sm hover:scale-110 flex items-center justify-center">
          ${isFav ? '❤️' : '🤍'}
        </button>

        ${notes ? `
          <button data-grid-audio-idx="${originalIndex}" aria-label="Listen to notes" title="Listen to Museum Notes" class="btn-tts-toggle absolute top-12 right-3 p-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-blue-600 dark:text-blue-400 hover:text-blue-700 backdrop-blur-md transition shadow-sm text-xs font-bold">
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

    card.querySelector('.btn-fav-toggle')?.addEventListener('click', (e) => {
      import('./storage.js').then(m => m.toggleFavorite(originalIndex, e));
    });

    card.querySelector('.btn-tts-toggle')?.addEventListener('click', (e) => {
      import('./tts.js').then(m => m.speakAudioGuide(originalIndex, e));
    });

    card.addEventListener('click', () => openModalByFilteredIndex(arrayIndex));
    grid.appendChild(card);
  });

  updateAudioUI();
}

export function renderGramophoneGrid() {
  const grid = document.getElementById('grid');
  const itemCount = document.getElementById('itemCount');
  const favs = getFavorites();

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5';
  grid.innerHTML = '';
  if (itemCount) itemCount.textContent = `Showing ${state.currentFilteredRows.length} gramophone record${state.currentFilteredRows.length === 1 ? '' : 's'}`;

  if (state.currentFilteredRows.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <span class="text-3xl mb-2 block">🎵</span>
        <p class="text-slate-600 dark:text-slate-300 font-bold text-sm">No gramophone records match your selected filters.</p>
        <button id="btnResetGramophonePrompt" class="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Return to Main Museum Exhibits</button>
      </div>`;
    document.getElementById('btnResetGramophonePrompt')?.addEventListener('click', () => {
      import('./data.js').then(m => m.browseAllExhibits());
    });
    return;
  }

  state.currentFilteredRows.forEach(({ row, originalIndex }, arrayIndex) => {
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

          <button data-fav-idx="${originalIndex}" aria-label="Favorite item" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}" class="btn-fav-toggle p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition">
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

    card.querySelector('.btn-fav-toggle')?.addEventListener('click', (e) => {
      import('./storage.js').then(m => m.toggleFavorite(originalIndex, e));
    });

    card.addEventListener('click', () => openModalByFilteredIndex(arrayIndex));
    grid.appendChild(card);
  });
}