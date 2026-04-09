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
- 🚑 **底层元素自愈 (Self-Healing)**：完美兼容现有传统脚本。当原本写死的 CSS 选择器失效时，拦截错误并触发大模型“看懂”当前页面，自动找到新的元素位置继续执行，测试不再中断！
- 📝 **PRD 到代码全自动生成 (Test Generation)**：传入一段自然语言的产品需求文档 (PRD)，框架自动输出带有 Playwright 和 AI 驱动的 pytest 规范脚本。
- 🧠 **语义智能断言 (Smart Assertion)**：告别死板的 `assert "success" in text`。使用 `asserter.evaluate(dom, "用户已成功登录且看到了欢迎横幅")`。
- ⚡ **Token 极致压缩 (Accessibility Tree)**：内置底层的 JS 注入引擎，过滤无效标签与不可见元素，将上百 KB 的 HTML 压缩为精简的“交互无障碍树”，Token 消耗降低 **90%**，响应快且成本极低！
- 📊 **现代化的测试报告与日志**：零配置自动生成基于 Tailwind CSS 的美观 HTML 测试报告，并自带详细的中文执行轨迹日志。

---

## 📦 架构设计

```text
ai-web-tester/
├── src/
│   └── ai_tester/
│       ├── agent.py            # 🧠 AI 大脑：负责分析页面意图和自主探索执行 (ReAct 模式)
│       ├── healer.py           # 🚑 元素自愈引擎：传统脚本失效时的守护者
│       ├── asserter.py         # 🔍 智能断言引擎：评估页面语义状态
│       ├── generator.py        # ⚙️ 测试生成器：读取 PRD 并输出 pytest 代码
│       ├── driver.py           # 🚗 驱动层：封装 Playwright 动作
│       ├── logger.py           # 📝 格式化全中文日志模块
│       ├── pytest_plugin.py    # 📊 HTML 测试报告与 Pytest Hook
│       └── inject/
│           └── extract_elements.js  # 🚀 核心：注入浏览器端，提取高压缩率的语义交互树
├── tests/
│   ├── test_demo.py            # 示例：混合编程测试（意图执行 + 智能断言 + 元素自愈）
│   └── generate_test.py        # 示例：根据需求自动生成代码
├── docs/                       # 自动生成的 HTML 报告存放处
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

我们准备了两个综合演示脚本：

- **执行混合测试**: 展示了如何进行“意图操作”、“智能断言”以及“元素自愈”。
  ```bash
  pytest tests/test_demo.py -s
  ```

- **测试代码生成**: 读取一份模拟的 PRD，让 AI 自动生成 Python 测试代码。
  ```bash
  python3 tests/generate_test.py
  ```

运行结束后，您可以打开自动生成的 `docs/test_report.html` 查看精美的测试报告，或者在 `logs/` 目录下查看 AI 每一步决策的详细日志。

---

## 🛠️ 使用示例

您可以将 `ai_tester` 作为一个常规的 Python 包，在任何业务测试中灵活调用。

### 场景一：混合编程（传统性能 + AI 鲁棒性）

在日常回归测试中，为了追求极致速度，我们依然可以使用传统选择器。当选择器因前端重构而失效时，再让 AI 兜底自愈。

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer

def test_login_with_healing(page):
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="gpt-4o-mini")
    healer = SelfHealer(model_name="gpt-4o-mini")

    broken_selector = "#old-login-btn"
    
    try:
        # 1. 尝试极速的传统执行
        page.click(broken_selector, timeout=2000)
    except Exception:
        # 2. 如果因为 UI 变更报错，触发 AI 元素自愈
        current_dom = agent.get_dom_tree_str()
        
        # 告诉 AI 那个失效的按钮是干什么用的
        new_id = healer.heal(broken_selector, "The login submit button", current_dom)
        
        # 使用 AI 找到的新 ID 继续执行测试！
        driver.perform_action("click", new_id)
```

### 场景二：完全意图驱动与智能断言

彻底抛弃定位器，用人类语言测试页面。

```python
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter

def test_search_feature(page):
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="gpt-4o")
    asserter = SmartAsserter(model_name="gpt-4o")
    
    page.goto("https://example.com")
    
    # 意图驱动执行多步操作
    agent.step("在顶部搜索框输入 'iPhone 15'，然后按下回车键")
    
    # 语义化断言
    is_passed = asserter.evaluate(
        agent.get_dom_tree_str(), 
        "页面跳转到了搜索结果，并且展示了多款 iPhone 15 的商品列表"
    )
    assert is_passed is True
```

### 场景三：从需求文档 (PRD) 直接生成测试代码

```python
from ai_tester import TestCaseGenerator

generator = TestCaseGenerator(model_name="gpt-4o")

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
