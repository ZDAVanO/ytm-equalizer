
export function initVisualizer(analyser: AnalyserNode) {
    const bar = document.querySelector('ytmusic-player-bar.style-scope.ytmusic-app');
    if (!bar) {
        console.warn('Player bar not found, retrying in 1s...');
        setTimeout(() => initVisualizer(analyser), 1000);
        return;
    }

    // Check if visualizer already exists
    if (document.getElementById('ytm-equalizer-visualizer-container')) {
        return;
    }

    const container = document.createElement('div');
    container.id = 'ytm-equalizer-visualizer-container';
    container.className = 'visualizer-container';
    
    // Create canvas
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    bar.appendChild(container);

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(() => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    });
    resizeObserver.observe(canvas);
    
    // Initial size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let rafId: number | null = null;

    function draw() {
        // Stop loop when tab is hidden — prevents unnecessary GPU load
        if (document.hidden) {
            rafId = null;
            return;
        }

        rafId = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        if (canvasCtx) {
            canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

            const barWidth = (WIDTH / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 255 * HEIGHT; // Scale to height
                
                canvasCtx.fillStyle = `rgba(255, 255, 255, ${dataArray[i] / 255})`; 
                
                canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        }
    }

    // Resume loop when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && rafId === null) {
            draw();
        }
    });

    draw();
}