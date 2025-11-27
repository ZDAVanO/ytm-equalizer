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
export let previousAudioSource: MediaElementAudioSourceNode | null = null;

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
    // Connect to analyser before destination
    // currentNode.connect(analyser);
    // analyser.connect(audioContext.destination);

    devLog('Equalizer applied');

    previousAudioSource = audioSource;
}


// MARK: disableEqualizer
export function disableEqualizer(audioElement: HTMLMediaElement) {
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
            // Still connect through analyser even if EQ is disabled, so visualizer works
            // sourceNode.connect(analyser);
            // analyser.connect(audioContext.destination);
            
        } catch (e) {
            console.warn('[disableEqualizer] Error reconnecting sourceNode:', e);
        }
    }
}


// MARK: applyEQIfPlaying
export function applyEQIfPlaying(eqEnabled: boolean) {
    devLog('applyEQIfPlaying');
    const audios = document.querySelectorAll<HTMLMediaElement>('audio, video');
    audios.forEach(audio => {
        if (!audio.paused && !audio.ended && audio.readyState > 2) {
            lastPlayedElement = audio;
            if (eqEnabled) {
                devLog('[applyEQIfPlaying] Applying EQ to currently playing element');
                applyEqualizer(audio);
            // } else {
            //      // Even if EQ is disabled, we might want to attach for visualizer if we want it always on
            //      disableEqualizer(audio);
            }
        }
    });
}