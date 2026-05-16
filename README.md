# Coursera Quiz AI Solver

<p align="center">
  <a href="https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest">
    <img alt="Download latest release" src="https://img.shields.io/github/v/release/aburahatsabir/coursera-quiz-ai-solver?style=for-the-badge&label=Download">
  </a>
  <img alt="Chrome extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white">
  <img alt="No API key required" src="https://img.shields.io/badge/No_API_Key-Required-111827?style=for-the-badge">
  <img alt="ChatGPT and Claude" src="https://img.shields.io/badge/ChatGPT_+_Claude-Supported-10A37F?style=for-the-badge">
</p>

<p align="center">
  <strong>A simple Chrome extension that turns ChatGPT or Claude into a Coursera quiz study assistant.</strong>
</p>

<p align="center">
  Read questions, review answer choices, use AI suggestions, handle visual questions, and support quiz plus peer-assignment workflows without setting up an API key.
</p>

<p align="center">
  <a href="https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest"><strong>Download Latest Version</strong></a>
  |
  <a href="#install-in-2-minutes"><strong>Install Guide</strong></a>
  |
  <a href="#how-it-works"><strong>How It Works</strong></a>
  |
  <a href="#faq"><strong>FAQ</strong></a>
</p>

---

## The Short Version

Coursera Quiz AI Solver is an open-source Chrome extension for learners who want a faster way to study Coursera quizzes with AI. It reads the visible quiz page, prepares a clean prompt, sends it to your open ChatGPT or Claude tab, and brings structured suggestions back into Coursera.

It is built for:

| You want to... | The extension helps by... |
| --- | --- |
| Study Coursera quiz questions faster | collecting question text and answer options automatically |
| Use AI without an API key | routing through your existing ChatGPT or Claude web tab |
| Review image-based questions | attaching supported visual question images to the AI prompt |
| Work through repeatable practice flows | keeping track of queue progress across page changes |
| Understand what the tool is doing | showing an on-page status toolbar |
| Use peer-assignment support | treating peer review as a feature, not a separate product |

> Important: Use this only where AI assistance and automation are allowed. Always review suggestions yourself and follow your course rules.

---

## Download

The correct release file is:

```text
coursera-quiz-ai-solver.zip
```

Get it here:

```text
https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest
```

Avoid older peer-branded package names. Peer assignment support is only a feature inside Coursera Quiz AI Solver, and the current release asset is `coursera-quiz-ai-solver.zip`.

---

## Install in 2 Minutes

### Step 1: Download

Open the latest release page and download:

```text
coursera-quiz-ai-solver.zip
```

Extract the zip file to a normal folder.

### Step 2: Open Chrome Extensions

In Chrome, Edge, Brave, or another Chromium browser, open:

```text
chrome://extensions/
```

### Step 3: Turn On Developer Mode

Use the `Developer mode` switch in the top-right corner.

### Step 4: Load the Extension

Click `Load unpacked`, then select the extracted folder.

### Step 5: Sign In to an AI Tab

Open at least one of these in the same browser profile:

```text
https://chatgpt.com/
https://claude.ai/
```

For best results, keep both tabs signed in and open.

---

## How to Use

### Use It on One Quiz

1. Open a Coursera quiz, exam, or assignment-submission page.
2. Click the extension icon.
3. Click the current-page solve action.
4. Wait while the extension reads the questions and sends them to ChatGPT or Claude.
5. Review the returned suggestions before relying on them.

### Use It From the Assignments Page

1. Open your Coursera course.
2. Go to the assignments or grades page.
3. Use the floating `Quiz AI` toolbar.
4. Choose quiz or peer-assignment workflow.
5. Watch the status message so you know what is happening.

### Use It With Visual Questions

If a question includes a chart, image, dataframe screenshot, or canvas, the extension tries to attach the visual context to the AI prompt. This works best when the image can be safely read by the browser.

---

## How It Works

Here is the simple version:

```text
Coursera question -> Extension toolbar -> ChatGPT or Claude -> AI suggestion -> Coursera page
```

More clearly:

1. The extension notices that you are on a Coursera quiz or assignment page.
2. It reads the visible question text and answer choices.
3. If a question includes an image, it tries to include that image too.
4. It opens or focuses ChatGPT or Claude.
5. It asks the AI for a structured answer.
6. It waits for the AI response.
7. It parses the answer into a clean format.
8. It shows or applies the suggestion on the Coursera page.

No OpenAI API key, Anthropic API key, Gemini API key, or backend server is required.

---

## Best Features

### No API Key Setup

Most AI tools ask you to create API keys, manage billing, or paste secrets into settings. This extension uses your already-open ChatGPT or Claude web session instead.

### ChatGPT and Claude Support

ChatGPT is used as the main AI bridge. Claude can be used as a fallback when the first response fails, times out, or is hard to parse.

### Works With More Than Basic Multiple Choice

The extension is designed for common Coursera formats:

```text
single-choice questions
multi-select questions
short-answer questions
numeric questions
free-text questions
quiz pages
exam pages
assignment-submission pages
peer review pages
```

### Image and Chart Awareness

For supported visual questions, the extension looks for images, canvas elements, SVGs, and nearby figures. When possible, it attaches visual context to the AI request.

### On-Page Status Toolbar

The floating toolbar tells you what is happening:

```text
Looking for pending quizzes
Scanning for image-based questions
Opening ChatGPT
Waiting for Claude
Filling in answers
Moving to next item
```

### Peer Assignment Support

Peer assignment support is included as a feature. The extension can detect pending peer review pages and help with repeated review workflows.

Peer feedback affects other learners. Use this only when you are allowed to use automation and you have personally reviewed the submission.

---

## Why People Search for This

People usually find this project when they are looking for:

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

That is exactly what this repository is: a practical, open-source Coursera AI assistant that uses ChatGPT and Claude from the browser.

---

## Feature Overview

| Feature | Included |
| --- | --- |
| Chrome extension package | Yes |
| Works without API keys | Yes |
| ChatGPT web bridge | Yes |
| Claude web bridge | Yes |
| Coursera quiz parsing | Yes |
| Multiple-choice support | Yes |
| Multi-select support | Yes |
| Short-answer support | Yes |
| Visual question support | Yes, when browser image access allows it |
| Peer assignment support | Yes, as a feature |
| Local browser storage workflow | Yes |
| Backend server required | No |
| Official Coursera product | No |

---

## Responsible Use

This project is for learning support, accessibility, self-review, private testing, and browser automation research.

Do not use it to misrepresent your own work, submit material you have not reviewed, or violate a course honor code. AI can be wrong. Coursera courses and institutions can have strict rules about outside tools. Check your course policy before using automation.

The safest way to use the extension:

1. Let it collect and organize question context.
2. Read the AI suggestion.
3. Compare it with your own understanding.
4. Review every selected answer or written response.
5. Submit only work you are allowed to submit.

---

## Privacy in Plain English

This extension does not run its own cloud server.

The data flow is:

```text
Coursera page -> your browser extension storage -> your ChatGPT or Claude tab -> your browser extension storage -> Coursera page
```

Important details:

| Question | Answer |
| --- | --- |
| Does this project require its own account? | No |
| Does this project run a backend server? | No |
| Does it send prompts to ChatGPT or Claude? | Yes, through the AI tab you are signed into |
| Can visual questions be included in prompts? | Yes, when image capture works |
| Should I review AI provider privacy settings? | Yes |

---

## Troubleshooting

### The extension does not show up on Coursera

Try this:

1. Open `chrome://extensions/`.
2. Make sure Coursera Quiz AI Solver is enabled.
3. Refresh the Coursera tab.
4. Confirm the page is on `coursera.org`.
5. Make sure you loaded the extracted folder, not the zip file.

### ChatGPT or Claude did not answer

Check the AI tab. It may need you to:

```text
sign in again
finish a verification prompt
clear a pop-up
wait for a rate limit
start a new chat
```

### The answer format looks wrong

The extension asks for JSON, but AI tools sometimes add extra text. The parser tries several recovery methods, but not every response can be fixed automatically. Retry once, or switch providers.

### An image question was missed

Some images cannot be read by the browser because of cross-origin rules, canvas security rules, or how the course renders the image. If that happens, review the question manually.

### A Coursera button was not clicked

Coursera changes layouts often. Refresh the page and try again. If it keeps happening, open an issue with the page type, extension version, browser version, and a redacted screenshot.

---

## FAQ

### Is this free?

Yes. The repository is open source and the extension does not require a paid API key.

### Do I need an OpenAI or Anthropic API key?

No. It uses the ChatGPT or Claude website in your browser.

### Does it work on Microsoft Edge?

It should work on Chromium-based browsers such as Chrome, Edge, Brave, and similar browsers that support unpacked Manifest V3 extensions.

### Why should I keep both ChatGPT and Claude open?

The extension can use one provider as the main path and the other as a fallback. This improves reliability when one provider is slow, blocked, or returns a response that cannot be parsed.

### Does it support peer assignments?

Yes. Peer assignment support is included, but the product name remains Coursera Quiz AI Solver.

### Is it official?

No. This is an independent open-source project. It is not affiliated with Coursera, OpenAI, Anthropic, Google, Chrome, or any university.

### Why is the zip called `coursera-quiz-ai-solver.zip`?

Because that is the correct product name. Peer assignment support is only one feature inside the extension.

---

## Perfect GitHub Topics

If you maintain this repository, these topics help normal users and search engines understand it:

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

## For Developers and Maintainers

Most users do not need this section. It is here for contributors, maintainers, and developers who want to understand the internal design.

<details>
<summary><strong>Project files</strong></summary>

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

Main phases:

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

Parser recovery tries:

1. Brace-balanced JSON extraction.
2. Sanitized JSON parsing.
3. Regex extraction from answer blocks.
4. Conversational fallback parsing.

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

Planned improvements that would make the extension better for normal users:

1. Add a review-before-submit mode.
2. Add a clearer first-run setup screen.
3. Add screenshots and short demo GIFs.
4. Add a simple provider selector: ChatGPT, Claude, or auto.
5. Add a privacy mode that disables visual capture.
6. Reduce broad permissions where possible.
7. Improve settings so every option affects runtime behavior.
8. Add issue templates for broken Coursera layouts.

---

## Disclaimer

Coursera Quiz AI Solver is an independent open-source browser extension. It is not affiliated with Coursera, OpenAI, Anthropic, Google, Chrome, or any course provider. AI suggestions can be incomplete or wrong. Always review output yourself and follow your course rules.

---

## Links

```text
Repository: https://github.com/aburahatsabir/coursera-quiz-ai-solver
Latest release: https://github.com/aburahatsabir/coursera-quiz-ai-solver/releases/latest
Release asset: coursera-quiz-ai-solver.zip
```
