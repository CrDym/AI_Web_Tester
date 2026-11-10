<div align="center">

# AI Web Tester

**A next-generation web automation testing workbench powered by LLMs**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Let AI take over fragile CSS selectors and drive E2E tests with natural language intent.

[中文](README.md) · [Quick Start](#quick-start) · [Docs](#docs) · [Verification](#verification)

</div>

---

## Why It Exists

Traditional web UI automation usually has two major pain points:

1. High authoring cost: engineers must inspect elements, write selectors, and maintain scripts.
2. Brittle scripts: a small UI or style refactor can break many tests.

AI Web Tester shifts test authoring from “finding elements” to “expressing intent”. You can write “click the login button in the top right”. When a selector is missing or broken, the system uses DOM, screenshots, and intent to trigger AI self-healing, while preserving screenshots, logs, token usage, and audit records.

## Core Features

- Modern web console for cases, suites, environments, prompts, and run history.
- Intent-driven steps: `intent` can be the primary locator, and `selector` may be empty.
- AI self-healing when selectors fail.
- Heal audit and reviewed rewrite with before/after screenshot comparison.
- Token usage visibility across runs, heal events, fix suggestions, and NL2Case.
- AI fix suggestions with root cause and applicable `patched_steps`.
- Suite execution with setup case support and shared login state.
- Chrome recording extension for syncing recorded steps to the console.
- Data-driven cases with `variables`, `dataset`, and built-in variables such as `${today_ymd}`.
- Cancellable queueing: runs queue in `pending` state and can be cancelled while still in the queue, releasing the slot.
- Trustworthy assertions: assertions are semantic visible-assertions (`.first + count + wait_for(visible)`) and never enter self-healing, so assertions cannot be bypassed; input data is safely embedded into generated scripts as Python literals via `repr`.

## Scope & Trust Model

This tool is intended for **single-team internal use**. Understand the trust boundary before deployment:

- A logged-in user can execute server-generated Python test scripts on the host, equivalent to a trusted intranet execution environment. Do not expose the backend directly to the public internet.
- The Chrome recorder sync endpoint (`POST /api/recorder/cases`) is not authenticated by default; it is only guarded by an optional `AI_TESTER_RECORDER_TOKEN`. Always set that token in shared/production environments.
- Scripts generated from natural language or AI fix suggestions are compiled and executed server-side, with inputs safely serialized via `repr`.

## Quick Start

### 1. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r web_server/requirements.txt
playwright install chromium
```

### 2. Configure Model Access

```bash
cp .env.example .env
```

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
OPENAI_MODEL_NAME=gpt-4o
```

You can also configure these values from the Web Console Settings page. The backend writes them to `.env`.

### 3. Start Services

Backend:

```bash
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

### 4. Chrome Extension

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Load the `extension/` directory
4. Start recording on a target page; recorded steps sync to the Web Console

## Docs

- [Development Guide](docs/en/development.md): local setup, env vars, runtime data, Chrome extension, CI notes.
- [Architecture](docs/en/architecture.md): frontend hooks/components, backend routes/runners, data flow.
- [API Overview](docs/en/api.md): auth, cases, runs, suites, config, prompts, and internal APIs.
- [E2E & Verification](docs/en/e2e.md): pytest, frontend tests, production build, browser smoke test.
- [Security Notes](docs/en/security.md): auth, CORS, secret masking, path validation, sensitive data handling.

## Verification

Recommended checks after development or refactoring:

```bash
venv/bin/python -m pytest web_server/test_web_server_api.py web_server/test_runner.py web_server/test_suite_runner.py -q

cd frontend
npm test
npm run build
npm run e2e:smoke
```

`npm run e2e:smoke` starts isolated temporary frontend/backend services, a temporary database, and a temporary prompts directory. It covers setup/login, settings save, case creation/save, and suite creation/maintenance.

The backend currently has 30 tests (`test_web_server_api.py` 22 / `test_runner.py` 5 / `test_suite_runner.py` 3), covering key regression paths such as generated-script injection, assertion/self-heal isolation, queue cancellation, run timeout and stopped-terminal-state preservation, backup restore integrity, and unauthenticated request rejection.

## Acknowledgments

This project was inspired in part by open-source work around DOM extraction, prompt design, and visual element localization:

- [browser-use](https://github.com/browser-use/browser-use)
- [alibaba/page-agent](https://github.com/alibaba/page-agent)

## Contributing

Issues and pull requests are welcome.

[MIT License](LICENSE) © 2026 RockChe
