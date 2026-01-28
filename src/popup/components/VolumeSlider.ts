import * as Constants from "@constants";

export function VolumeSlider(sliderId: string, inputId: string) {

  return `
    <div class="range-slider volume-slider-container">
      <div class="value">
        <input type="number" id="${inputId}" class="number-fx" min="0" max="6" step=".01" value="1.00">
      </div>
      <div class="slider-container">
        <div class="slider-bg-1">
          <div class="slider-bg-2"></div>
        </div>
        <input class="range-slider__range" id="${sliderId}" type="range" value="0.5" min="0" max="1" step="0.001">
      </div>

      <div class="freq-value">
        <p class="number-fx">Volume</p>
      </div>
      <div class="filter-type">
        <button id="${Constants.VOLUME_RESET_BTN_ID}" class="reset-btn" type="button" title="Reset Volume to 100%">Reset</button>
      </div>
      <div class="q-value">
        <div style="height: 21px;"></div>
      </div>
    </div>
  `;
}

