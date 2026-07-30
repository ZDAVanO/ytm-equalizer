import { Filter } from "../types";
import { filterTypes, filterTypeShort, filterHasGain, filterHasQ, formatFrequency } from "../../filterTypes";

export class ParametricEqEditor {
  private container: HTMLElement;
  private filters: Filter[] = [];
  private selectedIndex: number | null = null;
  private onChange: (filters: Filter[]) => void;

  // DOM Elements
  private rootElement!: HTMLElement;
  private tableContainer!: HTMLElement;
  private filterListBody!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private handlesOverlay!: HTMLElement;

  // Dragging state
  private isDragging = false;
  private activeDragIndex: number | null = null;
  private pendingMouseMove: MouseEvent | null = null;
  private rafPending = false;

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
    this.renderFilterList();
    this.drawGraph();
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
                <col style="width: 18px">
                <col style="width: 22px">
                <col style="width: 32px">
                <col style="width: 26px">
                <col style="width: 26px">
                <col style="width: 20px">
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
      </div>
    `;

    this.rootElement = this.container.querySelector(".peq-editor") as HTMLElement;
    this.tableContainer = this.container.querySelector(".peq-table-container") as HTMLElement;
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
      delBtn.innerHTML = `&times;`;
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

    if (this.filters.length < 10) {
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

    // 2. Compute Combined Frequency Response
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
        this.ctx.fillText(formatFrequency(freq) + " Hz", x + 4 * dpr, height - 6 * dpr);
      }
    });
  }

  private renderHandlesOverlay(cssWidth: number, cssHeight: number) {
    this.handlesOverlay.innerHTML = "";

    this.filters.forEach((filter, idx) => {
      const x = this.freqToX(filter.freq, cssWidth);
      const db = filterHasGain(filter.type) ? filter.gain : 0;
      const y = this.dbToY(db, cssHeight);
      const isSelected = this.selectedIndex === idx;

      const handle = document.createElement("div");
      handle.className = `peq-handle ${isSelected ? "selected" : ""}`;
      handle.style.left = `${x}px`;
      handle.style.top = `${y}px`;
      handle.dataset.index = idx.toString();

      handle.innerHTML = `
        <span class="peq-handle-num">${idx + 1}</span>
      `;

      this.handlesOverlay.appendChild(handle);
    });
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
    this.drawGraph();
    this.onChange(this.filters);
  }

  private notifyChange() {
    this.renderFilterList();
    this.drawGraph();
    this.onChange(this.filters);
  }
}
