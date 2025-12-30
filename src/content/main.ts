import './style.css';

// import * as Constants from '@constants';
import { devLog } from '@utils';

import { insertEQButton, updateEQBtnVisual } from './eqButton';

import {
  updateFilters,
  applyEqualizer,
  disableEqualizer,
  applyEQIfPlaying,
  equalizerFilters,
  // lastPlayedElement,
  setLastPlayedElement,
  toggleEQForAll,
  // getLastPlayedElement
} from './equalizer';


console.log('[content] Web Equalizer Extension loaded');


let eqEnabled = false;
let eqBtn: HTMLButtonElement | null = null;

devLog('[content] hostname:', window.location.hostname);
if (window.location.hostname === 'music.youtube.com') {
    devLog('[content] Detected YouTube Music domain, inserting EQ button');
    eqBtn = insertEQButton(() => {
        chrome.runtime.sendMessage({ action: "open_popup" });
    });
}

// Global media element observer to catch dynamically added videos/audios
const mediaObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLMediaElement) {
                devLog('[mediaObserver] New media element found:', node);
                if (eqEnabled) applyEqualizer(node);
            } else if (node instanceof HTMLElement) {
                const media = node.querySelectorAll('audio, video');
                media.forEach(m => {
                    devLog('[mediaObserver] New nested media found:', m);
                    if (eqEnabled) applyEqualizer(m as HTMLMediaElement);
                });
            }
        });
    }
});
mediaObserver.observe(document.body, { childList: true, subtree: true });


// MARK: Initial load from storage
chrome.storage.local.get(['eqEnabled', 'currentFilters'], (data) => {
    eqEnabled = !!data.eqEnabled;
    devLog('[content] eqEnabled state on load:', eqEnabled);

    // Load currentFilters
    if (Array.isArray(data.currentFilters) && data.currentFilters.length === equalizerFilters.length) {
        updateFilters(data.currentFilters);
        devLog('[content] Loaded currentFilters from storage:', data.currentFilters);
    }

    updateEQBtnVisual(eqBtn, eqEnabled);
    applyEQIfPlaying(eqEnabled);
});


// React to storage changes (all tabs update EQ automatically)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    devLog('[content] storage.onChanged detected:', changes);

    // Handle eqEnabled changes
    if (changes.eqEnabled) {
        eqEnabled = !!changes.eqEnabled.newValue;
        devLog('[content] eqEnabled changed:', eqEnabled);

        updateEQBtnVisual(eqBtn, eqEnabled);
        toggleEQForAll(eqEnabled);
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


// MARK: Listen for play events
document.addEventListener('play', function (e) {
    const target = e.target as HTMLMediaElement;
    setLastPlayedElement(target);
    
    if (eqEnabled) {
        applyEqualizer(target);
    } else {
        // We don't necessarily need to attach if disabled, 
        // but if it was previously attached, we should ensure it's in the right state.
        disableEqualizer(target);
    }
}, true);




