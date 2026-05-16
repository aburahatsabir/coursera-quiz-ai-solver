// claude_bridge.js — runs on claude.ai/* (Chrome extension content script)
// Lives tested selectors (Feb 2026):
//   Input:    div.tiptap.ProseMirror
//   Inject:   execCommand('insertText')  ← confirmed ✓
//   Send:     button[aria-label="Send message"]  ← confirmed ✓
//   Response: .font-claude-response  /  .font-claude-response-body  ← confirmed ✓

(async function () {
    'use strict';

    const TASK_KEY = 'cqsClaudeTask';
    const ANSWER_KEY = 'cqsClaudeAnswers';

    // Module-level constant — must be here (not inside handleTask) to avoid TDZ errors
    // when isClaudeRetryMessage() is called before the const line executes.
    const CLAUDE_RETRY_PHRASES = [
        /taking longer than usual/i,
        /trying again shortly/i,
        /[\u2026].*attempt\s+\d+/i,   // "… attempt 2"
    ];

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

        // ── 2. Wait for the Tiptap editor to be fully hydrated ───────────────────────
        await delay(2500); // Claude's React/Tiptap takes 1-3s to mount

        const inputEl = await waitForEl([
            'div.tiptap.ProseMirror',              // Primary — live tested ✓
            'div[contenteditable="true"][enterkeyhint]',
            'div[contenteditable="true"][data-placeholder]',
            'div[contenteditable="true"]',         // Generic fallback
        ], 20000);

        if (!inputEl) {
            await storeError('Claude chat input not found. Make sure you are logged into claude.ai');
            return;
        }

        console.log('[QuizAI Bridge] Input found:', inputEl.className.slice(0, 80));

        // ── 3. Snapshot baseline BEFORE sending ──────────────────────────────────────
        // This tells us how many response elements exist BEFORE we send our message.
        // We'll only read elements that appear AFTER this count.
        const RESPONSE_SELS = [
            '.font-claude-response',
            '.font-claude-response-body',
            '[class*="font-claude-response"]',
        ];

        function getAllResponseEls() {
            for (const sel of RESPONSE_SELS) {
                const all = document.querySelectorAll(sel);
                if (all.length > 0) return [...all];
            }
            return [];
        }

        function normalizeText(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

        const baselineEls = getAllResponseEls();
        const baselineCount = baselineEls.length;
        const baselineLastText = baselineEls.length ? normalizeText(baselineEls[baselineEls.length - 1].innerText) : '';
        console.log('[QuizAI Bridge] Baseline captured. Count:', baselineCount, 'Last text len:', baselineLastText.length);

        // ── 4. Paste question screenshots (for vision/image questions) ────────────
        if (Array.isArray(task.screenshots) && task.screenshots.length > 0) {
            console.log(`[QuizAI Bridge] Pasting ${task.screenshots.length} screenshot(s) for vision questions...`);
            await pasteImages(inputEl, task.screenshots);
            await delay(1500); // wait for Claude to process attachments
        }

        // ── 5. Inject the prompt ─────────────────────────────────────────────────────
        inputEl.focus();
        await delay(300);
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await delay(150);

        // PRIMARY: execCommand insertText (confirmed working with Tiptap ✓)
        const inserted = document.execCommand('insertText', false, task.prompt);
        console.log('[QuizAI Bridge] insertText ok:', inserted, '| snippet:', (inputEl.innerText || '').slice(0, 60));

        // FALLBACK 1: ClipboardEvent
        if (!inserted || !(inputEl.innerText || '').trim()) {
            console.warn('[QuizAI Bridge] Falling back to ClipboardEvent...');
            const dt = new DataTransfer();
            dt.setData('text/plain', task.prompt);
            inputEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            await delay(400);
        }

        // FALLBACK 2: innerHTML injection
        if (!(inputEl.innerText || '').trim()) {
            console.warn('[QuizAI Bridge] Falling back to innerHTML...');
            inputEl.innerHTML = '<p>' + task.prompt.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
            await delay(400);
        }

        console.log('[QuizAI Bridge] Final input text (first 80 chars):', (inputEl.innerText || '').slice(0, 80));

        // ── 5. Click Send ────────────────────────────────────────────────────────────
        await delay(600); // let React enable the Send button

        const sendBtn = await waitForEl([
            'button[aria-label="Send message"]',  // confirmed ✓
            'button[aria-label="Send Message"]',
            'button[data-testid="send-button"]',
            'button[aria-label*="Send" i]',
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
        await delay(3000); // give Claude time to start generating

        // ── 6. Wait for a NEW response element to appear (not old sidebar text) ───────
        const newEls = await waitFor(
            () => {
                const all = getAllResponseEls();
                if (!all.length) return null;

                if (baselineCount > 0 && all.length > baselineCount) return all;
                if (baselineCount === 0 && all.length > 0) return all;
                return null;
            },
            60000
        );

        if (!newEls) {
            await storeError('Claude did not generate a response in time. Try again.');
            return;
        }

        console.log('[QuizAI Bridge] New response text detected.');

        // ── 7. Wait for the NEW response text to stabilise ───────────────────────────
        const responseText = await waitForStableText(() => {
            const all = getAllResponseEls();
            if (!all.length) return '';
            // Just read the absolute last output block, immune to SPA unmounts
            return (all[all.length - 1].innerText || '').trim();
        }, 120000);

        console.log('[QuizAI Bridge] Stable response (', responseText.length, ' chars):', responseText.slice(0, 150));

        if (!responseText.trim()) {
            await storeError('Claude response was empty. Try again.');
            return;
        }

        // ── 8. Parse and store ───────────────────────────────────────────────────────
        const answers = parseClaudeResponse(responseText);
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

        showBanner(`✅ Quiz AI: ${answers.length} answers from Claude! Switch back to Coursera.`);
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

        // Paste base64 screenshots into Claude's input as image attachments
        async function pasteImages(inputEl, screenshots) {
            for (const { q, dataUrl } of screenshots) {
                try {
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    const dt = new DataTransfer();
                    dt.items.add(new File([blob], `question_${q}.png`, { type: 'image/png' }));
                    inputEl.focus();
                    inputEl.dispatchEvent(new ClipboardEvent('paste', {
                        clipboardData: dt,
                        bubbles: true,
                        cancelable: true
                    }));
                    console.log(`[QuizAI Bridge] Pasted screenshot for Q${q}`);
                    await delay(800);
                } catch (e) {
                    console.warn(`[QuizAI Bridge] Failed to paste image for Q${q}:`, e);
                }
            }
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

        // CLAUDE_RETRY_PHRASES is defined at module scope (top of file) to avoid TDZ errors.

        function isClaudeRetryMessage(text) {
            if (!text) return false;
            return CLAUDE_RETRY_PHRASES.some(re => re.test(text));
        }

        function waitForStableText(getText, maxMs) {
            return new Promise(resolve => {
                let last = '', stableCount = 0;
                const start = Date.now();
                const id = setInterval(() => {
                    const cur = getText();
                    if (cur && cur === last && cur.length > 10) {
                        if (isClaudeRetryMessage(cur)) {
                            // Claude is retrying — reset and keep waiting
                            stableCount = 0;
                            last = ''; // force re-read next tick
                            console.log('[QuizAI Bridge] Retry phrase detected, still waiting...', cur.slice(0, 80));
                        } else {
                            stableCount++;
                            // Longer text (full answer) needs only 2 stable checks (~1.6s).
                            // Shorter text needs 3 checks (~2.4s) to avoid locking onto partial streaming.
                            const needed = cur.length > 300 ? 2 : 3;
                            if (stableCount >= needed) { clearInterval(id); resolve(cur); return; }
                        }
                    } else {
                        stableCount = 0; last = cur;
                        if (cur && cur.includes('"answers"')) {
                            const parsed = parseClaudeResponse(cur, true);
                            if (parsed && parsed.answers && parsed.answers.length > 0) {
                                clearInterval(id); resolve(cur); return;
                            }
                        }
                    }
                    if (Date.now() - start > maxMs) { clearInterval(id); resolve(last); }
                }, 800);
            });
        }

        function parseClaudeResponse(text, skipRegexFallback = false) {
            // 1. Extract all complete JSON objects using brace-balancing
            const candidates = extractJsonObjects(text);
            // Try largest candidate first (most complete JSON blob)
            for (const candidate of [...candidates].reverse()) {
                try {
                    const p = JSON.parse(candidate);
                    if (Array.isArray(p.answers) && p.answers.length) {
                        console.log('[QuizAI Bridge] JSON parsed successfully, answers:', p.answers.length);
                        return p.answers;
                    }
                } catch { /* try next */ }
            }

            // 2. Sanitize-then-parse: replace unescaped internal quotes with apostrophes
            for (const candidate of [...candidates].reverse()) {
                try {
                    const sanitized = candidate.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
                        const fixed = inner.replace(/(?<!\\)"/g, "'");
                        return ': "' + fixed + '"';
                    });
                    const p = JSON.parse(sanitized);
                    if (Array.isArray(p.answers) && p.answers.length) return p.answers;
                } catch { /* try next */ }
            }

            if (skipRegexFallback) return { answers: [] };

            // 3. Regex extraction — handles both letter and open-ended text answers, plus scoreIndex for peer review
            const customRes = [];
            const qBlocks = [...text.matchAll(/"q"\s*:\s*(\d+)\s*,\s*(?:"text"\s*:\s*"([\s\S]*?)"|"a"\s*:\s*\[([\s\S]*?)\])(?:\s*,\s*"scoreIndex"\s*:\s*(\d+))?/g)];
            if (qBlocks.length > 0) {
                for (const m of qBlocks) {
                    const q = parseInt(m[1]);
                    const scoreIndexStr = m[4];
                    let rawA = (m[2] || m[3] || '').trim();
                    let ansObj = { q };

                    if (scoreIndexStr !== undefined) {
                        ansObj.scoreIndex = parseInt(scoreIndexStr);
                    }

                    if (/^"[A-H]"(?:\s*,\s*"[A-H]")*$/.test(rawA)) {
                        ansObj.a = [...rawA.matchAll(/"([A-H])"/g)].map(x => x[1]);
                        customRes.push(ansObj);
                    } else {
                        let extracted = rawA;
                        if (extracted.startsWith('"')) extracted = extracted.substring(1);
                        if (extracted.endsWith('"')) extracted = extracted.substring(0, extracted.length - 1);
                        extracted = extracted.replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
                        if (extracted.length > 2) {
                            ansObj.a = [extracted];
                            customRes.push(ansObj);
                        }
                    }
                }
                if (customRes.length > 0) return customRes;
            }

            // 4. Block-by-block fallback (Handles conversational multi-line answers)
            const result = [];
            const blocks = text.split(/(?:(?:\*\*|^|\n)\s*(?:Q|Question)\s*(\d+)[:.)\s])/i);
            for (let i = 1; i < blocks.length; i += 2) {
                const q = parseInt(blocks[i]);
                const content = blocks[i + 1] || '';
                const letterMatches = [...content.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?([A-H])(?:\*\*|[.)])\s+/g)];
                if (letterMatches.length > 0) {
                    const letters = letterMatches.map(m => m[1].toUpperCase());
                    result.push({ q, a: [...new Set(letters)] });
                } else {
                    let txt = content;
                    const ansMatch = content.match(/Answer\s*:\s*([\s\S]+?)(?:\n\nExplanation|\n\n$|$)/i);
                    if (ansMatch) txt = ansMatch[1];
                    txt = txt.replace(/\*/g, '').trim();
                    if (txt.length > 2) result.push({ q, a: [txt] });
                }
            }
            return result;
        }

        // Extracts all complete top-level JSON objects by counting balanced braces
        function extractJsonObjects(text) {
            const results = [];
            let depth = 0, start = -1;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '{') {
                    if (depth === 0) start = i;
                    depth++;
                } else if (text[i] === '}') {
                    depth--;
                    if (depth === 0 && start !== -1) {
                        results.push(text.slice(start, i + 1));
                        start = -1;
                    }
                }
            }
            return results;
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
                'background:#0f172a;border:1.5px solid #6366f1;border-radius:14px;' +
                'padding:14px 20px;font-family:Inter,system-ui,sans-serif;font-size:13px;' +
                'font-weight:600;color:#f8fafc;box-shadow:0 8px 40px rgba(0,0,0,0.6);line-height:1.5;';
            b.textContent = msg;
            document.body.appendChild(b);
            setTimeout(() => b.remove(), 12000);
        }

        function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    } // End of handleTask

})();
