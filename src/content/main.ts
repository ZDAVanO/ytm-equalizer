import { Vibrant } from "node-vibrant/browser";

import { filterTypes } from '../filterTypes';
import { devLog } from '../utils';

import './style.css'
import eq_icon from '@/assets/equalizer-svgrepo-com.svg'


console.log('[content] YTM Equalizer Extension loaded');



let eqEnabled = false;
let eqToggleBtn: HTMLButtonElement | null = null;

const audioContext = new AudioContext();
const mediaElementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let previousAudioSource: MediaElementAudioSourceNode | null = null;
let lastPlayedElement: HTMLMediaElement | null = null;

const FILTER_COUNT = 10;
const equalizerFilters: BiquadFilterNode[] = Array.from({ length: FILTER_COUNT }, () => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 0;
    filter.Q.value = 1;
    filter.gain.value = 0;
    return filter;
});

let appliedFilters: BiquadFilterNode[] = [];


const SONG_IMAGE_SELECTOR = '#song-image>#thumbnail>#img';
const DEFAULT_GLOW_COLOR = 'rgba(250, 72, 111, 1)';



// MARK: updateButtonGlow
// Function to get color and update CSS variable
async function updateButtonGlow(imageUrl: string) {
    if (!imageUrl) return;

    try {
        const palette = await Vibrant.from(imageUrl).getPalette();
        
        // Priority: LightVibrant (usually brighter), then Vibrant
        const swatch = palette.LightVibrant || palette.Vibrant || palette.Muted;

        let finalColor = DEFAULT_GLOW_COLOR;

        if (swatch) {
            // Vibrant returns hsl in format [H (0-1), S (0-1), L (0-1)] or [0-360, ...] depending on version.
            // In newer versions it's often [360, 1.0, 1.0].
            const [h, s, l] = swatch.hsl;

            // 🔥 MAGIC HERE: Normalize brightness
            // If brightness (l) is less than 50% (0.5), set it to 60% (0.6)
            // Blue color at L=0.6 becomes bright "Electric Blue"
            const minLightness = 0.6; 
            const newL = l < minLightness ? minLightness : l;

            // Form CSS HSL string
            // Note: node-vibrant v3.x returns h=0..1, v3.2+ h=0..360. 
            // Check console.log(swatch.hsl), but usually these are numbers:
            // If using 'node-vibrant/browser', usually h: 0-1, s: 0-1, l: 0-1
            // BUT if standard version, h in degrees. 
            // Reliable formatting option:
            
            // Since Vibrant returns an array, use its hex if you don't want to bother with HSL,
            // BUT to fix the issue, we need HSL.
            
            // Assume standard: H(0-360), S(0-1), L(0-1)
            finalColor = `hsl(${h * 360}, ${s * 100}%, ${newL * 100}%)`; 
            
            // ⚠️ If colors suddenly look "broken", try without multiplication:
            // finalColor = `hsl(${h}, ${s * 100}%, ${newL * 100}%)`;
        }

        devLog(`[updateButtonGlow] Set Color: ${finalColor}`);

        if (eqToggleBtn) {
            eqToggleBtn.style.setProperty('--glow-color', finalColor);
        }
    } catch (err) {
        console.warn('[updateButtonGlow] Failed to extract color', err);
        if (eqToggleBtn) {
            eqToggleBtn.style.setProperty('--glow-color', DEFAULT_GLOW_COLOR);
        }
    }
}



// MARK: setupAlbumArtObserver
// Watch for image changes (adapted from your dom.ts example)
function setupAlbumArtObserver() {
    waitForElem(SONG_IMAGE_SELECTOR, (element) => {
        const imgElement = element as HTMLImageElement;
        
        // 1. Run once for current image on load
        updateButtonGlow(imgElement.src);

        // 2. Create observer for src attribute changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    devLog('[AlbumArtObserver] Image src changed');
                    updateButtonGlow(imgElement.src);
                }
            }
        });

        observer.observe(imgElement, { 
            attributes: true, 
            attributeFilter: ['src'] // only react to src changes
        });
        
        devLog('[setupAlbumArtObserver] Observer attached');
    });
}


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
    btn.innerHTML = `<img src="${eq_icon}" alt="EQ Icon" draggable="false">`;
    btn.title = "Open Equalizer";

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




setupAlbumArtObserver();


