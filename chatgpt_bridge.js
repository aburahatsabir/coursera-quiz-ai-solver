// chatgpt_bridge.js — runs on chatgpt.com/* (Chrome extension content script)

(async function () {
    'use strict';

    const TASK_KEY = 'cqsChatGptTask';
    const ANSWER_KEY = 'cqsChatGptAnswers';

    // CHATGPT_PROCESSING_PHRASES detects temporary blocks. Defined globally to avoid TDZ errors.
    const CHATGPT_PROCESSING_PHRASES = [
        /analyzing(?:\s|\.)*$/i,
        /searching(?:\s.*)?web(?:\s|\.)*$/i,
        /running analysis(?:\s|\.)*$/i
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
            'div[data-message-author-role="tool"]'
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
        const baselineIds = new Set(baselineEls.map(el => el.getAttribute('data-message-id')).filter(Boolean));
        console.log('[QuizAI Bridge] Baseline captured. Count:', baselineCount, 'IDs tracked:', baselineIds.size);

        // ── 4. Paste question screenshots (for vision/image questions) ────────────
        if (Array.isArray(task.screenshots) && task.screenshots.length > 0) {
            console.log(`[QuizAI Bridge] Pasting ${task.screenshots.length} screenshot(s) for vision questions...`);
            await pasteImages(inputEl, task.screenshots);
            await delay(1500); // wait for ChatGPT to process attachments
        }

        // ── 5. Inject the prompt ─────────────────────────────────────────────────────
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

        // ── 6. Click Send ────────────────────────────────────────────────────────────
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

        // ── 7. Wait for a NEW response element to appear ───────
        const newEls = await waitFor(
            () => {
                const all = getAllResponseEls();
                if (!all.length) return null;

                // 1. If we find an assistant element with a brand new data-message-id, it's our new block!
                const newBubble = all.find(el => {
                    const id = el.getAttribute('data-message-id');
                    return id && !baselineIds.has(id);
                });
                if (newBubble) return [newBubble];

                // 2. Fallback: if data-message-id is disabled/missing, just ensure count strictly increased
                if (baselineCount > 0 && all.length > baselineCount) return all;

                return null;
            },
            60000
        );

        if (!newEls) {
            await storeError('ChatGPT did not generate a response in time. Try again.');
            return;
        }

        console.log('[QuizAI Bridge] New response text detected.');

        // Wait for ChatGPT's streaming to finish (stable text = done)
        const responseText = await waitForStableText(() => {
            const all = getAllResponseEls();
            if (!all.length) return '';
            const last = all[all.length - 1];
            if (last.getAttribute('data-message-author-role') === 'tool') {
                return '[TOOL_PROCESSING]';
            }
            // Just read the absolute last output block, immune to SPA unmounts
            return (last.innerText || '').trim();
        }, 120000);

        console.log('[QuizAI Bridge] Stable response (', responseText.length, ' chars)');

        if (!responseText.trim()) {
            await storeError('ChatGPT response was empty. Try again.');
            return;
        }

        // ── 8. Parse and store ───────────────────────────────────────────────────────
        // parseChatGPTResponse returns { answers, uploadFileSvg }
        const { answers, uploadFileSvg } = parseChatGPTResponse(responseText);
        console.log('[QuizAI Bridge] Parsed', answers.length, 'answers:', JSON.stringify(answers));
        if (uploadFileSvg) console.log('[QuizAI Bridge] Got uploadFileSvg (' + uploadFileSvg.length + ' chars)');

        await chrome.storage.local.set({
            [ANSWER_KEY]: {
                answers,
                uploadFileSvg: uploadFileSvg || null,  // pass through to content.js for file upload
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

        // Paste base64 screenshots into ChatGPT's input as image attachments
        async function pasteImages(inputEl, screenshots) {
            for (const { q, dataUrl } of screenshots) {
                try {
                    // Convert base64 dataURL → Blob
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();

                    // Build a DataTransfer with the image blob
                    const dt = new DataTransfer();
                    dt.items.add(new File([blob], `question_${q}.png`, { type: 'image/png' }));

                    // Dispatch paste event on the input element
                    inputEl.focus();
                    inputEl.dispatchEvent(new ClipboardEvent('paste', {
                        clipboardData: dt,
                        bubbles: true,
                        cancelable: true
                    }));
                    console.log(`[QuizAI Bridge] Pasted screenshot for Q${q}`);
                    await delay(800); // give ChatGPT time to process each attachment
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



        function isChatGPTProcessing(text) {
            if (text === '[TOOL_PROCESSING]') return true;
            if (document.querySelector('button[aria-label="Stop generating"], button[data-testid="stop-button"]')) return true;
            if (!text) return false;
            return CHATGPT_PROCESSING_PHRASES.some(re => re.test(text));
        }

        function waitForStableText(getText, maxMs) {
            return new Promise(resolve => {
                let last = '', stableCount = 0;
                const start = Date.now();
                const id = setInterval(() => {
                    const cur = getText();
                    if (cur && cur === last && cur.length > 5) {
                        if (isChatGPTProcessing(cur)) {
                            // ChatGPT is in an intermediate state (Analyzing), keep waiting
                            stableCount = 0;
                            last = ''; // force re-read
                            console.log('[QuizAI Bridge] Temporarily processing, still waiting...', cur.slice(0, 60));
                        } else {
                            stableCount++;
                            const needed = cur.length > 300 ? 2 : 3;
                            if (stableCount >= needed) { clearInterval(id); resolve(cur); return; }
                        }
                    } else {
                        stableCount = 0; last = cur;
                        // If Chrome has background-throttled the tab, setInterval drops to 1 min.
                        // Bypass: If the text is already completely valid JSON, resolve instantly!
                        if (cur && cur.includes('"answers"')) {
                            const parsed = parseChatGPTResponse(cur, true);
                            if (parsed && parsed.answers && parsed.answers.length > 0) {
                                clearInterval(id); resolve(cur); return;
                            }
                        }
                    }
                    if (Date.now() - start > maxMs) { clearInterval(id); resolve(last); }
                }, 800);
            });
        }

        // Returns { answers: [...], uploadFileSvg: "<svg>...</svg>" | null }
        function parseChatGPTResponse(text, skipRegexFallback = false) {
            // 1. Brace-balanced JSON extraction
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

            // Try largest candidate first — also extract root-level uploadFileSvg
            for (const candidate of [...candidates].reverse()) {
                try {
                    const p = JSON.parse(candidate);
                    if (Array.isArray(p.answers) && p.answers.length) {
                        return { answers: p.answers, uploadFileSvg: p.uploadFileSvg || null };
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
                    if (Array.isArray(p.answers) && p.answers.length) {
                        return { answers: p.answers, uploadFileSvg: p.uploadFileSvg || null };
                    }
                } catch { /* try next */ }
            }

            if (skipRegexFallback) return { answers: [] };

            // 3. Regex extraction — handles both letter and open-ended answers, plus scoreIndex for peer review
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
                if (customRes.length > 0) return { answers: customRes, uploadFileSvg: null };
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
            if (result.length > 0) return { answers: result, uploadFileSvg: null };
            return { answers: [], uploadFileSvg: null };
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
