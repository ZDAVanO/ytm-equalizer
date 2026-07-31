import "./style.css";
import ytm_eq_icon from "@/assets/icon-128.png";
import { version } from "../../package.json";
import * as Constants from "@constants";
import defaultPresets, { presetDisplayNames, localDevPresets } from "./defaultPresets";
import { StorageService, matchesDomain, normalizeFilters } from "./services/StorageService";
import { ParametricEqEditor } from "./components/ParametricEqEditor";
import { PopupVisualizer } from "./components/PopupVisualizer";
import { FilterPreset, Filter, FilterMode } from "./types";

const CUSTOM_PRESET_NAME = "[Custom]";

class PopupManager {
  private userPresets: FilterPreset[] = [];
  private peqEditor!: ParametricEqEditor;
  private visualizer!: PopupVisualizer;

  private eqToggle!: HTMLButtonElement;
  private eqDropdownBtn!: HTMLButtonElement;
  private eqDropdownMenu!: HTMLDivElement;
  private toggleCurrentSiteBtn!: HTMLButtonElement;
  private currentSiteBtn!: HTMLButtonElement;

  private presetsSelect!: HTMLSelectElement;
  private savePresetBtn!: HTMLButtonElement;
  private deletePresetBtn!: HTMLButtonElement;
  private presetModal!: HTMLDialogElement;
  private closeModalBtn!: HTMLButtonElement;
  private modalSaveBtn!: HTMLButtonElement;
  private modalCancelBtn!: HTMLButtonElement;
  private presetNameInput!: HTMLInputElement;
  private volumeSlider!: HTMLInputElement;
  private volumeInput!: HTMLInputElement;
  private volumeResetBtn!: HTMLButtonElement;

  // Site Lists Tab Elements
  private settingsFilterModeBlocklist!: HTMLInputElement;
  private settingsFilterModeAllowlist!: HTMLInputElement;
  private currentSiteStatusBadge!: HTMLSpanElement;
  private currentSiteDomainDisplay!: HTMLSpanElement;
  private settingsToggleCurrentBtn!: HTMLButtonElement;

  private addBlocklistInput!: HTMLInputElement;
  private addBlocklistBtn!: HTMLButtonElement;
  private blocklistItemsContainer!: HTMLDivElement;
  private blocklistCountSpan!: HTMLSpanElement;

  private addAllowlistInput!: HTMLInputElement;
  private addAllowlistBtn!: HTMLButtonElement;
  private allowlistItemsContainer!: HTMLDivElement;
  private allowlistCountSpan!: HTMLSpanElement;

  // State
  private currentHostname: string = "";
  private eqEnabled: boolean = false;
  private filterMode: FilterMode = "blocklist";
  private blockList: string[] = [];
  private allowList: string[] = [];

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

      <nav class="tabs-nav">
        <button class="tab-btn active" data-tab="equalizer">Equalizer</button>
        <button class="tab-btn" data-tab="sitelists">Site Lists</button>
        <button class="tab-btn" data-tab="settings">Settings</button>
      </nav>

      <div id="tab-equalizer" class="tab-content active">
        <div>
          <div class="card">
            <!-- Split Button -->
            <div class="split-btn-group">
              <button id="${Constants.EQ_TOGGLE_BTN_ID}" type="button" class="split-btn-main" title="Equalizer ON / OFF">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v10" />
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                </svg>
                <span id="eq-toggle-text" class="eq-toggle-text">Equalizer OFF</span>
              </button>
              <button id="${Constants.EQ_DROPDOWN_BTN_ID}" type="button" class="split-btn-arrow" title="Filter Options">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="2.5" y1="6" x2="21.5" y2="6" />
                  <line x1="7.25" y1="12" x2="16.75" y2="12" />
                  <line x1="11.5" y1="18" x2="12.5" y2="18" />
                </svg>
              </button>
              <div id="${Constants.EQ_DROPDOWN_MENU_ID}" class="filter-dropdown-menu hidden">
                <div class="dropdown-header">Filter Mode</div>
                <label class="dropdown-item">
                  <input type="radio" name="popFilterMode" value="blocklist" id="pop-mode-blocklist" />
                  <div class="mode-info">
                    <span class="mode-title">🛡️ Blocklist Mode</span>
                    <span class="mode-desc">Active on all sites except blocked</span>
                  </div>
                </label>
                <label class="dropdown-item">
                  <input type="radio" name="popFilterMode" value="allowlist" id="pop-mode-allowlist" />
                  <div class="mode-info">
                    <span class="mode-title">🎯 Allowlist Mode</span>
                    <span class="mode-desc">Active ONLY on allowed sites</span>
                  </div>
                </label>
                <div class="dropdown-divider"></div>
                <button type="button" id="${Constants.TOGGLE_CURRENT_SITE_BTN_ID}" class="dropdown-action-btn">
                  Block current site
                </button>
              </div>
            </div>

            <div class="profile-site-group">
              <div class="profile-controls">
                <select id="${Constants.PRESETS_SELECT_ID}"></select>
                <button id="${Constants.SAVE_PRESET_BTN_ID}" type="button">New</button>
                <button id="${Constants.DELETE_PRESET_BTN_ID}" type="button">Delete</button>
              </div>
              <button id="current-site" type="button" class="current-site-label" title="Toggle site-specific equalizer">Loading...</button>
            </div>
          </div>

          <!-- Parametric Equalizer Dual-Pane Editor -->
          <div id="peq-editor-container"></div>
        </div>
      </div>

      <div id="tab-sitelists" class="tab-content">
        <div class="settings-container">
          
          <div class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-title">Equalizer Mode Selection</span>
            </div>
            <div class="mode-selector-group">
              <label class="mode-card-option" id="label-mode-blocklist">
                <input type="radio" name="setFilterMode" value="blocklist" id="set-mode-blocklist" />
                <div class="mode-card-content">
                  <span class="mode-card-name">🛡️ Blocklist Mode</span>
                  <span class="mode-card-detail">Equalizer runs on all websites EXCEPT those listed in Blocklist below. (Allowlist is ignored).</span>
                </div>
              </label>
              <label class="mode-card-option" id="label-mode-allowlist">
                <input type="radio" name="setFilterMode" value="allowlist" id="set-mode-allowlist" />
                <div class="mode-card-content">
                  <span class="mode-card-name">🎯 Allowlist Mode</span>
                  <span class="mode-card-detail">Equalizer runs ONLY on websites listed in Allowlist below. (Blocklist is ignored).</span>
                </div>
              </label>
            </div>
          </div>

          <div class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-title">Current Site Control</span>
              <span id="current-site-status-badge" class="status-badge">...</span>
            </div>
            <div class="current-site-action-row">
              <span id="current-site-domain-display" class="site-domain-text">domain.com</span>
              <button id="settings-toggle-current-btn" type="button" class="settings-action-btn">Toggle site</button>
            </div>
          </div>

          <div class="settings-two-columns">
            <div class="settings-card col">
              <div class="settings-card-header">
                <span class="settings-card-title">🛡️ Blocklist (<span id="blocklist-count">0</span>)</span>
              </div>
              <div class="add-domain-row">
                <input type="text" id="add-blocklist-input" placeholder="e.g. spotify.com" />
                <button type="button" id="add-blocklist-btn" class="add-btn">Add</button>
              </div>
              <div id="blocklist-items" class="domain-list"></div>
            </div>

            <div class="settings-card col">
              <div class="settings-card-header">
                <span class="settings-card-title">🎯 Allowlist (<span id="allowlist-count">0</span>)</span>
              </div>
              <div class="add-domain-row">
                <input type="text" id="add-allowlist-input" placeholder="e.g. youtube.com" />
                <button type="button" id="add-allowlist-btn" class="add-btn">Add</button>
              </div>
              <div id="allowlist-items" class="domain-list"></div>
            </div>
          </div>

        </div>
      </div>

      <div id="tab-settings" class="tab-content">
        <div class="settings-container">
          <div class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-title">General Extension Settings</span>
            </div>
            <div class="general-settings-content">
              <p class="general-settings-info">
                Web Equalizer version ${version}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <dialog id="${Constants.PRESET_MODAL_ID}" class="modal" closedby="any">
        <div class="modal-content">
          <div class="modal-header">
            <span class="modal-title">New preset</span>
            <button id="${Constants.CLOSE_MODAL_BTN_ID}" class="close" type="button" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <input id="${Constants.PRESET_NAME_INPUT_ID}" type="text" placeholder="New preset name" />
          </div>
          <div class="modal-footer">
            <button id="${Constants.MODAL_SAVE_BTN_ID}" type="button">Save</button>
            <button id="${Constants.MODAL_CANCEL_BTN_ID}" type="button">Close</button>
          </div>
        </div>
      </dialog>
    `;
  }

  private initElements() {
    this.eqToggle = document.getElementById(
      Constants.EQ_TOGGLE_BTN_ID
    ) as HTMLButtonElement;
    this.eqDropdownBtn = document.getElementById(
      Constants.EQ_DROPDOWN_BTN_ID
    ) as HTMLButtonElement;
    this.eqDropdownMenu = document.getElementById(
      Constants.EQ_DROPDOWN_MENU_ID
    ) as HTMLDivElement;
    this.toggleCurrentSiteBtn = document.getElementById(
      Constants.TOGGLE_CURRENT_SITE_BTN_ID
    ) as HTMLButtonElement;
    this.currentSiteBtn = document.getElementById(
      "current-site"
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

    // Initialize Parametric Equalizer Component (which contains volume controls)
    const peqContainer = document.getElementById("peq-editor-container")!;
    this.peqEditor = new ParametricEqEditor(peqContainer, (filters) => {
      this.onFiltersChanged(filters);
    });

    this.volumeSlider = document.getElementById(
      Constants.VOLUME_SLIDER_ID
    ) as HTMLInputElement;
    this.volumeInput = document.getElementById(
      Constants.VOLUME_INPUT_ID
    ) as HTMLInputElement;
    this.volumeResetBtn = document.getElementById(
      Constants.VOLUME_RESET_BTN_ID
    ) as HTMLButtonElement;

    // Site Lists Elements
    this.settingsFilterModeBlocklist = document.getElementById(
      "set-mode-blocklist"
    ) as HTMLInputElement;
    this.settingsFilterModeAllowlist = document.getElementById(
      "set-mode-allowlist"
    ) as HTMLInputElement;

    this.currentSiteStatusBadge = document.getElementById(
      "current-site-status-badge"
    ) as HTMLSpanElement;
    this.currentSiteDomainDisplay = document.getElementById(
      "current-site-domain-display"
    ) as HTMLSpanElement;
    this.settingsToggleCurrentBtn = document.getElementById(
      "settings-toggle-current-btn"
    ) as HTMLButtonElement;

    this.addBlocklistInput = document.getElementById(
      "add-blocklist-input"
    ) as HTMLInputElement;
    this.addBlocklistBtn = document.getElementById(
      "add-blocklist-btn"
    ) as HTMLButtonElement;
    this.blocklistItemsContainer = document.getElementById(
      "blocklist-items"
    ) as HTMLDivElement;
    this.blocklistCountSpan = document.getElementById(
      "blocklist-count"
    ) as HTMLSpanElement;

    this.addAllowlistInput = document.getElementById(
      "add-allowlist-input"
    ) as HTMLInputElement;
    this.addAllowlistBtn = document.getElementById(
      "add-allowlist-btn"
    ) as HTMLButtonElement;
    this.allowlistItemsContainer = document.getElementById(
      "allowlist-items"
    ) as HTMLDivElement;
    this.allowlistCountSpan = document.getElementById(
      "allowlist-count"
    ) as HTMLSpanElement;

    // Initialize Popup Visualizer (captures audio from the active tab via tabCapture)
    this.visualizer = new PopupVisualizer((analyser, captureError) => {
      this.peqEditor.setAnalyser(analyser, captureError);
    });
  }

  private initEventListeners() {
    this.eqToggle.addEventListener("click", () => this.toggleEq());
    this.currentSiteBtn.addEventListener("click", () => this.toggleSiteOverride());

    // Split button dropdown toggle
    this.eqDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.eqDropdownMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!this.eqDropdownMenu.contains(e.target as Node) && e.target !== this.eqDropdownBtn) {
        this.eqDropdownMenu.classList.add("hidden");
      }
    });

    // Dropdown Mode selection
    const popBlocklistRadio = document.getElementById("pop-mode-blocklist") as HTMLInputElement;
    const popAllowlistRadio = document.getElementById("pop-mode-allowlist") as HTMLInputElement;

    popBlocklistRadio?.addEventListener("change", () => {
      if (popBlocklistRadio.checked) this.changeFilterMode("blocklist");
    });
    popAllowlistRadio?.addEventListener("change", () => {
      if (popAllowlistRadio.checked) this.changeFilterMode("allowlist");
    });

    // Settings Mode selection
    this.settingsFilterModeBlocklist?.addEventListener("change", () => {
      if (this.settingsFilterModeBlocklist.checked) this.changeFilterMode("blocklist");
    });
    this.settingsFilterModeAllowlist?.addEventListener("change", () => {
      if (this.settingsFilterModeAllowlist.checked) this.changeFilterMode("allowlist");
    });

    // Quick toggle site buttons
    this.toggleCurrentSiteBtn.addEventListener("click", () => {
      this.toggleCurrentSiteMembership();
      this.eqDropdownMenu.classList.add("hidden");
    });
    this.settingsToggleCurrentBtn.addEventListener("click", () => {
      this.toggleCurrentSiteMembership();
    });

    // Add Domain handlers
    this.addBlocklistBtn.addEventListener("click", () => this.addDomainToBlocklist());
    this.addBlocklistInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addDomainToBlocklist();
    });

    this.addAllowlistBtn.addEventListener("click", () => this.addDomainToAllowlist());
    this.addAllowlistInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addDomainToAllowlist();
    });

    this.presetsSelect.addEventListener("change", () => this.handlePresetChange());
    this.savePresetBtn.addEventListener("click", () => this.openPresetModal());
    this.deletePresetBtn.addEventListener("click", () => this.deletePreset());
    this.closeModalBtn.onclick = () => this.presetModal.close();
    this.modalCancelBtn.onclick = () => this.presetModal.close();
    this.modalSaveBtn.addEventListener("click", () => this.saveNewPreset());

    // Volume Events
    const volumeText = document.getElementById("vol-value-text");

    const updateVolumeUI = (gain: number) => {
      if (volumeText) {
        volumeText.textContent = `${gain.toFixed(2)}x`;
        const isModified = Math.abs(gain - 1.0) >= 0.005;
        volumeText.classList.toggle("modified", isModified);
      }
      if (this.volumeInput) {
        this.volumeInput.value = gain.toFixed(2);
      }
    };

    this.volumeSlider.oninput = () => {
      const pos = parseFloat(this.volumeSlider.value);
      const gain = 6 * Math.pow(pos, 2.585);
      updateVolumeUI(gain);
      this.handleVolumeChanges(gain);
    };

    if (this.volumeInput) {
      this.volumeInput.addEventListener("input", () => {
        let gain = parseFloat(this.volumeInput!.value);
        if (isNaN(gain)) gain = 1.0;
        gain = Math.max(0, Math.min(6, gain));
        const pos = Math.pow(gain / 6, 1 / 2.585);
        this.volumeSlider.value = pos.toString();
        updateVolumeUI(gain);
        this.handleVolumeChanges(gain);
      });
    }

    const handleVolumeWheel = (e: WheelEvent) => {
      e.preventDefault();
      let pos = parseFloat(this.volumeSlider.value);
      pos += e.deltaY < 0 ? 0.01 : -0.01;
      pos = Math.max(0, Math.min(1, pos));
      this.volumeSlider.value = pos.toString();

      const gain = 6 * Math.pow(pos, 2.585);
      updateVolumeUI(gain);
      this.handleVolumeChanges(gain);
    };

    this.volumeSlider.addEventListener("wheel", handleVolumeWheel);

    const resetVolume = () => {
      const gain = 1.0;
      const pos = 0.5;
      this.volumeSlider.value = pos.toString();
      updateVolumeUI(gain);
      this.handleVolumeChanges(gain);
    };

    this.volumeResetBtn.addEventListener("click", resetVolume);

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");

        tabBtns.forEach((b) => b.classList.remove("active"));
        tabContents.forEach((c) => c.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(`tab-${targetTab}`)?.classList.add("active");
      });
    });
  }

  private async loadData() {
    await this.updateCurrentSite();

    this.userPresets = await StorageService.getUserPresets();
    this.updatePresetsSelector();

    const selectedPreset = (await StorageService.getEffectivePreset(this.currentHostname)) || defaultPresets[0].name;
    this.presetsSelect.value = selectedPreset;

    const savedFilters = await StorageService.getEffectiveFilters(this.currentHostname);
    if (Array.isArray(savedFilters)) {
      this.peqEditor.setFilters(savedFilters);
    } else {
      await this.loadFiltersFromPreset(selectedPreset);
    }

    this.eqEnabled = await StorageService.getEqEnabled();
    this.filterMode = await StorageService.getFilterMode();
    this.blockList = await StorageService.getBlockList();
    this.allowList = await StorageService.getAllowList();

    this.updateAllFilteringUI();
    this.updateDeleteButtonState();

    const volume = await StorageService.getEffectiveVolume(this.currentHostname);
    const pos = Math.pow(volume / 6, 1 / 2.585);
    this.volumeSlider.value = pos.toString();
    const volText = document.getElementById("vol-value-text");
    if (volText) {
      volText.textContent = `${volume.toFixed(2)}x`;
      volText.classList.toggle("modified", Math.abs(volume - 1.0) >= 0.005);
    }
    if (this.volumeInput) this.volumeInput.value = volume.toFixed(2);

    // Start audio capture for popup visualizer
    this.visualizer.start();
  }

  private async updateCurrentSite() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      try {
        this.currentHostname = new URL(tab.url).hostname;
      } catch (e) {
        this.currentHostname = "unknown";
      }
    }
    await this.updateSiteOverrideUI();
  }

  private async toggleSiteOverride() {
    if (!this.currentHostname || this.currentHostname === "unknown" || this.currentHostname === "Browser page") return;
    const currentActive = await StorageService.isSiteOverrideActive(this.currentHostname);
    const newActive = !currentActive;

    if (newActive) {
      // Snapshot current active state into site profile so there's no jump/reset
      const currentFilters = this.peqEditor.getFilters();
      const currentPreset = this.presetsSelect.value;
      const currentVolume = 6 * Math.pow(parseFloat(this.volumeSlider.value), 2.585);

      await StorageService.setSiteFilters(this.currentHostname, currentFilters);
      await StorageService.setSitePreset(this.currentHostname, currentPreset);
      await StorageService.setVolume(this.currentHostname, currentVolume);
    }

    await StorageService.setSiteOverrideActive(this.currentHostname, newActive);

    await this.updateSiteOverrideUI(newActive);

    const effectivePreset = (await StorageService.getEffectivePreset(this.currentHostname)) || defaultPresets[0].name;
    this.presetsSelect.value = effectivePreset;

    const effectiveFilters = await StorageService.getEffectiveFilters(this.currentHostname);
    this.peqEditor.setFilters(effectiveFilters);

    const effectiveVolume = await StorageService.getEffectiveVolume(this.currentHostname);
    const pos = Math.pow(effectiveVolume / 6, 1 / 2.585);
    this.volumeSlider.value = pos.toString();
    const volText = document.getElementById("vol-value-text");
    if (volText) {
      volText.textContent = `${effectiveVolume.toFixed(2)}x`;
      volText.classList.toggle("modified", Math.abs(effectiveVolume - 1.0) >= 0.005);
    }
    if (this.volumeInput) this.volumeInput.value = effectiveVolume.toFixed(2);

    this.updateDeleteButtonState();
  }

  private async updateSiteOverrideUI(active?: boolean) {
    if (!this.currentSiteBtn) return;
    const isBrowserPage = !this.currentHostname || this.currentHostname === "unknown" || this.currentHostname === "Browser page";
    const domainDisplay = isBrowserPage ? "Browser page" : this.currentHostname;
    const isOverride = isBrowserPage ? false : (active !== undefined ? active : await StorageService.isSiteOverrideActive(this.currentHostname));

    this.currentSiteBtn.textContent = `Only for ${domainDisplay}`;
    this.currentSiteBtn.classList.toggle("active", isOverride);
    if (isOverride) {
      this.currentSiteBtn.title = `Using custom equalizer profile for ${domainDisplay}. Click to switch back to global profile.`;
    } else {
      this.currentSiteBtn.title = `Using global equalizer profile. Click to enable custom profile for ${domainDisplay}.`;
    }
  }

  private async toggleEq() {
    if (!this.currentHostname || this.currentHostname === "unknown" || this.currentHostname === "Browser page") {
      this.eqEnabled = !this.eqEnabled;
      await StorageService.setEqEnabled(this.eqEnabled);
      this.updateAllFilteringUI();
      return;
    }

    if (this.filterMode === "blocklist") {
      const isBlocked = this.blockList.some((d) => matchesDomain(this.currentHostname, d));
      if (isBlocked) {
        this.blockList = this.blockList.filter((d) => !matchesDomain(this.currentHostname, d));
      } else {
        this.blockList.push(this.currentHostname);
      }
      await StorageService.setBlockList(this.blockList);
    } else {
      const isAllowed = this.allowList.some((d) => matchesDomain(this.currentHostname, d));
      if (isAllowed) {
        this.allowList = this.allowList.filter((d) => !matchesDomain(this.currentHostname, d));
      } else {
        this.allowList.push(this.currentHostname);
      }
      await StorageService.setAllowList(this.allowList);
    }

    if (!this.eqEnabled) {
      this.eqEnabled = true;
      await StorageService.setEqEnabled(true);
    }

    this.updateAllFilteringUI();
  }

  private async changeFilterMode(mode: FilterMode) {
    this.filterMode = mode;
    await StorageService.setFilterMode(mode);
    this.updateAllFilteringUI();
  }

  private isCurrentSiteInActiveList(): boolean {
    if (!this.currentHostname || this.currentHostname === "unknown") return false;
    if (this.filterMode === "blocklist") {
      return this.blockList.some((domain) => matchesDomain(this.currentHostname, domain));
    } else {
      return this.allowList.some((domain) => matchesDomain(this.currentHostname, domain));
    }
  }

  private async toggleCurrentSiteMembership() {
    if (!this.currentHostname || this.currentHostname === "unknown") return;

    if (this.filterMode === "blocklist") {
      const isBlocked = this.blockList.some((d) => matchesDomain(this.currentHostname, d));
      if (isBlocked) {
        this.blockList = this.blockList.filter((d) => !matchesDomain(this.currentHostname, d));
      } else {
        this.blockList.push(this.currentHostname);
      }
      await StorageService.setBlockList(this.blockList);
    } else {
      const isAllowed = this.allowList.some((d) => matchesDomain(this.currentHostname, d));
      if (isAllowed) {
        this.allowList = this.allowList.filter((d) => !matchesDomain(this.currentHostname, d));
      } else {
        this.allowList.push(this.currentHostname);
      }
      await StorageService.setAllowList(this.allowList);
    }
    this.updateAllFilteringUI();
  }

  private async addDomainToBlocklist() {
    const val = this.addBlocklistInput.value.trim().toLowerCase();
    if (!val) return;
    if (!this.blockList.includes(val)) {
      this.blockList.push(val);
      await StorageService.setBlockList(this.blockList);
      this.addBlocklistInput.value = "";
      this.updateAllFilteringUI();
    }
  }

  private async addDomainToAllowlist() {
    const val = this.addAllowlistInput.value.trim().toLowerCase();
    if (!val) return;
    if (!this.allowList.includes(val)) {
      this.allowList.push(val);
      await StorageService.setAllowList(this.allowList);
      this.addAllowlistInput.value = "";
      this.updateAllFilteringUI();
    }
  }

  private async removeDomainFromBlocklist(domain: string) {
    this.blockList = this.blockList.filter((d) => d !== domain);
    await StorageService.setBlockList(this.blockList);
    this.updateAllFilteringUI();
  }

  private async removeDomainFromAllowlist(domain: string) {
    this.allowList = this.allowList.filter((d) => d !== domain);
    await StorageService.setAllowList(this.allowList);
    this.updateAllFilteringUI();
  }

  private updateAllFilteringUI() {
    const isSiteActive = StorageService.isSiteActive(
      this.currentHostname,
      this.eqEnabled,
      this.filterMode,
      this.blockList,
      this.allowList
    );

    // Main split toggle visual
    this.eqToggle.classList.toggle("on", isSiteActive);
    this.eqDropdownBtn.classList.toggle("on", isSiteActive);
    const eqToggleText = document.getElementById("eq-toggle-text");
    if (isSiteActive) {
      this.eqToggle.title = "Equalizer ON";
      if (eqToggleText) eqToggleText.textContent = "Equalizer ON";
    } else {
      this.eqToggle.title = !this.eqEnabled ? "Equalizer OFF" : "EQ OFF (Filtered)";
      if (eqToggleText) eqToggleText.textContent = "Equalizer OFF";
    }

    // Radio inputs sync
    const popBlocklistRadio = document.getElementById("pop-mode-blocklist") as HTMLInputElement;
    const popAllowlistRadio = document.getElementById("pop-mode-allowlist") as HTMLInputElement;
    if (popBlocklistRadio) popBlocklistRadio.checked = this.filterMode === "blocklist";
    if (popAllowlistRadio) popAllowlistRadio.checked = this.filterMode === "allowlist";

    if (this.settingsFilterModeBlocklist) this.settingsFilterModeBlocklist.checked = this.filterMode === "blocklist";
    if (this.settingsFilterModeAllowlist) this.settingsFilterModeAllowlist.checked = this.filterMode === "allowlist";

    const labelBlocklist = document.getElementById("label-mode-blocklist");
    const labelAllowlist = document.getElementById("label-mode-allowlist");
    labelBlocklist?.classList.toggle("active-mode", this.filterMode === "blocklist");
    labelAllowlist?.classList.toggle("active-mode", this.filterMode === "allowlist");

    // Quick toggle button labels
    const isListed = this.isCurrentSiteInActiveList();
    const domainText = this.currentHostname || "this site";

    if (this.filterMode === "blocklist") {
      this.toggleCurrentSiteBtn.textContent = isListed ? `Unblock ${domainText}` : `Block ${domainText}`;
      this.settingsToggleCurrentBtn.textContent = isListed ? `Remove from Blocklist` : `Add to Blocklist`;
    } else {
      this.toggleCurrentSiteBtn.textContent = isListed ? `Remove ${domainText} from Allowlist` : `Allow ${domainText}`;
      this.settingsToggleCurrentBtn.textContent = isListed ? `Remove from Allowlist` : `Add to Allowlist`;
    }

    // Settings status badge & domain display
    if (this.currentSiteDomainDisplay) {
      this.currentSiteDomainDisplay.textContent = this.currentHostname || "Browser page";
    }
    if (this.currentSiteStatusBadge) {
      if (!this.eqEnabled) {
        this.currentSiteStatusBadge.textContent = "Globally Disabled";
        this.currentSiteStatusBadge.className = "status-badge off";
      } else if (isSiteActive) {
        this.currentSiteStatusBadge.textContent = "Active on this site";
        this.currentSiteStatusBadge.className = "status-badge active";
      } else {
        this.currentSiteStatusBadge.textContent = "Disabled by filter";
        this.currentSiteStatusBadge.className = "status-badge blocked";
      }
    }

    // Render lists
    this.renderDomainList(this.blocklistItemsContainer, this.blockList, (d) => this.removeDomainFromBlocklist(d));
    this.blocklistCountSpan.textContent = this.blockList.length.toString();

    this.renderDomainList(this.allowlistItemsContainer, this.allowList, (d) => this.removeDomainFromAllowlist(d));
    this.allowlistCountSpan.textContent = this.allowList.length.toString();
  }

  private renderDomainList(
    container: HTMLDivElement,
    list: string[],
    onRemove: (domain: string) => void
  ) {
    container.innerHTML = "";
    if (list.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "empty-list-msg";
      emptyMsg.textContent = "No sites added yet";
      container.appendChild(emptyMsg);
      return;
    }

    list.forEach((domain) => {
      const item = document.createElement("div");
      item.className = "domain-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "domain-name";
      nameSpan.textContent = domain;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "domain-remove-btn";
      removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      removeBtn.title = `Remove ${domain}`;
      removeBtn.setAttribute("aria-label", `Remove ${domain}`);
      removeBtn.addEventListener("click", () => onRemove(domain));

      item.appendChild(nameSpan);
      item.appendChild(removeBtn);
      container.appendChild(item);
    });
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

    if (localDevPresets.length > 0) {
      const localGroup = document.createElement("optgroup");
      localGroup.label = "Local presets";
      localDevPresets.forEach((p) => {
        const displayName = presetDisplayNames[p.name] || p.name;
        localGroup.appendChild(createOption(p.name, displayName));
      });
      this.presetsSelect.appendChild(localGroup);
    }

    const defaultGroup = document.createElement("optgroup");
    defaultGroup.label = "Predefined presets";
    defaultPresets.forEach((p) => {
      const displayName = presetDisplayNames[p.name] || p.name;
      defaultGroup.appendChild(createOption(p.name, displayName));
    });
    this.presetsSelect.appendChild(defaultGroup);
  }

  private async loadFiltersFromPreset(presetName: string) {
    const allPresets = [...this.userPresets, ...localDevPresets, ...defaultPresets];
    const preset = allPresets.find((p) => p.name === presetName) || defaultPresets[0];
    const normalized = normalizeFilters(preset.filters);
    this.peqEditor.setFilters(normalized);
    this.updateDeleteButtonState();
    await StorageService.setEffectiveFilters(this.currentHostname, normalized);
  }

  private updateDeleteButtonState() {
    const name = this.presetsSelect.value;
    const isUser = this.userPresets.some((p) => p.name === name);
    this.deletePresetBtn.disabled = !isUser || name === CUSTOM_PRESET_NAME;
  }

  private async handlePresetChange() {
    const name = this.presetsSelect.value;
    await StorageService.setEffectivePreset(this.currentHostname, name);
    await this.loadFiltersFromPreset(name);
  }

  private openPresetModal() {
    this.presetModal.showModal();
    this.presetNameInput.value = "";
    this.presetNameInput.focus();
  }

  private async saveNewPreset() {
    const name = this.presetNameInput.value.trim();
    if (!name) return alert("Enter a name for your preset.");
    if ([...defaultPresets, ...localDevPresets, ...this.userPresets].some((p) => p.name === name))
      return alert("Preset name already exists.");

    const newPreset: FilterPreset = {
      name,
      filters: this.peqEditor.getFilters(),
    };
    this.userPresets.push(newPreset);
    await StorageService.setUserPresets(this.userPresets);

    this.updatePresetsSelector();
    this.presetsSelect.value = name;
    await StorageService.setEffectivePreset(this.currentHostname, name);
    this.presetModal.close();
    this.updateDeleteButtonState();
  }

  private async deletePreset() {
    const name = this.presetsSelect.value;
    const isUser = this.userPresets.some((p) => p.name === name);
    if (!isUser || name === CUSTOM_PRESET_NAME) return;

    this.userPresets = this.userPresets.filter((p) => p.name !== name);
    await StorageService.setUserPresets(this.userPresets);
    this.updatePresetsSelector();

    const nextPreset = defaultPresets[0].name;
    this.presetsSelect.value = nextPreset;
    await StorageService.setEffectivePreset(this.currentHostname, nextPreset);
    await this.loadFiltersFromPreset(nextPreset);
  }

  private async onFiltersChanged(filters: Filter[]) {
    await StorageService.setEffectiveFilters(this.currentHostname, filters);
    await this.autosavePreset(filters);
  }

  private async handleVolumeChanges(gain?: number) {
    const vol = gain !== undefined ? gain : 6 * Math.pow(parseFloat(this.volumeSlider.value), 2.585);
    await StorageService.setEffectiveVolume(this.currentHostname, vol);
  }

  private async autosavePreset(filters: Filter[]) {
    const name = this.presetsSelect.value;
    const isUser = this.userPresets.some((p) => p.name === name);

    if (isUser) {
      const idx = this.userPresets.findIndex((p) => p.name === name);
      if (idx !== -1) this.userPresets[idx].filters = filters;

      const customIdx = this.userPresets.findIndex((p) => p.name === CUSTOM_PRESET_NAME);
      if (customIdx !== -1) this.userPresets[customIdx].filters = filters;
      else this.userPresets.push({ name: CUSTOM_PRESET_NAME, filters });

      await StorageService.setUserPresets(this.userPresets);
    } else {
      const customIdx = this.userPresets.findIndex((p) => p.name === CUSTOM_PRESET_NAME);
      if (customIdx !== -1) this.userPresets[customIdx].filters = filters;
      else this.userPresets.push({ name: CUSTOM_PRESET_NAME, filters });

      await StorageService.setUserPresets(this.userPresets);
      this.updatePresetsSelector();
      this.presetsSelect.value = CUSTOM_PRESET_NAME;
      await StorageService.setEffectivePreset(this.currentHostname, CUSTOM_PRESET_NAME);
    }
  }
}

new PopupManager();
