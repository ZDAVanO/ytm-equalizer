import { devLog } from '@utils';
import { filterTypes } from '../filterTypes';


export const audioContext = new AudioContext();
// const analyser = audioContext.createAnalyser();
// analyser.fftSize = 256; // Set FFT size for visualizer


export const FILTER_COUNT = 10;
export const equalizerFilters: BiquadFilterNode[] = Array.from({ length: FILTER_COUNT }, () => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 0;
    filter.Q.value = 1;
    filter.gain.value = 0;
    return filter;
});


export const mediaElementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
export let lastPlayedElement: HTMLMediaElement | null = null;
export function setLastPlayedElement(el: HTMLMediaElement | null) {
    lastPlayedElement = el;
}
export function getLastPlayedElement() {
    return lastPlayedElement;
}

export let appliedFilters: BiquadFilterNode[] = [];


// MARK: updateFilters
export function updateFilters(filters: any[]) {
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
export function applyEqualizer(ae_audioElement: HTMLMediaElement) {
    devLog('[applyEqualizer] element:', ae_audioElement);

    // AudioContext must be resumed after user gesture
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => devLog('[applyEqualizer] AudioContext resumed'));
    }

    let audioSource: MediaElementAudioSourceNode;

    if (mediaElementSources.has(ae_audioElement)) {
        audioSource = mediaElementSources.get(ae_audioElement)!;
    } else {
        devLog('[applyEqualizer] creating new MediaElementSourceNode');
        try {
            audioSource = audioContext.createMediaElementSource(ae_audioElement);
            mediaElementSources.set(ae_audioElement, audioSource);
        } catch (e) {
            console.warn('[applyEqualizer] Failed to create MediaElementSourceNode (possibly cross-origin):', e);
            return;
        }
    }

    // Ensure the filter chain itself is connected to destination
    setupFilterChain();

    // Re-route this source through the filters
    try {
        audioSource.disconnect();
        audioSource.connect(equalizerFilters[0]);
        devLog('[applyEqualizer] Equalizer applied and connected to filter chain');
    } catch (e) {
        console.warn('[applyEqualizer] Error connecting source node:', e);
    }
}


// MARK: disableEqualizer
export function disableEqualizer(audioElement: HTMLMediaElement) {
    devLog('[disableEqualizer] element:', audioElement);
    
    if (audioElement && mediaElementSources.has(audioElement)) {
        const sourceNode = mediaElementSources.get(audioElement)!;
        try {
            sourceNode.disconnect();
            sourceNode.connect(audioContext.destination);
            devLog('[disableEqualizer] Reconnected sourceNode directly to destination');
        } catch (e) {
            console.warn('[disableEqualizer] Error reconnecting sourceNode:', e);
        }
    }
}

let filterChainInitialized = false;
function setupFilterChain() {
    if (filterChainInitialized) return;

    devLog('[setupFilterChain] Connecting filter chain...');

    for (let i = 0; i < equalizerFilters.length; i++) {
        const filter = equalizerFilters[i];
        const nextFilter = equalizerFilters[i + 1];
        
        filter.disconnect(); // Clear previous
        if (nextFilter) {
            filter.connect(nextFilter);
        } else {
            filter.connect(audioContext.destination);
        }
    }
    appliedFilters = [...equalizerFilters];
    filterChainInitialized = true;
}


// MARK: applyEQIfPlaying
export function applyEQIfPlaying(eqEnabled: boolean) {
    devLog('applyEQIfPlaying', eqEnabled);
    const audios = document.querySelectorAll<HTMLMediaElement>('audio, video');
    audios.forEach(audio => {
        if (!audio.paused && !audio.ended && audio.readyState > 2) {
            if (eqEnabled) {
                applyEqualizer(audio);
            } else {
                disableEqualizer(audio);
            }
        }
    });
}

/**
 * Toggles the EQ for all currently present elements.
 */
// MARK: toggleEQForAll
export function toggleEQForAll(enabled: boolean) {
    devLog('toggleEQForAll:', enabled);
    const audios = document.querySelectorAll<HTMLMediaElement>('audio, video');
    audios.forEach(el => {
        if (enabled) {
            applyEqualizer(el);
        } else {
            disableEqualizer(el);
        }
    });
}
