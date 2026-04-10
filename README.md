<div align="center">

# 🤖 AI Web Tester

**基于 LLM 驱动的下一代 Web 自动化测试工程框架**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*让大模型接管脆弱的 CSS 选择器，用自然语言意图驱动你的端到端 (E2E) 测试。*

[English Documentation](README_EN.md) · [特性](#-核心特性) · [快速开始](#-快速开始) · [架构设计](#-架构设计) · [使用示例](#-使用示例)

</div>

---

## 💡 为什么需要 AI Web Tester？

在传统的 Web UI 自动化测试（如 Selenium, 原生 Playwright）中，我们通常面临三大痛点：
1. **编写成本高**：需要手动检查 DOM 树，编写复杂的 XPath 或 CSS Selector。
2. **脚本极其脆弱**：前端 UI 的一次小重构（甚至只是改了 Tailwind 的 ClassName），就会导致大面积的 `NoSuchElementException`，维护成本极高。
3. **断言太死板**：只能进行精确的字符串匹配，难以进行“语义层面”的模糊断言。

**AI Web Tester** 通过引入大语言模型 (如 GPT-4o, Claude 3.5, DeepSeek 等) 作为“大脑”，实现了从 **“指令驱动”向“意图驱动”** 的测试范式跃迁。

---

## ✨ 核心特性

- 🗣️ **意图驱动执行 (Intent-Driven)**：无需编写选择器，直接使用 `agent.step("在搜索框输入 iPhone 并点击搜索")`，AI 会自动寻找目标并执行动作。
- 👁️ **多模态视觉与红框标注 (Visual Bounding Box)**：完美吸收 Midscene.js 的精髓。支持截取当前页面并自动在元素上绘制带有 ID 的红框，结合 GPT-4o 视觉能力，精准处理复杂嵌套卡片和动态 UI。
- 🚑 **底层元素自愈 (Self-Healing)**：完美兼容现有传统脚本。当原本写死的 CSS 选择器失效时，拦截错误并触发大模型“看懂”当前页面，自动找到新的元素位置继续执行，测试不再中断！
- ⚡ **意图缓存回放 (Intent Cache & Replay)**：首次执行意图时记录原生 CSS 选择器操作，后续执行秒级缓存回放，**0 Token 消耗，毫秒级运行**。只有重放失败时才唤醒大模型重新探索。
- ✍️ **自动代码回写 (Auto Code Rewrite)**：当 AI 成功探索出一条执行路径后，会自动定位调用它的 Python 测试文件，将原生的 Playwright 代码（如 `page.click`, `page.fill`）写回文件并注释掉大模型调用代码，彻底消除对 AI 的依赖！
- 📝 **PRD 到代码全自动生成 (Test Generation)**：传入一段自然语言的产品需求文档 (PRD)，框架自动输出带有 Playwright 和 AI 驱动的 pytest 规范脚本。
- 🔍 **智能数据提取 (Data Extractor)**：内置 `DataExtractor`，基于视觉和 DOM，用自然语言快速将页面上复杂的表格或卡片列表转换为结构化的 JSON 数据。
- 🧠 **语义智能断言 (Smart Assertion)**：告别死板的 `assert "success" in text`。使用 `asserter.evaluate(dom, "用户已成功登录且看到了欢迎横幅", screenshot)`。
- 📉 **极致 Token 压缩与视口裁剪 (Viewport Pruning)**：内置底层的 JS 注入引擎，仅提取当前视口内可见元素，精简属性输出。在非视觉模式下单步操作仅需不到 1000 Token。
- 📊 **现代化测试报告与日志管理**：零配置自动生成基于 Tailwind CSS 的美观 HTML 测试报告。日志支持自动轮转保留，用例失败时自动生成现场截图。

---

## 📦 架构设计

```text
ai-web-tester/
├── main.py                     # 统一的 CLI 程序主入口 (run / generate)
├── src/
│   └── ai_tester/              # 框架核心代码
│       ├── agent.py            # 🧠 AI 大脑：负责分析页面意图和自主探索执行 (ReAct 模式)
│       ├── healer.py           # 🚑 元素自愈引擎：传统脚本失效时的守护者
│       ├── asserter.py         # 🔍 智能断言引擎：评估页面语义状态
│       ├── extractor.py        # 📊 智能提取引擎：页面数据提取爬虫
│       ├── generator.py        # ⚙️ 测试生成器：读取 PRD 并输出 pytest 代码
│       ├── driver.py           # 🚗 驱动层：封装 Playwright 动作
│       ├── logger.py           # 📝 格式化全中文日志模块
│       ├── pytest_plugin.py    # 📊 HTML 测试报告与 Pytest Hook
│       └── inject/
│           └── extract_elements.js  # 🚀 核心：注入浏览器端，提取高压缩率的语义交互树
├── examples/                   # 示例演示代码
│   ├── conftest.py             # 引入测试报告和全局配置
│   ├── test_demo.py            # 示例：混合编程测试（意图执行 + 智能断言 + 元素自愈）
│   └── test_baidu_search.py    # 示例：由 AI 自动生成的自然语言测试脚本
├── tests/                      # 您的业务测试代码目录
│   └── test_template.py        # 模板：预置的空白测试用例，供您直接复制编写
├── logs/                       # 自动生成的日志与 HTML 报告存放处
│   └── runs/                   # 每次运行产生的独立报告与日志文件
└── TODO.md                     # 进阶开发计划与 Todo List
```

---

## 🚀 快速开始

### 1. 环境依赖

确保您的系统已安装 Python 3.8+。建议使用虚拟环境：

```bash
python3 -m venv venv
source venv/bin/activate
```

安装框架依赖及 Playwright 浏览器内核：

```bash
pip install playwright pytest pytest-playwright langchain langchain-openai pydantic python-dotenv
playwright install chromium
```

### 2. 配置大模型 API Key

本项目基于 `langchain_openai` 开发，因此**原生兼容所有支持 OpenAI 接口格式的大模型平台**（如 OpenAI, GitHub Models, 硅基流动, DeepSeek 等）。

复制配置文件模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 API 信息（以 GitHub Models 为例）：

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
```

> **提示**：建议使用推理能力较强的模型（如 `gpt-4o`, `gpt-4o-mini`, `Claude 3.5 Sonnet`, `deepseek-chat`）。

### 3. 运行演示用例与代码生成

框架提供了一个统一的入口命令 `python3 main.py`，让您可以更优雅地执行测试和生成代码：

- **执行测试用例**:
  ```bash
  # 运行 examples 目录下的所有演示测试 (默认带 UI 界面)
  python3 main.py run
  
  # 运行指定的测试文件，并开启无头模式 (不显示浏览器)
  python3 main.py run examples/test_demo.py --headless
  ```

- **代码自动生成**: 读取外部的 PRD 文档或自然语言，让 AI 自动生成 Python 测试代码。
  ```bash
  # 方式 1：使用纯自然语言描述生成测试代码
  python3 main.py generate --text "打开必应搜索，输入人工智能，断言页面标题包含人工智能" --out tests/test_bing.py
  
  # 方式 2：使用已有的 PRD 文档生成测试代码
  python3 main.py generate --prd requirements/my_prd.md --out tests/test_my_feature.py
  ```

- **基于模板编写**: 您可以直接复制预置的空白模板，填入自己的自然语言指令进行测试。
  ```bash
  cp tests/test_template.py tests/test_my_app.py
  python3 main.py run tests/test_my_app.py
  ```

运行结束后，您可以进入 `logs/runs/<运行时间>/` 目录下打开 `test_report.html` 查看精美的测试报告，或者查看 AI 每一步决策的详细日志和失败截图。

---

## ✅ 最佳实践

- **优先用环境变量统一管理模型**：建议在 `.env` 里配置 `OPENAI_API_BASE / OPENAI_API_KEY / OPENAI_MODEL_NAME`，业务代码里尽量不硬编码 `model_name`，只在需要覆盖时传参（例如某个用例强制使用视觉模型）。
- **控制单次意图的复杂度**：将长流程拆成多个 `agent.step(...)`，每个 step 最好可在 3–8 步内完成，避免大模型在复杂页面里探索过久导致 Token 暴涨。
- **意图里明确“完成条件”**：在意图末尾明确写清楚“完成后必须返回 done”，能显著减少模型在任务已完成后继续尝试的概率。
- **默认关闭视觉，按需开启**：`use_vision=False` 通常更省 Token；只有遇到复杂组件（卡片、表格、浮层、多列布局、动态列表）或 DOM 信息不足时再启用 `use_vision=True`，或使用 `auto_vision=True` 让框架自行兜底切换。
- **充分利用缓存回放机制**：同一条稳定意图跑通一次后会写入本地缓存，后续回归优先命中回放实现 0 Token；当 UI 变更导致回放失败时才会唤醒大模型重新探索。
- **减少无效点击与遮挡问题**：遇到 “intercepts pointer events” 或遮挡浮层时，优先在意图里加入“先关闭弹窗/遮罩/引导层”或“滚动到可见区域后再点击”的描述；必要时拆分成“关闭干扰 → 再点击目标”两步意图。
- **排查问题的推荐方式**：优先用 `--headless` 跑回归；复现问题时切换为有头模式并打开日志（`logs/`）观察每一步的目标元素与 Token 消耗；如果页面频繁改版，清理缓存后重新跑一次以生成新的稳定路径。

## 🛠️ 使用示例

您可以将 `ai_tester` 作为一个常规的 Python 包，在任何业务测试中灵活调用。

### 场景一：混合编程（0 Token 高速回放 + AI 自愈兜底）

在日常回归测试中，为了追求极致速度，我们依然可以使用传统选择器（或让大模型执行过一次产生的缓存）。当选择器因前端重构而失效时，再让 AI 兜底自愈。

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer

def test_login_with_healing(page):
    driver = PlaywrightDriver(page)
    # 推荐在 .env 中设置 OPENAI_MODEL_NAME，这里不强行写死模型
    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)
    healer = SelfHealer(use_vision=True)

    broken_selector = "#old-login-btn"
    
    try:
        # 1. 尝试极速的传统执行 (0 Token, 毫秒级)
        page.click(broken_selector, timeout=2000)
    except Exception:
        # 2. 如果因为 UI 变更报错，触发 AI 元素自愈
        current_dom = agent.get_dom_tree_str()
        screenshot = driver.get_screenshot()
        
        # 告诉 AI 那个失效的按钮是干什么用的
        new_id_or_selector = healer.heal(broken_selector, "登录提交按钮", current_dom, screenshot)
        
        # 使用 AI 找到的新目标继续执行测试！
        driver.perform_action("click", new_id_or_selector)
```

### 场景二：完全意图驱动与代码自动回写

彻底抛弃定位器，用人类语言测试页面。跑通一次后，框架自动帮你把测试代码写好！

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter

def test_search_feature(page):
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)
    asserter = SmartAsserter(use_vision=True)
    
    page.goto("https://example.com")
    
    # 意图驱动执行多步操作。
    # 💡 魔法时刻：当这行代码成功运行一次后，它会被自动注释掉，
    # 并在下方自动生成原生的 page.fill 和 page.click 代码！
    agent.step("在顶部搜索框输入 'iPhone 15'，然后按下回车键，结束后返回 done")
    
    # 语义化多模态断言
    current_dom = agent.get_dom_tree_str()
    screenshot = driver.get_screenshot()
    is_passed = asserter.evaluate(
        current_dom, 
        "页面跳转到了搜索结果，并且展示了多款 iPhone 15 的商品列表",
        screenshot
    )
    assert is_passed is True
```

### 场景三：智能数据提取 (Data Extractor)

除了动作和断言，AI 还能作为您的“智能爬虫”和“表格读取器”，直接将复杂的页面转化为结构化的 JSON 数据。

```python
from ai_tester import PlaywrightDriver, DataExtractor

def test_data_extractor(page):
    driver = PlaywrightDriver(page)
    page.goto("https://practicetestautomation.com/practice-test-login/")
    
    # 使用 use_vision=True 获取更精准的结构化提取能力
    extractor = DataExtractor(driver, use_vision=True)
    
    # 通过自然语言提取页面上的账号和密码提示信息
    query = "提取页面上提示的 Test username 和 Test password，返回格式: {\"username\": \"...\", \"password\": \"...\"}"
    data = extractor.extract(query)
    
    assert data.get("username") == "student"
```

### 场景四：从需求文档 (PRD) 直接生成测试代码

```python
from ai_tester import TestCaseGenerator

generator = TestCaseGenerator()

prd_text = """
功能：用户注册
场景：输入正确的用户名和符合规则的密码，点击注册按钮。
预期：页面提示注册成功并跳转到用户中心。
"""

# 直接生成可执行的 pytest 脚本文件
generator.generate_from_prd(prd_text, "tests/test_auto_register.py")
```

---

## 🤝 贡献与支持

欢迎提交 Issue 和 Pull Request 来共同完善这个项目！
如果您觉得这个框架对您有启发，欢迎给本项目点个 ⭐️ **Star**！

## 📄 License

[MIT License](LICENSE) © 2026 Your Name
