// content.js — v6 (Fully Automated One-Click Pipeline)
// State machine that persists across page navigations via chrome.storage.local
// ONE button → navigate assignments → solve each quiz → submit → next → done

(function () {
  'use strict';

  // ─── State key stored in chrome.storage.local ──────────────────────────────
  // {
  //   active: true,
  //   phase: 'collect' | 'quiz',
  //   courseSlug: string,
  //   quizUrls: string[],
  //   currentIndex: number,
  // }
  const STATE_KEY = 'cqsAutoState';

  // ─── Detect page context ───────────────────────────────────────────────────
  const href = location.href;
  const isAssignmentsPage = /\/home\/(assignments|grades)/.test(href);
  const isQuizPage = /\/(assignment-submission|quiz|exam)(\/|\b)/.test(href);
  const courseSlugMatch = href.match(/coursera\.org\/learn\/([^/?#]+)/);
  const courseSlug = courseSlugMatch?.[1] || '';

  // ─── Answered cache ────────────────────────────────────────────────────────
  const answered = new Map();

  // ════════════════════════════════════════════════════════════════════════════
  //  INIT — decide what to do based on page + state
  // ════════════════════════════════════════════════════════════════════════════
  async function init() {
    injectStyles();

    const state = await getState();

    if (isAssignmentsPage && state?.active && state?.phase === 'collect') {
      buildToolbar('Looking for your incomplete quizzes...', false);
      await delay(1500);
      await collectAndStartQuizzes(state);
      return;
    }

    if (isQuizPage && state?.active && state?.phase === 'quiz') {
      buildToolbar(`Solving quiz ${state.currentIndex + 1} of ${state.quizUrls.length} — please wait...`, false);
      await delay(2000);
      await autoSolveAndSubmit(state);
      return;
    }

    // Default: show the main toolbar on any Coursera page
    buildToolbar('Click below to solve all your quizzes automatically', true);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TOOLBAR
  // ════════════════════════════════════════════════════════════════════════════
  function buildToolbar(statusMsg, showStart) {
    if (document.getElementById('cqs-toolbar')) return;
    const t = document.createElement('div');
    t.id = 'cqs-toolbar';

    const logoHtml = `
      <div class="cqs-hub-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        Quiz AI
      </div>
    `;

    const statusHtml = `
      <div id="cqs-status-wrap">
        <span class="cqs-label">What's happening</span>
        <span id="cqs-status">${statusMsg}</span>
      </div>
    `;

    if (showStart) {
      t.innerHTML = `
        ${logoHtml}
        <button id="cqs-start-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
          Solve All My Quizzes
        </button>
      `;
    } else {
      t.innerHTML = `
        ${logoHtml}
        ${statusHtml}
        <button id="cqs-stop-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>
          Stop
        </button>
      `;
    }

    document.body.appendChild(t);

    document.getElementById('cqs-start-btn')?.addEventListener('click', startPipeline);
    document.getElementById('cqs-stop-btn')?.addEventListener('click', stopPipeline);
  }

  function setStatus(txt) {
    const el = document.getElementById('cqs-status');
    if (el) {
      el.textContent = txt;
      // Brief glow effect on update
      el.style.color = '#818cf8';
      setTimeout(() => { if (el) el.style.color = ''; }, 600);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PIPELINE ENTRY POINT
  // ════════════════════════════════════════════════════════════════════════════
  async function startPipeline() {
    if (!courseSlug) {
      setStatus('⚠ Not on a Coursera course page');
      return;
    }
    // Save state and navigate to assignments page
    await setState({
      active: true,
      phase: 'collect',
      courseSlug,
      quizUrls: [],
      currentIndex: 0,
    });
    setStatus('Going to assignments...');
    await delay(400);
    location.href = `https://www.coursera.org/learn/${courseSlug}/home/assignments`;
  }

  async function stopPipeline() {
    await clearState();
    setStatus('Stopped');
    const btn = document.getElementById('cqs-stop-btn');
    if (btn) {
      btn.textContent = '🔄 Reload to start';
      btn.onclick = () => location.reload();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  WEB UI SOLVER (ChatGPT / Claude)
  // ════════════════════════════════════════════════════════════════════════════
  async function solveWithWebUI(forceAiChoice = null) {
    // Default to ChatGPT, but allow fallback to Claude
    const aiChoice = forceAiChoice || 'chatgpt';

    const isChatGPT = aiChoice === 'chatgpt';
    const TASK_KEY = isChatGPT ? 'cqsChatGptTask' : 'cqsClaudeTask';
    const ANSWER_KEY = isChatGPT ? 'cqsChatGptAnswers' : 'cqsClaudeAnswers';
    const AI_NAME = isChatGPT ? 'ChatGPT' : 'Claude';
    const OPEN_MSG = isChatGPT ? 'OPEN_CHATGPT_TAB' : 'OPEN_CLAUDE_TAB';

    // Wait for questions
    await waitFor(() => findBlocks().length > 0, 10000);
    const blocks = findBlocks();
    if (!blocks.length) { setStatus('⚠ No questions found on this page'); return; }

    // Check if we already answered these newly found questions
    // (A primitive check to prevent infinite loops if something fails)
    const firstQKey = getQuestion(blocks[0])?.slice(0, 50);
    if (firstQKey && answered.has(firstQKey)) {
      setStatus(`✅ Already answered this quiz`);
      return;
    }

    // Build numbered question list for the designated AI
    let promptLines = [];
    promptLines.push('Analyze the following educational items and extract the most factually accurate option(s) for each.');
    promptLines.push('Rules: Single-choice = 1 letter. Multi-select = all correct letters. Open-ended = write a short 3-sentence summary.');
    promptLines.push('CRITICAL: For open-ended answers, escape any internal quotes (e.g. \\") so the JSON remains valid.');
    promptLines.push('OUTPUT FORMAT (Raw JSON only, no markdown, no explanation, just this structure):');
    promptLines.push('{"answers": [{"q": <question_number>, "a": ["<letter_1>", "<letter_2>"]}]}');
    promptLines.push('--- ITEMS ---');

    const blockMeta = []; // store block metadata for later answer injection
    blocks.forEach((block, i) => {
      const q = getQuestion(block);
      const type = getType(block);
      const opts = type !== 'text' ? getOptions(block) : [];
      blockMeta.push({ block, q, type, opts });

      promptLines.push(`Q${i + 1}: ${q}`);
      if (opts.length) {
        opts.forEach((o, j) => promptLines.push(`  ${String.fromCharCode(65 + j)}. ${o}`));
      } else {
        promptLines.push('  [Open-ended — write a short answer]');
      }
      promptLines.push('');
    });

    const prompt = promptLines.join('\n');
    const taskId = Date.now().toString();

    blocks.forEach(showLoader);
    setStatus(`Opening ${AI_NAME} — wait for it to answer...`);

    // Clear old answers, store the task payload
    await chrome.storage.local.remove([ANSWER_KEY]);
    await chrome.storage.local.set({
      [TASK_KEY]: { prompt, taskId, timestamp: Date.now() }
    });

    // Ask background to open the tab
    chrome.runtime.sendMessage({ type: OPEN_MSG });

    // Poll for answers (up to 3 minutes)
    setStatus(`Waiting for ${AI_NAME} to answer...`);
    const deadline = Date.now() + 180000;
    let answeredQuiz = false;
    let pollCount = 0;

    while (Date.now() < deadline) {
      await delay(2000);
      pollCount++;
      if (pollCount % 5 === 0) setStatus(`Still waiting for ${AI_NAME}... (${Math.round((Date.now() - (deadline - 180000)) / 1000)}s)`);

      const stored = await new Promise(r =>
        chrome.storage.local.get([ANSWER_KEY], d => r(d[ANSWER_KEY]))
      );

      if (!stored) continue;

      // Error from bridge
      if (stored.error) {
        setStatus(`⚠ ${AI_NAME}: ${stored.error}`);
        blocks.forEach(b => showError(b, stored.error));
        await chrome.storage.local.remove([ANSWER_KEY]);
        return false;
      }

      // Got a response (answers array OR rawText)
      const hasAnswers = Array.isArray(stored.answers) && stored.answers.length > 0;
      const hasRawText = stored.rawText && stored.rawText.length > 10;

      if (hasAnswers || hasRawText) {
        setStatus(`Got ${AI_NAME} response! Filling in answers...`);

        let finalAnswers = stored.answers || [];

        // If answers is empty but rawText exists, try re-parsing here
        if (!hasAnswers && hasRawText) {
          finalAnswers = parseRawText(stored.rawText);
          console.log('[QuizAI] Re-parsed from rawText:', finalAnswers);
        }

        await applyWebUiAnswers(blockMeta, finalAnswers, AI_NAME);
        await chrome.storage.local.remove([ANSWER_KEY]);

        // Mark as answered to prevent re-running on same block
        if (firstQKey) answered.set(firstQKey, true);

        // Check if parsing yielded actual answers
        if (finalAnswers.length === 0) {
          setStatus(`⚠ ${AI_NAME}: Failed to parse answers`);
          blocks.forEach(b => showError(b, `Failed to parse answers`));
          return false; // Parsing failed -> Failure
        }

        setStatus(`✅ ${AI_NAME} answered your quiz!`);
        return true;
      }
    }

    setStatus(`⏱ Timed out — ${AI_NAME} took too long. Try again.`);
    blocks.forEach(b => showError(b, `${AI_NAME} timed out`));
    return false;
  }

  // Local fallback parser: extract "Q1: A" / "1. B, C" style answers or nested JSON
  function parseRawText(text) {
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

  async function applyWebUiAnswers(blockMeta, aiAnswers, aiName) {
    const answerMap = {};
    for (const item of aiAnswers) {
      answerMap[item.q] = item.a || [];
    }

    for (let i = 0; i < blockMeta.length; i++) {
      const { block, q, type, opts } = blockMeta[i];
      const qNum = i + 1;
      const letters = answerMap[qNum] || [];
      if (!letters.length) { showError(block, `${aiName} did not answer this question`); continue; }

      if (type === 'text') {
        const result = { answers: [], reasoning: letters[0] || '', suggestedText: letters[0] || '', confidence: 88 };
        showAnswer(block, result, [], 'text', aiName);
      } else {
        const validLetters = letters.map(l => String(l).toUpperCase()).filter(l => /^[A-H]$/.test(l));
        const result = { answers: validLetters.length ? validLetters : ['A'], reasoning: `Via ${aiName}`, confidence: 92 };
        showAnswer(block, result, opts, type, aiName);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE 1: Collect unfinished assignment URLs from grades page
  // ════════════════════════════════════════════════════════════════════════════
  async function collectAndStartQuizzes(state) {
    setStatus('Scanning grades table...');

    // Wait for assignment rows to render (specific selector, not generic [role=row])
    await waitFor(
      () => document.querySelector('[data-e2e="ungrouped-non-peer-assignment-row"], .rc-AssignmentsTableRowCds'),
      10000
    );
    await delay(500); // extra settle time

    // Use ONLY the specific row selectors — NOT [role="row"] which catches header/banner rows
    const rows = document.querySelectorAll(
      '[data-e2e="ungrouped-non-peer-assignment-row"], .rc-AssignmentsTableRowCds'
    );

    console.log('[QuizAI] Found rows:', rows.length);

    const urls = [];
    rows.forEach((row, i) => {
      const statusEl = row.querySelector('.status-column, [class*="status-column"]');
      const statusTxt = (statusEl?.innerText || '').trim().toLowerCase();
      const rowTxt = (row.innerText || '').toLowerCase();

      // Explicitly INCLUDE rows with "in progress" — these are unfinished, with Resume button
      const isInProgress = statusTxt.includes('in progress') || rowTxt.includes('in progress');

      // Skip ONLY if clearly passed/completed (grade ≥ 1%)
      const isPassed = statusTxt.includes('passed') || rowTxt.includes('passed');

      // A grade number that shows actual completion — skip 0% (still in progress), include 1%+
      const gradeMatch = statusTxt.match(/(\d+)%/);
      const gradeValue = gradeMatch ? parseInt(gradeMatch[1]) : -1;
      const isActuallyGraded = gradeValue >= 1; // 0% = not submitted yet
      const isFailed = statusTxt.includes("didn't pass") || rowTxt.includes("didn't pass") || statusTxt.includes("failed");

      console.log(`[QuizAI] Row ${i}: status="${statusTxt}" inProgress=${isInProgress} passed=${isPassed} grade=${gradeValue} failed=${isFailed}`);

      // If it's failed, we DO NOT skip it.
      if (!isInProgress && !isFailed && (isPassed || isActuallyGraded)) return; // already done

      const link = row.querySelector(
        'a[href*="assignment-submission"], a[href*="/quiz/"], a[href*="/exam/"]'
      );
      if (link?.href) {
        console.log(`[QuizAI] Adding URL:`, link.href, `ForceClaude:`, isFailed);
        urls.push({ url: link.href, forceClaude: isFailed });
      }
    });

    // NOTE: Ignore the Coursera banner "You have completed all assessments currently due"
    // That banner shows even when future assignments are pending — check rows only.

    if (!urls.length) {
      setStatus('✅ All graded assignments done!');
      await clearState();
      return;
    }

    setStatus(`Found ${urls.length} to do. Starting...`);
    await delay(600);

    const newState = { ...state, phase: 'quiz', quizUrls: urls, currentIndex: 0 };
    await setState(newState);
    location.href = urls[0].url || urls[0];
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE 2: Auto-solve and submit one quiz
  // ════════════════════════════════════════════════════════════════════════════
  async function autoSolveAndSubmit(state) {
    const total = state.quizUrls.length;
    const idx = state.currentIndex;
    const currentQuizItem = state.quizUrls[idx];
    const isClaudeForced = typeof currentQuizItem === 'object' && currentQuizItem.forceClaude;

    setStatus(`Quiz ${idx + 1} of ${total} — Opening...`);

    // Step A: Click Start / Resume / Retry if present
    await clickStartButton();

    // Step B: Wait for question blocks to actually appear in DOM
    setStatus(`Quiz ${idx + 1} of ${total} — Loading questions...`);
    await waitFor(() => findBlocks().length > 0, 12000);
    await delay(800); // extra settle for React re-renders

    // Step C: Solve all questions (Using Web UI logic now)
    setStatus(`Quiz ${idx + 1} of ${total} — Answering...`);
    let success = false;

    if (isClaudeForced) {
      setStatus(`Quiz ${idx + 1} of ${total} — Retrying failed quiz with Claude...`);
      success = await solveWithWebUI('claude');
    } else {
      success = await solveWithWebUI();
      // Automatic Fallback to Claude if ChatGPT fails or times out
      if (!success) {
        setStatus(`⚠ Failed with preferred AI. Falling back to Claude...`);
        await delay(2000);
        success = await solveWithWebUI('claude');
      }
    }

    // Step D: Check honor code checkbox
    setStatus(`Quiz ${idx + 1} of ${total} — Checking honor pledge...`);
    await checkHonorCode();
    await delay(600);

    // Step E: Submit
    setStatus(`Quiz ${idx + 1} of ${total} — Submitting...`);
    const submitted = await submitQuiz();

    if (submitted) {
      setStatus(`Quiz ${idx + 1} of ${total} — Done ✅`);
    } else {
      setStatus(`Quiz ${idx + 1} of ${total} — Submit button not found ⚠`);
    }
    await delay(2500);

    // Step F: Move to next quiz or finish
    const nextIndex = idx + 1;
    if (nextIndex < total) {
      const newState = { ...state, currentIndex: nextIndex };
      await setState(newState);
      const nextUrl = typeof state.quizUrls[nextIndex] === 'object' ? state.quizUrls[nextIndex].url : state.quizUrls[nextIndex];
      location.href = nextUrl;
    } else {
      await clearState();
      setStatus(`✅ All ${total} quizzes completed!`);
      await delay(2000);
      location.href = `https://www.coursera.org/learn/${state.courseSlug}/home/assignments`;
    }
  }

  // ─── Click Start / Resume / Retry button on quiz page ────────────────────
  async function clickStartButton() {
    await delay(2000); // wait for SPA to mount

    const primaryTargets = [
      'start', 'resume', 'begin', 'retry', 'retake', 'try again',
      'start quiz', 'resume quiz', 'start exam', 'resume exam',
      'start assignment', 'resume assignment',
      'start new attempt', 'new attempt', 'open quiz', 'open exam',
    ];

    let startBtn = null;

    // Poll for up to 8 seconds (SPA pages load slowly)
    const deadline = Date.now() + 8000;
    const targetRegex = /\b(start|resume|begin|retry|retake|try again)\b.*?\b(quiz|exam|assignment|new attempt)?\b/i;

    // Try testid selectors first
    const testIds = [
      '[data-testid="action-button"]',        // newly discovered graded assignment button
      '[data-testid="CoverPageActionButton"]',// newly discovered practice assignment button
      '[data-testid="start-exam-button"]',
      '[data-testid="resume-exam-button"]',
      '[data-testid="retry-exam-button"]',
      '[data-testid="retake-exam-button"]',
      '[data-testid="start-assignment-button"]',
      '[data-testid="resume-assignment-button"]',
      'button[aria-label*="start" i]',
      'button[aria-label*="resume" i]',
      'button[aria-label*="retry" i]',
    ];

    while (Date.now() < deadline) {

      // Strategy 1: Explicit React ARIA hooks
      for (const sel of testIds) {
        startBtn = document.querySelector(sel);
        if (startBtn) break;
      }
      if (startBtn) break;

      // Strategy 2: Look for the text inside Coursera's specific button label spans
      const labelSpans = document.querySelectorAll('.cds-button-label');
      for (const span of labelSpans) {
        const txt = (span.innerText || span.textContent || '').trim();
        if (targetRegex.test(txt)) {
          startBtn = span.closest('button, [role="button"], a');
          if (startBtn) break;
        }
      }
      if (startBtn) break;

      // Strategy 3: Look at the buttons directly
      if (!startBtn) {
        startBtn = [...document.querySelectorAll('button, [role="button"], a[role="button"]')]
          .find(b => targetRegex.test((b.innerText || b.textContent || '').trim()));
      }

      if (startBtn) break;
      await delay(500);
    }

    if (!startBtn) {
      console.log('[QuizAI] Start/Resume button not found. Assuming quiz is open.');
      return; // No start/resume button — quiz is already open
    }

    // Dispatch a full suite of events to ensure React registers the click
    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach(et => {
      startBtn.dispatchEvent(new MouseEvent(et, { bubbles: true, cancelable: true, view: window }));
    });

    // Also try standard click as fallback
    startBtn.click();
    await delay(1500);

    // ── Handle post-click confirmation modals ─────────────────────────────
    // Coursera shows various modals after clicking Start/Retry:
    //  • "Start a new attempt?" → [Start new attempt] [Cancel]
    //  • "Starting a new attempt" → [Continue] [Cancel]
    //  • Generic confirm → [OK] [Cancel]
    const confirmTargets = [
      'start new attempt', 'continue', 'ok', 'confirm', 'proceed',
      'yes', 'accept', 'begin', 'start attempt',
    ];

    // Poll for up to 4 seconds for a modal to appear
    const modalDeadline = Date.now() + 4000;
    while (Date.now() < modalDeadline) {
      await delay(400);
      // Check for any modal backdrop / dialog
      const dialogScope = document.querySelector(
        '[role="dialog"], .cds-modal-backdrop, .cds-modal-container, [class*="modal"]'
      );
      if (dialogScope) {
        const confirmBtn = [...dialogScope.querySelectorAll('button, [role="button"]')]
          .find(b => confirmTargets.includes((b.innerText?.trim() || '').toLowerCase()));
        if (confirmBtn) {
          confirmBtn.click();
          await delay(2500); // wait for quiz to fully load after confirming
          return;
        }
      }
      // Also check page-level buttons that appeared after the click
      const pageConfirm = [...document.querySelectorAll('button, [role="button"]')]
        .find(b => {
          const txt = (b.innerText?.trim() || '').toLowerCase();
          return confirmTargets.includes(txt) && txt !== 'start'; // don't re-click start
        });
      if (pageConfirm) {
        pageConfirm.click();
        await delay(2000);
        return;
      }
    }

    // No modal appeared — quiz should already be open, give it a moment
    await delay(1000);
  }

  // ─── Check honor code checkbox ─────────────────────────────────────────────
  async function checkHonorCode() {
    window.scrollTo(0, document.body.scrollHeight);
    await delay(800);

    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const box of allCheckboxes) {
      if (box.checked) continue;

      // Get all text near the checkbox (parent label, next sibling, wrapper div)
      const labelText = (box.closest('label')?.innerText || '').toLowerCase();
      const parentText = (box.parentElement?.innerText || '').toLowerCase();
      const nextSiblingText = (box.nextElementSibling?.innerText || '').toLowerCase();
      const combinedText = ` ${labelText} ${parentText} ${nextSiblingText} `;

      const isHonorCode = combinedText.includes('honor') ||
        combinedText.includes('understand that submitting work') ||
        combinedText.includes('submitting work that isn\'t my own') ||
        combinedText.includes('certify') ||
        combinedText.includes('agree');

      if (isHonorCode) {
        // Coursera uses React, so we must dispatch a robust sequence of events
        box.checked = true;
        const events = ['mousedown', 'mouseup', 'click', 'input', 'change'];
        events.forEach(et => {
          box.dispatchEvent(new MouseEvent(et, { bubbles: true, cancelable: true, view: window }));
        });

        // Also try clicking exactly on the label if it exists, as React often binds onClick there
        const label = box.closest('label');
        if (label) label.click();

        console.log('[QuizAI] Honor code checked successfully.');
        break; // Only check one
      }
    }
  }

  // ─── Submit the quiz ────────────────────────────────────────────────────────
  async function submitQuiz() {
    window.scrollTo(0, document.body.scrollHeight);
    await delay(1000); // Give the page a moment to react to the scroll

    // ── Step 1: find and click the page's bottom Submit button ──
    const submitTexts = ['submit', 'submit quiz', 'submit exam', 'submit assignment'];
    const findSubmit = () => document.querySelector('[data-testid="submit-button"]') ||
      [...document.querySelectorAll('button, a[role="button"], div[role="button"]')].find(b =>
        submitTexts.includes((b.innerText?.trim() || '').toLowerCase())
      );

    let pageSubmit = findSubmit();

    if (!pageSubmit) {
      // One more scroll and retry if not found
      window.scrollTo(0, document.body.scrollHeight);
      await delay(1000);
      pageSubmit = findSubmit();
    }

    if (!pageSubmit) return false;

    // Wait for the button to become officially enabled by React (it briefly disables after checking honor code)
    let isEnabled = false;
    for (let i = 0; i < 15; i++) { // Poll for up to 3 seconds
      if (pageSubmit.getAttribute('aria-disabled') !== 'true' && !pageSubmit.disabled) {
        isEnabled = true;
        break;
      }
      await delay(200);
    }

    if (!isEnabled) {
      console.warn('[QuizAI] Submit button remained disabled.');
      return false;
    }

    // Click multiple times to ensure the click registers through React interceptors
    await delay(300); // final breathing room
    pageSubmit.click();
    await delay(300);
    pageSubmit.click();
    await delay(1000);

    // ── Step 2: Poll up to 5 s for the "Ready to submit?" modal ──
    const modalSubmitBtn = await waitForModalSubmit(5000);
    if (modalSubmitBtn) {
      modalSubmitBtn.click();
      await delay(300);
      modalSubmitBtn.click(); // Double tap modal submit too
      await delay(2500);
    }

    return true;
  }

  // Find the Submit button inside the "Ready to submit?" confirmation modal.
  // Live DOM confirmed structure:
  //   .cds-modal-backdrop > .cds-modal-container > [div with H2 "Ready to submit?"] + [buttons]
  // Strategy: find H2 with that text, go up 2 levels to cds-modal-container, get buttons there.
  async function waitForModalSubmit(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await delay(350);

      // Method 1: find modal heading — "Ready to submit?" OR "Missing or invalid answers"
      const headings = document.querySelectorAll('h1,h2,h3,h4');
      for (const h of headings) {
        const txt = (h.innerText || '').trim().toLowerCase();
        const isSubmitModal = txt.startsWith('ready to submit') || txt.includes('missing or invalid');
        const submitTexts = ['submit', 'submit quiz', 'submit exam', 'submit assignment'];
        if (isSubmitModal) {
          // Walk up to find the Submit button inside the modal container
          for (const ancestor of [h.parentElement?.parentElement, h.parentElement?.parentElement?.parentElement]) {
            if (!ancestor) continue;
            const btn = [...ancestor.querySelectorAll('button, a[role="button"], div[role="button"]')]
              .find(b => submitTexts.includes((b.innerText?.trim() || '').toLowerCase()));
            if (btn) { console.log('[QuizAI] Modal submit found via heading ancestor'); return btn; }
          }
        }
      }

      // Method 2: any visible modal container with a Submit button
      const submitTexts = ['submit', 'submit quiz', 'submit exam', 'submit assignment'];
      for (const sel of ['.cds-modal-container', '[class*="modal-container"]', '.cds-modal-backdrop', '[class*="modal-backdrop"]']) {
        const container = document.querySelector(sel);
        if (container) {
          const btn = [...container.querySelectorAll('button, a[role="button"], div[role="button"]')]
            .find(b => submitTexts.includes((b.innerText?.trim() || '').toLowerCase()));
          if (btn) { console.log('[QuizAI] Modal submit found via', sel); return btn; }
        }
      }
    }
    console.log('[QuizAI] Modal submit NOT found after', maxMs, 'ms');
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  QUIZ DOM PARSERS
  // ════════════════════════════════════════════════════════════════════════════
  function findBlocks() {
    const seen = new Set(), results = [];

    // Tier 1 — standard MCQ / checkbox / text-input
    for (const sel of [
      '[data-testid="part-Submission_MultipleChoiceQuestion"]',
      '[data-testid="part-Submission_CheckboxQuestion"]',
      '[data-testid="part-Submission_TextInputQuestion"]',
      // Coursera reflection / open-ended essay questions
      '[data-testid="part-Submission_ReflectiveQuestion"]',
      '[data-testid="part-Submission_FreeFormTextQuestion"]',
      '[data-testid*="ReflectiveQuestion"]',
      '[data-testid*="FreeForm"]',
    ]) {
      document.querySelectorAll(sel).forEach(n => { if (!seen.has(n)) { seen.add(n); results.push(n); } });
    }
    if (results.length) return results;

    // Tier 2 — generic question containers
    for (const sel of ['[data-testid*="Question"]', '.rc-FormPartsQuestion']) {
      document.querySelectorAll(sel).forEach(n => { if (!seen.has(n)) { seen.add(n); results.push(n); } });
    }
    if (results.length) return results;

    // Tier 3 — fallback: find standalone textareas NOT inside an already-detected block
    document.querySelectorAll('textarea').forEach(ta => {
      let p = ta;
      for (let i = 0; i < 12; i++) {
        p = p?.parentElement; if (!p) break;
        // If the textarea lives inside a block we already found, skip it
        if (seen.has(p)) return;
        // Use the closest div that looks like a question wrapper
        if (p.tagName === 'DIV' && (p.querySelector('p, label, h3, h4, legend') || p.getAttribute('data-testid'))) {
          if (!seen.has(p)) { seen.add(p); results.push(p); }
          return;
        }
      }
    });

    // Tier 4 — radio/checkbox fallback
    if (!results.length) {
      document.querySelectorAll('input[type="radio"],input[type="checkbox"]').forEach(inp => {
        let p = inp;
        for (let i = 0; i < 10; i++) {
          p = p?.parentElement; if (!p) break;
          if (p.querySelectorAll('input[type="radio"],input[type="checkbox"]').length >= 2) {
            if (!seen.has(p)) { seen.add(p); results.push(p); } break;
          }
        }
      });
    }
    return results;
  }

  function getType(b) {
    if (b.querySelector('input[type="checkbox"]')) return 'checkbox';
    if (b.querySelector('input[type="text"],textarea')) return 'text';
    return 'radio';
  }

  function getQuestion(b) {
    // Standard Coursera question legend
    const legend = b.querySelector('[data-testid="legend"]');
    const cml = legend?.querySelector('.rc-CML');
    const fromLegend = ((cml || legend || null)?.innerText || '').replace(/^\d+\.\s*/, '').replace(/\d+\s*points?\s*/gi, '').replace(/\s+/g, ' ').trim();
    if (fromLegend) return fromLegend.slice(0, 1200);

    // Fallback for reflection / textarea blocks — grab any readable question text
    const fallback = b.querySelector('h1,h2,h3,h4,h5,p,label');
    const fromFallback = (fallback?.innerText || '').replace(/\s+/g, ' ').trim();
    return fromFallback.slice(0, 1200);
  }

  function getOptions(b) {
    const opts = b.querySelectorAll('.rc-Option');
    if (opts.length >= 2) return [...opts].map(o => (o.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return [...b.querySelectorAll('label')].map(l => (l.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 0 && t.length < 500);
  }

  function clearBadge(b) {
    b.querySelectorAll('[data-cqs]').forEach(e => e.remove());
    b.querySelectorAll('.cqs-glow,.cqs-glow-multi').forEach(e => e.classList.remove('cqs-glow', 'cqs-glow-multi'));
  }

  function showLoader(b) {
    clearBadge(b);
    const d = document.createElement('div');
    d.className = 'cqs-loading'; d.setAttribute('data-cqs', '1');
    d.innerHTML = '<div class="cqs-spinner"></div><span>AI solving...</span>';
    b.prepend(d);
  }

  function showError(b, msg) {
    clearBadge(b);
    const d = document.createElement('div');
    d.className = 'cqs-error'; d.setAttribute('data-cqs', '1');
    d.textContent = '⚠ ' + msg;
    b.prepend(d);
  }

  function showAnswer(block, result, options, type, aiName) {
    clearBadge(block);
    autoSelect(block, result, type);

    // Highlight selected option rows
    if (type !== 'text') {
      const cls = result.answers.length > 1 ? 'cqs-glow-multi' : 'cqs-glow';
      const targets = block.querySelectorAll('.rc-Option').length
        ? block.querySelectorAll('.rc-Option')
        : block.querySelectorAll('label');
      [...targets].forEach((el, i) => {
        if (result.answers.includes(String.fromCharCode(65 + i))) el.classList.add(cls);
      });
    }

    const confColor = result.confidence >= 85 ? '#34d399' : result.confidence >= 65 ? '#fbbf24' : '#fc8181';
    const confLabel = result.confidence >= 85 ? 'High' : result.confidence >= 65 ? 'Medium' : 'Low';

    const badge = document.createElement('div');
    badge.className = 'cqs-new-badge';
    badge.setAttribute('data-cqs', '1');

    if (type === 'text') {
      // Essay / reflection — show preview of typed answer
      const preview = (result.suggestedText || result.reasoning || '').slice(0, 220);
      badge.innerHTML = `
        <div class="cqs-badge-header">
          <div class="cqs-badge-ai-icon">🤖</div>
          <div class="cqs-badge-ai-name">${aiName.toUpperCase()} — TYPED ANSWER</div>
          <div class="cqs-badge-spacer"></div>
          <div class="cqs-badge-conf-pill" style="color:${confColor};border-color:${confColor}22">
            <div class="cqs-dot" style="background:${confColor}"></div>${result.confidence}% ${confLabel}
          </div>
        </div>
        <div class="cqs-suggested-wrap">
          <span class="cqs-suggested-label">ANSWER TYPED INTO BOX</span>
          <div class="cqs-suggested-text">${preview}${preview.length === 220 ? '…' : ''}</div>
        </div>`;
    } else {
      // MCQ / checkbox
      const pills = result.answers.map(l => {
        const idx = l.charCodeAt(0) - 65;
        return `<div class="cqs-badge-pill"><b>${l}.</b> ${options[idx] || ''}</div>`;
      }).join('');
      const reasoning = result.reasoning
        ? `<div class="cqs-badge-logic"><span>AI REASONING &nbsp;</span>${result.reasoning}</div>` : '';
      badge.innerHTML = `
        <div class="cqs-badge-header">
          <div class="cqs-badge-ai-icon">🤖</div>
          <div class="cqs-badge-ai-name">${aiName.toUpperCase()} — ${result.answers.length > 1 ? 'SELECT ALL MARKED' : 'BEST ANSWER'}</div>
          <div class="cqs-badge-spacer"></div>
          <div class="cqs-badge-conf-pill" style="color:${confColor};border-color:${confColor}22">
            <div class="cqs-dot" style="background:${confColor}"></div>${result.confidence}% ${confLabel}
          </div>
        </div>
        <div class="cqs-badge-options">${pills}</div>
        ${reasoning}`;
    }

    block.prepend(badge);
  }

  function autoSelect(block, result, type) {
    if (type === 'text') {
      const inp = block.querySelector('input[type="text"],textarea');
      if (!inp) return;
      const answer = result.suggestedText || result.reasoning || '';
      const proto = inp instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(inp, answer); else inp.value = answer;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const inputs = [...block.querySelectorAll('input[type="radio"],input[type="checkbox"]')];
    result.answers.forEach(l => {
      const inp = inputs[l.charCodeAt(0) - 65];
      if (!inp) return;
      if (inp.type === 'radio' || !inp.checked) {
        inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        inp.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        inp.click();
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  STYLES (Ultra-Premium Redesign)
  // ════════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('cqs-styles')) return;
    const s = document.createElement('style');
    s.id = 'cqs-styles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      /* In-Page Toolbar (Command Hub) */
      #cqs-toolbar {
        position: fixed; bottom: 32px; right: 32px; z-index: 2147483647;
        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px);
        border: 1px solid #e5e7eb; border-radius: 16px;
        padding: 12px 20px; display: flex; align-items: center; gap: 16px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 13.5px; color: #111827;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0,0,0,0.04);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        letter-spacing: -0.01em;
      }
      #cqs-toolbar:hover { transform: translateY(-2px); border-color: rgba(124, 58, 237, 0.3); }
      
      #cqs-toolbar .cqs-hub-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #111827; }
      #cqs-toolbar .cqs-hub-logo svg { filter: drop-shadow(0 0 6px rgba(124, 58, 237, 0.2)); color: #7c3aed; }

      #cqs-status-wrap { display: flex; flex-direction: column; min-width: 140px; }
      #cqs-status-wrap .cqs-label { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }
      
      #cqs-toolbar button {
        border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 18px;
        font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit;
        transition: all 0.2s ease; white-space: nowrap; display: flex; align-items: center; gap: 8px;
        color: #374151; background: #fff;
      }
      #cqs-start-btn { 
        background: #7c3aed !important; color: #ffffff !important; border: none !important;
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25); 
      }
      #cqs-start-btn:hover { 
        background: #6d28d9 !important;
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35); transform: translateY(-1px);
      }
      #cqs-start-btn svg { color: #ffffff !important; opacity: 0.9; }
      
      #cqs-stop-btn { background: transparent !important; color: #ef4444!important; border-color: rgba(239, 68, 68, 0.2)!important; }
      #cqs-stop-btn:hover { background: rgba(239, 68, 68, 0.05) !important; border-color: rgba(239, 68, 68, 0.4)!important; }

      /* AI Answer Badge (Modern Card) */
      .cqs-new-badge {
        background: #fff; border: 1px solid #e5e7eb; 
        border-radius: 16px; padding: 16px; margin: 12px 0;
        font-family: 'Inter', sans-serif; color: #111827;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
        animation: cqs-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes cqs-slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      .cqs-badge-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
      .cqs-badge-ai-icon { width: 30px; height: 30px; background: rgba(124, 58, 237, 0.08); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #7c3aed; }
      .cqs-badge-ai-name { font-size: 12px; font-weight: 700; color: #4b5563; letter-spacing: 0.02em; }
      .cqs-badge-spacer { flex: 1; }
      .cqs-badge-conf-pill { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; padding: 4px 10px; border: 1px solid; border-radius: 20px; }
      .cqs-dot { width: 6px; height: 6px; border-radius: 50%; }

      .cqs-badge-options { display: flex; flex-direction: column; gap: 8px; }
      .cqs-badge-pill { 
        background: #f9fafb; border: 1px solid #e5e7eb;
        border-radius: 10px; padding: 12px 14px; font-size: 14.5px; color: #111827; line-height: 1.4;
      }
      .cqs-badge-pill b { color: #7c3aed; font-size: 15px; }

      .cqs-suggested-wrap { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
      .cqs-suggested-label { display: block; font-size: 10px; font-weight: 700; color: #10b981; margin-bottom: 4px; }
      .cqs-suggested-text { font-size: 14.5px; color: #065f46; font-weight: 500; }

      .cqs-badge-logic { font-size: 13px; color: #4b5563; margin-top: 14px; padding-top: 14px; border-top: 1px solid #e5e7eb; line-height: 1.6; }
      .cqs-badge-logic span { color: #6b7280; font-weight: 700; font-size: 11px; }

      /* Loader & Error */
      .cqs-loading { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; gap: 12px; color: #4b5563; font-size: 14px; font-weight: 500; margin: 12px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      .cqs-spinner { width: 18px; height: 18px; border: 2.5px solid rgba(124, 58, 237, 0.2); border-top-color: #7c3aed; border-radius: 50%; animation: cqs-spin 0.8s linear infinite; }
      @keyframes cqs-spin { to { transform: rotate(360deg); } }

      /* Choice Highlighting (Elite Glow) */
      .cqs-glow { 
        position: relative; overflow: visible!important; box-shadow: 0 0 0 2px #7c3aed, 0 8px 24px rgba(124, 58, 237, 0.25)!important; 
        border-color: #7c3aed!important; background: rgba(124, 58, 237, 0.05)!important; border-radius: 8px!important; 
      }
      .cqs-glow-multi { 
        position: relative; overflow: visible!important; box-shadow: 0 0 0 2px #10b981, 0 8px 24px rgba(16, 185, 129, 0.25)!important; 
        border-color: #10b981!important; background: rgba(16, 185, 129, 0.05)!important; border-radius: 8px!important; 
      }
    `;
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  STATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════
  function getState() {
    return new Promise(resolve => chrome.storage.local.get([STATE_KEY], d => resolve(d[STATE_KEY] || null)));
  }
  function setState(val) {
    return new Promise(resolve => chrome.storage.local.set({ [STATE_KEY]: val }, resolve));
  }
  function clearState() {
    return new Promise(resolve => chrome.storage.local.remove([STATE_KEY], resolve));
  }

  // ─── Wait for element ──────────────────────────────────────────────────────
  function waitFor(fn, maxMs = 8000) {
    return new Promise(resolve => {
      const result = fn(); if (result) { resolve(result); return; }
      const start = Date.now();
      const id = setInterval(() => {
        const r = fn();
        if (r || Date.now() - start > maxMs) { clearInterval(id); resolve(r); }
      }, 300);
    });
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ════════════════════════════════════════════════════════════════════════════
  //  MESSAGE LISTENER (for popup buttons)
  // ════════════════════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type === 'TRIGGER_START') {
      startPipeline();
      sendResponse({ ok: true });
    }

    if (msg.type === 'TRIGGER_SOLVE_ALL') {
      // "Answer This Quiz Only" — click Start/Resume, wait for questions, solve, then submit
      (async () => {
        setStatus('Opening quiz...');
        await clickStartButton();

        setStatus('Waiting for questions...');
        await waitFor(() => findBlocks().length > 0, 12000);
        await delay(600);

        setStatus('Answering questions...');
        let success = await solveWithWebUI();

        // Automatic Fallback to Claude if ChatGPT fails or times out
        if (!success) {
          setStatus(`⚠ Failed with preferred AI. Falling back to Claude...`);
          await delay(2000);
          success = await solveWithWebUI('claude');
        }

        setStatus('Checking honor pledge...');
        await checkHonorCode();
        await delay(600);

        setStatus('Submitting...');
        const submitted = await submitQuiz();
        setStatus(submitted ? '✅ Submitted!' : '⚠ Submit button not found — check manually');
      })();
      sendResponse({ ok: true });
    }

    if (msg.type === 'TOGGLE_ENABLED') {
      // handled silently
    }
    return true;
  });

  // ─── Run ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
  } else {
    setTimeout(init, 1200);
  }

})();
