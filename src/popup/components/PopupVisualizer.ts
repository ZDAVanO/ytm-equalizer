/**
 * PopupVisualizer — captures audio from the active tab via chrome.tabCapture
 * and provides an AnalyserNode for real-time frequency visualization in the popup.
 *
 * No message passing needed: tabCapture gives a MediaStream directly in the popup context.
 */
export class PopupVisualizer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private onAnalyserChange: (analyser: AnalyserNode | null, captureError?: boolean) => void;

  constructor(onAnalyserChange: (analyser: AnalyserNode | null, captureError?: boolean) => void) {
    this.onAnalyserChange = onAnalyserChange;
  }

  async start() {
    // tabCapture is only available in extension pages (popup), not in service workers.
    // It captures the currently active tab's audio stream.
    if (!chrome.tabCapture) {
      console.warn("[PopupVisualizer] chrome.tabCapture is not available.");
      this.onAnalyserChange(null, true);
      return;
    }

    try {
      chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
        if (chrome.runtime.lastError) {
          // This is expected when capture is not allowed (e.g. opened via in-page button)
          console.warn("[PopupVisualizer] tabCapture failed:", chrome.runtime.lastError.message);
          this.onAnalyserChange(null, true);
          return;
        }
        if (!stream) {
          console.warn("[PopupVisualizer] No stream returned from tabCapture.");
          this.onAnalyserChange(null, true);
          return;
        }

        this.stream = stream;
        this.audioCtx = new AudioContext();

        const source = this.audioCtx.createMediaStreamSource(stream);

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;

        // source → analyser (for visualization)
        source.connect(this.analyser);

        // source → destination: Chrome silences the captured tab's audio by design,
        // so we must route the captured stream back to speakers ourselves.
        source.connect(this.audioCtx.destination);

        this.onAnalyserChange(this.analyser, false);


        // Stop visualizer when the stream ends (e.g. tab closed/navigated)
        stream.getAudioTracks().forEach((track) => {
          track.addEventListener("ended", () => this.stop());
        });
      });
    } catch (e) {
      console.warn("[PopupVisualizer] Unexpected error starting capture:", e);
      this.onAnalyserChange(null, true);
    }
  }

  stop() {
    this.onAnalyserChange(null, false);

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
  }
}
