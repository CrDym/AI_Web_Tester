<div align="center">

# 🤖 AI Web Tester

**A Next-Generation Web Automation Testing Workbench Powered by LLMs**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Let AI take over fragile CSS selectors and drive your end-to-end (E2E) tests with natural language intent.*

[中文文档](README.md) · [Features](#-core-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [Workflow Demo](#-workflow-demo)

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
- 🛡️ **Self-Healing Selector Scoring & Rewrite**: During self-healing, the AI scores candidate selectors for stability (prioritizing `data-testid` or `aria` attributes). High-scoring selectors are automatically cached and rewritten, while low-scoring selectors go to the **"Self-Healing Review Page"** on the Web console for human review and comparison.
- 📦 **Test Suites & Execution Plans**: Supports grouping test cases into Suites for batch execution. You can specify a global "Setup Login Case" (sharing state via injected Browser Context) to log in once and reuse it across the entire suite.
- 📺 **Real-time Monitoring & Run History**: During suite execution, the right side of the console plays back the test screen in real time and streams execution logs. Frame captures, step durations, and logs for every run are saved to disk for easy playback and auditing at any time.
- 🧩 **Chrome Recording Extension Companion**: Coupled with a dedicated browser extension, you can record operation steps simply by clicking on a real webpage, and the test cases will automatically sync to the Web console.
- ⚡ **Rich Interaction Support**: Supports `click`, `input`, `wait`, `hover`, `select_option`, `press_key`, `scroll` (including local container scrolling), and various `assert` actions.

---

## 📦 Architecture

This project adopts a decoupled frontend-backend design:

```text
ai-web-tester/
├── src/ai_tester/              # 🐍 Underlying Python Driver & Self-Healing Engine
│   ├── agent.py                # AI exploration and intent understanding engine
│   ├── healer.py               # AI element self-healing engine (w/ scoring & rewrite)
│   ├── driver.py               # Playwright action encapsulation
│   └── inject/                 # JS injection scripts: DOM dimensionality reduction
├── web_server/                 # 🚀 Web Backend (FastAPI)
│   └── app.py                  # API, WebSocket real-time push, subprocess scheduling
├── frontend/                   # 💻 Web Frontend Console (React + Tailwind)
│   └── src/App.tsx             # Core views: Case Lobby, Run Replay, Healing Review
├── extension/                  # 🧩 Chrome Recording Extension
├── tests/                      # Data storage directory (Auto-generated)
│   ├── recorded_cases/         # JSON test case library
│   ├── run_history/            # Single case run artifacts (logs, screenshots, metadata)
│   └── suite_history/          # Suite run artifacts
└── ROADMAP.md                  # Development evolution roadmap
```

---

## 🚀 Quick Start

### 1. Prerequisites

Ensure your system has **Python 3.8+** and **Node.js** installed.

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

## 🎥 Workflow Demo

1. **Create/Record Case**: Record via the extension or manually write steps in the Web console. Each step can consist of just a "natural language intent" (e.g., `Click Login`) without needing to fill in a `selector`.
2. **First Run (Exploration & Healing)**: Click Run. The underlying `ai_tester` engine detects the missing selector and wakes up the LLM to scan the current page, find the element, and score it. If the score is high, the engine writes the reliable CSS Selector back to your case.
3. **Ultra-fast Regression**: The second time the case runs, the engine directly uses the cached Selector from the previous run, costing **0 Tokens and executing in milliseconds**.
4. **Self-Healing Triggered by UI Changes**: One day the frontend is redesigned, and the old Selector fails. When the engine intercepts the error at that step, it wakes up the LLM again. Combining the historical "intent" and the new page structure, the LLM successfully finds the new element location and continues the test.
5. **Self-Healing Review**: After testing is complete, you can see the before-and-after screenshot comparisons on the "Self-Healing Review Page" in the Web console, and approve or rollback this healing action with one click.

---

## 👏 Acknowledgments

During the development of this project, the concepts of DOM dehydration and extraction, prompt design, and multi-modal visual element localization were partially inspired by and refer to excellent peers in the open-source community. Special thanks to:
- [**browser-use**](https://github.com/browser-use/browser-use) 
- [**alibaba/page-agent**](https://github.com/alibaba/page-agent)

---

## 🤝 Contribution & Support

Issues and Pull Requests are welcome to improve this project together!
If this framework inspired you, feel free to give this project a ⭐️ **Star**!

[MIT License](LICENSE) © 2026 RockChe