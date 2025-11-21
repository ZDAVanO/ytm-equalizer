

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "open_popup") {
    chrome.action.openPopup();
  }
});





