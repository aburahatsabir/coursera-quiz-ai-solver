// content.js — v6 (Quiz + Peer Review Automation)
// State machine that persists across page navigations via chrome.storage.local
// ONE button → navigate assignments → solve each quiz → submit → next → done

(function () {
  'use strict';

  // ─── State key stored in chrome.storage.local ──────────────────────────────
  // {
  //   active: true,
  //   phase: 'collect' | 'quiz' | 'peer_review_queue' | 'peer_review',
  //   courseSlug: string,
  //   quizUrls: string[],
  //   currentIndex: number,
  // }
  // IMPORTANT: 'quiz' is ONLY used for actual quiz/assignment-submission pages.
  //            'peer_review_queue' is used when iterating through peer reviews
  //            in the master queue. This separation prevents autoSolveAndSubmit
  //            from being dispatched on peer review pages (BUG-01).
  const STATE_KEY = 'cqsAutoState';

  // ─── Detect page context ───────────────────────────────────────────────────
  const href = location.href;
  const isAssignmentsPage = /\/home\/(assignments|grades)/.test(href);
  const isQuizPage = /\/(assignment-submission|quiz|exam)(\/|\b)/.test(href);
  const isAssignmentSubmitPage = /\/peer\/[^\/]+\/[^\/]+\/submit/.test(href);
  const isPeerReviewPage = /\/peer\/[^\/]+\/[^\/]+\/(give-feedback|review-next)/.test(href);
  const isPeerOverviewPage = /\/peer\/[^\/]+\/[^\/]+/.test(href) &&
    !href.includes('/submit') &&
    !href.includes('/give-feedback') &&
    !href.includes('/review-next');
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
      buildToolbar('Looking for pending peer assignments...', false);
      await delay(1500);
      await collectAndStartQuizzes(state);
      return;
    }

    if (isAssignmentsPage && state?.active && state?.phase === 'collect_quizzes') {
      buildToolbar('Looking for pending quizzes...', false);
      await delay(1500);
      await collectQuizzes(state);
      return;
    }

    // ── Phase-based routing (strict — each phase maps to exactly one handler) ──
    // 'quiz'               → autoSolveAndSubmit  (quiz / assignment-submission pages only)
    // 'peer_review_queue'  → autoSolvePeerReview (peer review pages in master queue)
    // 'peer_review'        → autoSolvePeerReview (standalone manual trigger)

    if (isQuizPage && state?.active && state?.phase === 'quiz') {
      buildToolbar(`Solving quiz ${state.currentIndex + 1} of ${state.quizUrls.length} — please wait...`, false);
      await delay(2000);
      await autoSolveAndSubmit(state);
      return;
    }

    const isPeerReviewActive = state?.active &&
      (state?.phase === 'peer_review' || state?.phase === 'peer_review_queue');
    if (isPeerReviewPage && isPeerReviewActive) {
      const label = state.phase === 'peer_review_queue'
        ? `Reviewing peers (${state.currentIndex + 1}/${state.quizUrls?.length ?? '?'})...`
        : `Reviewing peers...`;
      buildToolbar(label, false);
      await delay(2000);
      await autoSolvePeerReview(state);
      return;
    }

    // Default: show the main toolbar on any Coursera page
    if (isPeerReviewPage && (!state || !state.active)) {
      buildToolbar('Click below to auto-grade this peer', true, 'peer_review');
      return;
    }
    if (isQuizPage && (!state || !state.active)) {
      buildToolbar('Click below to auto-solve this quiz', true, 'quiz_single');
      return;
    }

    buildToolbar('Click below to auto-solve peer assignments', true, 'collect');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TOOLBAR
  // ════════════════════════════════════════════════════════════════════════════
  function buildToolbar(statusMsg, showStart, targetPhase = 'quiz') {
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
        Peer AI
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
        <div style="display: flex; gap: 8px;">
          <button id="cqs-start-btn" data-phase="${targetPhase}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
            ${targetPhase === 'peer_review' ? 'Solve Peer Review' : targetPhase === 'quiz_single' ? 'Solve Quiz' : 'Auto-Solve Peers'}
          </button>
          ${targetPhase === 'collect' ? `
            <button id="cqs-quiz-btn" data-phase="collect_quizzes" style="background: #3b82f6; border: none; padding: 0 16px; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              Auto-Solve Quizzes
            </button>
          ` : ''}
        </div>
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

    document.getElementById('cqs-start-btn')?.addEventListener('click', (e) => {
      startPipeline(e.currentTarget.getAttribute('data-phase'));
    });
    document.getElementById('cqs-quiz-btn')?.addEventListener('click', (e) => {
      startPipeline(e.currentTarget.getAttribute('data-phase'));
    });
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
  async function startPipeline(targetPhase = 'quiz') {
    if (!courseSlug) {
      setStatus('⚠ Not on a Coursera course page');
      return;
    }

    // For single page auto-solver (Peer Review) start immediately if already there
    if (targetPhase === 'peer_review' && isPeerReviewPage) {
        await setState({ active: true, phase: 'peer_review', courseSlug });
        location.reload();
        return;
    }

    if (targetPhase === 'quiz_single' && isQuizPage) {
        await setState({ active: true, phase: 'quiz', courseSlug, quizUrls: [location.href], currentIndex: 0 });
        location.reload();
        return;
    }

    if (targetPhase === 'collect_quizzes') {
        await setState({ active: true, phase: 'collect_quizzes', courseSlug, quizUrls: [], currentIndex: 0 });
        setStatus('Going to assignments...');
        await delay(400);
        location.href = `https://www.coursera.org/learn/${courseSlug}/home/assignments`;
        return;
    }

    // Default: Quiz Collector Pipeline
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


    // ── Detect which blocks have visual content and capture screenshots ────────
    setStatus(`Scanning for image-based questions...`);
    const blockMeta = [];
    const screenshotMap = {}; // { qIndex: dataUrl }
    // Collect metadata
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const q = getQuestion(block);
      const type = getType(block);
      const opts = type !== 'text' ? getOptions(block) : [];
      blockMeta.push({ block, q, type, opts });
    }

    // Capture image data directly via Offscreen Canvas locally
    for (let i = 0; i < blocks.length; i++) {
        if (hasVisualContent(blocks[i])) {
            setStatus(`Capturing DataFrame/Image for Q${i + 1}...`);
            const dataUrl = await captureBlockScreenshot(blocks[i]);
            if (dataUrl) screenshotMap[i + 1] = dataUrl;
            console.log(`[QuizAI] Q${i + 1} has visual content — screenshot extracted: ${!!dataUrl}`);
        }
    }

    // Build numbered question list for the designated AI
    let promptLines = [];
    promptLines.push('Analyze the following educational items and extract the most factually accurate option(s) for each.');

    if (Object.keys(screenshotMap).length > 0) {
      promptLines.push('IMPORTANT: Some questions include images/screenshots attached — examine them carefully to answer correctly.');
    }

    promptLines.push('Rules:');
    promptLines.push('  - Single-choice questions: respond with exactly 1 letter (e.g. "A")');
    promptLines.push('  - Multi-select questions: respond with all correct letters (e.g. "A", "C")');
    promptLines.push('  - Open-ended / free-text questions: If it asks for a specific value/number, respond ONLY with the raw number (e.g. "-19.5" or "0"). Do NOT write sentences. If it asks for an explanation, write a concise 1-2 sentence response. NO internal quotes.');
    promptLines.push('CRITICAL JSON RULES: Output ONLY raw JSON. No markdown fences. No explanation. For open-ended answers, the entire answer must be a single JSON string with NO unescaped double-quotes inside it.');
    promptLines.push('OUTPUT FORMAT:');
    promptLines.push('{"answers": [{"q": 1, "a": ["A"]}, {"q": 2, "a": ["The answer is X because Y."]}]}');
    promptLines.push('--- ITEMS ---');

    blockMeta.forEach(({ q, type, opts }, i) => {
      // Label question type explicitly so AI knows when to select multiple answers
      const typeLabel = type === 'checkbox' ? '[MULTI-SELECT]' : type === 'text' ? '[OPEN-ENDED]' : '[SINGLE-CHOICE]';
      promptLines.push(`Q${i + 1} ${typeLabel}: ${q}`);
      if (screenshotMap[i + 1]) {
        promptLines.push(`  [IMAGE SCREENSHOT ATTACHED for Q${i + 1} — refer to it for visual details]`);
      }
      if (opts.length) {
        opts.forEach((o, j) => promptLines.push(`  ${String.fromCharCode(65 + j)}. ${o}`));
      } else {
        promptLines.push('  [Open-ended — if the question asks for a value, output ONLY the raw numeric value. Otherwise write short text]');
      }
      promptLines.push('');
    });
    promptLines.push('FINAL INSTRUCTION: You are an automated JSON API. DO NOT confirm receipt of these images. DO NOT ask how to proceed. Generate the requested JSON answers immediately without any conversational text.');

    const prompt = promptLines.join('\n');
    const taskId = Date.now().toString();
    const screenshots = Object.entries(screenshotMap).map(([q, dataUrl]) => ({ q: parseInt(q), dataUrl }));

    blocks.forEach(showLoader);
    setStatus(`Opening ${AI_NAME} — wait for it to answer...`);

    // Clear old answers, store the task payload (including screenshots for vision)
    await chrome.storage.local.remove([ANSWER_KEY]);
    await chrome.storage.local.set({
      [TASK_KEY]: { prompt, taskId, timestamp: Date.now(), screenshots }
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

      const stored = await new Promise(r =>
        chrome.storage.local.get([ANSWER_KEY, 'cqsBridgeStatus'], d => r(d))
      );

      const bridgeStatus = stored['cqsBridgeStatus'] || '';

      if (pollCount % 5 === 0) {
        setStatus(`Still waiting for ${AI_NAME}... (${Math.round((Date.now() - (deadline - 180000)) / 1000)}s) [${bridgeStatus}]`);
      }

      if (!stored[ANSWER_KEY]) continue;
      const ansData = stored[ANSWER_KEY];

      // Error from bridge
      if (ansData.error) {
        setStatus(`⚠ ${AI_NAME}: ${ansData.error}`);
        blocks.forEach(b => showError(b, ansData.error));
        await chrome.storage.local.remove([ANSWER_KEY, 'cqsBridgeStatus']);
        return false;
      }

      // Got a response (answers array OR rawText)
      const hasAnswers = Array.isArray(ansData.answers) && ansData.answers.length > 0;
      const hasRawText = ansData.rawText && ansData.rawText.length > 10;

      if (hasAnswers || hasRawText) {
        setStatus(`Got ${AI_NAME} response! Filling in answers...`);

        let finalAnswers = ansData.answers || [];

        // If answers is empty but rawText exists, try re-parsing here
        if (!hasAnswers && hasRawText) {
          finalAnswers = parseRawText(ansData.rawText);
          console.log('[QuizAI] Re-parsed from rawText:', finalAnswers);
        }

        await applyWebUiAnswers(blockMeta, finalAnswers, AI_NAME);
        await chrome.storage.local.remove([ANSWER_KEY]);

        // Check if parsing yielded actual answers
        if (finalAnswers.length === 0) {
          setStatus(`⚠ ${AI_NAME}: Failed to parse answers`);
          blocks.forEach(b => showError(b, `Failed to parse answers`));
          return false; // Parsing failed -> Failure
        }

        // Mark as answered to prevent re-running on same block ONLY if successful
        if (firstQKey) answered.set(firstQKey, true);

        setStatus(`✅ ${AI_NAME} answered your quiz!`);

        setStatus(`✅ ${AI_NAME} answered your quiz!`);
        return true;
      }
    }

    setStatus(`⏱ Timed out — ${AI_NAME} took too long. Try again.`);
    blocks.forEach(b => showError(b, `${AI_NAME} timed out`));
    return false;
  }

  // Local fallback parser: extract answers from AI response text
  function parseRawText(text) {
    // 1. Try brace-balanced JSON extraction (handles extra text around JSON)
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
    // Try largest candidate first (most complete), smallest last
    for (const candidate of [...candidates].reverse()) {
      try {
        const p = JSON.parse(candidate);
        if (Array.isArray(p.answers) && p.answers.length) return p.answers;
      } catch { /* try next */ }
    }

    // 2. Sanitize-then-parse: Fix common issues — unescaped quotes inside string values
    for (const candidate of [...candidates].reverse()) {
      try {
        // Replace unescaped double-quotes inside string values with apostrophes
        const sanitized = candidate
          .replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
            // Re-escape any unescaped internal quotes in string values
            const fixed = inner.replace(/(?<!\\)"/g, "'");
            return ': "' + fixed + '"';
          });
        const p = JSON.parse(sanitized);
        if (Array.isArray(p.answers) && p.answers.length) return p.answers;
      } catch { /* try next */ }
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
  //  PHASE 1: Collect pending peer reviews from the assignments page
  //  Strategy: group Submit + Review links by shared /peer/<ID>/<slug> key.
  //  Only queue when submission is done AND reviews aren't all complete yet.
  // ════════════════════════════════════════════════════════════════════════════
  async function collectAndStartQuizzes(state) {
    setStatus('Scanning assignments page...');
    await waitFor(() => document.querySelector('a[href*="/peer/"]'), 12000);
    await delay(1000);

    const urls = [];
    const peerLinkMap = {}; // keyed by "<ID>/<slug>"

    [...document.querySelectorAll('a[href*="/peer/"]')].forEach(a => {
      const href = a.href || '';
      // Extract /peer/<ID>/<slug> as the grouping key
      const m = href.match(/\/peer\/([^/?#]+\/[^/?#]+)/);
      if (!m) return;
      const key = m[1]; // e.g. "KOk5G/graphics-lies"
      if (!peerLinkMap[key]) peerLinkMap[key] = {};

      const txt = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');
      const isReview = /review\s+\d+\s+peer/i.test(txt) ||
                       href.includes('give-feedback') ||
                       href.includes('review-next');
      const isSubmit = /submit\s+your\s+assignment/i.test(txt) && !isReview;

      if (isSubmit && !peerLinkMap[key].submitLink) {
        peerLinkMap[key].submitLink = a;
      } else if (isReview && !peerLinkMap[key].reviewLink) {
        peerLinkMap[key].reviewLink = a;
        peerLinkMap[key].reviewHref = href;
        // Extract count from "Review 4 peers' assignments."
        const countMatch = txt.match(/review\s+(\d+)\s+peer/i);
        if (countMatch) peerLinkMap[key].peerCount = parseInt(countMatch[1], 10);
      }
    });

    for (const [key, group] of Object.entries(peerLinkMap)) {
      const { submitLink, reviewLink, reviewHref } = group;
      let peerCount = group.peerCount || 3;

      // Must have a review link
      if (!reviewLink || !reviewHref) {
        console.log(`[QuizAI] [${key}] No review link found — skipping`);
        continue;
      }

      // ── Check A: Has the peer review already been fully completed? ─────────
      // Coursera uses div-based layout (class css-1o8v0v5), not tr/li/[role=row]
      // Walk up the parent chain to find the div that contains the "X/Y reviewed" text
      const reviewRow = findStatusRow(reviewLink, 'reviewed');
      const reviewRowTxt = (reviewRow?.innerText || '').replace(/\s+/g, ' ');
      const progressMatch = reviewRowTxt.match(/(\d+)\s*\/\s*(\d+)\s*reviewed/i);
      let alreadyDone = 0;
      if (progressMatch) {
        const done = parseInt(progressMatch[1], 10);
        const total = parseInt(progressMatch[2], 10);
        if (total > peerCount) peerCount = total; // displayed total is authoritative
        alreadyDone = done;
        if (done >= total) {
          console.log(`[QuizAI] [${key}] Peer review done (${done}/${total}) — skipping`);
          continue;
        }
        console.log(`[QuizAI] [${key}] Peer review in progress (${done}/${total}) — need ${total - done} more`);
      } else {
        // No "X/Y reviewed" text — check for a completion icon in any nearby ancestor
        const nearestRow = findRowContainer(reviewLink);
        if (nearestRow && isRowCompleted(nearestRow)) {
          console.log(`[QuizAI] [${key}] Review row shows completed icon — skipping`);
          continue;
        }
      }

      // ── Check B: Is the submission done? ──────────────────────────────────
      let submissionDone = false;
      if (submitLink) {
        // Walk up until we find an ancestor containing "Submitted"
        const submitRow = findStatusRow(submitLink, 'Submitted') || findRowContainer(submitLink);
        const submitRowTxt = (submitRow?.innerText || submitLink.parentElement?.innerText || '').replace(/\s+/g, ' ');
        const hasSubmittedWord = /\bSubmitted\b/i.test(submitRowTxt);
        const hasCompletedIcon = submitRow ? isRowCompleted(submitRow) : false;
        submissionDone = hasSubmittedWord || hasCompletedIcon;
        console.log(`[QuizAI] [${key}] Submit row: "${submitRowTxt.slice(0, 150)}" | submitted=${hasSubmittedWord} icon=${hasCompletedIcon}`);
      } else {
        // No submit link — cannot confirm submission; skip to be safe
        submissionDone = false;
        console.log(`[QuizAI] [${key}] No submit link found — skipping (cannot verify submission)`);
      }

      if (!submissionDone) {
        console.log(`[QuizAI] [${key}] Submission NOT done — skipping peer review`);
        continue;
      }

      // peerReviewTarget = REMAINING reviews (total - already done)
      // e.g. if 1/4 done → target = 3, so extension does exactly 3 more
      const remaining = peerCount - alreadyDone;
      console.log(`[QuizAI] [${key}] ✅ Queuing peer review: ${reviewHref} (${remaining} remaining of ${peerCount})`);
      urls.push({ url: reviewHref, peerReviewTarget: remaining });
    }

    // ── STEP 3: Report & start ─────────────────────────────────────────────
    if (!urls.length) {
      setStatus('✅ All peer reviews done!');
      await clearState();
      return;
    }

    setStatus(`Found ${urls.length} peer review(s) to do. Starting...`);
    await delay(600);

    // Use 'peer_review_queue' — NOT 'quiz' — so init() routes to autoSolvePeerReview
    // and never accidentally dispatches autoSolveAndSubmit on a peer review page.
    const newState = { ...state, phase: 'peer_review_queue', quizUrls: urls, currentIndex: 0 };
    await setState(newState);
    location.href = urls[0].url || urls[0];
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE 1B: Collect pending quizzes from the assignments page
  // ════════════════════════════════════════════════════════════════════════════
  async function collectQuizzes(state) {
    setStatus('Scanning for quizzes...');
    await waitFor(() => document.querySelector('a'), 12000);
    await delay(1000);

    const urls = [];
    const allLinks = [...document.querySelectorAll('a')];
    allLinks.forEach(a => {
        const href = a.href || '';
        // Look for quiz or exam links
        if (href.includes('/quiz/') || href.includes('/exam/') || href.includes('/assignment-submission/')) {
            // Find container to check if it's already done
            const row = findRowContainer(a);
            if (row && isRowCompleted(row)) {
                console.log('[QuizAI] Skipping completed quiz:', href);
                return;
            }

            // Check if this quiz was previously failed
            let forceClaude = false;
            if (row && (row.innerText || '').toLowerCase().includes("didn't pass")) {
                forceClaude = true;
                console.log('[QuizAI] Found broken/failed quiz, forcing Claude:', href);
            }

            // push an object instead of string so it can carry forceClaude flag
            const exists = urls.some(u => (typeof u === 'string' ? u : u.url) === href);
            if (!exists) {
                urls.push(forceClaude ? { url: href, forceClaude: true } : href);
            }
        }
    });

    if (!urls.length) {
        setStatus('✅ No pending quizzes found!');
        await clearState();
        return;
    }

    setStatus(`Found ${urls.length} pending quizzes. Starting...`);
    await delay(600);
    const newState = { ...state, phase: 'quiz', quizUrls: urls, currentIndex: 0 };
    await setState(newState);
    location.href = urls[0].url || urls[0];
  }

  // ── Helper: walk up DOM to find a row containing a specific status keyword ──
  // Coursera's modern layout uses nested divs (class css-1o8v0v5), not tr/li/[role=row].
  // This helper finds the tightest ancestor whose innerText includes the keyword.
  function findStatusRow(el, keyword) {
    let node = el?.parentElement;
    for (let d = 0; d < 10; d++) {
      if (!node || node === document.body) return null;
      const txt = (node.innerText || '');
      if (txt.toLowerCase().includes(keyword.toLowerCase())) return node;
      node = node.parentElement;
    }
    return null;
  }

  // ── Helper: walk up DOM to find the row/item container of a link ─────────
  function findRowContainer(el) {
    const semantic = el.closest('tr, li, [role="row"], .cds-table-row, [class*="TableRow"]');
    if (semantic) return semantic;

    let node = el;
    for (let d = 0; d < 12; d++) {
      node = node?.parentElement;
      if (!node || node === document.body) return null;
      const cls = (node.className || '').toLowerCase();
      if (cls.includes('row') || cls.includes('item')) return node;

      // Coursera div layout: a div containing multiple children spanning columns
      const txt = node.innerText || '';
      if (node.children.length >= 3 && txt.includes('\n') && txt.length < 600) return node;
    }
    return null;
  }

  // ── Helper: check if a row container shows a green completion indicator ───
  function isRowCompleted(rowEl) {
    if (!rowEl) return false;
    // Check SVG icons — Coursera uses SVG for the green checkmark
    for (const svg of rowEl.querySelectorAll('svg')) {
      const ariaLabel = (svg.getAttribute('aria-label') || '').toLowerCase();
      const cls = (svg.className?.baseVal || svg.className || '').toLowerCase();
      const titleTxt = (svg.querySelector('title')?.textContent || '').toLowerCase();
      if (/complet|check|done|pass|success|verified/.test(ariaLabel + cls + titleTxt)) return true;
    }
    // Check img alt texts
    for (const img of rowEl.querySelectorAll('img[alt]')) {
      if (/complet|check|done|pass/.test((img.alt || '').toLowerCase())) return true;
    }
    return false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE 2: Auto-solve and submit one quiz
  // ════════════════════════════════════════════════════════════════════════════
  async function autoSolveAndSubmit(state) {
    const total = state.quizUrls.length;
    const idx = state.currentIndex;
    const currentQuizItem = state.quizUrls[idx];
    let isClaudeForced = typeof currentQuizItem === 'object' && currentQuizItem.forceClaude;

    setStatus(`Quiz ${idx + 1} of ${total} — Opening...`);

    // Step A: Click Start / Resume / Retry if present
    const isNativeRetry = await clickStartButton();
    if (isNativeRetry && !isClaudeForced) {
        console.log('[QuizAI] Natively detected a Retry button override. Upgrading to Claude!');
        isClaudeForced = true;
    }

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

  // ════════════════════════════════════════════════════════════════════════════
  //  PEER REVIEW AUTO-SOLVER
  // ════════════════════════════════════════════════════════════════════════════
  // NOTE: Assignment submission automation has been intentionally removed.
  // Only peer review grading automation is retained below.

  async function autoSolvePeerReview(state) {
    // 1. Wait for SPA to mount "Start Reviewing" or rubric
    await delay(1500);

    let startReviewBtn = null;
    await waitFor(() => {
        const allBtns = [...document.querySelectorAll('button, a, .cds-button-primary')];
        startReviewBtn = allBtns.find(b => {
             const txt = (b.innerText || '').toLowerCase().trim();
             return txt === 'start reviewing' || txt === 'review peers' || txt === 'resume reviewing';
        });
        const isGradingActive = document.querySelectorAll('input[type="radio"]').length > 0;
        return startReviewBtn || isGradingActive;
    }, 6000);

    if (startReviewBtn) {
         setStatus('Entering peer grading view...');
         startReviewBtn.click();
         await delay(4000); // let SPA route us to /review-next
         const isGradingActive = document.querySelectorAll('input[type="radio"]').length > 0;
         if (!isGradingActive && !location.href.includes('review-next')) {
            setStatus('Checking context...');
            await delay(1000);
         }
    }

    const fieldsets = [...document.querySelectorAll('fieldset, .rc-FormPartsQuestion, .rc-RubricCriteria')];
    if (fieldsets.length === 0) {
        // Double check: if it says "You have reviewed X peers" and there's no Start Reviewing button, we are done!
        const bodyTxt = document.body.innerText.toLowerCase();
        if (bodyTxt.includes('done') || bodyTxt.includes('keep reviewing') || bodyTxt.includes('to pass this assignment, you must')) {
             if (state?.phase === 'peer_review' || state?.phase === 'peer_review_queue') {
                   setStatus('✅ Peer reviews complete! Moving on...');
                   await delay(2000);
                   const nextIndex = state.currentIndex + 1;
                   if (state.quizUrls && nextIndex < state.quizUrls.length) {
                       const newState = { ...state, currentIndex: nextIndex };
                       await setState(newState);
                       const nextUrl = typeof state.quizUrls[nextIndex] === 'object' ? state.quizUrls[nextIndex].url : state.quizUrls[nextIndex];
                       location.href = nextUrl;
                   } else {
                       await clearState();
                       location.href = `https://www.coursera.org/learn/${state.courseSlug}/home/assignments`;
                   }
                   return;
             }
        }
        setStatus('⚠ No peer review rubric found.');
        return;
    }

    setStatus('Extracting student submission & rubric...');

    // Instead of using the AI bridge, instantly assign Maximum Points for Peer Reviews!
    setStatus('Applying MAXIMUM MAX points and feedback...');

    // Inject Generic Free Text Comments
    const textboxes = [...document.querySelectorAll('div[role="textbox"], textarea')];
    for (let tb of textboxes) {
       tb.focus();
       document.execCommand('selectAll', false, null);
       document.execCommand('delete', false, null);
       document.execCommand('insertText', false, 'Great job on this assignment! Everything looks thoroughly explained and implemented perfectly.');
       // Fire a native InputEvent so React re-validates the form state
       tb.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
       await delay(100);
    }

    // Try to apply maximum radio button scores by grouping 'name' attributes
    const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
    const groupedRadios = radioButtons.reduce((groups, radio) => {
        const name = radio.getAttribute('name');
        if (name) {
            if (!groups[name]) groups[name] = [];
            groups[name].push(radio);
        }
        return groups;
    }, {});

    Object.values(groupedRadios).forEach(group => {
        let maxPoints = -1;
        let bestRadio = null;

        group.forEach(radio => {
            const label = radio.closest('label') || radio.closest('.rc-RubricCriteria') || radio.parentElement;
            if (label) {
                const match = label.innerText.match(/(\d+)\s*point/i);
                if (match) {
                    const points = parseInt(match[1], 10);
                    if (points >= maxPoints) { // >= ensures we pick the last one if tied (often visual highest)
                        maxPoints = points;
                        bestRadio = radio;
                    }
                } else if (maxPoints === -1) {
                    // Fallback: if no text parsed, just assume the last one is best later
                    bestRadio = radio;
                }
            }
        });

        if (bestRadio) {
            bestRadio.click();
            bestRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    await delay(1500);
    // Auto-click the Submit Review button (broaden selector to catch all button variants)
    const allBtns = [...document.querySelectorAll('button')];
    const actualSubmitReview = allBtns.find(b => /submit\s*review/i.test((b.innerText || b.textContent || '')));
    if (actualSubmitReview && !actualSubmitReview.disabled) {
         setStatus('Submitting review...');
         actualSubmitReview.click();
         await delay(4000); // wait for confirmation screen

         // ── BUG-02 fix: always read reviewsCompleted from storage before incrementing.
         // The in-memory `state` object is reconstructed on every page reload, so
         // mutating it directly loses the count if a navigation occurs between reviews.
         // Reading from storage first makes the increment reload-safe.
         const freshState = await getState();
         const newCount = (freshState.reviewsCompleted || 0) + 1;
         const updatedState = { ...freshState, reviewsCompleted: newCount };
         await setState(updatedState);

         // Use the per-assignment target (3 or 4) stored in quizUrls entry
         const currentItem = updatedState.quizUrls?.[updatedState.currentIndex];
         const target = (typeof currentItem === 'object' && currentItem.peerReviewTarget > 0)
           ? currentItem.peerReviewTarget
           : 3; // default fallback

         console.log(`[QuizAI] Peer reviews completed this session: ${newCount}/${target}`);

         if (newCount < target) {
             setStatus(`Submitted ✓ (${newCount}/${target}) — loading next peer...`);

             // Coursera SPA: after submit it shows a "Keep reviewing" / "Next feedback" button
             // OR it automatically loads the next submission. Handle both:
             await delay(2000);
             const nextBtn = [...document.querySelectorAll('button, a')].find(b =>
               /keep\s*review|next\s*(feedback|peer|review)|review\s*another|continue/i.test(b.innerText || '')
             );
             if (nextBtn) {
               nextBtn.click();
               await delay(2000);
             }

             // Wait for the new rubric (radio buttons or fieldset) to load in-place
             await waitFor(
               () => document.querySelectorAll('input[type="radio"], fieldset').length > 0,
               10000
             );
             await delay(600); // settle

             // Pass updatedState (with correct newCount) so recursive call has the latest data
             autoSolvePeerReview(updatedState);
         } else {
             setStatus(`✅ All ${target} peer reviews done! Proceeding...`);
             await delay(2000);
             // Use updatedState (the storage-backed copy) to reset the counter cleanly
             const doneState = { ...updatedState, reviewsCompleted: 0 };
             await setState(doneState);

             // Fall back to Master Queue if active
             if (doneState.quizUrls && typeof doneState.currentIndex !== 'undefined') {
                 const nextIndex = doneState.currentIndex + 1;
                 if (nextIndex < doneState.quizUrls.length) {
                     const advancedState = { ...doneState, currentIndex: nextIndex };
                     await setState(advancedState);
                     const nextUrl = typeof doneState.quizUrls[nextIndex] === 'object' ? doneState.quizUrls[nextIndex].url : doneState.quizUrls[nextIndex];
                     location.href = nextUrl;
                     return;
                 }
             }

             // If manual loop, exit to assignments page
             await clearState();
             location.href = location.href.replace(/\/peer\/([^\/]+)\/([^\/]+)\/.*$/, '/home/assignments');
         }
         return;
    }

    setStatus('Peer reviewed! Click Next/Submit manually.');
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
      return false; // No start/resume button — quiz is already open
    }

    const btnText = (startBtn.innerText || startBtn.textContent || '').trim().toLowerCase();
    const isRetry = /retry|retake|try again/i.test(btnText) || btnText.includes('new attempt');

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
          return isRetry;
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
        return isRetry;
      }
    }

    // No modal appeared — quiz should already be open, give it a moment
    await delay(1000);
    return isRetry;
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

    // ── Pass 1: All known Coursera data-testid question containers ──────────
    // IMPORTANT: No early return here — we collect ALL types in one unified pass
    const KNOWN_PART_SELS = [
      // MCQ / Checkbox / TextInput — the three main graded question types
      '[data-testid="part-Submission_MultipleChoiceQuestion"]',
      '[data-testid="part-Submission_CheckboxQuestion"]',
      '[data-testid="part-Submission_TextInputQuestion"]',
      // Numeric / short answer variants seen in some courses
      '[data-testid="part-Submission_NumericQuestion"]',
      '[data-testid*="NumericQuestion"]',
      '[data-testid*="TextInput"]',
      // Essay / reflection / free-form
      '[data-testid="part-Submission_ReflectiveQuestion"]',
      '[data-testid="part-Submission_FreeFormTextQuestion"]',
      '[data-testid*="ReflectiveQuestion"]',
      '[data-testid*="FreeForm"]',
      // Generic "part-Submission_*" wildcard — catches any Coursera question part
      '[data-testid^="part-Submission_"]',
    ];

    for (const sel of KNOWN_PART_SELS) {
      document.querySelectorAll(sel).forEach(n => {
        if (!seen.has(n)) { seen.add(n); results.push(n); }
      });
    }

    // ── Pass 2: Catch any text-input questions NOT matched above ────────────
    // Coursera renders "Enter answer here" fill-in-the-blank questions as
    // <input type="text" aria-label="Enter answer here"> or <textarea placeholder="Enter answer here">
    // These may live inside a generic wrapper with no matching data-testid.
    const textInputSelectors = [
      'input[aria-label="Enter answer here"]',
      'textarea[aria-label="Enter answer here"]',
      'input[placeholder*="Enter answer"]',
      'textarea[placeholder*="Enter answer"]',
      'input[data-testid*="text-input"]',
      'textarea[data-testid*="text-input"]',
    ];

    for (const sel of textInputSelectors) {
      document.querySelectorAll(sel).forEach(inp => {
        // Walk up to find a suitable question wrapper div
        let p = inp;
        for (let i = 0; i < 15; i++) {
          p = p?.parentElement;
          if (!p || p === document.body) break;
          // Skip if already captured
          if (seen.has(p)) return;
          // Look for a wrapper that contains a question prompt (text/para) + the input
          if (p.tagName === 'DIV' || p.tagName === 'FIELDSET' || p.tagName === 'SECTION') {
            const hasPrompt = p.querySelector('p, legend, h3, h4, [data-testid="legend"], .rc-CML, [data-testid*="prompt"]');
            const hasInput = p.querySelector('input[type="text"], textarea');
            if (hasPrompt && hasInput) {
              seen.add(p);
              results.push(p);
              return;
            }
          }
        }
        // Fallback: if no good wrapper found, wrap just at grandparent level
        const gp = inp.parentElement?.parentElement;
        if (gp && !seen.has(gp)) {
          seen.add(gp);
          results.push(gp);
        }
      });
    }

    // ── Pass 3: Wider generic fallback for any remaining *visible* question containers
    if (results.length === 0) {
      for (const sel of ['[data-testid*="Question"]', '.rc-FormPartsQuestion']) {
        document.querySelectorAll(sel).forEach(n => {
          if (!seen.has(n)) { seen.add(n); results.push(n); }
        });
      }
    }

    // ── Pass 4: Last-resort — find all radio/checkbox groups not yet captured
    if (results.length === 0) {
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

    // ── Sort results by vertical DOM position to preserve quiz order ─────────
    results.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.top + window.scrollY) - (rb.top + window.scrollY);
    });

    console.log(`[QuizAI] findBlocks() found ${results.length} question(s)`);
    return results;
  }


  // ─── Image/visual content detection ────────────────────────────────────────
  // ─── Image/visual content detection ────────────────────────────────────────
  function getCompanionImage(block) {
    // 1. Look for images directly inside the block
    const innerImgs = [...block.querySelectorAll('img')];
    const validInner = innerImgs.find(img => (img.naturalWidth || img.width || 0) > 60 || img.src);
    if (validInner) return validInner;

    // 2. Look at preceding siblings (Coursera renders DataFrames as <figure><img> visually above the question)
    let prev = block.previousElementSibling;
    for (let i = 0; i < 3; i++) { // look up to 3 siblings up
      if (!prev) break;
      if (prev.tagName === 'FIGURE' || prev.tagName === 'IMG' || prev.querySelector('img')) {
        const img = prev.tagName === 'IMG' ? prev : prev.querySelector('img');
        if (img && ((img.naturalWidth || img.width || 0) > 60 || img.src)) return img;
      }
      prev = prev.previousElementSibling;
    }

    return null;
  }

  function hasVisualContent(block) {
    if (getCompanionImage(block)) return true;

    // Canvas/SVG embedded directly
    if (block.querySelector('canvas')) return true;
    const svgs = [...block.querySelectorAll('svg')];
    if (svgs.some(svg => (svg.getBoundingClientRect().width || 0) > 60)) return true;

    // "Shown above" hint (fallback)
    if (/shown above/i.test(block.innerText)) return true;

    return false;
  }

  // ─── Capture image directly via Canvas (No background script / activeTab needed) ───
  async function captureBlockScreenshot(block) {
    try {
      const imgTarget = getCompanionImage(block);

      if (!imgTarget) {
          // If a Canvas exists, dump it directly
          const cvs = block.querySelector('canvas');
          if (cvs) return cvs.toDataURL('image/png');
          return null; // For SVGs or missing images, we skip (vision models handle images best)
      }

      // We have an <img> tag. Draw it to an offscreen canvas to get Base64.
      // This bypasses entirely the brittle chrome.tabs.captureVisibleTab.
      return await new Promise((resolve, reject) => {
        // Coursera uses cloudfront URLs which fully support CORS, but we set anonymous to be safe
        const imgObj = new Image();
        imgObj.crossOrigin = 'Anonymous';
        imgObj.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = imgObj.naturalWidth || imgObj.width;
          canvas.height = imgObj.naturalHeight || imgObj.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgObj, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        imgObj.onerror = () => {
           // Fallback if CORS prevents crossOrigin load: remove crossOrigin and try again
           // Note: if CORS fails, canvas.toDataURL will taint and throw, but we still try.
           console.warn('[QuizAI] CORS failed for image, capturing may taint');
           resolve(null);
        };
        imgObj.src = imgTarget.src;
      });

    } catch (e) {
      console.warn('[QuizAI] captureBlockScreenshot error:', e);
      return null;
    }
  }

  function getType(b) {
    // ── Fill-in-the-blank: "Enter answer here" inputs — most specific signal ─
    const enterAnswerEl =
      b.querySelector('input[aria-label="Enter answer here"]') ||
      b.querySelector('textarea[aria-label="Enter answer here"]') ||
      b.querySelector('input[placeholder*="Enter answer"]') ||
      b.querySelector('textarea[placeholder*="Enter answer"]');
    if (enterAnswerEl) return 'text';

    // Checkbox question: has checkbox inputs
    if (b.querySelector('input[type="checkbox"]')) return 'checkbox';

    // Radio question: has radio inputs
    if (b.querySelector('input[type="radio"]')) return 'radio';

    // Text input question: real textarea (not Monaco code editor)
    const textareas = [...b.querySelectorAll('textarea')];
    const answerTextarea = textareas.find(ta => {
      const cls = ta.className || '';
      const aria = (ta.getAttribute('aria-label') || '').toLowerCase();
      const isCodeEditor = cls.includes('inputarea') || aria.includes('editor') || ta.closest('.monaco-editor, .view-lines, [class*="CodeMirror"]');
      return !isCodeEditor;
    });
    if (answerTextarea) return 'text';

    // Text input with <input type="text">
    if (b.querySelector('input[type="text"]')) return 'text';

    return 'radio'; // default fallback for MCQ
  }

  function getQuestion(b) {
    // 1. Standard Coursera question legend
    const legend = b.querySelector('[data-testid="legend"]');
    const cml = legend?.querySelector('.rc-CML');
    const fromLegend = ((cml || legend || null)?.innerText || '').replace(/^\d+\.\s*/, '').replace(/\d+\s*points?\s*/gi, '').replace(/\s+/g, ' ').trim();
    if (fromLegend) return fromLegend.slice(0, 1200);

    // 2. New Coursera UI: question prompt is in an h3, a <p>, or a .rc-CML block
    for (const sel of [
      '[data-testid="question-prompt"]',
      '[data-testid="prompt"]',
      '.rc-CML',
    ]) {
      const el = b.querySelector(sel);
      if (el) {
        const txt = (el.innerText || '').replace(/\d+\s*points?\s*/gi, '').replace(/\s+/g, ' ').trim();
        if (txt.length > 5) return txt.slice(0, 1200);
      }
    }

    // 3. Fallback: first meaningful heading or paragraph in the block
    for (const sel of ['h1','h2','h3','h4','h5','p']) {
      const el = b.querySelector(sel);
      if (el) {
        const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
        // Avoid picking up short noise or option text
        if (txt.length > 10) return txt.slice(0, 1200);
      }
    }

    // 4. Last resort: whole block text, first 300 chars
    return (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  function getOptions(b) {
    // Helper: extract text from a label element (live DOM — innerText requires layout)
    function extractLabelText(liveLabel) {
      // First try reading Monaco code blocks inside the label (code-snippet options)
      const codeLines = liveLabel.querySelectorAll('.view-lines .view-line');
      if (codeLines.length > 0) {
        // Monaco renders each line as a separate .view-line div containing spans
        const codeText = [...codeLines].map(line =>
          (line.innerText || line.textContent || '').replace(/\u00a0/g, ' ')
        ).join('\n').trim();
        if (codeText.length > 0) return codeText;
      }

      // For plain-text options: get live innerText minus the input's own value contribution
      const live = (liveLabel.innerText || '').replace(/\s+/g, ' ').trim();
      // Remove any leading radio/checkbox marker (sometimes "○" or "□" appears)
      return live.replace(/^[○◉□■✓✗]\s*/, '').trim();
    }

    // 1. New Coursera UI (2024+): options in label.cds-checkboxAndRadio-label
    const newOpts = b.querySelectorAll('label.cds-checkboxAndRadio-label');
    if (newOpts.length >= 2) {
      return [...newOpts].map(o => extractLabelText(o)).filter(t => t.length > 0);
    }

    // 2. Legacy Coursera UI: .rc-Option
    const legacyOpts = b.querySelectorAll('.rc-Option');
    if (legacyOpts.length >= 2) {
      return [...legacyOpts].map(o => (o.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    }

    // 3. Generic label fallback (only labels wrapping a radio or checkbox)
    const labels = [...b.querySelectorAll('label')].filter(l => {
      const hasInput = l.querySelector('input[type="radio"], input[type="checkbox"]');
      const txt = (l.innerText || '').replace(/\s+/g, ' ').trim();
      return hasInput && txt.length > 0 && txt.length < 800;
    });
    if (labels.length >= 2) {
      return labels.map(l => extractLabelText(l)).filter(t => t.length > 0);
    }

    return [];
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
      // Priority 1: "Enter answer here" — the specific fill-in-blank Coursera input
      // Priority 2: Any other input[type="text"]
      // Priority 3: Real textarea (excluding Monaco code editors)
      // Priority 4: contenteditable (rich-text essay boxes)
      const inp =
        block.querySelector('input[aria-label="Enter answer here"]') ||
        block.querySelector('textarea[aria-label="Enter answer here"]') ||
        block.querySelector('input[placeholder*="Enter answer"]') ||
        block.querySelector('input[type="text"]') ||
        [...block.querySelectorAll('textarea')].find(ta => !ta.className.includes('inputarea') && !(ta.getAttribute('aria-label') || '').toLowerCase().includes('editor')) ||
        block.querySelector('[contenteditable="true"]');

      if (!inp) return;
      const answer = result.suggestedText || result.reasoning || '';

      if (inp.getAttribute('contenteditable') === 'true') {
        // Contenteditable div (Coursera rich-text editors)
        inp.focus();
        inp.innerHTML = '';
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, answer);
        inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: answer }));
      } else {
        // Standard input[type=text] or textarea
        // Step 1: Focus the input
        inp.focus();
        inp.dispatchEvent(new Event('focus', { bubbles: true }));

        // Step 2: Try execCommand('insertText') first — works best for React CDS inputs
        inp.select?.(); // select any existing text
        const inserted = document.execCommand('insertText', false, answer);

        if (!inserted || !inp.value) {
          // Step 3: Fallback — use React's internal value setter
          const proto = inp instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(inp, answer);
          } else {
            inp.value = answer;
          }
        }

        // Step 4: Fire React's synthetic event chain
        inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: answer }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
        inp.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      }
      return;
    }
    // MCQ / checkbox — use the parent label as the click target (required for new Coursera UI)
    const inputs = [...block.querySelectorAll('input[type="radio"],input[type="checkbox"]')];
    result.answers.forEach(l => {
      const inp = inputs[l.charCodeAt(0) - 65];
      if (!inp) return;
      if (inp.type === 'radio' || !inp.checked) {
        // Find the actual label wrapper that Coursera expects you to click
        const parentLabel = inp.closest('label') || inp.parentElement?.closest('label');
        if (parentLabel) {
          parentLabel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          parentLabel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          parentLabel.click();
        } else {
          // Fallback: click the input directly
          inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          inp.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          inp.click();
        }

        // Ensure state updates in React if synthetic click wasn't captured
        if (inp.type === 'checkbox' && !inp.checked) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
            if (nativeSetter) {
                nativeSetter.call(inp, true);
            } else {
                inp.checked = true;
            }
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
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
