// background.js — v6.0 Web UI AI Solvers (ChatGPT & Claude)

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
});
