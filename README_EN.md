<div align="center">

# 🤖 AI Web Tester

**A next-generation Web automation testing engineering framework powered by LLMs**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Let large language models take over fragile CSS selectors, and drive your end-to-end (E2E) tests with natural language intent.*

[中文文档](README.md) · [Features](#-core-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [Best Practices](#-best-practices) · [Usage Examples](#-usage-examples)

</div>

---

## 💡 Why AI Web Tester?

In traditional Web UI automation testing (such as Selenium and native Playwright), we usually face three major pain points:
1. **High authoring cost**: You need to manually inspect the DOM tree and write complex XPath or CSS selectors.
2. **Extremely brittle scripts**: A minor frontend UI refactor (even just changing a Tailwind className) can cause widespread `NoSuchElementException` failures, with very high maintenance cost.
3. **Rigid assertions**: Only exact string matching is possible, making “semantic-level” fuzzy assertions difficult.

**AI Web Tester** introduces large language models (such as GPT-4o, Claude 3.5, DeepSeek, etc.) as the “brain,” enabling a paradigm shift in testing from **“instruction-driven” to “intent-driven.”**

---

## ✨ Core Features

- 🗣️ **Intent-Driven Execution**: No need to write selectors. Just use `agent.step("在搜索框输入 iPhone 并点击搜索")`, and AI will automatically find the target and perform the action.
- 👁️ **Multimodal Vision & Bounding Boxes (Visual Bounding Box)**: Fully embraces the essence of Midscene.js. Supports capturing the current page and automatically drawing red boxes with IDs on elements; combined with GPT-4o vision capabilities, it handles complex nested cards and dynamic UIs precisely.
- 🚑 **Low-Level Element Self-Healing**: Fully compatible with existing traditional scripts. When hardcoded CSS selectors fail, it intercepts errors and triggers the LLM to “understand” the current page, automatically find new element locations, and continue execution—no more interrupted tests!
- ⚡ **Intent Cache & Replay**: Records native CSS selector actions during first intent execution, then replays from cache in subsequent runs within seconds, with **0 token cost and millisecond-level runtime**. The LLM is only invoked again when replay fails.
- ✍️ **Automatic Code Rewrite**: After AI successfully explores an execution path, it automatically locates the Python test file that called it, writes native Playwright code (such as `page.click`, `page.fill`) back into the file, and comments out the LLM call code—completely removing AI dependency!
- 📝 **Fully Automated PRD-to-Code Generation (Test Generation)**: Pass in a natural-language product requirements document (PRD), and the framework automatically outputs pytest-compliant scripts powered by Playwright and AI.
- 🔍 **Intelligent Data Extraction (Data Extractor)**: Built-in `DataExtractor` uses vision and DOM to quickly convert complex tables or card lists on pages into structured JSON data via natural language.
- 🧠 **Semantic Smart Assertions**: Say goodbye to rigid `assert "success" in text`. Use `asserter.evaluate(dom, "用户已成功登录且看到了欢迎横幅", screenshot)`.
- 📉 **Extreme Token Compression & Viewport Pruning**: Built-in low-level JS injection engine extracts only visible elements in the current viewport and outputs simplified attributes. In non-vision mode, each step requires fewer than 1000 tokens.
- 📊 **Modern Test Reports & Log Management**: Beautiful Tailwind CSS-based HTML test reports generated automatically with zero configuration. Logs support automatic rotation retention, and screenshots are captured automatically when test cases fail.

---

## 📦 Architecture

```text
ai-web-tester/
├── main.py                     # Unified CLI entry point (run / generate)
├── src/
│   └── ai_tester/              # Framework core code
│       ├── agent.py            # 🧠 AI brain: analyzes page intent and autonomous exploratory execution (ReAct mode)
│       ├── healer.py           # 🚑 Element self-healing engine: guardian when traditional scripts fail
│       ├── asserter.py         # 🔍 Smart assertion engine: evaluates semantic page state
│       ├── extractor.py        # 📊 Intelligent extraction engine: page data extraction crawler
│       ├── generator.py        # ⚙️ Test generator: reads PRD and outputs pytest code
│       ├── driver.py           # 🚗 Driver layer: encapsulates Playwright actions
│       ├── logger.py           # 📝 Fully Chinese formatted logging module
│       ├── pytest_plugin.py    # 📊 HTML test reports and Pytest hooks
│       ├── run_context.py      # 🔄 Runtime context: isolated records and token statistics for each run
│       └── inject/
│           └── extract_elements.js  # 🚀 Core: injected into browser side to extract a highly compressed semantic interaction tree
├── examples/                   # Example demo code
│   ├── conftest.py             # Imports test reporting and global configuration
│   ├── test_demo.py            # Example: hybrid programming test (intent execution + smart assertion + element self-healing)
│   └── test_baidu_search.py    # Example: natural-language test script auto-generated by AI
├── tests/                      # Your business test code directory
│   ├── conftest.py             # Global configuration for business tests
│   ├── test_dustess.py         # Example: complete admin-side automation test script
│   └── test_template.py        # Template: preset blank test case for direct copy-and-write
├── logs/                       # Auto-generated logs and HTML reports storage
│   └── runs/                   # Independent report, screenshot, and log folders per run
└── TODO.md                     # Advanced development roadmap and Todo list
```

---

## 🚀 Quick Start

### 1. Environment Dependencies

Ensure Python 3.8+ is installed on your system. Using a virtual environment is recommended:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install framework dependencies and Playwright browser binaries:

```bash
pip install playwright pytest pytest-playwright langchain langchain-openai pydantic python-dotenv
playwright install chromium
```

### 2. Configure LLM API Key

This project is built on `langchain_openai`, so it is **natively compatible with all LLM platforms that support the OpenAI API format** (such as OpenAI, GitHub Models, SiliconFlow, DeepSeek, etc.).

Copy the configuration template:

```bash
cp .env.example .env
```

Edit the `.env` file and fill in your API info (GitHub Models as an example):

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
```

> **Tip**: It is recommended to use models with stronger reasoning capabilities (such as `gpt-4o`, `gpt-4o-mini`, `Claude 3.5 Sonnet`, `deepseek-chat`).

### 3. Run Demo Cases and Generate Code

The framework provides a unified entry command `python3 main.py`, allowing you to run tests and generate code more elegantly:

- **Run test cases**:
  ```bash
  # Run all demo tests under the examples directory (UI mode by default)
  python3 main.py run
  
  # Run a specified test file in headless mode (no browser UI)
  python3 main.py run examples/test_demo.py --headless
  ```

- **Automatic code generation**: Read an external PRD document or natural language and let AI generate Python test code automatically.
  ```bash
  # Method 1: Generate test code using pure natural language description
  python3 main.py generate --text "打开必应搜索，输入人工智能，断言页面标题包含人工智能" --out tests/test_bing.py
  
  # Method 2: Generate test code using an existing PRD document
  python3 main.py generate --prd requirements/my_prd.md --out tests/test_my_feature.py
  ```

- **Template-based authoring**: You can directly copy the preset blank template and fill in your own natural language instructions for testing.
  ```bash
  cp tests/test_template.py tests/test_my_app.py
  python3 main.py run tests/test_my_app.py
  ```

After execution, you can go to `logs/runs/<运行时间>/` and open `test_report.html` to view the polished test report, or inspect detailed logs of each AI decision step and failure screenshots.

---

## ✅ Best Practices

- **Use environment variables first for unified model management**: It is recommended to configure `OPENAI_API_BASE / OPENAI_API_KEY / OPENAI_MODEL_NAME` in `.env`. Avoid hardcoding `model_name` in business code, and only pass it when override is needed (e.g., forcing a vision model for a specific case).
- **Control single-intent complexity**: Split long flows into multiple `agent.step(...)` calls. Ideally, each step should be completed within 3–8 actions to avoid excessive token consumption from prolonged exploration on complex pages.
- **State clear “completion criteria” in intent**: Explicitly add “must return done after completion” at the end of intent, which significantly reduces the chance of the model continuing attempts after the task is done.
- **Disable vision by default; enable on demand**: `use_vision=False` usually saves more tokens. Only enable `use_vision=True` for complex components (cards, tables, popups, multi-column layouts, dynamic lists) or when DOM information is insufficient; or use `auto_vision=True` to let the framework switch as fallback.
- **Make full use of cache replay**: Once a stable intent succeeds, it is written to local cache. Subsequent regressions prioritize replay for 0 token cost; only when replay fails due to UI changes will the LLM be invoked to re-explore.
- **Reduce invalid clicks and overlay issues**: When encountering “intercepts pointer events” or blocking overlays, prioritize adding intent descriptions like “close popup/mask/guide layer first” or “scroll into visible area before clicking.” If needed, split into two steps: “remove interference → click target.”
- **Recommended troubleshooting workflow**: Run regressions with `--headless` first; when reproducing issues, switch to headed mode and inspect logs (`logs/`) for per-step target elements and token usage; if the page changes frequently, clear cache and rerun once to generate a new stable path.

## 🛠️ Usage Examples

You can use `ai_tester` as a regular Python package and call it flexibly in any business test.

### Scenario 1: Hybrid Programming (0-Token High-Speed Replay + AI Self-Healing Fallback)

In daily regression testing, for ultimate speed, we can still use traditional selectors (or cache generated from one successful LLM execution). When selectors fail due to frontend refactors, AI self-healing serves as fallback.

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer

def test_login_with_healing(page):
    driver = PlaywrightDriver(page)
    # Recommended: set OPENAI_MODEL_NAME in .env; do not hardcode model here
    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)
    healer = SelfHealer(use_vision=True)

    broken_selector = "#old-login-btn"
    
    try:
        # 1. Try ultra-fast traditional execution first (0 token, millisecond-level)
        page.click(broken_selector, timeout=2000)
    except Exception:
        # 2. If it fails due to UI changes, trigger AI element self-healing
        current_dom = agent.get_dom_tree_str()
        screenshot = driver.get_screenshot()
        
        # Tell AI what the failed button is used for
        new_id_or_selector = healer.heal(broken_selector, "登录提交按钮", current_dom, screenshot)
        
        # Continue the test with the new target found by AI!
        driver.perform_action("click", new_id_or_selector)
```

### Scenario 2: Fully Intent-Driven with Automatic Code Rewrite

Completely discard locators and test pages with human language. After one successful run, the framework automatically writes the test code for you!

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter

def test_search_feature(page):
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)
    asserter = SmartAsserter(use_vision=True)
    
    page.goto("https://example.com")
    
    # Intent-driven multi-step execution.
    # 💡 Magic moment: once this line runs successfully once, it will be auto-commented out,
    # and native page.fill and page.click code will be auto-generated below!
    agent.step("在顶部搜索框输入 'iPhone 15'，然后按下回车键，结束后返回 done")
    
    # Semantic multimodal assertion
    current_dom = agent.get_dom_tree_str()
    screenshot = driver.get_screenshot()
    is_passed = asserter.evaluate(
        current_dom, 
        "页面跳转到了搜索结果，并且展示了多款 iPhone 15 的商品列表",
        screenshot
    )
    assert is_passed is True
```

### Scenario 3: Intelligent Data Extraction (Data Extractor)

Beyond actions and assertions, AI can also serve as your “smart crawler” and “table reader,” directly transforming complex pages into structured JSON data.

```python
from ai_tester import PlaywrightDriver, DataExtractor

def test_data_extractor(page):
    driver = PlaywrightDriver(page)
    page.goto("https://practicetestautomation.com/practice-test-login/")
    
    # Use use_vision=True for more accurate structured extraction capability
    extractor = DataExtractor(driver, use_vision=True)
    
    # Extract the account and password hint information from the page via natural language
    query = "提取页面上提示的 Test username 和 Test password，返回格式: {\"username\": \"...\", \"password\": \"...\"}"
    data = extractor.extract(query)
    
    assert data.get("username") == "student"
```

### Scenario 4: Generate Test Code Directly from Requirement Documents (PRD)

```python
from ai_tester import TestCaseGenerator

generator = TestCaseGenerator()

prd_text = """
功能：用户注册
场景：输入正确的用户名和符合规则的密码，点击注册按钮。
预期：页面提示注册成功并跳转到用户中心。
"""

# Generate an executable pytest script file directly
generator.generate_from_prd(prd_text, "tests/test_auto_register.py")
```

---

## 🤝 Contribution & Support

Issues and Pull Requests are welcome to improve this project together!
If this framework inspired you, feel free to give this project a ⭐️ **Star**!

## 📄 License

[MIT License](LICENSE) © 2026 RockChe
