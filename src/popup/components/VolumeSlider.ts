import * as Constants from "@constants";

export function VolumeSlider(sliderId: string, inputId?: string) {
  return `
    <div class="vol-control-vertical">
      <div class="vol-top-controls">
        <span id="vol-value-text" class="vol-value-text">1.00x</span>
      </div>
      <div class="vol-slider-wrapper">
        <div class="vol-zero-line"></div>
        <input class="vol-range-vertical" id="${sliderId}" type="range" value="0.5" min="0" max="1" step="0.001" orient="vertical" />
      </div>
      <div class="vol-bottom-controls">
        <button id="${Constants.VOLUME_RESET_BTN_ID}" class="vol-reset-btn" type="button">Reset</button>
      </div>
    </div>
  `;
}
