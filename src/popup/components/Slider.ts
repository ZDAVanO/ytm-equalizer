import {
  filterTypes,
  filterTypeDescriptions,
  filterTypeShort,
} from "../../filterTypes";

const freqLabels: Record<number, string> = {
  32: "32Hz",
  64: "64Hz",
  125: "125Hz",
  250: "250Hz",
  500: "500Hz",
  1000: "1KHz",
  2000: "2KHz",
  4000: "4KHz",
  8000: "8KHz",
  16000: "16KHz",
};

export function Slider(idx: number, freq: number) {
  return `
    <div class="range-slider">
      <div class="value">
        <input type="number" id="input${idx}" class="number-fx" min="-12" max="12" step=".1" value="0">
      </div>
      <div class="slider-container">
        <div class="slider-bg-1">
          <div class="slider-bg-2"></div>
        </div>
        <input class="range-slider__range" id="slider${idx}" type="range" value="0" min="-12" max="12" step=".01">
      </div>
      <div class="freq-value">
        <p class="number-fx">${freqLabels[freq] || freq + "Hz"}</p>
      </div>
      <div class="filter-type">
        <select id="filter-type-${idx}" class="number-fx">
          ${filterTypes
            .map(
              (type) =>
                `<option value="${type}" title="${filterTypeDescriptions[type]}">${filterTypeShort[type]}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="q-value">
        <input type="number" id="q-input-${idx}" class="number-fx" min="0.1" max="10" step="0.01" value="1.0"
          title="Q (Quality factor):&#10;Controls the bandwidth of the filter.&#10;Lower Q = wider filter.&#10;Higher Q = narrower filter." />
      </div>
    </div>
  `;
}
