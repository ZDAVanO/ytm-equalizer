import { filterTypes } from '../filterTypes';

import './style.css'
import eq_icon from '@/assets/equalizer-svgrepo-com.svg'

import { devLog } from '../utils';

console.log('[content] YTM Equalizer Extension loaded');



let eqEnabled = false;
let eqToggleBtn: HTMLButtonElement | null = null;

const audioContext = new AudioContext();
const mediaElementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let previousAudioSource: MediaElementAudioSourceNode | null = null;
let lastPlayedElement: HTMLMediaElement | null = null;

const FILTER_COUNT = 10;
// const equalizerFilters: BiquadFilterNode[] = Array.from({ length: FILTER_COUNT }, () => audioContext.createBiquadFilter());
const equalizerFilters: BiquadFilterNode[] = Array.from({ length: FILTER_COUNT }, () => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 0;
    filter.Q.value = 1;
    filter.gain.value = 0;
    return filter;
});

let appliedFilters: BiquadFilterNode[] = [];



// MARK: waitForElem
function waitForElem(selector: string, cb: (el: Element) => void) {
    const el = document.querySelector(selector);
    if (el) {
        devLog(`[waitForElem] Found element: ${selector}`);
        return cb(el);
    }
    const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
            obs.disconnect();
            devLog(`[waitForElem] Found element via MutationObserver: ${selector}`);
            cb(el);
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}


// MARK: updateFilters
function updateFilters(filters: any[]) {
    filters.forEach((band, i) => {
        const filter = equalizerFilters[i];
        if (filter) {
            filter.type = filterTypes.includes(band.type) ? band.type : 'peaking';
            filter.frequency.value = band.freq || 0;
            filter.Q.value = band.Q || 1;
            filter.gain.value = band.gain || 0;
        }
    });
}


// MARK: applyEqualizer
function applyEqualizer(ae_audioElement: HTMLMediaElement) {
    devLog('[applyEqualizer]');

    let audioSource: MediaElementAudioSourceNode;

    if (mediaElementSources.has(ae_audioElement)) {
        devLog('MediaElementSourceNode already connected');
        audioSource = mediaElementSources.get(ae_audioElement)!;

    } else {
        devLog('MediaElementSourceNode not found, creating new one');
        audioSource = audioContext.createMediaElementSource(ae_audioElement);
        mediaElementSources.set(ae_audioElement, audioSource); // save source to weakmap
    }

    devLog('previousAudioSource', previousAudioSource);
    if (previousAudioSource) {
        previousAudioSource.disconnect();
    }

    devLog('mediaElementSources', mediaElementSources);


    appliedFilters.forEach((filter) => filter.disconnect());
    appliedFilters = [];


    let currentNode: AudioNode = audioSource;
    for (const filter of equalizerFilters) {
        // devLog('Connecting filter', filter);
        currentNode.connect(filter);
        appliedFilters.push(filter);
        currentNode = filter;
    }
    devLog('appliedFilters', appliedFilters);
    currentNode.connect(audioContext.destination);

    devLog('Equalizer applied');

    previousAudioSource = audioSource;
}


// MARK: disableEqualizer
function disableEqualizer(audioElement: HTMLMediaElement) {
    devLog('disableEqualizer');
    // Disconnect filters
    appliedFilters.forEach((filter) => filter.disconnect());
    appliedFilters = [];
    // Reconnect source directly to destination
    if (audioElement && mediaElementSources.has(audioElement)) {
        const sourceNode = mediaElementSources.get(audioElement)!;
        try {
            devLog('[disableEqualizer] Reconnecting sourceNode directly to destination');
            sourceNode.disconnect();
            sourceNode.connect(audioContext.destination);
        } catch (e) {
            console.warn('[disableEqualizer] Error reconnecting sourceNode:', e);
        }
    }
}


// MARK: applyEQIfPlaying
function applyEQIfPlaying() {
    devLog('applyEQIfPlaying');
    const audios = document.querySelectorAll<HTMLMediaElement>('audio, video');
    audios.forEach(audio => {
        if (!audio.paused && !audio.ended && audio.readyState > 2) {
            lastPlayedElement = audio;
            if (eqEnabled) {
                devLog('[applyEQIfPlaying] Applying EQ to currently playing element');
                applyEqualizer(audio);
            }
        }
    });
}


// MARK: Initial load from storage
chrome.storage.local.get(['eqEnabled', 'currentFilters'], (data) => {
    eqEnabled = !!data.eqEnabled;
    devLog('[content] eqEnabled state on load:', eqEnabled);

    // Load currentFilters
    if (Array.isArray(data.currentFilters) && data.currentFilters.length === equalizerFilters.length) {
        updateFilters(data.currentFilters);
        devLog('[content] Loaded currentFilters from storage:', data.currentFilters);
    }

    updateEQBtnVisual();

    applyEQIfPlaying();
});


// React to storage changes (all tabs update EQ automatically)
chrome.storage.onChanged.addListener((changes, area) => {
    devLog('[content] storage.onChanged detected:', changes, area);

    // Handle eqEnabled changes
    if (changes.eqEnabled) {
        eqEnabled = !!changes.eqEnabled.newValue;

        devLog('[content] eqEnabled changed:', eqEnabled);

        updateEQBtnVisual();

        if (lastPlayedElement) {
            if (eqEnabled) {
                applyEqualizer(lastPlayedElement);
            } else {
                disableEqualizer(lastPlayedElement);
            }
        }
    }

    // Handle direct filter changes
    if (changes.currentFilters) {
        devLog('[content] currentFilters changed:', changes.currentFilters.newValue);
        const newFilters = changes.currentFilters.newValue;
        if (Array.isArray(newFilters) && newFilters.length === equalizerFilters.length) {
            updateFilters(newFilters);
        }
    }
});


// MARK: Insert EQ Toggle Button
waitForElem('#right-content.right-content.style-scope.ytmusic-nav-bar', (panel) => {
    const btn = document.createElement("button");
    btn.className = "eq-toggle-btn";
    btn.innerHTML = `<img src="${eq_icon}" alt="EQ Icon">`;

    btn.onclick = () => {
        chrome.runtime.sendMessage({ action: "open_popup" });
    };

    eqToggleBtn = btn;
    panel.insertBefore(btn, panel.firstChild);

});


// MARK: updateEQBtnVisual
function updateEQBtnVisual() {
    if (eqToggleBtn) {
        eqToggleBtn.classList.toggle('on', eqEnabled);
    }
}


// MARK: Listen for play events
document.addEventListener('play', function (e) {
    lastPlayedElement = e.target as HTMLMediaElement;
    if (eqEnabled) {
        if (lastPlayedElement === e.target && appliedFilters.length > 0) {
            // Already applied
            devLog('[addEventListener play] Equalizer already applied to this element');
        } else {
            applyEqualizer(e.target as HTMLMediaElement);
        }
    }
}, true);







