// background.js — v6.1 Web UI AI Solvers (ChatGPT & Claude) + Vision/Screenshot support

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_CLAUDE_TAB') {
    chrome.tabs.query({ url: '*://claude.ai/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: 'https://claude.ai/chat', active: true });
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.type === 'OPEN_CHATGPT_TAB') {
    chrome.tabs.query({ url: '*://chatgpt.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: 'https://chatgpt.com/', active: true });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Screenshot capture for image-containing questions ──────────────────────
  // content.js calls this after scrolling the question block into view.
  // Returns the full visible tab as a PNG dataURL so content.js can crop it.
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab?.windowId;
    if (!windowId) { sendResponse({ error: 'No windowId' }); return true; }
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // keep message channel open for async response
  }
});
