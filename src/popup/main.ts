import './style.css';
import ytm_eq_icon from '@/assets/icon-128.png';

import { version } from '../../package.json';

import defaultPresets, { FilterPreset, presetDisplayNames } from '../defaultPresets';
import { filterTypes, filterTypeShort, filterTypeDescriptions } from '../filterTypes';
import { devLog } from '../utils';

console.log('Popup script loaded');



const slidersConfig = [
  { idx: 1, freq: 32 },
  { idx: 2, freq: 64 },
  { idx: 3, freq: 125 },
  { idx: 4, freq: 250 },
  { idx: 5, freq: 500 },
  { idx: 6, freq: 1000 },
  { idx: 7, freq: 2000 },
  { idx: 8, freq: 4000 },
  { idx: 9, freq: 8000 },
  { idx: 10, freq: 16000 }
];

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
  16000: "16KHz"
};




// MARK: renderSlider
function renderSlider(idx: number, freq: number) {
  return `
    <div id="range-slider" class="range-slider">

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
        <p id="output" class="number-fx">${freqLabels[freq]}</p>
      </div>

      <div class="filter-type">
        <select id="filter-type-${idx}" class="number-fx">
          ${filterTypes.map(type =>
            `<option value="${type}" title="${filterTypeDescriptions[type]}">${filterTypeShort[type]}</option>`
          ).join('')}
        </select>
      </div>

      <div class="q-value">
        <input type="number" id="q-input-${idx}" class="number-fx" min="0.1" max="10" step="0.01" value="1.0"
          title="Q (Quality factor):&#10;Controls the bandwidth of the filter.&#10;Lower Q = wider filter.&#10;Higher Q = narrower filter." />
      </div>

    </div>
  `;
}



// Set up the main HTML structure for the popup
document.querySelector('#app')!.innerHTML = `

  <div class="top-panel">

    <div class="top-panel-left">
      <img src="${ytm_eq_icon}" alt="App Icon" class="logo" />
      <span class="app-title">YTM Equalizer</span>
      <span class="app-version">v${version}</span>
    </div>

    <div class="top-panel-links">
      <a href="https://github.com/ZDAVanO/ytm-equalizer" target="_blank" class="top-panel-link">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"></path>
        </svg>
      </a>
    </div>

  </div>

  <div>

    <div class="card">
      <button id="eq-toggle-btn" type="button">Equalizer</button>
      <select id="presets-select"></select>
      <button id="save-preset-btn" type="button">New</button>
      <button id="delete-preset-btn" type="button">Delete</button>
    </div>

    <div class="sliders-row">
      ${slidersConfig.map(cfg => renderSlider(cfg.idx, cfg.freq)).join('')}
    </div>

    <!-- Modal for new preset name -->
    <div id="preset-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">New preset</span>
          <button id="close-modal" class="close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <input id="preset-name-input" type="text" placeholder="New preset name" />
        </div>
        <div class="modal-footer">
          <button id="modal-save-btn" type="button">Save</button>
          <button id="modal-cancel-btn" type="button">Close</button>
        </div>
      </div>
    </div>
    
  </div>
`



let userPresets: FilterPreset[] = []

let currentFilters: FilterPreset['filters'] = []

const eqToggle = document.getElementById('eq-toggle-btn') as HTMLButtonElement;

const presetsSelect = document.getElementById('presets-select') as HTMLSelectElement;

const savePresetBtn = document.getElementById('save-preset-btn') as HTMLButtonElement
const deletePresetBtn = document.getElementById('delete-preset-btn') as HTMLButtonElement

const presetModal = document.getElementById('preset-modal') as HTMLDivElement
const closeModalBtn = document.getElementById('close-modal') as HTMLButtonElement
const modalSaveBtn = document.getElementById('modal-save-btn') as HTMLButtonElement
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement
const presetNameInput = document.getElementById('preset-name-input') as HTMLInputElement

const customPresetName = "[Custom]"




// MARK: updatePresetsSelector
function updatePresetsSelector() {
  // Group user presets and default presets using <optgroup>
  let html = '';
  if (userPresets.length > 0) {
    html += `<optgroup label="My presets">`;
    html += userPresets.map((preset) =>
      `<option value="${preset.name}">${preset.name}</option>`
    ).join('');
    html += `</optgroup>`;
  }
  html += `<optgroup label="Predefined presets">`;
  html += defaultPresets.map((preset) =>
    `<option value="${preset.name}">${presetDisplayNames[preset.name] || preset.name}</option>`
  ).join('');
  html += `</optgroup>`;
  presetsSelect.innerHTML = html;
  // Update delete button state after rendering
  updateDeleteButtonState();
}


function updateDeleteButtonState() {
  const selectedName = presetsSelect.value
  deletePresetBtn.disabled = !isUserPreset(selectedName) || selectedName === customPresetName;
}


function isUserPreset(name: string) {
  return userPresets.some(p => p.name === name)
}

function isDefaultPreset(name: string) {
  return defaultPresets.some(p => p.name === name);
}


function setSlidersFromPreset(presetName: string) {
  const allPresets = [...defaultPresets, ...userPresets]
  const preset = allPresets.find(p => p.name === presetName) || defaultPresets[0]
  
  preset.filters.forEach((filter, i) => {
    const sliderElem = document.getElementById(`slider${i+1}`) as HTMLInputElement
    const inputElem = document.getElementById(`input${i+1}`) as HTMLInputElement
    const filterTypeElem = document.getElementById(`filter-type-${i+1}`) as HTMLSelectElement
    const qInputElem = document.getElementById(`q-input-${i+1}`) as HTMLInputElement
    
    if (sliderElem && inputElem) {
      sliderElem.value = filter.gain.toString()
      inputElem.value = filter.gain.toString()
    }
    if (filterTypeElem) {
      filterTypeElem.value = filter.type
    }
    if (qInputElem) {
      qInputElem.value = filter.Q.toString()
    }
  })

  // Update delete button state when preset changes
  updateDeleteButtonState()
}

// --- Save preset (open modal) ---
savePresetBtn.addEventListener("click", () => {
  presetModal.style.display = "flex";
  presetNameInput.value = "";
  presetNameInput.focus();
});

// --- Modal close logic ---
function closeModal() {
  presetModal.style.display = "none";
}
closeModalBtn.onclick = closeModal;
modalCancelBtn.onclick = closeModal;
window.onclick = (event) => {
  if (event.target === presetModal) {
    closeModal();
  }
};


// --- Modal save logic ---
modalSaveBtn.addEventListener("click", () => {

  const name = presetNameInput.value.trim();
  if (!name) {
    alert("Enter a name for your preset.");
    return;
  }
  if ([...defaultPresets, ...userPresets].some(p => p.name === name)) {
    alert("Preset name already exists.");
    return;
  }

  const newPreset: FilterPreset = { name: name, filters: getCurrentFiltersFromUI() };
  userPresets.push(newPreset);
  chrome.storage.local.set({ userPresets });

  updatePresetsSelector();
  presetsSelect.value = name;
  chrome.storage.local.set({ selectedPreset: name });
  setSlidersFromPreset(name);

  presetModal.style.display = "none";
});


// --- Delete preset ---
deletePresetBtn.addEventListener("click", () => {
  const name = presetsSelect.value
  if (!isUserPreset(name) || name === customPresetName) {
    alert("You can only delete user presets.")
    return
  }
  userPresets = userPresets.filter(p => p.name !== name)
  chrome.storage.local.set({ userPresets })
  updatePresetsSelector()

  // Select first preset after deletion
  // const firstPreset = presetsSelect.options[0]?.value || defaultPresets[0].name
  const firstPreset = defaultPresets[0].name
  presetsSelect.value = firstPreset
  chrome.storage.local.set({ selectedPreset: firstPreset })
  setSlidersFromPreset(firstPreset)

  updateCurrentFilters();
  
})



// --- Load presets on startup ---
chrome.storage.local.get("userPresets", data => {
  devLog('Loaded userPresets from storage:', data.userPresets);
  userPresets = Array.isArray(data.userPresets) ? data.userPresets : []
  updatePresetsSelector()

})

chrome.storage.local.get("selectedPreset", data => {
  const name = typeof data.selectedPreset === "string" ? data.selectedPreset : defaultPresets[0].name
  devLog('Loaded selectedPreset from storage:', name);
  presetsSelect.value = name
  setSlidersFromPreset(name)
  // Update delete button state on load
  updateDeleteButtonState()
})



// --- Update sliders and storage on preset change ---
presetsSelect.addEventListener("change", () => {
  chrome.storage.local.set({ selectedPreset: presetsSelect.value })
  setSlidersFromPreset(presetsSelect.value)
  updateCurrentFilters();
  // Update delete button state on change
  updateDeleteButtonState()
});



// MARK: Toggle
// Update the button appearance and text based on enabled state
function updateEqToggle(enabled: boolean) {
  eqToggle.classList.toggle('on', enabled);
  eqToggle.textContent = enabled ? "Equalizer ON" : "Equalizer OFF";
}

// Initialize switch state from chrome.storage
chrome.storage.local.get("eqEnabled", data => {
  const enabled = Boolean(data.eqEnabled);
  updateEqToggle(enabled);
});


// Handle button click: toggle state and update storage
eqToggle.addEventListener("click", () => {
  chrome.storage.local.get("eqEnabled", data => {
    const newState = !data.eqEnabled;
    chrome.storage.local.set({ eqEnabled: newState });
    updateEqToggle(newState);
  });
});


function getCurrentFiltersFromUI(): any[] {
  return slidersConfig.map((cfg, i) => ({
    freq: cfg.freq,
    gain: parseFloat((document.getElementById(`slider${i+1}`) as HTMLInputElement).value),
    Q: parseFloat((document.getElementById(`q-input-${i+1}`) as HTMLInputElement).value),
    type: (document.getElementById(`filter-type-${i+1}`) as HTMLSelectElement).value
  }));
}



// MARK: updateCurrentFilters
function updateCurrentFilters(filters?: any[]) {
  currentFilters = filters ?? getCurrentFiltersFromUI();
  devLog('[updateCurrentFilters] Current preset:', currentFilters);
  chrome.storage.local.set({ currentFilters });
}



// MARK: autosavePreset
function autosavePreset() {
  const name = presetsSelect.value;

  if (isUserPreset(name)) {
    devLog('[autosavePreset] UserPreset');
    const filters = getCurrentFiltersFromUI();
    const newPreset: FilterPreset = { name: name, filters };
    const customPreset: FilterPreset = { name: customPresetName, filters };

    const idx = userPresets.findIndex(p => p.name === name);
    if (idx === -1) return;
    userPresets[idx] = newPreset;

    // update [Custom] preset
    const customIdx = userPresets.findIndex(p => p.name === customPresetName);
    userPresets[customIdx] = customPreset;

    chrome.storage.local.set({ userPresets });
  }
  
  if (isDefaultPreset(name)) {
    devLog('[autosavePreset] DefaultPreset');
    const filters = getCurrentFiltersFromUI();
    const customPreset: FilterPreset = { name: customPresetName, filters };

    // add or update [Custom] preset
    const idx = userPresets.findIndex(p => p.name === customPresetName);
    if (idx === -1) {
      userPresets.push(customPreset);
    } else {
      userPresets[idx] = customPreset;
    }

    chrome.storage.local.set({ userPresets });

    updatePresetsSelector();
    presetsSelect.value = customPresetName;

    chrome.storage.local.set({ selectedPreset: customPresetName })

  }
}







function handleEqChanges() {
  autosavePreset();
  updateCurrentFilters();
}


// MARK: Setup event listeners
slidersConfig.forEach((_, i) => {

  const sliderElem = document.getElementById(`slider${i+1}`) as HTMLInputElement;
  const inputElem = document.getElementById(`input${i+1}`) as HTMLInputElement;

  const filterTypeElem = document.getElementById(`filter-type-${i+1}`) as HTMLSelectElement;
  const qInputElem = document.getElementById(`q-input-${i+1}`) as HTMLInputElement;



  // Sync initial values
  inputElem.value = sliderElem.value;

  // Slider changes update input
  sliderElem.oninput = function () {
    inputElem.value = (this as HTMLInputElement).value;


    handleEqChanges();
  };

  // Manual input changes update slider
  inputElem.addEventListener("input", function () {
    let val = parseFloat(this.value);
    if (isNaN(val)) val = 0;
    val = Math.max(Number(sliderElem.min), Math.min(Number(sliderElem.max), val));
    sliderElem.value = val.toString();
    inputElem.value = sliderElem.value;


    handleEqChanges();
  });

  // Filter type change
  if (filterTypeElem) {
    filterTypeElem.addEventListener("change", () => {

      handleEqChanges();
    });
  }

  // Q value change
  if (qInputElem) {

    qInputElem.addEventListener("input", () => {
      let val = parseFloat(qInputElem.value);
      if (isNaN(val)) val = 1.0;
      val = Math.max(0.1, Math.min(10, val));
      qInputElem.value = val.toString();
      handleEqChanges();
    });

    qInputElem.addEventListener("blur", () => {
      let val = parseFloat(qInputElem.value);
      if (isNaN(val)) val = 1.0;
      val = Math.max(0.1, Math.min(10, val));
      qInputElem.value = val.toString();
    });

    // Add wheel for changing Q
    qInputElem.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      let val = parseFloat(qInputElem.value);
      if (isNaN(val)) val = 1.0;
      // Change by step (0.01)
      const step = 0.01;
      if (e.deltaY < 0) {
        val += step;
      } else {
        val -= step;
      }
      val = Math.max(0.1, Math.min(10, Math.round(val * 100) / 100));
      qInputElem.value = val.toString();
      handleEqChanges();
    });

  }

  // Add wheel for changing gain
  inputElem.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    let val = parseFloat(inputElem.value);
    if (isNaN(val)) val = 0;
    // Change by step (0.05)
    const step = 0.05;
    if (e.deltaY < 0) {
      val += step;
    } else {
      val -= step;
    }
    val = Math.max(Number(sliderElem.min), Math.min(Number(sliderElem.max), Math.round(val * 100) / 100));
    inputElem.value = val.toString();
    sliderElem.value = inputElem.value;
    handleEqChanges();
  });

  // Add wheel for changing gain when hovering slider
  sliderElem.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    let val = parseFloat(sliderElem.value);
    if (isNaN(val)) val = 0;
    // Change by step (0.05)
    const step = 0.05;
    if (e.deltaY < 0) {
      val += step;
    } else {
      val -= step;
    }
    val = Math.max(Number(sliderElem.min), Math.min(Number(sliderElem.max), Math.round(val * 100) / 100));
    sliderElem.value = val.toString();
    inputElem.value = sliderElem.value;
    handleEqChanges();
  });



});






