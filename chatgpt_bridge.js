// chatgpt_bridge.js — runs on chatgpt.com/* (Chrome extension content script)

(async function () {
    'use strict';

    const TASK_KEY = 'cqsChatGptTask';
    const ANSWER_KEY = 'cqsChatGptAnswers';

    // ── Listen for new tasks when the tab is reused ───────────────────────────
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[TASK_KEY]?.newValue) {
            handleTask(changes[TASK_KEY].newValue);
        }
    });

    // ── Check for a pending task on initial load ──────────────────────────────
    const storage = await chrome.storage.local.get([TASK_KEY]);
    if (storage[TASK_KEY]) {
        handleTask(storage[TASK_KEY]);
    }

    async function handleTask(task) {
        if (!task?.prompt) return;

        console.log('[QuizAI Bridge] ✅ Task found. Prompt length:', task.prompt.length);

        // ── 2. Wait for the editor to be fully hydrated ───────────────────────
        await delay(2500); // ChatGPT React takes a moment to mount

        const inputEl = await waitForEl([
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'div[contenteditable="true"]#prompt-textarea'
        ], 20000);

        if (!inputEl) {
            await storeError('ChatGPT input not found. Make sure you are logged into chatgpt.com');
            return;
        }

        console.log('[QuizAI Bridge] Input found:', inputEl.tagName, inputEl.id);

        // ── 3. Snapshot baseline BEFORE sending ──────────────────────────────────────
        const RESPONSE_SELS = [
            'div[data-message-author-role="assistant"]',
            '.agent-turn',
            '.markdown'
        ];

        function getAllResponseEls() {
            for (const sel of RESPONSE_SELS) {
                const all = document.querySelectorAll(sel);
                if (all.length > 0) return [...all];
            }
            return [];
        }

        const baselineCount = getAllResponseEls().length;
        console.log('[QuizAI Bridge] Baseline response element count:', baselineCount);

        // ── 4. Inject the prompt ─────────────────────────────────────────────────────
        inputEl.focus();
        await delay(300);

        if (inputEl.tagName.toLowerCase() === 'textarea') {
            // For normal textarea
            inputEl.value = task.prompt;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // For contenteditable
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            await delay(150);

            const inserted = document.execCommand('insertText', false, task.prompt);

            if (!inserted || !(inputEl.innerText || '').trim()) {
                const dt = new DataTransfer();
                dt.setData('text/plain', task.prompt);
                inputEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            }

            if (!(inputEl.innerText || '').trim()) {
                inputEl.innerHTML = '<p>' + task.prompt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
                inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
            }
        }

        await delay(400);

        // ── 5. Click Send ────────────────────────────────────────────────────────────
        await delay(800); // let React enable the Send button

        const sendBtn = await waitForEl([
            'button[data-testid="send-button"]',
            'button[aria-label="Send message"]'
        ], 5000);

        if (sendBtn && !sendBtn.disabled) {
            console.log('[QuizAI Bridge] Clicking Send...');
            sendBtn.click();
        } else {
            console.warn('[QuizAI Bridge] Send button not found — pressing Enter');
            inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
            }));
        }

        console.log('[QuizAI Bridge] Message sent. Waiting for NEW response elements...');
        await delay(3000); // give ChatGPT time to start generating

        // ── 6. Wait for a NEW response element to appear ───────
        const newEls = await waitFor(
            () => {
                const all = getAllResponseEls();
                return all.length > baselineCount ? all : null;
            },
            60000
        );

        if (!newEls) {
            await storeError('ChatGPT did not generate a response in time. Try again.');
            return;
        }

        console.log('[QuizAI Bridge] New response elements appeared:', newEls.length - baselineCount, 'new');

        // Wait extra time for ChatGPT's streaming to finish.
        // ChatGPT has a "Stop generating" button. When it disappears, it's done. But stable text is safer.
        const responseText = await waitForStableText(() => {
            const all = getAllResponseEls();
            return all.slice(baselineCount).map(el => (el.innerText || '').trim()).filter(t => t.length > 5).join('\n');
        }, 120000);

        console.log('[QuizAI Bridge] Stable response (', responseText.length, ' chars)');

        if (!responseText.trim()) {
            await storeError('ChatGPT response was empty. Try again.');
            return;
        }

        // ── 8. Parse and store ───────────────────────────────────────────────────────
        const answers = parseChatGPTResponse(responseText);
        console.log('[QuizAI Bridge] Parsed', answers.length, 'answers:', JSON.stringify(answers));

        await chrome.storage.local.set({
            [ANSWER_KEY]: {
                answers,
                rawText: responseText.slice(0, 5000),
                taskId: task.taskId,
                timestamp: Date.now(),
            }
        });
        await chrome.storage.local.remove([TASK_KEY]);

        showBanner(`✅ Quiz AI: ${answers.length} answers from ChatGPT! Switch back to Coursera.`);
        console.log('[QuizAI Bridge] ✅ Done.');

        // ──────────────────────────────────────────────────────────────────────────────
        //  HELPERS
        // ──────────────────────────────────────────────────────────────────────────────

        function waitForEl(sels, maxMs) {
            return new Promise(resolve => {
                for (const sel of sels) {
                    const el = document.querySelector(sel);
                    if (el) { resolve(el); return; }
                }
                const start = Date.now();
                const id = setInterval(() => {
                    for (const sel of sels) {
                        const el = document.querySelector(sel);
                        if (el) { clearInterval(id); resolve(el); return; }
                    }
                    if (Date.now() - start > maxMs) { clearInterval(id); resolve(null); }
                }, 400);
            });
        }

        function waitFor(fn, maxMs) {
            return new Promise(resolve => {
                const r = fn(); if (r) { resolve(r); return; }
                const start = Date.now();
                const id = setInterval(() => {
                    const r2 = fn();
                    if (r2 || Date.now() - start > maxMs) { clearInterval(id); resolve(r2 || null); }
                }, 600);
            });
        }

        function waitForStableText(getText, maxMs) {
            return new Promise(resolve => {
                let last = '', stableCount = 0;
                const start = Date.now();
                const id = setInterval(() => {
                    const cur = getText();
                    if (cur && cur === last && cur.length > 10) {
                        stableCount++;
                        if (stableCount >= 4) { clearInterval(id); resolve(cur); return; } // stable 4×800ms
                    } else { stableCount = 0; last = cur; }
                    if (Date.now() - start > maxMs) { clearInterval(id); resolve(last); }
                }, 800);
            });
        }

        function parseChatGPTResponse(text) {
            // 1. Extract using brace balancing
            const candidates = [];
            let depth = 0, start = -1;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '{') {
                    if (depth === 0) start = i;
                    depth++;
                } else if (text[i] === '}') {
                    if (depth > 0) {
                        depth--;
                        if (depth === 0 && start !== -1) {
                            candidates.push(text.slice(start, i + 1));
                            start = -1;
                        }
                    }
                }
            }
            for (const candidate of candidates.reverse()) {
                try {
                    const p = JSON.parse(candidate);
                    if (Array.isArray(p.answers) && p.answers.length) return p.answers;
                } catch { /* try next */ }
            }

            // 2. Custom Regex extractor for malformed JSON (handles unescaped quotes)
            const customRes = [];
            const matches = [...text.matchAll(/"q"\s*:\s*(\d+)\s*,\s*"a"\s*:\s*\[([\s\S]*?)\]\s*\}/g)];
            if (matches.length > 0) {
                for (const m of matches) {
                    const q = parseInt(m[1]);
                    let rawA = m[2].trim();
                    // Check if it's just letter choices
                    if (/^"[A-H]"(?:\s*,\s*"[A-H]")*$/.test(rawA)) {
                        const letters = [...rawA.matchAll(/"([A-H])"/g)].map(x => x[1]);
                        customRes.push({ q, a: letters });
                    } else {
                        // Open text answer - sanitize bounding quotes
                        if (rawA.startsWith('"')) rawA = rawA.substring(1);
                        if (rawA.endsWith('"')) rawA = rawA.substring(0, rawA.length - 1);
                        rawA = rawA.replace(/\\"/g, '"').replace(/\\n/g, '\n');
                        customRes.push({ q, a: [rawA] });
                    }
                }
                if (customRes.length > 0) return customRes;
            }

            // 3. Line-by-line fallback
            const result = [];
            for (const line of text.split('\n')) {
                const m = line.match(/(?:Q|Question\s*)?(\d+)[.:)\s]+([A-H](?:\s*[,/&]?\s*(?:and\s*)?[A-H])*)/i);
                if (m) {
                    const q = parseInt(m[1]);
                    const letters = [...m[2].matchAll(/[A-H]/gi)].map(x => x[0].toUpperCase());
                    if (letters.length) result.push({ q, a: [...new Set(letters)] });
                }
            }
            return result;
        }

        async function storeError(msg) {
            console.error('[QuizAI Bridge] ERROR:', msg);
            await chrome.storage.local.set({ [ANSWER_KEY]: { error: msg, taskId: task.taskId, timestamp: Date.now() } });
            await chrome.storage.local.remove([TASK_KEY]);
            showBanner('⚠ Quiz AI: ' + msg);
        }

        function showBanner(msg) {
            const b = document.createElement('div');
            b.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;max-width:380px;' +
                'background:#10a37f;border:1.5px solid #054a38;border-radius:14px;' +
                'padding:14px 20px;font-family:Inter,system-ui,sans-serif;font-size:13px;' +
                'font-weight:600;color:#ffffff;box-shadow:0 8px 40px rgba(0,0,0,0.6);line-height:1.5;';
            b.textContent = msg;
            document.body.appendChild(b);
            setTimeout(() => b.remove(), 12000);
        }

        function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    } // End of handleTask

})();
