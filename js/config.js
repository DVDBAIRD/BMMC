export const EXHIBITS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1U3V1JIatKpTOyAHEMnscs0mdZ4vDNf4C7eX_fuUbj_s/gviz/tq?tqx=out:csv&gid=1146027655';
export const GRAMOPHONE_CSV_URL = 'https://docs.google.com/spreadsheets/d/1U3V1JIatKpTOyAHEMnscs0mdZ4vDNf4C7eX_fuUbj_s/gviz/tq?tqx=out:csv&gid=606568772';
export const NO_IMAGE_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22300%22%20viewBox%3D%220%200%20400%20300%22%3E%3Crect%20fill%3D%22%23f1f5f9%22%20width%3D%22400%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3ENo%20Image%20Available%3C%2Ftext%3E%3C%2Fsvg%3E';

export const MAIN_HUB_CATEGORIES = ["War", "Photography", "Survey", "General", "Documentation", "Household", "Collections"];
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour Cache

// Application State
export const state = {
  currentTab: 'exhibits',
  rawExhibitsRows: [],
  rawGramophoneRows: [],
  currentFilteredRows: [],
  currentModalIndex: -1,
  currentlySpeakingIndex: null,
  only3DActive: false,
  showingFavoritesOnly: false,
  isGridActive: false,
  currentSpeechUtterance: null,
  availableVoices: [],
  fuseExhibits: null,
  fuseGramophone: null
};