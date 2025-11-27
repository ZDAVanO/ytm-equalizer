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
  appliedFilters,
  lastPlayedElement,
  setLastPlayedElement,
  // getLastPlayedElement
} from './equalizer';


console.log('[content] YTM Equalizer Extension loaded');


let eqEnabled = false;
let eqBtn: HTMLButtonElement | null = null;

if (window.location.hostname === 'music.youtube.com') {
    devLog('[content] Detected YouTube Music domain, inserting EQ button');
    eqBtn = insertEQButton(() => {
        chrome.runtime.sendMessage({ action: "open_popup" });
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

    updateEQBtnVisual(eqBtn, eqEnabled);

    applyEQIfPlaying(eqEnabled);
});


// React to storage changes (all tabs update EQ automatically)
chrome.storage.onChanged.addListener((changes, area) => {
    devLog('[content] storage.onChanged detected:', changes, area);

    // Handle eqEnabled changes
    if (changes.eqEnabled) {
        eqEnabled = !!changes.eqEnabled.newValue;

        devLog('[content] eqEnabled changed:', eqEnabled);

        updateEQBtnVisual(eqBtn, eqEnabled);

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


// MARK: Listen for play events
document.addEventListener('play', function (e) {
    // lastPlayedElement = e.target as HTMLMediaElement;
    setLastPlayedElement(e.target as HTMLMediaElement);
    if (eqEnabled) {
        if (lastPlayedElement === e.target && appliedFilters.length > 0) {
            // Already applied
            devLog('[addEventListener play] Equalizer already applied to this element');
        } else {
            applyEqualizer(e.target as HTMLMediaElement);
        }
    // } else {
    //     // If EQ disabled, ensure visualizer is connected
    //     disableEqualizer(e.target as HTMLMediaElement);
    }
}, true);




