import './style.css'

import defaultPresets, { FilterPreset, presetDisplayNames } from '../defaultPresets'
import { filterTypes, filterTypeShort } from '../filterTypes';

console.log('Popup script loaded');



// Unified sliders configuration
const slidersConfig = [
  { idx: 1, initial: 0, freq: 32 },
  { idx: 2, initial: 0, freq: 64 },
  { idx: 3, initial: 0, freq: 125 },
  { idx: 4, initial: 0, freq: 250 },
  { idx: 5, initial: 0, freq: 500 },
  { idx: 6, initial: 0, freq: 1000 },
  { idx: 7, initial: 0, freq: 2000 },
  { idx: 8, initial: 0, freq: 4000 },
  { idx: 9, initial: 0, freq: 8000 },
  { idx: 10, initial: 0, freq: 16000 }
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
function renderSlider(idx: number, initial: number, freq: number) {
  return `
    <div id="range-slider-${idx}" class="range-slider">
      <div class="slider-bg-1">
        <div class="slider-bg-2"></div>
      </div>
      <input class="range-slider__range" id="slider${idx}" type="range" value="${initial}" min="-12" max="12" step=".1">
      <div class="value">
        <input type="number" id="input${idx}" class="number-fx" min="-12" max="12" step=".1" value="${initial}">
      </div>
      <div class="freq-value">
        <p id="output" class="number-fx">${freqLabels[freq]}</p>
      </div>
      <div class="filter-type">
        <select id="filter-type-${idx}">
          ${filterTypes.map(type => `<option value="${type}">${filterTypeShort[type]}</option>`).join('')}
        </select>
      </div>
      <div class="q-value">
        <input type="number" id="q-input-${idx}" class="number-fx" min="0.1" max="10" step="0.01" value="1.0" />
      </div>
    </div>
  `;
}



// Set up the main HTML structure for the popup
document.querySelector('#app')!.innerHTML = `
  <div>

    

    <div class="card">
      <button id="eq-toggle-btn" type="button">Equalizer</button>
      <select id="presets-select"></select>
      <button id="save-preset-btn" type="button">New</button>
      <button id="delete-preset-btn" type="button">Delete</button>
    </div>

    <div class="sliders-row">
      ${slidersConfig.map(cfg => renderSlider(cfg.idx, cfg.initial, cfg.freq)).join('')}
    </div>

    <!-- Modal for new preset name -->
    <div id="preset-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <span id="close-modal" class="close">&times;</span>
        <h3>Enter new preset name</h3>
        <input id="preset-name-input" type="text" placeholder="New preset name" />
        <button id="modal-save-btn" type="button">Save</button>
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
const closeModalBtn = document.getElementById('close-modal') as HTMLSpanElement
const modalSaveBtn = document.getElementById('modal-save-btn') as HTMLButtonElement

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
  presetModal.style.display = "block";
  presetNameInput.value = "";
  presetNameInput.focus();
});


// --- Modal close logic ---
closeModalBtn.onclick = () => {
  presetModal.style.display = "none";
};
window.onclick = (event) => {
  if (event.target === presetModal) {
    presetModal.style.display = "none";
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
  console.log('Loaded userPresets from storage:', data.userPresets);
  userPresets = Array.isArray(data.userPresets) ? data.userPresets : []
  updatePresetsSelector()

})

chrome.storage.local.get("selectedPreset", data => {
  const name = typeof data.selectedPreset === "string" ? data.selectedPreset : defaultPresets[0].name
  console.log('Loaded selectedPreset from storage:', name);
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
  console.log('[updateCurrentFilters] Current preset:', currentFilters);
  chrome.storage.local.set({ currentFilters });
}



// MARK: autosavePreset
function autosavePreset() {
  const name = presetsSelect.value;

  if (isUserPreset(name)) {
    console.log('[autosavePreset] UserPreset');
    const filters = getCurrentFiltersFromUI();
    const newPreset: FilterPreset = { name: name, filters };

    const idx = userPresets.findIndex(p => p.name === name);
    if (idx === -1) return;
    userPresets[idx] = newPreset;

    chrome.storage.local.set({ userPresets });
  }
  
  if (isDefaultPreset(name)) {
    console.log('[autosavePreset] DefaultPreset');
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
slidersConfig.forEach(({ initial }, i) => {

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
    if (isNaN(val)) val = initial;
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

    handleEqChanges();
    });
  }
});






