import * as Constants from "@constants";

export function VolumeSlider(sliderId: string, inputId: string) {
  return `
    <div class="vol-control-horizontal">
      <svg class="vol-icon" width="16" height="16" viewBox="0 0 24 24" fill="#8e8e93">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
      <input class="vol-range" id="${sliderId}" type="range" value="0.5" min="0" max="1" step="0.001" title="Volume slider" />
      <input type="number" id="${inputId}" class="vol-number-input" min="0" max="6" step="0.01" value="1.00" title="Volume gain" />
      <button id="${Constants.VOLUME_RESET_BTN_ID}" class="vol-reset-btn" type="button" title="Reset Volume to 1.0">1.0x</button>
    </div>
  `;
}
