

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "open_popup") {
    chrome.action.openPopup();
  } else if (msg.action === "get_tab_hostname") {
    if (sender.tab && sender.tab.url) {
      try {
        const url = new URL(sender.tab.url);
        sendResponse({ hostname: url.hostname });
      } catch (e) {
        sendResponse({ hostname: null });
      }
    } else {
      sendResponse({ hostname: null });
    }
    return true; // Keep channel open for async response
  }
});





