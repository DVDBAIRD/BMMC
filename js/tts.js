import { state } from './config.js';
import { getVal } from './utils.js';
import { showToast } from './ui.js';

export function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  state.availableVoices = voices.filter(v => v.lang.startsWith('en'));
  const highQualityKeywords = ['natural', 'neural', 'enhanced', 'premium', 'google', 'online', 'siri', 'edge'];
  state.availableVoices.sort((a, b) => {
    const aScore = highQualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
    const bScore = highQualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
    return bScore - aScore;
  });
  populateVoiceDropdown();
}

export function getSelectedVoice() {
  if (state.availableVoices.length === 0) return null;
  const savedName = localStorage.getItem('bMMC_selectedVoiceName');
  if (savedName) {
    const found = state.availableVoices.find(v => v.name === savedName);
    if (found) return found;
  }
  return state.availableVoices[0];
}

export function populateVoiceDropdown() {
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  select.innerHTML = '';
  const currentVoice = getSelectedVoice();

  state.availableVoices.forEach(voice => {
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

export function speakAudioGuide(originalIndex, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const isSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;

  // Toggle off if currently speaking this exact item
  if (state.currentlySpeakingIndex === originalIndex && isSpeaking) {
    stopAudioGuide();
    return;
  }

  const row = state.rawExhibitsRows[originalIndex];
  if (!row) return;

  const notes = getVal(row, 4);
  if (!notes || notes.trim() === '') {
    showToast('No Museum Notes available for audio narration', 'ℹ️');
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    state.currentlySpeakingIndex = originalIndex;
    const cleanNotes = notes.replace(/^#\s*/, '');
    const textToSpeak = `Museum Note: ${cleanNotes}`;
    state.currentSpeechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    
    const chosenVoice = getSelectedVoice();
    if (chosenVoice) state.currentSpeechUtterance.voice = chosenVoice;

    state.currentSpeechUtterance.rate = 0.92;
    state.currentSpeechUtterance.pitch = 1.0;
    
    state.currentSpeechUtterance.onend = () => { 
      state.currentlySpeakingIndex = null; 
      updateAudioUI(); 
    };
    state.currentSpeechUtterance.onerror = () => { 
      state.currentlySpeakingIndex = null; 
      updateAudioUI(); 
    };

    window.speechSynthesis.speak(state.currentSpeechUtterance);
    updateAudioUI();
  } else {
    alert('Speech Synthesis is not supported in this browser.');
  }
}

export function stopAudioGuide() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentlySpeakingIndex = null;
  updateAudioUI();
}

export function updateAudioUI() {
  const isSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;

  document.querySelectorAll('[data-grid-audio-idx]').forEach(btn => {
    const idx = parseInt(btn.getAttribute('data-grid-audio-idx'), 10);
    if (state.currentlySpeakingIndex === idx && isSpeaking) {
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
    if (state.currentlySpeakingIndex === modalRowIdx && isSpeaking) {
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
      btnModal.onclick = (e) => speakAudioGuide(modalRowIdx, e);
    }
  }
}