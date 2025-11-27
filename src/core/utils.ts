
// MARK: devLog
export function devLog(...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}


// MARK: waitForElem
export function waitForElem(selector: string, cb: (el: Element) => void) {
    const el = document.querySelector(selector);
    if (el) {
        devLog(`[waitForElem] Found element: ${selector}`);
        return cb(el);
    }
    const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
            obs.disconnect();
            devLog(`[waitForElem] Found element via MutationObserver: ${selector}`);
            cb(el);
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}