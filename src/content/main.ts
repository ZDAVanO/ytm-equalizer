import './style.css';

import { devLog, matchesDomain } from '@utils';

import { insertEQButton, updateEQBtnVisual } from './eqButton';

import {
  updateFilters,
  updateVolume,
  applyEqualizer,
  disableEqualizer,
  applyEQIfPlaying,
  // lastPlayedElement,
  setLastPlayedElement,
  toggleEQForAll,
  // getLastPlayedElement
} from './equalizer';

console.log('[content] Web Equalizer Extension loaded');

let masterEqEnabled = false;
let filterMode: 'blocklist' | 'allowlist' = 'blocklist';
let blockList: string[] = [];
let allowList: string[] = [];
let effectiveEqEnabled = false;

let eqBtn: HTMLButtonElement | null = null;
let currentHostname = window.location.hostname;

function computeEffectiveEq(): boolean {
    if (!masterEqEnabled) return false;
    if (filterMode === 'blocklist') {
        const isBlocked = blockList.some(domain => matchesDomain(currentHostname, domain));
        return !isBlocked;
    } else {
        const isAllowed = allowList.some(domain => matchesDomain(currentHostname, domain));
        return isAllowed;
    }
}

function updateStateAndApply() {
    const newEffective = computeEffectiveEq();
    const changed = effectiveEqEnabled !== newEffective;
    effectiveEqEnabled = newEffective;
    
    devLog('[content] state update:', { currentHostname, masterEqEnabled, filterMode, effectiveEqEnabled, changed });
    updateEQBtnVisual(eqBtn, effectiveEqEnabled);
    if (changed) {
        toggleEQForAll(effectiveEqEnabled);
    }
}

// Get the top-level hostname to handle iframes correctly
chrome.runtime.sendMessage({ action: "get_tab_hostname" }, (response) => {
    if (response && response.hostname) {
        currentHostname = response.hostname;
        devLog('[content] Updated to tab hostname:', currentHostname);
        
        // Refresh volume and EQ state with the correct hostname
        chrome.storage.local.get(['siteVolumes', 'eqEnabled', 'filterMode', 'blockList', 'allowList'], (data) => {
            const siteVolumes: Record<string, number> = (data.siteVolumes as Record<string, number>) || {};
            const volume = siteVolumes[currentHostname];
            if (typeof volume === 'number') {
                updateVolume(volume);
                devLog('[content] Re-loaded site volume for:', currentHostname, volume);
            }
            if (data.filterMode) filterMode = data.filterMode === 'allowlist' ? 'allowlist' : 'blocklist';
            if (Array.isArray(data.blockList)) blockList = data.blockList;
            if (Array.isArray(data.allowList)) allowList = data.allowList;
            if (typeof data.eqEnabled === 'boolean') masterEqEnabled = data.eqEnabled;
            updateStateAndApply();
        });
    }
});

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
                if (!node.crossOrigin) node.crossOrigin = 'anonymous';
                if (effectiveEqEnabled) applyEqualizer(node);
            } else if (node instanceof HTMLElement) {
                const media = node.querySelectorAll('audio, video');
                media.forEach(m => {
                    devLog('[mediaObserver] New nested media found:', m);
                    const el = m as HTMLMediaElement;
                    if (!el.crossOrigin) el.crossOrigin = 'anonymous';
                    if (effectiveEqEnabled) applyEqualizer(el);
                });
            }
        });
    }
});
mediaObserver.observe(document.body, { childList: true, subtree: true });


function applyEffectiveFilters() {
    chrome.storage.local.get(['currentFilters', 'siteFilters', 'siteOverrides'], (data) => {
        const siteOverrides: Record<string, boolean> = (data.siteOverrides as Record<string, boolean>) || {};
        const isOverride = Boolean(siteOverrides[currentHostname]);
        if (isOverride) {
            const siteFilters: Record<string, any[]> = (data.siteFilters as Record<string, any[]>) || {};
            if (Array.isArray(siteFilters[currentHostname])) {
                updateFilters(siteFilters[currentHostname]);
                devLog('[content] Loaded siteFilters for:', currentHostname, siteFilters[currentHostname]);
                return;
            }
        }
        if (Array.isArray(data.currentFilters)) {
            updateFilters(data.currentFilters);
            devLog('[content] Loaded currentFilters from storage:', data.currentFilters);
        }
    });
}

function applyEffectiveVolume() {
    chrome.storage.local.get(['globalVolume', 'siteVolumes', 'siteOverrides'], (data) => {
        const siteOverrides: Record<string, boolean> = (data.siteOverrides as Record<string, boolean>) || {};
        const isOverride = Boolean(siteOverrides[currentHostname]);
        if (isOverride) {
            const siteVolumes: Record<string, number> = (data.siteVolumes as Record<string, number>) || {};
            if (typeof siteVolumes[currentHostname] === 'number') {
                updateVolume(siteVolumes[currentHostname]);
                devLog('[content] Loaded siteVolume for:', currentHostname, siteVolumes[currentHostname]);
                return;
            }
        }
        const globalVolume = typeof data.globalVolume === 'number' ? data.globalVolume : 1.0;
        updateVolume(globalVolume);
        devLog('[content] Loaded globalVolume:', globalVolume);
    });
}

// MARK: Initial load from storage
chrome.storage.local.get(['eqEnabled', 'filterMode', 'blockList', 'allowList'], (data) => {
    masterEqEnabled = !!data.eqEnabled;
    filterMode = data.filterMode === 'allowlist' ? 'allowlist' : 'blocklist';
    blockList = Array.isArray(data.blockList) ? data.blockList : [];
    allowList = Array.isArray(data.allowList) ? data.allowList : [];

    effectiveEqEnabled = computeEffectiveEq();
    devLog('[content] effectiveEqEnabled state on load:', effectiveEqEnabled);

    // Load effective filters and volume (site-specific if override active, else global)
    applyEffectiveFilters();
    applyEffectiveVolume();

    updateEQBtnVisual(eqBtn, effectiveEqEnabled);
    applyEQIfPlaying(effectiveEqEnabled);
});


// React to storage changes (all tabs update EQ automatically)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    devLog('[content] storage.onChanged detected:', changes);

    let needsStateReeval = false;

    // Handle eqEnabled changes
    if (changes.eqEnabled !== undefined) {
        masterEqEnabled = !!changes.eqEnabled.newValue;
        needsStateReeval = true;
    }

    // Handle filterMode changes
    if (changes.filterMode !== undefined) {
        filterMode = changes.filterMode.newValue === 'allowlist' ? 'allowlist' : 'blocklist';
        needsStateReeval = true;
    }

    // Handle blockList changes
    if (changes.blockList !== undefined) {
        blockList = Array.isArray(changes.blockList.newValue) ? changes.blockList.newValue : [];
        needsStateReeval = true;
    }

    // Handle allowList changes
    if (changes.allowList !== undefined) {
        allowList = Array.isArray(changes.allowList.newValue) ? changes.allowList.newValue : [];
        needsStateReeval = true;
    }

    if (needsStateReeval) {
        updateStateAndApply();
    }

    // Handle filter or override changes
    if (changes.currentFilters || changes.siteFilters || changes.siteOverrides) {
        applyEffectiveFilters();
    }

    // Handle volume or override changes
    if (changes.globalVolume || changes.siteVolumes || changes.siteOverrides) {
        applyEffectiveVolume();
    }
});




// MARK: Listen for play events
document.addEventListener('play', function (e) {
    const target = e.target as HTMLMediaElement;
    if (target && !target.crossOrigin) {
        target.crossOrigin = 'anonymous';
    }
    setLastPlayedElement(target);
    
    if (effectiveEqEnabled) {
        applyEqualizer(target);
    } else {
        // We don't necessarily need to attach if disabled, 
        // but if it was previously attached, we should ensure it's in the right state.
        disableEqualizer(target);
    }
}, true);





