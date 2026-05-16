<div align="center">

<h1>Coursera Quiz AI Solver</h1>

<p><strong>AI study assistant for Coursera quizzes, visual questions, and peer-assignment workflows.</strong></p>

<p>Use your existing ChatGPT or Claude web tab to get structured study suggestions on Coursera without creating API keys, managing billing, or setting up a backend.</p>

<br>

<a href="https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest">
  <img alt="Download coursera-quiz-ai-solver.zip" src="https://img.shields.io/badge/Download-coursera--quiz--ai--solver.zip-0056D2?style=for-the-badge">
</a>
<a href="#install-in-2-minutes">
  <img alt="Install guide" src="https://img.shields.io/badge/Install-2_Minutes-111827?style=for-the-badge">
</a>
<a href="#how-it-works">
  <img alt="How it works" src="https://img.shields.io/badge/How_It_Works-Simple_Flow-10A37F?style=for-the-badge">
</a>

<br><br>

<img alt="Chrome extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white">
<img alt="ChatGPT supported" src="https://img.shields.io/badge/ChatGPT-Supported-10A37F?style=flat-square">
<img alt="Claude supported" src="https://img.shields.io/badge/Claude-Supported-6B46C1?style=flat-square">
<img alt="No API key" src="https://img.shields.io/badge/API_Key-Not_Required-111827?style=flat-square">
<img alt="Open source" src="https://img.shields.io/badge/Open_Source-GitHub-24292F?style=flat-square">

</div>

---

<h2 align="center">Start Here</h2>

<table align="center">
<tr>
<th>I want to...</th>
<th>Go here</th>
</tr>
<tr>
<td>Download the extension</td>
<td><a href="https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest">Latest Release</a></td>
</tr>
<tr>
<td>Install it in Chrome</td>
<td><a href="#install-in-2-minutes">Install in 2 Minutes</a></td>
</tr>
<tr>
<td>Understand the tool quickly</td>
<td><a href="#what-you-get">What You Get</a></td>
</tr>
<tr>
<td>See the workflow</td>
<td><a href="#how-it-works">How It Works</a></td>
</tr>
<tr>
<td>Check privacy</td>
<td><a href="#privacy-in-plain-english">Privacy in Plain English</a></td>
</tr>
<tr>
<td>Fix a problem</td>
<td><a href="#troubleshooting">Troubleshooting</a></td>
</tr>
<tr>
<td>Contribute or inspect internals</td>
<td><a href="#developer-notes">Developer Notes</a></td>
</tr>
</table>

---

## What You Get

Coursera Quiz AI Solver is a browser extension that helps learners review Coursera quiz questions with AI. It reads the visible quiz page, prepares the question context, sends it to ChatGPT or Claude, and brings a structured suggestion back to the Coursera page.

| Built for normal users | What it means |
| --- | --- |
| No API key setup | Use ChatGPT or Claude from the website you already log into |
| Clear on-page toolbar | See what the extension is doing at every step |
| Coursera quiz support | Handles common quiz, exam, and assignment-submission pages |
| Visual question support | Tries to include charts, images, canvases, and dataframe screenshots |
| Peer-assignment feature | Peer support is included as a feature, not a separate product |
| Open-source package | Latest release file is always `coursera-quiz-ai-solver.zip` |

> [!IMPORTANT]
> Use this only where AI assistance and browser automation are allowed. Review every suggestion yourself and follow your course or institution rules.

---

## Install in 2 Minutes

<table>
<tr>
<td width="25%"><strong>1. Download</strong><br><br>Get the latest release zip.</td>
<td width="25%"><strong>2. Extract</strong><br><br>Unzip it into a normal folder.</td>
<td width="25%"><strong>3. Load</strong><br><br>Open Chrome extensions and load unpacked.</td>
<td width="25%"><strong>4. Study</strong><br><br>Open Coursera plus ChatGPT or Claude.</td>
</tr>
</table>

### Download the Correct File

```text
coursera-quiz-ai-solver.zip
```

Release page:

```text
https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest
```

### Load It in Chrome

1. Open `chrome://extensions/`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the extracted extension folder.
5. Pin the extension in your browser toolbar.

### Prepare AI Tabs

Open at least one supported AI tab in the same browser profile:

```text
https://chatgpt.com/
https://claude.ai/
```

Best setup: keep both ChatGPT and Claude open so the extension has a fallback path.

---

## How It Feels to Use

| Step | You do | Extension does |
| --- | --- | --- |
| 1 | Open a Coursera quiz | Detects the quiz page |
| 2 | Click the extension | Shows the `Quiz AI` toolbar |
| 3 | Start the workflow | Reads questions and answer choices |
| 4 | Keep ChatGPT or Claude open | Sends a clean prompt to the AI tab |
| 5 | Wait for the response | Parses the AI output into suggestions |
| 6 | Review the result | Shows or applies the suggestion on Coursera |

Simple flow:

```text
Coursera quiz -> Quiz AI toolbar -> ChatGPT or Claude -> AI suggestion -> Review on Coursera
```

---

## Best Features

<table>
<tr>
<td width="50%">

### No API Key Required

No OpenAI API key. No Anthropic API key. No billing setup. The extension uses your already-open ChatGPT or Claude web session.

</td>
<td width="50%">

### ChatGPT + Claude

Use ChatGPT as the main AI path and Claude as a fallback when responses are slow, blocked, or hard to parse.

</td>
</tr>
<tr>
<td width="50%">

### Visual Question Awareness

For supported pages, the extension tries to include image, chart, canvas, SVG, or dataframe context with the prompt.

</td>
<td width="50%">

### Coursera-Aware Workflow

Designed around Coursera quiz, exam, assignment-submission, and peer-review page patterns.

</td>
</tr>
<tr>
<td width="50%">

### Status You Can Follow

The floating toolbar shows plain messages like `Opening ChatGPT`, `Waiting for Claude`, and `Scanning for image-based questions`.

</td>
<td width="50%">

### Open Source

The extension is plain HTML, CSS, JavaScript, and Manifest V3 metadata. You can inspect every file.

</td>
</tr>
</table>

---

## Supported Workflows

| Coursera page type | Support |
| --- | --- |
| Single quiz page | Supported |
| Exam page | Supported |
| Assignment-submission page | Supported |
| Assignments or grades page | Supported for queue discovery |
| Image-based questions | Supported when browser capture allows it |
| Short-answer questions | Supported |
| Multi-select questions | Supported |
| Peer review page | Supported as a feature |

---

## What Makes It Different

| Typical AI workflow | Coursera Quiz AI Solver |
| --- | --- |
| Copy question manually | Reads visible question text from the page |
| Paste into ChatGPT manually | Sends a structured prompt to ChatGPT or Claude |
| Lose track of page state | Keeps workflow state in browser storage |
| Handle image questions manually | Attempts to attach supported visual context |
| Guess what is happening | Shows a live Coursera toolbar status |
| Install a black-box tool | Open-source files you can inspect |

---

## Search-Friendly Summary

Coursera Quiz AI Solver is an open-source Coursera Chrome extension and AI study assistant for Coursera quizzes. It supports ChatGPT, Claude, visual questions, quiz parsing, peer-assignment workflows, and no-API-key browser automation.

People searching for this project often use phrases like:

```text
Coursera Quiz AI Solver
Coursera quiz AI assistant
Coursera Chrome extension
ChatGPT Coursera extension
Claude Coursera extension
Coursera quiz helper no API key
AI study assistant for Coursera
open source Coursera extension
Coursera quiz parser
Chrome extension for Coursera quizzes
```

---

## Responsible Use

This tool is for learning support, accessibility support, self-review, private testing, and browser automation research.

Do not use it to misrepresent your work, submit material you have not reviewed, or violate a course honor code. AI suggestions can be incomplete or wrong. Always review the output yourself.

Safe use checklist:

| Before relying on output | Check |
| --- | --- |
| Did I read the question myself? | Yes |
| Did I review the AI suggestion? | Yes |
| Does my course allow AI assistance? | Confirmed |
| Am I submitting work I understand? | Yes |
| Am I respecting peer-review rules? | Yes |

---

## Privacy in Plain English

This project does not run its own cloud server.

The normal data path is:

```text
Coursera page
-> browser extension storage
-> your ChatGPT or Claude web tab
-> browser extension storage
-> Coursera page
```

| Question | Plain answer |
| --- | --- |
| Does this project require its own account? | No |
| Does it run a backend server? | No |
| Does it send prompts to ChatGPT or Claude? | Yes, through the tab you are signed into |
| Can question images be included? | Yes, when visual capture works |
| Should I check AI provider privacy settings? | Yes |

---

## Troubleshooting

<details>
<summary><strong>The toolbar does not show on Coursera</strong></summary>

Try this:

1. Open `chrome://extensions/`.
2. Make sure Coursera Quiz AI Solver is enabled.
3. Refresh the Coursera tab.
4. Confirm the page is on `coursera.org`.
5. Make sure you loaded the extracted folder, not the zip file.

</details>

<details>
<summary><strong>ChatGPT or Claude did not answer</strong></summary>

Open the AI tab and check for:

```text
login prompts
verification prompts
cookie popups
rate limits
empty chat screen
network errors
```

</details>

<details>
<summary><strong>The answer format looks wrong</strong></summary>

The extension asks for structured JSON, but AI tools can return extra text. The parser tries to recover automatically. If the result is still wrong, retry once or switch providers.

</details>

<details>
<summary><strong>An image question was missed</strong></summary>

Some images cannot be read by the browser because of cross-origin rules, canvas security rules, or how Coursera renders the page. Review those questions manually.

</details>

<details>
<summary><strong>A Coursera button was not clicked</strong></summary>

Coursera changes layouts often. Refresh the page and try again. If it keeps happening, open an issue with the page type, extension version, browser version, and a redacted screenshot.

</details>

---

## FAQ

| Question | Answer |
| --- | --- |
| Is it free? | Yes. The repository is open source and does not require a paid API key. |
| Do I need an OpenAI API key? | No. It uses the ChatGPT website in your browser. |
| Do I need an Anthropic API key? | No. It uses the Claude website in your browser. |
| Does it work on Edge? | It should work on Chromium browsers that support unpacked Manifest V3 extensions. |
| Why keep both ChatGPT and Claude open? | One can act as a fallback when the other is slow or returns a hard-to-parse answer. |
| Does it support peer assignments? | Yes, as a feature inside Coursera Quiz AI Solver. |
| Is it official? | No. It is independent and not affiliated with Coursera, OpenAI, Anthropic, Google, or Chrome. |
| What is the correct zip name? | `coursera-quiz-ai-solver.zip` |

---

## Perfect GitHub Topics

Use these topics on the repository for better discovery:

```text
coursera
coursera-quiz
chrome-extension
manifest-v3
chatgpt
claude-ai
ai-study-assistant
learning-tools
browser-extension
open-source
```

---

## Developer Notes

Most users can stop reading here. The sections below are for maintainers and contributors.

<details>
<summary><strong>Project file map</strong></summary>

```text
.
|-- manifest.json          # Chrome extension manifest, permissions, content scripts
|-- background.js          # Service worker: opens ChatGPT/Claude tabs and capture bridge
|-- content.js             # Coursera toolbar, parser, queue state, quiz and peer workflows
|-- chatgpt_bridge.js      # ChatGPT prompt injection and response parsing
|-- claude_bridge.js       # Claude prompt injection and response parsing
|-- popup.html             # Extension popup UI
|-- popup.css              # Popup styling
|-- popup.js               # Popup button handlers
|-- options.html           # Settings page UI
|-- options.js             # Settings persistence
|-- icons/                 # Extension icons
|-- docs/index.html        # GitHub Pages landing page
|-- test_parser_2.js       # Parser smoke test
```

</details>

<details>
<summary><strong>Internal lifecycle</strong></summary>

```text
1. content.js loads on Coursera.
2. It detects page type from URL and DOM.
3. It injects the Quiz AI toolbar.
4. User starts a single-page or queue workflow.
5. Workflow state is saved in chrome.storage.local.
6. Question blocks are detected and sorted.
7. A strict prompt is created.
8. Visual data is attached when available.
9. background.js opens or focuses the AI tab.
10. chatgpt_bridge.js or claude_bridge.js injects the prompt.
11. The bridge waits for a new, stable response.
12. The response is parsed into answer objects.
13. content.js applies the suggestions with native DOM events.
14. The queue advances or clears.
```

</details>

<details>
<summary><strong>Workflow phases</strong></summary>

State is stored under:

```text
cqsAutoState
```

Common state shape:

```json
{
  "active": true,
  "phase": "quiz",
  "courseSlug": "course-slug",
  "quizUrls": [],
  "currentIndex": 0
}
```

| Phase | Meaning |
| --- | --- |
| `collect` | Scan assignments page for peer review tasks |
| `collect_quizzes` | Scan assignments page for quiz links |
| `quiz` | Process quiz URLs one by one |
| `peer_review_queue` | Process queued peer review pages |
| `peer_review` | Process the current peer review page |

</details>

<details>
<summary><strong>AI answer format</strong></summary>

The bridge asks the AI to return JSON like this:

```json
{
  "answers": [
    { "q": 1, "a": ["A"] },
    { "q": 2, "a": ["B", "D"] },
    { "q": 3, "a": ["short written answer"] }
  ]
}
```

Parser recovery tries brace-balanced JSON extraction, sanitized JSON parsing, regex extraction, and conversational fallback parsing.

</details>

<details>
<summary><strong>Permissions explained</strong></summary>

| Permission | Why it is used |
| --- | --- |
| `activeTab` | Talk to the active Coursera tab from the popup |
| `storage` | Save queue state, tasks, answers, and settings |
| `scripting` | Support Manifest V3 extension interaction patterns |
| `tabs` | Open or focus ChatGPT and Claude |
| `clipboardWrite` | Support prompt and image paste workflows |
| `https://*.coursera.org/*` | Run the Coursera content script |
| `https://chatgpt.com/*` | Run the ChatGPT bridge |
| `https://claude.ai/*` | Run the Claude bridge |
| `<all_urls>` | Used by the current build for broad visual/capture workflows |

</details>

<details>
<summary><strong>Development commands</strong></summary>

Run syntax checks:

```bash
node --check background.js
node --check content.js
node --check chatgpt_bridge.js
node --check claude_bridge.js
node --check popup.js
```

Run the parser smoke test:

```bash
node test_parser_2.js
```

Package the extension:

```bash
git archive --format=zip --output coursera-quiz-ai-solver.zip HEAD manifest.json background.js content.js chatgpt_bridge.js claude_bridge.js popup.html popup.css popup.js options.html options.js icons
```

</details>

---

## Roadmap

| Next improvement | Why it helps |
| --- | --- |
| Review-before-submit mode | Gives users more control |
| First-run setup screen | Makes onboarding easier |
| Demo screenshots and GIFs | Makes the README more visual |
| Provider selector | Lets users choose ChatGPT, Claude, or auto |
| Privacy mode | Allows users to disable visual capture |
| Narrower permissions | Reduces browser permission scope |
| Better settings wiring | Makes options page more useful |

---

## Disclaimer

Coursera Quiz AI Solver is an independent open-source browser extension. It is not affiliated with Coursera, OpenAI, Anthropic, Google, Chrome, or any course provider. AI suggestions can be incomplete or wrong. Always review output yourself and follow your course rules.

---

<div align="center">

<h3>Download the latest version</h3>

<a href="https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest">
  <img alt="Download coursera-quiz-ai-solver.zip" src="https://img.shields.io/badge/Download-coursera--quiz--ai--solver.zip-0056D2?style=for-the-badge">
</a>

</div>

```text
Repository: https://github.com/aburahatsabir/coursera-quiz-ai-solver
Latest release: https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest
Release asset: coursera-quiz-ai-solver.zip
```
