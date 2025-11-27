import { Vibrant } from "node-vibrant/browser";

import { devLog, waitForElem } from '../utils';

const SONG_IMAGE_SELECTOR = '#song-image>#thumbnail>#img';
const DEFAULT_GLOW_COLOR = 'rgba(250, 72, 111, 1)';


// MARK: extractGlowColorFromImage
export async function extractGlowColorFromImage(imageUrl: string): Promise<string> {
    if (!imageUrl) return DEFAULT_GLOW_COLOR;

    try {
        const palette = await Vibrant.from(imageUrl).getPalette();

        // Priority: LightVibrant (usually brighter), then Vibrant
        const swatch = palette.LightVibrant || palette.Vibrant || palette.Muted;

        if (swatch) {
            // Vibrant returns hsl in format [H (0-1), S (0-1), L (0-1)] or [0-360, ...] depending on version.
            // In newer versions it's often [360, 1.0, 1.0].
            const [h, s, l] = swatch.hsl;

            // Normalize brightness
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
            return `hsl(${h * 360}, ${s * 100}%, ${newL * 100}%)`;

            // ⚠️ If colors suddenly look "broken", try without multiplication:
            // finalColor = `hsl(${h}, ${s * 100}%, ${newL * 100}%)`;
        }
    } catch (err) {
        console.warn('[extractGlowColorFromImage] Failed to extract color', err);
    }
    return DEFAULT_GLOW_COLOR;
}


// MARK: updateButtonGlow
export async function updateButtonGlow(imageUrl: string, eqToggleBtn: HTMLButtonElement | null) {
    const finalColor = await extractGlowColorFromImage(imageUrl);
    devLog(`[updateButtonGlow] Set Color: ${finalColor}`);
    if (eqToggleBtn) {
        eqToggleBtn.style.setProperty('--glow-color', finalColor);
    }
}


// MARK: setupAlbumArtObserver
export function setupAlbumArtObserver(onImageChange: (imageUrl: string) => void) {
    waitForElem(SONG_IMAGE_SELECTOR, (element) => {
        const imgElement = element as HTMLImageElement;

        // 1. Run once for current image on load
        onImageChange(imgElement.src);

        // 2. Create observer for src attribute changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    devLog('[AlbumArtObserver] Image src changed');
                    onImageChange(imgElement.src);
                }
            }
        });

        observer.observe(imgElement, { 
            attributes: true, 
            attributeFilter: ['src']
        });

        devLog('[setupAlbumArtObserver] Observer attached');
    });
}



