<div align="center">

# 🤖 AI Web Tester

**基于大模型驱动的新一代 Web 自动化测试工作台**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*让 AI 接管脆弱的 CSS 选择器，用自然语言意图驱动你的端到端 (E2E) 测试。*

[English Documentation](README_EN.md) · [核心特性](#-核心特性) · [快速开始](#-快速开始) · [架构设计](#-架构设计) · [工作流演示](#-工作流演示)

</div>

---

## 💡 为什么需要 AI Web Tester？

在传统的 Web UI 自动化测试（如 Selenium, 原生 Playwright）中，我们通常面临两大痛点：
1. **编写成本高**：需要频繁查看控制台、找元素，手动编写维护复杂的 XPath 或 CSS Selector。
2. **脚本极其脆弱**：前端 UI 的一次小重构（甚至只是改了 Tailwind 的 ClassName），就会导致大面积的 `NoSuchElementException`，维护成本极高。

**AI Web Tester** 是一个 **B/S 架构** 的现代化测试工作台。它引入了视觉大模型 (如 GPT-4o, Claude 3.5, DeepSeek 等) 作为“大脑”，实现了从 **“找元素”向“表达意图”** 的测试范式跃迁。

---

## ✨ 核心特性

- 🎮 **现代化的 Web 控制台**：零配置的 React 前端面板。支持用例管理、多环境配置、可视化拖拽编排测试步骤。
- 🗣️ **意图驱动 (Intent-Driven)**：你可以直接在编辑器中输入“点击右上角的登录按钮”或“在搜索框输入 iPhone”，无需手写任何选择器。
- 🚑 **AI 智能自愈引擎 (Self-Healing)**：这是框架的杀手锏。当原本录制的 CSS 选择器因为页面重构失效时，底层会自动拦截异常，并截取当前页面 DOM 与画面发送给大模型。AI 会根据你的“意图描述”重新寻找元素，并继续执行测试。**测试不再中断！**
- 🛡️ **自愈选择器评分与审核回写**：AI 自愈时会为候选选择器进行稳定性打分（优先采用 `data-testid` / `role` / `aria` 等）。高分选择器可写入本地缓存；在 Web 端可进入 **自愈审计大盘**，对比“自愈前/后”截图并一键 **批准更新** 将 selector 写回用例（支持原 selector 为空时按意图定位步骤）。
- 🔎 **Token 成本可视化**：所有大模型调用统一统计 Token 消耗；在运行记录/套件汇总/自愈事件/修复建议/NL2Case 等入口展示明细与总计。
- 🧰 **失败用例修复建议**：失败后可生成 AI 修复建议（根因解释 + 可执行的 patched_steps），并支持一键应用到用例。
- 📦 **测试套件与执行计划 (Test Suites)**：支持将用例组装为 Suite 批量运行。可指定全局的“前置登录用例”（通过注入 Browser Context 共享状态），一次登录，全套件复用。
- 📺 **实时监控与运行历史**：套件执行时，控制台右侧会**实时播放测试画面**和执行日志。每次运行的截帧、步骤耗时、Token 与日志均会落盘，方便随时回放审计。
- 🧩 **Chrome 录制插件伴侣**：配合专属浏览器插件，在真实网页上点一点即可录制操作步骤，用例会自动同步到 Web 控制台。
- ⚡ **丰富的交互能力支持**：支持 `click`, `input`, `wait`, `hover`, `select_option`, `press_key`, `scroll` (支持局部容器滚动) 以及多种 `assert` (断言) 动作。

---

## 📦 架构设计

本项目采用前后端分离设计：

```text
ai-web-tester/
├── src/ai_tester/              # 🐍 底层 Python 驱动与自愈引擎
│   ├── agent.py                # AI 探索与意图理解引擎
│   ├── healer.py               # AI 元素自愈引擎 (含评分机制与回写)
│   ├── driver.py               # Playwright 动作封装
│   └── inject/                 # JS 注入脚本：DOM 降维压缩提权
├── web_server/                 # 🚀 Web 后端 (FastAPI)
│   └── app.py                  # API、WebSocket 日志/截图实时推送、子进程调度
├── frontend/                   # 💻 Web 前端控制台 (React + Tailwind)
│   └── src/App.tsx             # 核心视图：用例大厅、运行回放、自愈审核
├── extension/                  # 🧩 Chrome 录制插件
├── tests/                      # 数据落盘目录 (自动生成)
│   ├── recorded_cases/         # 用例 JSON 库
│   ├── run_history/            # 单用例运行产物 (日志、截图、元数据、token_usage)（默认不入库）
│   └── suite_history/          # 套件运行产物（默认不入库）
└── ROADMAP.md                  # 开发演进路线
```

---

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装 **Python 3.8+** 和 **Node.js**。

克隆仓库后，配置 Python 虚拟环境并安装底层依赖：

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r web_server/requirements.txt
playwright install chromium
```

### 2. 配置大模型 API Key

复制配置模板并填入您的 LLM 信息（原生兼容所有支持 OpenAI API 格式的模型）：

```bash
cp .env.example .env
```

```env
# .env 示例 (以 GitHub Models 为例)
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
OPENAI_MODEL_NAME=gpt-4o
```
*(推荐使用多模态能力较强的模型，如 `gpt-4o`, `Claude 3.5 Sonnet`)*

### 3. 启动服务

**启动后端 (FastAPI)**：
```bash
# 确保在 venv 激活状态下
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

**启动前端 (React)**：
```bash
# 新开一个终端窗口
cd frontend
npm install
npm run dev
```

打开浏览器访问 `http://127.0.0.1:5173/`，即可进入 Web 控制台。

### 4. 配合 Chrome 插件使用 (可选但推荐)

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本项目的 `extension/` 目录
4. 在您需要测试的网页上点击插件图标即可开始录制操作，录制产物会自动发往 Web 控制台。

---

## 🎥 工作流演示

1. **创建/录制用例**：通过插件录制或在 Web 端手写步骤。每个步骤可以只有一个“自然语言意图”（如 `点击登录`），不需要填 `selector`。
2. **首次运行 (探索与自愈)**：点击运行，底层 `ai_tester` 引擎发现选择器缺失/失效，会唤醒大模型扫描当前页面，返回候选元素并给出稳定性评分，同时记录 Token 消耗。
3. **极速回归**：第二次运行该用例时，引擎会优先命中本地缓存的 selector 执行操作，通常 **0 Token** 或极低 Token。
4. **UI 变更触发自愈**：某天前端改版了，旧 selector 失效。执行到该步骤时引擎拦截到报错，再次唤醒大模型完成自愈并继续执行。
5. **自愈审计与回写**：在 Web 端的自愈审计大盘中查看“自愈前/后截图对比（支持放大查看）”，确认无误后可一键 **批准更新** 写回用例 steps.selector（支持原 selector 为空时按意图定位步骤）。
6. **失败修复建议**：如果运行失败，可生成 AI 修复建议（根因解释 + patched_steps），并一键应用到用例。

---

## 👏 致谢 (Acknowledgments)

本项目在开发过程中，其 DOM 脱水压缩提取思想、提示词设计和多模态视觉元素定位的灵感，部分借鉴或参考了开源社区优秀的同行者，特此致谢：
- [**browser-use**](https://github.com/browser-use/browser-use) 
- [**alibaba/page-agent**](https://github.com/alibaba/page-agent)

---

## 🤝 贡献与支持

欢迎提交 Issue 和 Pull Request 来共同完善这个项目！
如果您觉得这个框架对您有启发，欢迎给本项目点个 ⭐️ **Star**！

[MIT License](LICENSE) © 2026 RockChe
