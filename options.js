// options.js — Settings page controller
// (Must be a separate file — inline scripts are blocked by Chrome Extension CSP)

const DEFAULT_SETTINGS = {
    model: 'gemini-2.0-flash',   // current default — gemini-1.5-flash was deprecated
    language: 'English',
    showConfidence: true,
    showReasoning: true,
    highlight: true,
    autoSolve: false
};

// Load saved settings
chrome.storage.sync.get(['settings'], (data) => {
    const s = data.settings || {};
    if (s.model) document.getElementById('opt-model').value = s.model;
    if (s.language) document.getElementById('opt-language').value = s.language;
    if (s.showConfidence !== undefined) document.getElementById('opt-show-confidence').checked = s.showConfidence;
    if (s.showReasoning !== undefined) document.getElementById('opt-show-reasoning').checked = s.showReasoning;
    if (s.highlight !== undefined) document.getElementById('opt-highlight').checked = s.highlight;
    if (s.autoSolve !== undefined) document.getElementById('opt-auto-solve').checked = s.autoSolve;
});

// Save settings
document.getElementById('save-all-btn').addEventListener('click', () => {
    const settings = {
        model: document.getElementById('opt-model').value,
        language: document.getElementById('opt-language').value,
        showConfidence: document.getElementById('opt-show-confidence').checked,
        showReasoning: document.getElementById('opt-show-reasoning').checked,
        highlight: document.getElementById('opt-highlight').checked,
        autoSolve: document.getElementById('opt-auto-solve').checked
    };
    chrome.storage.sync.set({ settings }, () => {
        const msg = document.getElementById('saved-msg');
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 3000);
    });
});
