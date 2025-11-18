import './style.css'
import defaultPresets from '../content/defaultPresets'

console.log('[EQ] Popup script loaded');

const filterTypeShort: Record<BiquadFilterType, string> = {
  lowpass: 'LP',
  highpass: 'HP',
  bandpass: 'BP',
  lowshelf: 'LS',
  highshelf: 'HS',
  peaking: 'PK',
  notch: 'NT',
  allpass: 'AP'
};

const filterTypes: BiquadFilterType[] = [
  "lowpass", "highpass", "bandpass", "lowshelf", "highshelf", "peaking", "notch", "allpass"
];

// Helper to render a slider's HTML
function renderSlider(idx: number, initial: number, freq: string) {
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
        <p id="output" class="number-fx">${freq}</p>
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

// Unified sliders configuration
const slidersConfig = [
  { idx: 1, initial: 0, freq: "32Hz", slider: "slider1", input: "input1" },
  { idx: 2, initial: 0, freq: "64Hz", slider: "slider2", input: "input2" },
  { idx: 3, initial: 0, freq: "125Hz", slider: "slider3", input: "input3" },
  { idx: 4, initial: 0, freq: "250Hz", slider: "slider4", input: "input4" },
  { idx: 5, initial: 0, freq: "500Hz", slider: "slider5", input: "input5" },
  { idx: 6, initial: 0, freq: "1KHz", slider: "slider6", input: "input6" },
  { idx: 7, initial: 0, freq: "2KHz", slider: "slider7", input: "input7" },
  { idx: 8, initial: 0, freq: "4KHz", slider: "slider8", input: "input8" },
  { idx: 9, initial: 0, freq: "8KHz", slider: "slider9", input: "input9" },
  { idx: 10, initial: 0, freq: "16KHz", slider: "slider10", input: "input10" }
];

// Set up the main HTML structure for the popup
document.querySelector('#app')!.innerHTML = `
  <div>

    

    <div class="card">
      <button id="eq-toggle-btn" type="button">Equalizer</button>
      <select id="presets-select"></select>
      <button id="save-preset-btn" type="button">Save</button>
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
// --- End UI ---

// --- Preset management ---
type Preset = { name: string, filters: any[] }
let userPresets: Preset[] = []

const presetsSelect = document.querySelector<HTMLSelectElement>('#presets-select')!

const savePresetBtn = document.getElementById('save-preset-btn') as HTMLButtonElement
const deletePresetBtn = document.getElementById('delete-preset-btn') as HTMLButtonElement

const presetModal = document.getElementById('preset-modal') as HTMLDivElement
const closeModalBtn = document.getElementById('close-modal') as HTMLSpanElement
const modalSaveBtn = document.getElementById('modal-save-btn') as HTMLButtonElement

const presetNameInput = document.getElementById('preset-name-input') as HTMLInputElement

function loadUserPresets(cb?: () => void) {
  chrome.storage.local.get("userPresets", data => {
    userPresets = Array.isArray(data.userPresets) ? data.userPresets : []
    renderPresetsSelector()
    if (cb) cb()
  })
}

function renderPresetsSelector() {
  const allPresets = [...userPresets, ...defaultPresets]
  presetsSelect.innerHTML = allPresets.map((preset) =>
    `<option value="${preset.name}">${preset.name}${isUserPreset(preset.name) ? ' (custom)' : ''}</option>`
  ).join('')
  // Update delete button state after rendering
  updateDeleteButtonState()
}

function updateDeleteButtonState() {
  const selectedName = presetsSelect.value
  deletePresetBtn.disabled = !isUserPreset(selectedName)
}

function isUserPreset(name: string) {
  return userPresets.some(p => p.name === name)
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
  const newPreset = getCurrentPresetFromUI();
  newPreset.name = name;
  userPresets.push(newPreset);
  chrome.storage.local.set({ userPresets });
  renderPresetsSelector();
  presetsSelect.value = name;
  chrome.storage.local.set({ selectedPreset: name });
  presetModal.style.display = "none";
  setSlidersFromPreset(name);
});

// --- Delete preset ---
deletePresetBtn.addEventListener("click", () => {
  const name = presetsSelect.value
  if (!isUserPreset(name)) {
    alert("You can only delete user presets.")
    return
  }
  userPresets = userPresets.filter(p => p.name !== name)
  chrome.storage.local.set({ userPresets })
  renderPresetsSelector()
  // Select first preset after deletion
  const firstPreset = presetsSelect.options[0]?.value || defaultPresets[0].name
  presetsSelect.value = firstPreset
  chrome.storage.local.set({ selectedPreset: firstPreset })
  setSlidersFromPreset(firstPreset)
})

// --- Load presets on startup ---
loadUserPresets(() => {
  chrome.storage.local.get("selectedPreset", data => {
    const name = typeof data.selectedPreset === "string" ? data.selectedPreset : defaultPresets[0].name
    presetsSelect.value = name
    setSlidersFromPreset(name)
    // Update delete button state on load
    updateDeleteButtonState()
  })
})

// --- Update sliders and storage on preset change ---
presetsSelect.addEventListener("change", () => {
  chrome.storage.local.set({ selectedPreset: presetsSelect.value })
  setSlidersFromPreset(presetsSelect.value)
  logCurrentPreset()
  // Update delete button state on change
  updateDeleteButtonState()
});




// MARK: Toggle
// Get reference to the Equalizer toggle button
const eqToggle = document.querySelector<HTMLButtonElement>('#eq-toggle-btn')!;

// Update the button appearance and text based on enabled state
function updateEqToggle(enabled: boolean) {
  eqToggle.classList.toggle('on', enabled);
  eqToggle.textContent = enabled ? "Equalizer ON" : "Equalizer OFF";
}

// Initialize button state from chrome.storage
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






// MARK: Sliders
// Helper: collect current preset from UI
function getCurrentPresetFromUI(): { name: string, filters: any[] } {
  return {
    name: presetsSelect.value,
    filters: slidersConfig.map((cfg, i) => ({
      freq: parseFloat(cfg.freq),
      gain: parseFloat((document.getElementById(`slider${i+1}`) as HTMLInputElement).value),
      Q: parseFloat((document.getElementById(`q-input-${i+1}`) as HTMLInputElement).value),
      type: (document.getElementById(`filter-type-${i+1}`) as HTMLSelectElement).value
    }))
  };
}









// Helper: log current preset
function logCurrentPreset() {
  console.log('[EQ] Current preset:', getCurrentPresetFromUI());
}

// Helper: update current user preset in storage if selected
function autosaveUserPreset() {
  const name = presetsSelect.value;
  if (!isUserPreset(name)) return;
  const idx = userPresets.findIndex(p => p.name === name);
  if (idx === -1) return;
  userPresets[idx] = getCurrentPresetFromUI();
  chrome.storage.local.set({ userPresets });
}

slidersConfig.forEach(({ slider, input, initial }, i) => {
  const sliderElem = document.getElementById(slider) as HTMLInputElement;
  const inputElem = document.getElementById(input) as HTMLInputElement;
  const filterTypeElem = document.getElementById(`filter-type-${i+1}`) as HTMLSelectElement;
  const qInputElem = document.getElementById(`q-input-${i+1}`) as HTMLInputElement;



  // Sync initial values
  inputElem.value = sliderElem.value;

  // Slider changes update input
  sliderElem.oninput = function () {
    inputElem.value = (this as HTMLInputElement).value;
    logCurrentPreset();
    autosaveUserPreset();
  };

  // Manual input changes update slider
  inputElem.addEventListener("input", function () {
    let val = parseFloat(this.value);
    if (isNaN(val)) val = initial;
    val = Math.max(Number(sliderElem.min), Math.min(Number(sliderElem.max), val));
    sliderElem.value = val.toString();
    inputElem.value = sliderElem.value;
    logCurrentPreset();
    autosaveUserPreset();
  });

  // Filter type change
  if (filterTypeElem) {
    filterTypeElem.addEventListener("change", () => {
      logCurrentPreset();
      autosaveUserPreset();
    });
  }

  // Q value change
  if (qInputElem) {
    qInputElem.addEventListener("input", () => {
      logCurrentPreset();
      autosaveUserPreset();
    });
  }
});






