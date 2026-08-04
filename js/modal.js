import { state, NO_IMAGE_SVG } from './config.js';
import { 
  getVal, formatImageUrl, parseTitleAndDetails, getAgeBadgeStyle, 
  getGramophoneRawTitle, formatGramophoneTitle, getDiscogsUrl, 
  checkIfHasRecording, buildArchiveSearchUrl, unescapeHTML, googleItemSearch 
} from './utils.js';
import { getFavorites, toggleFavorite } from './storage.js';
import { stopAudioGuide, speakAudioGuide, populateVoiceDropdown } from './tts.js';
import { showToast } from './ui.js';

export function openModalByOriginalIndex(origIdx) {
  const filteredIndex = state.currentFilteredRows.findIndex(item => item.originalIndex === origIdx);
  if (filteredIndex !== -1) {
    openModalByFilteredIndex(filteredIndex);
  } else {
    const rows = state.currentTab === 'exhibits' ? state.rawExhibitsRows : state.rawGramophoneRows;
    if (rows[origIdx]) openModal(rows[origIdx], origIdx);
  }
}

export function openModalByFilteredIndex(filteredIndex) {
  if (filteredIndex < 0 || filteredIndex >= state.currentFilteredRows.length) return;
  state.currentModalIndex = filteredIndex;
  const { row, originalIndex } = state.currentFilteredRows[filteredIndex];
  openModal(row, originalIndex);
}

export function openModal(row, originalIndex) {
  stopAudioGuide();
  
  const modalContent = document.getElementById('modalContent');
  const counterElem = document.getElementById('modalCounter');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  const favs = getFavorites();
  const isFav = favs.includes(originalIndex);

  if (state.currentTab === 'exhibits') {
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

    if (state.currentModalIndex !== -1 && state.currentFilteredRows.length > 0) {
      counterElem.textContent = `${state.currentModalIndex + 1} of ${state.currentFilteredRows.length}`;
      prevBtn.disabled = state.currentModalIndex === 0;
      nextBtn.disabled = state.currentModalIndex === state.currentFilteredRows.length - 1;
      prevBtn.classList.toggle('opacity-40', state.currentModalIndex === 0);
      nextBtn.classList.toggle('opacity-40', state.currentModalIndex === state.currentFilteredRows.length - 1);
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
        <button id="btnModalSaveFav" class="px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1 shrink-0 ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
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
                  <button id="btnAudioGuide" data-row="${originalIndex}" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold transition shadow-sm">
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

    document.getElementById('btnModalSaveFav')?.addEventListener('click', (e) => toggleFavorite(originalIndex, e));
    document.getElementById('btnAudioGuide')?.addEventListener('click', (e) => speakAudioGuide(originalIndex, e));
    
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

    if (state.currentModalIndex !== -1 && state.currentFilteredRows.length > 0) {
      counterElem.textContent = `${state.currentModalIndex + 1} of ${state.currentFilteredRows.length}`;
      prevBtn.disabled = state.currentModalIndex === 0;
      nextBtn.disabled = state.currentModalIndex === state.currentFilteredRows.length - 1;
      prevBtn.classList.toggle('opacity-40', state.currentModalIndex === 0);
      nextBtn.classList.toggle('opacity-40', state.currentModalIndex === state.currentFilteredRows.length - 1);
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
        <button id="btnModalSaveFavGram" class="px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1 shrink-0 ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
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

    document.getElementById('btnModalSaveFavGram')?.addEventListener('click', (e) => toggleFavorite(originalIndex, e));
  }

  document.body.classList.add('overflow-hidden');
  document.getElementById('detailModal').classList.remove('hidden');
  document.getElementById('closeModal').focus();
}

export function closeModal() {
  stopAudioGuide();
  document.body.classList.remove('overflow-hidden');
  document.getElementById('detailModal').classList.add('hidden');
  window.history.replaceState(null, '', ' ');
}

export function initModalListeners() {
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.getElementById('detailModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detailModal')) closeModal();
  });

  document.getElementById('modalPrevBtn')?.addEventListener('click', () => {
    if (state.currentModalIndex > 0) openModalByFilteredIndex(state.currentModalIndex - 1);
  });

  document.getElementById('modalNextBtn')?.addEventListener('click', () => {
    if (state.currentModalIndex < state.currentFilteredRows.length - 1) openModalByFilteredIndex(state.currentModalIndex + 1);
  });

  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('detailModal');
    if (modal.classList.contains('hidden')) return;

    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft' && state.currentModalIndex > 0) openModalByFilteredIndex(state.currentModalIndex - 1);
    if (e.key === 'ArrowRight' && state.currentModalIndex < state.currentFilteredRows.length - 1) openModalByFilteredIndex(state.currentModalIndex + 1);

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
}