<div align="center">

# 🤖 AI Web Tester

**A Next-Generation Web Automation Testing Workbench Powered by LLMs**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Let AI take over fragile CSS selectors and drive your end-to-end (E2E) tests with natural language intent.*

[中文文档](README.md) · [Features](#-core-features) · [Quick Start](#-quick-start) · [Console Guide](#-console-guide) · [API Overview](#-api-overview) · [Architecture](#-architecture)

</div>

---

## 💡 Why AI Web Tester?

In traditional Web UI automation testing (such as Selenium and native Playwright), we usually face two major pain points:
1. **High authoring cost**: You need to frequently inspect the console, locate elements, and manually write or maintain complex XPath or CSS Selectors.
2. **Extremely brittle scripts**: A minor frontend UI refactor (even just changing a Tailwind className) can cause widespread `NoSuchElementException` failures, with very high maintenance cost.

**AI Web Tester** is a modern testing workbench built on a **B/S architecture**. It introduces visual large language models (such as GPT-4o, Claude 3.5, DeepSeek, etc.) as the "brain", enabling a paradigm shift from **"finding elements" to "expressing intents"**.

---

## ✨ Core Features

- 🎮 **Modern Web Console**: A zero-configuration React frontend panel. Supports test case management, multi-environment configuration, and visual drag-and-drop orchestration of test steps.
- 🗣️ **Intent-Driven**: You can simply type "Click the login button in the top right corner" or "Enter iPhone in the search box" in the editor, without manually writing any selectors.
- 🚑 **AI Smart Self-Healing Engine**: This is the killer feature of the framework. When a previously recorded CSS selector fails due to page refactoring, the underlying engine automatically intercepts the exception, captures the current page DOM and screenshot, and sends them to the LLM. The AI finds the element again based on your "intent description" and continues the test. **Tests are no longer interrupted!**
- 🛡️ **Self-Healing Scoring & Reviewed Rewrite**: The AI scores candidate selectors for stability (preferring `data-testid` / `role` / `aria`). High-confidence selectors can be cached locally. In the Web console you can open the **Heal Audit board**, compare “before/after” screenshots, and click **Approve update** to write back selectors into the case (even if the original selector was empty, it can locate the step by intent).
- 🔎 **Token Cost Visibility**: Token usage is tracked for every LLM call and displayed across run history, suite summary, heal events, AI fix suggestions, and NL2Case.
- 🧰 **AI Fix Suggestions**: On failures, generate an AI fix suggestion (root cause + executable `patched_steps`) and apply it to the case with one click.
- 📦 **Test Suites & Execution Plans**: Supports grouping test cases into Suites for batch execution. You can specify a global "Setup Login Case" (sharing state via injected Browser Context) to log in once and reuse it across the entire suite.
- 📺 **Real-time Monitoring & Run History**: The console streams logs and screenshots in real time. Each run persists metadata, screenshots, and token summary for replay and audit.
- 🧩 **Chrome Recording Extension Companion**: Coupled with a dedicated browser extension, you can record operation steps simply by clicking on a real webpage, and the test cases will automatically sync to the Web console.
- ⚡ **Rich Interaction Support**: Supports `click`, `input`, `wait`, `hover`, `select_option`, `press_key`, `scroll` (including local container scrolling), and various `assert` actions.

---

## 📦 Architecture

This project adopts a decoupled frontend-backend design:

```text
ai-web-tester/
├── src/ai_tester/              # 🐍 Underlying Python Driver & Self-Healing Engine
│   ├── agent.py                # AI auto-execution and intent understanding engine
│   ├── healer.py               # AI element self-healing engine (w/ scoring & heal event reporting)
│   ├── driver.py               # Playwright action encapsulation
│   └── inject/                 # JS injection scripts: DOM dimensionality reduction
├── web_server/                 # 🚀 Web Backend (FastAPI)
│   ├── app.py                  # API, WebSocket real-time push, subprocess scheduling
│   └── database.py             # SQLite database models
├── frontend/                   # 💻 Web Frontend Console (React + Tailwind)
│   └── src/App.tsx             # Core views: SOLO TEST Cyber-Console, Run Replay, Healing Review
├── extension/                  # 🧩 Chrome Recording Extension
├── tests/                      # Data storage directory (Auto-generated)
│   ├── tester.db               # SQLite database persisting Cases, Runs, Suites
│   ├── recorded_cases/         # Case JSON backup library (.bak files)
│   ├── run_history/            # Run artifacts (logs, screenshots, meta, token_usage)
│   └── suite_history/          # Suite run artifacts
└── ROADMAP.md                  # Development evolution roadmap
```

---

## 🧠 Core Concepts

- **Case**: describes `start_url` + `steps`. Persisted in `tests/tester.db` with **one-click .bak restore**.
- **Step**: a single action (`click/input/assert...`). Prefer writing a clear `intent`; `selector` can be empty.
- **Run**: one execution of a case, persisted under `tests/run_history/<run_id>/` for replay and auditing.
- **Heal**: when a selector is missing/invalid, the engine uses DOM (and optional screenshot) + intent to call the LLM and continue.
- **Approve Rewrite**: healing results are not auto-written into cases. You review “before/after” screenshots in the console and click **Approve update** to write back to the DB.
- **Suite**: an ordered set of cases. Optional `setup_case` is used for login and session preparation.
- **Token Usage**: every LLM call records token_usage; shown in run/suite summaries and per-event details.

## 🚀 Quick Start

### 1. Prerequisites

Ensure your system has **Python 3.8+** and **Node.js 18+** installed.

After cloning the repository, configure the Python virtual environment and install underlying dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r web_server/requirements.txt
playwright install chromium
```

### 2. Configure LLM API Key

Copy the configuration template and fill in your LLM information (natively compatible with all models supporting the OpenAI API format):

```bash
cp .env.example .env
```

```env
# .env Example (Using GitHub Models)
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
OPENAI_MODEL_NAME=gpt-4o
```
*(Using models with strong multi-modal capabilities is recommended, such as `gpt-4o`, `Claude 3.5 Sonnet`)*

### 3. Start Services

**Start Backend (FastAPI)**:
```bash
# Ensure you are inside the activated venv
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

**Start Frontend (React)**:
```bash
# Open a new terminal window
cd frontend
npm install
npm run dev
```

Open your browser and visit `http://127.0.0.1:5173/` to enter the Web Console.

### 4. Use with Chrome Extension (Optional but Recommended)

1. Open Chrome and visit `chrome://extensions/`
2. Enable **Developer mode** in the top right corner
3. Click **Load unpacked** and select the `extension/` directory of this project
4. Click the extension icon on the webpage you want to test to start recording. The recorded artifacts will be automatically sent to the Web Console.

---

## ⚙️ Configuration & Environment Variables

### `.env` (Model Config)

The root `.env` typically contains:

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=xxxx
OPENAI_MODEL_NAME=gpt-4o-mini
```

You can also configure these in the Web Console Settings page (the server will write to `.env`).

### Runtime Env Vars (Optional)

| Var | Example | Notes |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `1` | Headless mode (1=headless) |
| `AI_TESTER_STORAGE_STATE_PATH` | `tests/suite_history/<suite_run_id>/storage_state.json` | Share login state via Playwright storageState |
| `AI_TESTER_RUN_DIR` | `logs/runs/20260415_120000/` | Output directory for HTML report and failure screenshots |

---

## 🧾 Case & Suite Formats

### Case JSON

Cases are stored at `tests/recorded_cases/*.json` by default:

```json
{
  "id": "login.json",
  "name": "Login",
  "start_url": "https://example.com/login",
  "steps": [
    { "type": "input", "selector": "", "value": "admin", "intent": "Enter username in the username field" },
    { "type": "input", "selector": "", "value": "123456", "intent": "Enter password in the password field" },
    { "type": "click", "selector": "", "intent": "Click the login button" },
    { "type": "assert", "assert_type": "text", "value": "Login successful", "intent": "Page shows login success" }
  ]
}
```

Notes:
- `selector` can be empty. Missing/invalid selectors trigger healing based on `intent`.
- `assert_type`: `text` / `url` / `visible`

### Suite JSON

Suites are stored at `tests/suites/*.json`:

```json
{
  "id": "login_flow.json",
  "name": "Login Flow",
  "env_id": null,
  "setup_case_id": "login.json",
  "case_ids": ["login.json", "authorize.json"]
}
```

---

## 💾 Data Directory & Ignore Rules (Important)

`tests/` is a runtime data directory and is not committed by default:
- `tests/recorded_cases/`: case library (often company/internal)
- `tests/run_history/`: run artifacts (meta.json, screenshots, token_usage.json)
- `tests/suite_history/`: suite run artifacts (meta.json, storage_state.json)

The repository `.gitignore` ignores `tests/` to avoid accidentally committing internal data.

---

## 🎥 Workflow Demo

1. **Create/Record Case**: Record via the extension or manually write steps in the Web console. Each step can be just a natural-language `intent`; `selector` can be empty.
2. **First Run (Healing)**: If selectors are missing/invalid, the engine calls the LLM using DOM (+ optional screenshot), returns candidates with a stability score, and records token usage.
3. **Fast Regression**: Subsequent runs often hit cached selectors and cost **0 Tokens** (or very low Tokens).
4. **UI Change → Heal Again**: When UI changes break selectors, the engine heals and continues without stopping the run.
5. **Heal Audit & Rewrite**: In the Heal Audit board, compare before/after screenshots (zoom supported) and click **Approve update** to write selectors back to the case.
6. **AI Fix Suggestion**: If a run fails, generate an AI fix suggestion and apply the suggested `patched_steps` to the case.

---

## 🧭 Console Guide

### Case Lobby
- Search by name/ID, filter by tags
- Create cases: blank case or NL2Case (generate steps from natural language)
- Run history per case: status, duration, token summary; click to replay

### Case Editor
- Edit steps (`type/selector/intent/value/assert_type`)
- View generated pytest script (for debugging / CI)
- Save case JSON to runtime data directory

### Run & Live Monitoring
- Start a run and watch logs + screenshots in real time

### Replay & Audit
- Screenshot timeline and log replay
- Heal events with per-event token usage
- Heal Audit board with before/after screenshot compare (zoom)
- Token breakdown for all LLM calls in the run
- AI Fix Suggestion on failures

### Suite
- Create suites, reorder cases, configure setup_case
- Run suites with aggregated pass/fail/heal/token summary
- Per-case row shows duration/heal/token/status and jump to replay

### Settings & Environments
- Configure model (`OPENAI_API_BASE/KEY/MODEL_NAME`) and test connection
- Manage environments (base_url) for running the same cases against different deployments

---

## 🌐 API Overview

Backend listens on `http://127.0.0.1:8000`.

### Public APIs (Recommended)

| Category | Method | Route | Notes |
|---|---|---|---|
| Config | GET | `/api/config` | Read model config from `.env` |
| Config | POST | `/api/config` | Persist model config to `.env` |
| Config | POST | `/api/config/test` | Test model connectivity (returns latency + token_usage) |
| Environments | GET | `/api/environments` | List environments |
| Environments | POST | `/api/environments` | Save environments |
| Cases | GET | `/api/cases` | List cases |
| Cases | POST | `/api/cases` | Create case |
| Cases | GET | `/api/cases/{case_id}` | Get case detail |
| Cases | PUT | `/api/cases/{case_id}` | Update case |
| Cases | DELETE | `/api/cases/{case_id}` | Delete case |
| Cases | POST | `/api/cases/{case_id}/rename` | Rename case |
| NL2Case | POST | `/api/cases/generate` | Generate steps (returns token_usage) |
| Heal | POST | `/api/cases/{case_id}/heal/approve` | Approve rewrite (supports empty old_selector by intent) |
| Script | GET | `/api/cases/{case_id}/script` | Get generated pytest script |
| Run | POST | `/api/run/{case_id}` | Start run (returns run_id/session_id) |
| Run | GET | `/api/runs?case_id=...` | List runs |
| Run | GET | `/api/runs/{run_id}` | Run detail (logs/screens/heal/token_summary) |
| Run | DELETE | `/api/runs/{run_id}` | Delete run |
| Run | GET | `/api/runs/{run_id}/screenshots/{filename}` | Get screenshot (base64) |
| Fix Suggest | POST | `/api/runs/{run_id}/ai_fix_suggest` | Generate fix suggestion (returns token_usage) |
| Suites | GET | `/api/suites` | List suites |
| Suites | POST | `/api/suites` | Create suite |
| Suites | GET | `/api/suites/{suite_id}` | Suite detail |
| Suites | PUT | `/api/suites/{suite_id}` | Update suite |
| Suites | DELETE | `/api/suites/{suite_id}` | Delete suite |
| Suite Run | POST | `/api/suites/{suite_id}/run` | Start suite run |
| Suite Run | GET | `/api/suite_runs` | List suite runs |
| Suite Run | GET | `/api/suite_runs/{suite_run_id}` | Suite run detail |
| Suite Run | DELETE | `/api/suite_runs/{suite_run_id}` | Delete suite run |

### WebSocket
- `ws://127.0.0.1:8000/ws/run/{session_id}`: real-time log & screenshot stream

### Internal APIs (Not for external use)
| Method | Route | Notes |
|---|---|---|
| POST | `/api/internal/push_screenshot/{session_id}` | engine → server screenshot push |
| POST | `/api/internal/push_heal_event/{session_id}` | engine → server heal event push |

## 👏 Acknowledgments

During the development of this project, the concepts of DOM dehydration and extraction, prompt design, and multi-modal visual element localization were partially inspired by and refer to excellent peers in the open-source community. Special thanks to:
- [**browser-use**](https://github.com/browser-use/browser-use) 
- [**alibaba/page-agent**](https://github.com/alibaba/page-agent)

---

## 🤝 Contribution & Support

Issues and Pull Requests are welcome to improve this project together!
If this framework inspired you, feel free to give this project a ⭐️ **Star**!

[MIT License](LICENSE) © 2026 RockChe
