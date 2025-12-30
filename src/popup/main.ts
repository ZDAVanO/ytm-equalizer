import "./style.css";
import ytm_eq_icon from "@/assets/icon-128.png";
import { version } from "../../package.json";
import * as Constants from "@constants";
import defaultPresets, { presetDisplayNames } from "./defaultPresets";
import { StorageService } from "./services/StorageService";
import { Slider } from "./components/Slider";
import { SliderConfig, FilterPreset } from "./types";

const slidersConfig: SliderConfig[] = [
  { idx: 1, freq: 32 },
  { idx: 2, freq: 64 },
  { idx: 3, freq: 125 },
  { idx: 4, freq: 250 },
  { idx: 5, freq: 500 },
  { idx: 6, freq: 1000 },
  { idx: 7, freq: 2000 },
  { idx: 8, freq: 4000 },
  { idx: 9, freq: 8000 },
  { idx: 10, freq: 16000 },
];

const CUSTOM_PRESET_NAME = "[Custom]";

class PopupManager {
  private userPresets: FilterPreset[] = [];
  private eqToggle!: HTMLButtonElement;
  private presetsSelect!: HTMLSelectElement;
  private savePresetBtn!: HTMLButtonElement;
  private deletePresetBtn!: HTMLButtonElement;
  private presetModal!: HTMLDialogElement;
  private closeModalBtn!: HTMLButtonElement;
  private modalSaveBtn!: HTMLButtonElement;
  private modalCancelBtn!: HTMLButtonElement;
  private presetNameInput!: HTMLInputElement;

  constructor() {
    this.initHTML();
    this.initElements();
    this.initEventListeners();
    this.loadData();
  }

  private initHTML() {
    document.querySelector("#app")!.innerHTML = `
      <div class="top-panel">
        <div class="top-panel-left">
          <img src="${ytm_eq_icon}" alt="App Icon" class="logo" />
          <span class="app-title">Web Equalizer</span>
          <span class="app-version">v${version}</span>
        </div>
        <div class="top-panel-links">
          <a href="https://github.com/ZDAVanO/web-equalizer" target="_blank" class="top-panel-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"></path>
            </svg>
          </a>
        </div>
      </div>
      <div>
        <div class="card">
          <button id="${
            Constants.EQ_TOGGLE_BTN_ID
          }" type="button">Equalizer</button>
          <select id="${Constants.PRESETS_SELECT_ID}"></select>
          <button id="${
            Constants.SAVE_PRESET_BTN_ID
          }" type="button">New</button>
          <button id="${
            Constants.DELETE_PRESET_BTN_ID
          }" type="button">Delete</button>
        </div>
        <div class="sliders-row">
          ${slidersConfig.map((cfg) => Slider(cfg.idx, cfg.freq)).join("")}
        </div>
        <dialog id="${Constants.PRESET_MODAL_ID}" class="modal" closedby="any">
          <div class="modal-content">
            <div class="modal-header">
              <span class="modal-title">New preset</span>
              <button id="${
                Constants.CLOSE_MODAL_BTN_ID
              }" class="close" type="button" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
              <input id="${
                Constants.PRESET_NAME_INPUT_ID
              }" type="text" placeholder="New preset name" />
            </div>
            <div class="modal-footer">
              <button id="${
                Constants.MODAL_SAVE_BTN_ID
              }" type="button">Save</button>
              <button id="${
                Constants.MODAL_CANCEL_BTN_ID
              }" type="button">Close</button>
            </div>
          </div>
        </dialog>
      </div>
    `;
  }

  private initElements() {
    this.eqToggle = document.getElementById(
      Constants.EQ_TOGGLE_BTN_ID
    ) as HTMLButtonElement;
    this.presetsSelect = document.getElementById(
      Constants.PRESETS_SELECT_ID
    ) as HTMLSelectElement;
    this.savePresetBtn = document.getElementById(
      Constants.SAVE_PRESET_BTN_ID
    ) as HTMLButtonElement;
    this.deletePresetBtn = document.getElementById(
      Constants.DELETE_PRESET_BTN_ID
    ) as HTMLButtonElement;
    this.presetModal = document.getElementById(
      Constants.PRESET_MODAL_ID
    ) as HTMLDialogElement;
    this.closeModalBtn = document.getElementById(
      Constants.CLOSE_MODAL_BTN_ID
    ) as HTMLButtonElement;
    this.modalSaveBtn = document.getElementById(
      Constants.MODAL_SAVE_BTN_ID
    ) as HTMLButtonElement;
    this.modalCancelBtn = document.getElementById(
      Constants.MODAL_CANCEL_BTN_ID
    ) as HTMLButtonElement;
    this.presetNameInput = document.getElementById(
      Constants.PRESET_NAME_INPUT_ID
    ) as HTMLInputElement;
  }

  private initEventListeners() {
    this.eqToggle.addEventListener("click", () => this.toggleEq());
    this.presetsSelect.addEventListener("change", () =>
      this.handlePresetChange()
    );
    this.savePresetBtn.addEventListener("click", () => this.openPresetModal());
    this.deletePresetBtn.addEventListener("click", () => this.deletePreset());
    this.closeModalBtn.onclick = () => this.presetModal.close();
    this.modalCancelBtn.onclick = () => this.presetModal.close();
    this.modalSaveBtn.addEventListener("click", () => this.saveNewPreset());

    slidersConfig.forEach((cfg) => {
      const idx = cfg.idx;
      const sliderElem = document.getElementById(
        `slider${idx}`
      ) as HTMLInputElement;
      const inputElem = document.getElementById(
        `input${idx}`
      ) as HTMLInputElement;
      const filterTypeElem = document.getElementById(
        `filter-type-${idx}`
      ) as HTMLSelectElement;
      const qInputElem = document.getElementById(
        `q-input-${idx}`
      ) as HTMLInputElement;

      sliderElem.oninput = () => {
        inputElem.value = sliderElem.value;
        this.handleEqChanges();
      };

      inputElem.addEventListener("input", () => {
        let val = parseFloat(inputElem.value);
        if (isNaN(val)) val = 0;
        val = Math.max(
          Number(sliderElem.min),
          Math.min(Number(sliderElem.max), val)
        );
        sliderElem.value = val.toString();
        inputElem.value = sliderElem.value;
        this.handleEqChanges();
      });

      filterTypeElem.addEventListener("change", () => this.handleEqChanges());

      qInputElem.addEventListener("input", () => {
        let val = parseFloat(qInputElem.value);
        if (isNaN(val)) val = 1.0;
        val = Math.max(0.1, Math.min(10, val));
        qInputElem.value = val.toString();
        this.handleEqChanges();
      });

      qInputElem.addEventListener("blur", () => {
        let val = parseFloat(qInputElem.value);
        if (isNaN(val)) val = 1.0;
        val = Math.max(0.1, Math.min(10, val));
        qInputElem.value = val.toString();
      });

      const handleWheel = (
        e: WheelEvent,
        el: HTMLInputElement,
        step: number,
        min: number,
        max: number
      ) => {
        e.preventDefault();
        let val = parseFloat(el.value);
        if (isNaN(val)) val = 0;
        val += e.deltaY < 0 ? step : -step;
        val = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
        el.value = val.toString();
        if (el === inputElem) sliderElem.value = el.value;
        if (el === sliderElem) inputElem.value = el.value;
        this.handleEqChanges();
      };

      qInputElem.addEventListener("wheel", (e) =>
        handleWheel(e, qInputElem, 0.01, 0.1, 10)
      );
      inputElem.addEventListener("wheel", (e) =>
        handleWheel(e, inputElem, 0.05, -12, 12)
      );
      sliderElem.addEventListener("wheel", (e) =>
        handleWheel(e, sliderElem, 0.05, -12, 12)
      );
    });
  }

  private async loadData() {
    this.userPresets = await StorageService.getUserPresets();
    this.updatePresetsSelector();

    const selectedPreset =
      (await StorageService.getSelectedPreset()) || defaultPresets[0].name;
    this.presetsSelect.value = selectedPreset;
    this.setSlidersFromPreset(selectedPreset);

    const eqEnabled = await StorageService.getEqEnabled();
    this.updateEqToggleUI(eqEnabled);
    this.updateDeleteButtonState();
  }

  private updatePresetsSelector() {
    this.presetsSelect.innerHTML = "";

    const createOption = (name: string, displayName: string) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = displayName;
      return option;
    };

    if (this.userPresets.length > 0) {
      const userGroup = document.createElement("optgroup");
      userGroup.label = "My presets";
      this.userPresets.forEach((p) => {
        userGroup.appendChild(createOption(p.name, p.name));
      });
      this.presetsSelect.appendChild(userGroup);
    }

    const defaultGroup = document.createElement("optgroup");
    defaultGroup.label = "Predefined presets";
    defaultPresets.forEach((p) => {
      const displayName = presetDisplayNames[p.name] || p.name;
      defaultGroup.appendChild(createOption(p.name, displayName));
    });
    this.presetsSelect.appendChild(defaultGroup);
  }

  private setSlidersFromPreset(presetName: string) {
    const allPresets = [...defaultPresets, ...this.userPresets];
    const preset =
      allPresets.find((p) => p.name === presetName) || defaultPresets[0];

    preset.filters.forEach((filter, i) => {
      const idx = i + 1;
      (document.getElementById(`slider${idx}`) as HTMLInputElement).value =
        filter.gain.toString();
      (document.getElementById(`input${idx}`) as HTMLInputElement).value =
        filter.gain.toString();
      (
        document.getElementById(`filter-type-${idx}`) as HTMLSelectElement
      ).value = filter.type;
      (document.getElementById(`q-input-${idx}`) as HTMLInputElement).value =
        filter.Q.toString();
    });
    this.updateDeleteButtonState();
  }

  private updateDeleteButtonState() {
    const name = this.presetsSelect.value;
    const isUser = this.userPresets.some((p) => p.name === name);
    this.deletePresetBtn.disabled = !isUser || name === CUSTOM_PRESET_NAME;
  }

  private async toggleEq() {
    const enabled = await StorageService.getEqEnabled();
    const newState = !enabled;
    await StorageService.setEqEnabled(newState);
    this.updateEqToggleUI(newState);
  }

  private updateEqToggleUI(enabled: boolean) {
    this.eqToggle.classList.toggle("on", enabled);
    this.eqToggle.textContent = enabled ? "Equalizer ON" : "Equalizer OFF";
  }

  private handlePresetChange() {
    const name = this.presetsSelect.value;
    StorageService.setSelectedPreset(name);
    this.setSlidersFromPreset(name);
    this.updateCurrentFilters();
  }

  private openPresetModal() {
    this.presetModal.showModal();
    this.presetNameInput.value = "";
    this.presetNameInput.focus();
  }

  private async saveNewPreset() {
    const name = this.presetNameInput.value.trim();
    if (!name) return alert("Enter a name for your preset.");
    if ([...defaultPresets, ...this.userPresets].some((p) => p.name === name))
      return alert("Preset name already exists.");

    const newPreset: FilterPreset = {
      name,
      filters: this.getCurrentFiltersFromUI(),
    };
    this.userPresets.push(newPreset);
    await StorageService.setUserPresets(this.userPresets);

    this.updatePresetsSelector();
    this.presetsSelect.value = name;
    await StorageService.setSelectedPreset(name);
    this.presetModal.close();
    this.updateDeleteButtonState();
  }

  private async deletePreset() {
    const name = this.presetsSelect.value;
    
    const isUser = this.userPresets.some((p) => p.name === name);
    if (!isUser || name === CUSTOM_PRESET_NAME) {
      return;
    }

    this.userPresets = this.userPresets.filter((p) => p.name !== name);
    await StorageService.setUserPresets(this.userPresets);
    this.updatePresetsSelector();
    const nextPreset = defaultPresets[0].name;
    this.presetsSelect.value = nextPreset;
    await StorageService.setSelectedPreset(nextPreset);
    this.setSlidersFromPreset(nextPreset);
    this.updateCurrentFilters();
  }

  private getCurrentFiltersFromUI() {
    return slidersConfig.map((_, i) => ({
      freq: slidersConfig[i].freq,
      gain: parseFloat(
        (document.getElementById(`slider${i + 1}`) as HTMLInputElement).value
      ),
      Q: parseFloat(
        (document.getElementById(`q-input-${i + 1}`) as HTMLInputElement).value
      ),
      type: (
        document.getElementById(`filter-type-${i + 1}`) as HTMLSelectElement
      ).value as BiquadFilterType,
    }));
  }

  private updateCurrentFilters() {
    StorageService.setCurrentFilters(this.getCurrentFiltersFromUI());
  }

  private handleEqChanges() {
    this.autosavePreset();
    this.updateCurrentFilters();
  }

  private async autosavePreset() {
    const name = this.presetsSelect.value;
    const filters = this.getCurrentFiltersFromUI();
    const isUser = this.userPresets.some((p) => p.name === name);

    if (isUser) {
      const idx = this.userPresets.findIndex((p) => p.name === name);
      if (idx !== -1) this.userPresets[idx].filters = filters;

      const customIdx = this.userPresets.findIndex(
        (p) => p.name === CUSTOM_PRESET_NAME
      );
      if (customIdx !== -1) this.userPresets[customIdx].filters = filters;
      else this.userPresets.push({ name: CUSTOM_PRESET_NAME, filters });

      await StorageService.setUserPresets(this.userPresets);
    } else {
      const customIdx = this.userPresets.findIndex(
        (p) => p.name === CUSTOM_PRESET_NAME
      );
      if (customIdx !== -1) this.userPresets[customIdx].filters = filters;
      else this.userPresets.push({ name: CUSTOM_PRESET_NAME, filters });

      await StorageService.setUserPresets(this.userPresets);
      this.updatePresetsSelector();
      this.presetsSelect.value = CUSTOM_PRESET_NAME;
      await StorageService.setSelectedPreset(CUSTOM_PRESET_NAME);
    }
  }
}

new PopupManager();
