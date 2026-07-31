import { Filter } from "../types";
import { filterTypes, filterTypeShort, filterHasGain, filterHasQ, formatFrequency } from "../../filterTypes";
import * as Constants from "@constants";
import { VolumeSlider } from "./VolumeSlider";

export class ParametricEqEditor {
  private container: HTMLElement;
  private filters: Filter[] = [];
  private selectedIndex: number | null = null;
  private onChange: (filters: Filter[]) => void;

  // DOM Elements
  private filterListBody!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private handlesOverlay!: HTMLElement;

  // Dragging state & Caching flags
  private isDragging = false;
  private activeDragIndex: number | null = null;
  private pendingMouseMove: MouseEvent | null = null;
  private rafPending = false;
  private isResponseDirty = true;
  private handlesDirty = true;

  // Visualizer
  private analyser: AnalyserNode | null = null;
  private vizDataArray: Uint8Array | null = null;
  private vizRafId: number | null = null;
  private vizCaptureError = false;

  // Web Audio Offline Context for frequency response calculation
  private offlineAudioCtx = new OfflineAudioContext(1, 1, 44100);
  private numSamplePoints = 256;
  private frequencies = new Float32Array(this.numSamplePoints);
  private magResponseBuffer = new Float32Array(this.numSamplePoints);
  private phaseResponseBuffer = new Float32Array(this.numSamplePoints);
  private totalDbResponse = new Float32Array(this.numSamplePoints);

  // Audio range constants
  private readonly MIN_FREQ = 20;
  private readonly MAX_FREQ = 20000;
  private readonly MIN_DB = -12;
  private readonly MAX_DB = 12;
  private readonly MIN_Q = 0.00;
  private readonly MAX_Q = 9.99;

  constructor(container: HTMLElement, onChange: (filters: Filter[]) => void) {
    this.container = container;
    this.onChange = onChange;
    this.initFrequencies();
    this.renderLayout();
    this.initEventListeners();
  }

  private initFrequencies() {
    const logMin = Math.log10(this.MIN_FREQ);
    const logMax = Math.log10(this.MAX_FREQ);
    for (let i = 0; i < this.numSamplePoints; i++) {
      const logFreq = logMin + (i / (this.numSamplePoints - 1)) * (logMax - logMin);
      this.frequencies[i] = Math.pow(10, logFreq);
    }
  }

  public setFilters(filters: Filter[]) {
    this.filters = JSON.parse(JSON.stringify(filters));
    if (this.selectedIndex !== null && this.selectedIndex >= this.filters.length) {
      this.selectedIndex = this.filters.length > 0 ? 0 : null;
    }
    this.isResponseDirty = true;
    this.handlesDirty = true;
    this.renderFilterList();
    this.drawGraph();
  }

  public setAnalyser(analyser: AnalyserNode | null, captureError: boolean = false) {
    this.analyser = analyser;
    this.vizCaptureError = captureError;
    if (analyser) {
      this.vizDataArray = new Uint8Array(analyser.frequencyBinCount);
      this.startVizLoop();
    } else {
      this.stopVizLoop();
      this.vizDataArray = null;
      // Redraw once to update visualizer state or show notice
      this.drawGraph();
    }
  }

  private startVizLoop() {
    if (this.vizRafId !== null) return;
    const loop = () => {
      this.drawGraph();
      this.vizRafId = requestAnimationFrame(loop);
    };
    this.vizRafId = requestAnimationFrame(loop);
  }

  private stopVizLoop() {
    if (this.vizRafId !== null) {
      cancelAnimationFrame(this.vizRafId);
      this.vizRafId = null;
    }
  }

  public getFilters(): Filter[] {
    return this.filters;
  }

  private renderLayout() {
    this.container.innerHTML = `
      <div class="peq-editor">
        <!-- Left Pane: Filter List Controls (340px width) -->
        <div class="peq-left-pane">
          <div class="peq-table-container">
            <table class="peq-table">
              <colgroup>
                <col style="width: 26px">
                <col style="width: 26px">
                <col style="width: 44px">
                <col style="width: 38px">
                <col style="width: 32px">
                <col style="width: 26px">
              </colgroup>
              <thead>
                <tr>
                  <th colspan="2">Filter</th>
                  <th>Freq</th>
                  <th>Gain</th>
                  <th>Q</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="peq-filter-list"></tbody>
            </table>
          </div>
        </div>

        <!-- Right Pane: Interactive Graph Canvas -->
        <div class="peq-right-pane">
          <div class="peq-canvas-wrapper" id="peq-canvas-wrapper">
            <canvas id="peq-graph-canvas"></canvas>
            <div id="peq-handles-overlay" class="peq-handles-overlay"></div>
          </div>
        </div>

        <!-- Volume Pane: Vertical Volume Slider -->
        <div class="peq-vol-pane">
          ${VolumeSlider(Constants.VOLUME_SLIDER_ID, Constants.VOLUME_INPUT_ID)}
        </div>
      </div>
    `;

    this.filterListBody = this.container.querySelector("#peq-filter-list") as HTMLElement;
    this.canvas = this.container.querySelector("#peq-graph-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.handlesOverlay = this.container.querySelector("#peq-handles-overlay") as HTMLElement;

    this.resizeCanvas();
  }

  private resizeCanvas() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.handlesDirty = true;
    this.drawGraph();
  }

  private addFilter() {
    if (this.filters.length >= 10) return;
    const defaultFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    let newFreq = 1000;
    for (const f of defaultFreqs) {
      if (!this.filters.some((flt) => Math.abs(flt.freq - f) < 10)) {
        newFreq = f;
        break;
      }
    }
    const newFilter: Filter = {
      freq: newFreq,
      gain: 0,
      Q: 1.0,
      type: "peaking",
    };
    this.filters.push(newFilter);
    this.selectedIndex = this.filters.length - 1;
    this.notifyChange();
  }

  private initEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());

    const wrapper = this.canvas.parentElement;
    if (wrapper && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.resizeCanvas());
      ro.observe(wrapper);
    }

    this.handlesOverlay.addEventListener("mousedown", (e) => this.onOverlayMouseDown(e));
    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.pendingMouseMove = e;
      if (!this.rafPending) {
        this.rafPending = true;
        requestAnimationFrame(() => {
          this.rafPending = false;
          if (this.pendingMouseMove) {
            this.onOverlayMouseMove(this.pendingMouseMove);
            this.pendingMouseMove = null;
          }
        });
      }
    });
    document.addEventListener("mouseup", () => this.onOverlayMouseUp());
    this.handlesOverlay.addEventListener("wheel", (e) => this.onOverlayWheel(e), { passive: false });
  }

  private renderFilterList() {
    this.filterListBody.innerHTML = "";

    this.filters.forEach((filter, idx) => {
      const isSelected = this.selectedIndex === idx;
      const hasGain = filterHasGain(filter.type);
      const hasQ = filterHasQ(filter.type);
      const row = document.createElement("tr");
      row.className = `peq-row ${isSelected ? "selected" : ""}`;

      // Filter index badge
      const numTd = document.createElement("td");
      numTd.innerHTML = `<span class="peq-num-badge">${idx + 1}</span>`;
      numTd.addEventListener("click", () => {
        this.selectedIndex = idx;
        this.renderFilterList();
        this.drawGraph();
      });

      // Filter Type dropdown (2-letter codes)
      const typeTd = document.createElement("td");
      const typeSelect = document.createElement("select");
      typeSelect.className = "peq-select";
      filterTypes.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = filterTypeShort[t];
        opt.title = `${t.charAt(0).toUpperCase() + t.slice(1)}`;
        if (t === filter.type) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener("change", () => {
        const newType = typeSelect.value as BiquadFilterType;
        filter.type = newType;
        if (newType === "lowpass" || newType === "highpass") {
          filter.Q = 0.0;
        }
        this.notifyChange();
      });
      typeTd.appendChild(typeSelect);

      // Frequency input (editable typing & wheel scrollable)
      const freqTd = document.createElement("td");
      const freqInput = document.createElement("input");
      freqInput.type = "number";
      freqInput.className = "peq-input";
      freqInput.min = "20";
      freqInput.max = "20000";
      freqInput.step = "1";
      freqInput.value = Math.round(filter.freq).toString();

      freqInput.addEventListener("input", () => {
        let val = parseFloat(freqInput.value);
        if (!isNaN(val)) {
          filter.freq = Math.max(this.MIN_FREQ, Math.min(this.MAX_FREQ, val));
          this.onParamInput();
        }
      });
      freqInput.addEventListener("blur", () => {
        let val = parseFloat(freqInput.value);
        if (isNaN(val)) val = 1000;
        filter.freq = Math.max(this.MIN_FREQ, Math.min(this.MAX_FREQ, Math.round(val)));
        freqInput.value = filter.freq.toString();
        this.onParamInput();
      });
      freqInput.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? (filter.freq >= 1000 ? 50 : 5) : (filter.freq >= 1000 ? -50 : -5);
        filter.freq = Math.max(this.MIN_FREQ, Math.min(this.MAX_FREQ, Math.round(filter.freq + delta)));
        freqInput.value = filter.freq.toString();
        this.onParamInput();
      });
      freqTd.appendChild(freqInput);

      // Gain input (editable typing & wheel scrollable, disabled if no gain)
      const gainTd = document.createElement("td");
      const gainInput = document.createElement("input");
      gainInput.type = "number";
      gainInput.className = "peq-input";
      gainInput.step = "0.1";
      gainInput.min = "-12";
      gainInput.max = "12";
      gainInput.value = filter.gain.toFixed(1);
      gainInput.disabled = !hasGain;
      if (!hasGain) {
        gainInput.title = "Gain does not apply to this filter type";
        gainInput.value = "-";
      }

      if (hasGain) {
        gainInput.addEventListener("input", () => {
          let val = parseFloat(gainInput.value);
          if (!isNaN(val)) {
            filter.gain = Math.max(this.MIN_DB, Math.min(this.MAX_DB, val));
            this.onParamInput();
          }
        });
        gainInput.addEventListener("blur", () => {
          let val = parseFloat(gainInput.value);
          if (isNaN(val)) val = 0;
          filter.gain = Math.max(this.MIN_DB, Math.min(this.MAX_DB, Math.round(val * 10) / 10));
          gainInput.value = filter.gain.toFixed(1);
          this.onParamInput();
        });
        gainInput.addEventListener("wheel", (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          filter.gain = Math.max(this.MIN_DB, Math.min(this.MAX_DB, Math.round((filter.gain + delta) * 10) / 10));
          gainInput.value = filter.gain.toFixed(1);
          this.onParamInput();
        });
      }
      gainTd.appendChild(gainInput);

      // Q input (up to 9.99 with 2 decimal places precision, typing & wheel scrollable, disabled for shelf types)
      const qTd = document.createElement("td");
      const qInput = document.createElement("input");
      qInput.type = "number";
      qInput.className = "peq-input";
      qInput.step = "0.01";
      qInput.min = "0.00";
      qInput.max = "9.99";
      qInput.value = filter.Q.toFixed(2);
      qInput.disabled = !hasQ;
      if (!hasQ) {
        qInput.title = "Q does not apply to shelf filter types in Web Audio API";
        qInput.value = "-";
      }

      if (hasQ) {
        qInput.addEventListener("input", () => {
          let val = parseFloat(qInput.value);
          if (!isNaN(val)) {
            filter.Q = Math.max(this.MIN_Q, Math.min(this.MAX_Q, val));
            this.onParamInput();
          }
        });
        qInput.addEventListener("blur", () => {
          let val = parseFloat(qInput.value);
          if (isNaN(val)) val = 1.0;
          filter.Q = Math.max(this.MIN_Q, Math.min(this.MAX_Q, Math.round(val * 100) / 100));
          qInput.value = filter.Q.toFixed(2);
          this.onParamInput();
        });
        qInput.addEventListener("wheel", (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.05 : -0.05;
          filter.Q = Math.max(this.MIN_Q, Math.min(this.MAX_Q, Math.round((filter.Q + delta) * 100) / 100));
          qInput.value = filter.Q.toFixed(2);
          this.onParamInput();
        });
      }
      qTd.appendChild(qInput);

      // Delete button
      const delTd = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "peq-del-btn";
      delBtn.title = "Delete filter";
      delBtn.setAttribute("aria-label", "Delete filter");
      delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.filters.splice(idx, 1);
        if (this.selectedIndex === idx) {
          this.selectedIndex = this.filters.length > 0 ? Math.min(idx, this.filters.length - 1) : null;
        } else if (this.selectedIndex !== null && this.selectedIndex > idx) {
          this.selectedIndex--;
        }
        this.notifyChange();
      });
      delTd.appendChild(delBtn);

      row.appendChild(numTd);
      row.appendChild(typeTd);
      row.appendChild(freqTd);
      row.appendChild(gainTd);
      row.appendChild(qTd);
      row.appendChild(delTd);

      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT" || (e.target as HTMLElement).tagName === "BUTTON") {
          return;
        }
        this.selectedIndex = idx;
        this.renderFilterList();
        this.drawGraph();
      });

      this.filterListBody.appendChild(row);
    });

    // Render empty placeholder rows in the middle so the Add Filter button stays pinned at the bottom
    const maxFilters = 10;
    const currentCount = this.filters.length;
    const emptyRowsNeeded = maxFilters - currentCount - (currentCount < maxFilters ? 1 : 0);
    for (let i = 0; i < emptyRowsNeeded; i++) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "peq-empty-row";
      for (let c = 0; c < 6; c++) {
        const emptyTd = document.createElement("td");
        emptyTd.className = "peq-empty-td";
        emptyTd.innerHTML = `<span class="peq-empty-spacer">&nbsp;</span>`;
        emptyRow.appendChild(emptyTd);
      }
      this.filterListBody.appendChild(emptyRow);
    }

    // Add Filter button pinned at the very bottom (Row 10)
    if (currentCount < maxFilters) {
      const addRow = document.createElement("tr");
      addRow.className = "peq-add-row";
      const addTd = document.createElement("td");
      addTd.colSpan = 6;
      addTd.innerHTML = `
        <button type="button" class="peq-table-add-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Add Filter
        </button>
      `;
      addTd.querySelector("button")?.addEventListener("click", () => this.addFilter());
      addRow.appendChild(addTd);
      this.filterListBody.appendChild(addRow);
    }
  }

  // MARK: Coordinate conversions
  private freqToX(freq: number, width: number): number {
    const logMin = Math.log10(this.MIN_FREQ);
    const logMax = Math.log10(this.MAX_FREQ);
    const logF = Math.log10(Math.max(this.MIN_FREQ, Math.min(this.MAX_FREQ, freq)));
    return ((logF - logMin) / (logMax - logMin)) * width;
  }

  private xToFreq(x: number, width: number): number {
    const logMin = Math.log10(this.MIN_FREQ);
    const logMax = Math.log10(this.MAX_FREQ);
    const ratio = Math.max(0, Math.min(1, x / width));
    const logF = logMin + ratio * (logMax - logMin);
    return Math.pow(10, logF);
  }

  private dbToY(db: number, height: number): number {
    const padding = 20;
    const availHeight = height - padding * 2;
    const ratio = (db - this.MIN_DB) / (this.MAX_DB - this.MIN_DB);
    return height - padding - ratio * availHeight;
  }

  private yToDb(y: number, height: number): number {
    const padding = 20;
    const availHeight = height - padding * 2;
    const ratio = (height - padding - y) / availHeight;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return this.MIN_DB + clampedRatio * (this.MAX_DB - this.MIN_DB);
  }

  private computeResponseCurve() {
    if (!this.isResponseDirty) return;

    // Reset OfflineAudioContext to force garbage collection of old BiquadFilterNodes
    this.offlineAudioCtx = new OfflineAudioContext(1, 1, 44100);

    this.totalDbResponse.fill(0);
    this.filters.forEach((filter) => {
      try {
        const node = this.offlineAudioCtx.createBiquadFilter();
        node.type = filter.type;
        node.frequency.value = filter.freq;
        node.gain.value = filterHasGain(filter.type) ? filter.gain : 0;
        node.Q.value = filter.Q;

        node.getFrequencyResponse(this.frequencies, this.magResponseBuffer, this.phaseResponseBuffer);

        for (let i = 0; i < this.numSamplePoints; i++) {
          const mag = this.magResponseBuffer[i];
          const db = 20 * Math.log10(Math.max(1e-5, mag));
          this.totalDbResponse[i] += db;
        }
      } catch (err) {
        console.warn("Error computing frequency response:", err);
      }
    });

    this.isResponseDirty = false;
  }

  // MARK: Graph Rendering
  private drawGraph() {
    if (!this.canvas || !this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cssWidth = this.canvas.offsetWidth;
    const cssHeight = this.canvas.offsetHeight;

    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid Lines & Labels
    this.drawGrid(width, height);

    // 2. Draw visualizer bars (behind EQ curve)
    this.drawVisualizer(width, height);

    // 3. Compute Combined Frequency Response (cached)
    this.computeResponseCurve();

    // 3. Draw Frequency Response Curve
    this.ctx.beginPath();
    this.ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
    this.ctx.strokeStyle = "#fa486f";
    this.ctx.shadowColor = "rgba(250, 72, 111, 0.5)";
    this.ctx.shadowBlur = 10 * (window.devicePixelRatio || 1);

    for (let i = 0; i < this.numSamplePoints; i++) {
      const freq = this.frequencies[i];
      const db = Math.max(-30, Math.min(30, this.totalDbResponse[i]));
      const x = this.freqToX(freq, width);
      const y = this.dbToY(db, height);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Fill semi-transparent area under the curve
    this.ctx.lineTo(width, this.dbToY(0, height));
    this.ctx.lineTo(0, this.dbToY(0, height));
    this.ctx.closePath();
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(250, 72, 111, 0.15)");
    gradient.addColorStop(1, "rgba(250, 72, 111, 0.0)");
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // 4. Update Handles Overlay
    this.renderHandlesOverlay(cssWidth, cssHeight);
  }

  private drawGrid(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.lineWidth = 1 * dpr;

    // dB Grid Lines (-12, -6, 0, +6, +12)
    const dbValues = [-12, -6, 0, 6, 12];
    this.ctx.font = `${11 * dpr}px Inter, sans-serif`;

    dbValues.forEach((db) => {
      const y = this.dbToY(db, height);
      this.ctx.strokeStyle = db === 0 ? "#44444c" : "#28282c";
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();

      this.ctx.fillStyle = "#8e8e93";
      this.ctx.fillText(`${db > 0 ? "+" : ""}${db} dB`, 8 * dpr, y - 4 * dpr);
    });

    // Frequency Grid Lines (20, 50, 100, 200, 500, 1k, 2k, 5k, 10k, 20k Hz)
    const freqGrid = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqGrid.forEach((freq) => {
      const x = this.freqToX(freq, width);
      this.ctx.strokeStyle = (freq === 1000 || freq === 100 || freq === 10000) ? "#36363a" : "#222226";
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();

      if (freq === 20 || freq === 100 || freq === 1000 || freq === 10000 || freq === 20000) {
        this.ctx.fillStyle = "#8e8e93";
        if (freq === 10000 || freq === 20000) {
          // Draw to the LEFT of the line so text doesn't overflow the right edge
          this.ctx.textAlign = "right";
          this.ctx.fillText(formatFrequency(freq), Math.min(width - 8 * dpr, x - 4 * dpr), height - 6 * dpr);
          this.ctx.textAlign = "left";
        } else {
          this.ctx.fillText(formatFrequency(freq), Math.max(8 * dpr, x + 4 * dpr), height - 6 * dpr);
        }
      }
    });
  }

  private drawVisualizer(width: number, height: number) {
    if (!this.analyser || !this.vizDataArray) {
      if (this.vizCaptureError) {
        this.drawVisualizerUnavailableNotice(width, height);
      }
      return;
    }

    this.analyser.getByteFrequencyData(this.vizDataArray);

    const sampleRate = this.analyser.context.sampleRate;
    const binCount = this.analyser.frequencyBinCount;

    // Build gradient: Option 3 — Slate / Muted Steel Blue (slate-grey bottom → transparent top)
    const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "rgba(148, 163, 184, 0.32)");
    gradient.addColorStop(0.5, "rgba(148, 163, 184, 0.12)");
    gradient.addColorStop(1, "rgba(148, 163, 184, 0.02)");
    this.ctx.fillStyle = gradient;

    // 1. Pre-smooth raw FFT bins using a 5-tap Gaussian kernel to remove sharp noise spikes
    const smoothedBins = new Float32Array(binCount);
    for (let i = 0; i < binCount; i++) {
      const b0 = this.vizDataArray[Math.max(0, i - 2)];
      const b1 = this.vizDataArray[Math.max(0, i - 1)];
      const b2 = this.vizDataArray[i];
      const b3 = this.vizDataArray[Math.min(binCount - 1, i + 1)];
      const b4 = this.vizDataArray[Math.min(binCount - 1, i + 2)];
      smoothedBins[i] = b0 * 0.06 + b1 * 0.24 + b2 * 0.40 + b3 * 0.24 + b4 * 0.06;
    }

    // 2. Catmull-Rom cubic spline interpolation (C1-continuous: zero sharp knees/kinks at integer bin boundaries)
    const nyquist = sampleRate / 2;
    const points: { x: number; y: number }[] = [];
    const step = 3; // Sample every 3 pixels for a silky smooth Bezier path

    for (let px = 0; px <= width + step; px += step) {
      const clampedPx = Math.min(width, px);
      const freq = this.xToFreq(clampedPx, width);
      const exactBin = Math.max(0, Math.min(binCount - 1, (freq / nyquist) * binCount));
      
      const i1 = Math.floor(exactBin);
      const t = exactBin - i1;

      const i0 = Math.max(0, i1 - 1);
      const i2 = Math.min(binCount - 1, i1 + 1);
      const i3 = Math.min(binCount - 1, i1 + 2);

      const y0 = smoothedBins[i0];
      const y1 = smoothedBins[i1];
      const y2 = smoothedBins[i2];
      const y3 = smoothedBins[i3];

      // Catmull-Rom cubic spline formula
      const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
      const a1 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
      const a2 = -0.5 * y0 + 0.5 * y2;
      const a3 = y1;

      const val = a0 * t * t * t + a1 * t * t + a2 * t + a3;
      let amplitude = Math.max(0, Math.min(255, val)) / 255;

      // 3. MiniMeters-style Spectrum Tilt (+4.5 dB slope with 1 kHz pivot point) & Visual Gain Scaling
      // Attenuates excessive bass humps, boosts high frequencies, and scales peak amplitude up to 90% canvas height.
      const tiltFactor = Math.pow(freq / 1000, 0.20);
      const visualGain = 1.25; // Visual sensitivity boost to fill the canvas dynamically
      amplitude = Math.max(0, Math.min(1, amplitude * tiltFactor * visualGain));

      const barH = amplitude * height;
      const y = height - barH;
      points.push({ x: clampedPx, y });
    }

    // 3. Render continuous rounded curve with Quadratic Bezier midpoints
    if (points.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, height);
      this.ctx.lineTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const xc = (p0.x + p1.x) / 2;
        const yc = (p0.y + p1.y) / 2;
        this.ctx.quadraticCurveTo(p0.x, p0.y, xc, yc);
      }

      const last = points[points.length - 1];
      this.ctx.lineTo(last.x, last.y);
      this.ctx.lineTo(width, height);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  private drawVisualizerUnavailableNotice(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    const centerX = width / 2;
    const posY = this.dbToY(-9, height);

    this.ctx.save();
    this.ctx.fillStyle = "#8e8e93";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    // Primary line (same style as grid text, slightly larger font)
    this.ctx.font = `600 ${13 * dpr}px Inter, sans-serif`;
    this.ctx.fillText("Spectrum visualizer disabled in site button view", centerX, posY - 9 * dpr);

    // Secondary line
    this.ctx.font = `400 ${11.5 * dpr}px Inter, sans-serif`;
    this.ctx.fillText("Click extension icon in browser toolbar to enable visualizer", centerX, posY + 9 * dpr);

    this.ctx.restore();
  }

  private renderHandlesOverlay(cssWidth: number, cssHeight: number) {
    const existingHandles = Array.from(this.handlesOverlay.children) as HTMLElement[];
    const needsRebuild =
      existingHandles.length !== this.filters.length ||
      existingHandles.some((h, idx) => {
        const isSelected = this.selectedIndex === idx;
        return h.classList.contains("selected") !== isSelected;
      });

    if (needsRebuild) {
      this.handlesOverlay.innerHTML = "";
      this.filters.forEach((_filter, idx) => {
        const isSelected = this.selectedIndex === idx;
        const handle = document.createElement("div");
        handle.className = `peq-handle ${isSelected ? "selected" : ""}`;
        handle.dataset.index = idx.toString();
        handle.innerHTML = `<span class="peq-handle-num">${idx + 1}</span>`;
        this.handlesOverlay.appendChild(handle);
      });
      this.handlesDirty = true;
    }

    if (this.handlesDirty) {
      const HANDLE_R = 12;
      const handles = Array.from(this.handlesOverlay.children) as HTMLElement[];
      this.filters.forEach((filter, idx) => {
        const handle = handles[idx];
        if (!handle) return;
        const x = this.freqToX(filter.freq, cssWidth);
        const db = filterHasGain(filter.type) ? filter.gain : 0;
        const y = this.dbToY(db, cssHeight);

        handle.style.left = `${Math.max(HANDLE_R, Math.min(cssWidth - HANDLE_R, x))}px`;
        handle.style.top = `${Math.max(HANDLE_R, Math.min(cssHeight - HANDLE_R, y))}px`;
      });
      this.handlesDirty = false;
    }
  }


  // MARK: Mouse Drag & Wheel Handlers
  private onOverlayMouseDown(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest(".peq-handle") as HTMLElement;
    if (!target || target.dataset.index === undefined) return;

    e.preventDefault();
    const idx = parseInt(target.dataset.index, 10);
    this.selectedIndex = idx;
    this.isDragging = true;
    this.activeDragIndex = idx;

    this.renderFilterList();
    this.drawGraph();
  }

  private onOverlayMouseMove(e: MouseEvent) {
    if (!this.isDragging || this.activeDragIndex === null) return;
    const filter = this.filters[this.activeDragIndex];
    if (!filter) return;

    const rect = this.handlesOverlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rawFreq = this.xToFreq(x, rect.width);
    filter.freq = Math.max(this.MIN_FREQ, Math.min(this.MAX_FREQ, Math.round(rawFreq)));

    if (filterHasGain(filter.type)) {
      const rawDb = this.yToDb(y, rect.height);
      filter.gain = Math.max(this.MIN_DB, Math.min(this.MAX_DB, Math.round(rawDb * 10) / 10));
    }

    this.updateRowInputs(this.activeDragIndex);
    this.onParamInput();
  }

  private onOverlayMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.activeDragIndex = null;
    }
  }

  private onOverlayWheel(e: WheelEvent) {
    const target = (e.target as HTMLElement).closest(".peq-handle") as HTMLElement;
    if (!target || target.dataset.index === undefined) return;

    e.preventDefault();
    const idx = parseInt(target.dataset.index, 10);
    const filter = this.filters[idx];
    if (!filter) return;

    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    let newQ = Math.round((filter.Q + delta) * 100) / 100;
    newQ = Math.max(this.MIN_Q, Math.min(this.MAX_Q, newQ));
    filter.Q = newQ;

    this.updateRowInputs(idx);
    this.onParamInput();
  }

  private updateRowInputs(idx: number | null) {
    if (idx === null || idx < 0) return;
    const row = this.filterListBody.children[idx] as HTMLElement;
    if (!row) return;
    const filter = this.filters[idx];
    if (!filter) return;

    const inputs = row.querySelectorAll<HTMLInputElement>(".peq-input");
    if (inputs.length >= 3) {
      inputs[0].value = Math.round(filter.freq).toString();
      if (filterHasGain(filter.type)) {
        inputs[1].value = filter.gain.toFixed(1);
        inputs[1].disabled = false;
      } else {
        inputs[1].value = "-";
        inputs[1].disabled = true;
      }

      if (filterHasQ(filter.type)) {
        inputs[2].value = filter.Q.toFixed(2);
        inputs[2].disabled = false;
      } else {
        inputs[2].value = "-";
        inputs[2].disabled = true;
      }
    }
  }

  private onParamInput() {
    this.isResponseDirty = true;
    this.handlesDirty = true;
    this.drawGraph();
    this.onChange(this.filters);
  }

  private notifyChange() {
    this.isResponseDirty = true;
    this.handlesDirty = true;
    this.renderFilterList();
    this.drawGraph();
    this.onChange(this.filters);
  }
}
