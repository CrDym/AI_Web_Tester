<div align="center">

# 🤖 AI Web Tester

**基于大模型驱动的新一代 Web 自动化测试工作台**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*让 AI 接管脆弱的 CSS 选择器，用自然语言意图驱动你的端到端 (E2E) 测试。*

[English Documentation](README_EN.md) · [核心特性](#-核心特性) · [快速开始](#-快速开始) · [控制台导览](#-控制台功能导览) · [API 概览](#-api-概览) · [架构设计](#-架构设计)

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
- 🧭 **探索模式（新页面跑通 → 生成用例）**：针对全新页面/全新流程，AI 先基于“可交互元素清单”探索跑通并生成 steps（含 selector 与 intent），后续用例进入稳定回归链路。
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
│   ├── healer.py               # AI 元素自愈引擎 (含评分与自愈事件上报)
│   ├── driver.py               # Playwright 动作封装
│   └── inject/                 # JS 注入脚本：DOM 降维压缩提权
├── web_server/                 # 🚀 Web 后端 (FastAPI)
│   ├── app.py                  # API、WebSocket 日志/截图实时推送、子进程调度
│   └── database.py             # SQLite 数据库模型定义
├── frontend/                   # 💻 Web 前端控制台 (React + Tailwind)
│   └── src/App.tsx             # 核心视图：SOLO TEST 极客控制台、运行回放、自愈审核
├── extension/                  # 🧩 Chrome 录制插件
├── tests/                      # 数据落盘目录 (自动生成)
│   ├── tester.db               # SQLite 数据库，持久化存储 Cases, Runs, Suites
│   ├── recorded_cases/         # 用例 JSON 备份库 (.bak 文件)
│   ├── run_history/            # 单用例运行产物 (日志、截图、元数据、token_usage)
│   └── suite_history/          # 套件运行产物
└── ROADMAP.md                  # 开发演进路线
```

---

## 🧠 核心概念

- **用例（Case）**：包含起始 URL + steps（动作序列）。持久化存储在 `tests/tester.db`，并支持 **.bak 备份一键恢复**。
- **步骤（Step）**：单个动作（click/input/assert...），推荐以 `intent` 描述“你想做什么”，`selector` 可为空。
- **运行（Run）**：一次用例执行的结果与产物，支持回放与审计。
- **自愈（Heal）**：当 selector 失效/缺失时，引擎用 DOM（可选截图）+ intent 调用大模型寻找候选定位并继续执行。
- **审计与回写（Approve）**：自愈结果不会自动写入用例；在 Web 控制台里对比自愈前/后截图后，一键“批准更新”写回 DB。
- **探索（Explore）**：用于全新页面的“先跑通再固化”。探索阶段以编号元素清单为输入，显著减少大模型上下文；跑通后生成可回归用例。
- **套件（Suite）**：多个用例按顺序组成的执行计划，可选前置用例（setup_case）用于登录等准备动作。
- **Token 统计**：所有大模型调用统一记录 token_usage，在运行记录、套件汇总、自愈事件、修复建议等处展示，便于成本核算。

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装 **Python 3.8+** 和 **Node.js 18+**。

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

## 🧾 用例与套件格式

### 用例 JSON（Case）

用例默认保存在 `tests/recorded_cases/*.json`。基本结构：

```json
{
  "id": "登录.json",
  "name": "登录",
  "start_url": "https://example.com/login",
  "steps": [
    { "type": "input", "selector": "", "value": "admin", "intent": "在用户名输入框输入账号" },
    { "type": "input", "selector": "", "value": "123456", "intent": "在密码输入框输入密码" },
    { "type": "click", "selector": "", "intent": "点击登录按钮" },
    { "type": "assert", "assert_type": "text", "value": "登录成功", "intent": "页面提示登录成功" }
  ]
}
```

字段说明：
- `type`：`click` / `input` / `wait` / `assert` / `hover` / `select_option` / `press_key` / `scroll` / `double_click` / `right_click`
- `selector`：可为空。为空或失效时，会触发自愈（基于 `intent` 重新定位）
- `intent`：推荐必填。越具体越稳定（例如“弹窗底部的确认按钮”比“确认按钮”更稳）
- `value`：`input` 时为输入内容；`wait` 时为毫秒字符串；`assert` 时为断言目标文本/URL片段等
- `assert_type`：`text` / `url` / `visible`

### 套件 JSON（Suite）

套件默认保存在 `tests/suites/*.json`：

```json
{
  "id": "登录链路.json",
  "name": "登录链路",
  "env_id": null,
  "setup_case_id": "登录.json",
  "case_ids": ["登录.json", "授权.json"]
}
```

---

## 💾 数据目录与忽略规则（很重要）

`tests/` 是运行时数据目录，通常包含业务用例与运行产物，默认不会提交到仓库：
- `tests/recorded_cases/`：用例库（建议仅在公司内部仓库存放）
- `tests/run_history/`：单次运行产物（meta.json、screenshots、token_usage.json）
- `tests/suite_history/`：套件运行产物（meta.json、storage_state.json）

仓库已在 `.gitignore` 中忽略 `tests/`，避免误提交公司项目数据。

## 🎥 工作流演示

1. **创建/录制用例**：通过插件录制或在 Web 端手写步骤。每个步骤可以只有一个“自然语言意图”（如 `点击登录`），不需要填 `selector`。
2. **首次运行 (探索与自愈)**：点击运行，底层 `ai_tester` 引擎发现选择器缺失/失效，会唤醒大模型扫描当前页面，返回候选元素并给出稳定性评分，同时记录 Token 消耗。
3. **极速回归**：第二次运行该用例时，引擎会优先命中本地缓存的 selector 执行操作，通常 **0 Token** 或极低 Token。
4. **UI 变更触发自愈**：某天前端改版了，旧 selector 失效。执行到该步骤时引擎拦截到报错，再次唤醒大模型完成自愈并继续执行。
5. **自愈审计与回写**：在 Web 端的自愈审计大盘中查看“自愈前/后截图对比（支持放大查看）”，确认无误后可一键 **批准更新** 写回用例 steps.selector（支持原 selector 为空时按意图定位步骤）。
6. **失败修复建议**：如果运行失败，可生成 AI 修复建议（根因解释 + patched_steps），并一键应用到用例。

---

## 🧭 控制台功能导览

控制台是你日常工作的主入口，常用模块如下：

### 用例大厅

- **用例列表**：按名称/ID 搜索、按标签筛选与管理（标签用于组织业务用例）
- **探索列表**：展示探索模式的运行记录（running/completed/failed），便于随时回看探索过程与截图
- **用例创建**：
  - 新建空白用例（手工编排 steps）
  - NL2Case：输入自然语言指令生成 steps（selector 初始可为空）
  - 探索模式：输入目标（Goal）与成功标志（可选），AI 自动探索跑通并生成可回归用例
- **运行历史**：展示该用例的单次运行记录，包含状态、耗时、Token；点击可进入回放

### 用例编辑器

- **步骤编辑**：维护 `type/selector/intent/value/assert_type` 等字段
- **脚本视图**：查看后端动态生成的 pytest 脚本（用于排错与 CI 集成）
- **保存/回滚**：保存用例 JSON 到本地数据目录（`tests/recorded_cases/`）

### 运行与实时监控

- **单用例运行**：一键执行；右侧实时输出日志与当前截图
- **中止运行**：必要时停止 WebSocket 监控（不会自动回写任何 selector）

### 回放与审计

- **截图回放**：按时间轴查看本次运行截帧
- **自愈记录**：展示每次自愈的 intent、旧/新 selector、评分原因、Token
- **自愈审计大盘**：双屏对比“自愈前/后截图”（支持点击放大查看），确认无误后点 **批准更新** 写回用例 steps.selector
- **Token 明细**：展示本次运行内所有 LLM 调用的 token_usage 列表与汇总
- **失败修复建议**：失败后可生成 AI 修复建议，并支持一键应用到用例（patched_steps）

### 套件（Suite）与执行计划

- **套件管理**：创建套件、维护 case_ids 顺序、设置可选前置用例（setup_case）
- **套件运行**：串行执行全部用例；失败继续跑；提供 suite 级别通过/失败/自愈/Token 汇总
- **用例明细**：列出每个 case 的耗时、自愈次数、Token、状态，并可跳转到单个 run 回放

### 设置与环境

- **模型配置**：配置 `OPENAI_API_BASE / OPENAI_API_KEY / OPENAI_MODEL_NAME`，并提供连通性测试
- **环境列表**：管理 base_url 环境并在运行时切换（用于一套用例跑多套部署环境）

---

## 🌐 API 概览

后端默认监听 `http://127.0.0.1:8000`，前端通过同源代理调用（开发环境可直接访问）。

### 业务 API（建议使用）

| 模块 | 方法 | 路由 | 说明 |
|---|---|---|---|
| 配置 | GET | `/api/config` | 获取当前模型配置（从 `.env` 读取） |
| 配置 | POST | `/api/config` | 保存模型配置（写入 `.env`） |
| 配置 | POST | `/api/config/test` | 测试模型连通性（返回延迟与 token_usage） |
| 环境 | GET | `/api/environments` | 获取环境列表（base_url） |
| 环境 | POST | `/api/environments` | 保存环境列表 |
| 用例 | GET | `/api/cases` | 列出用例（`tests/recorded_cases/`） |
| 用例 | POST | `/api/cases` | 新建用例 |
| 用例 | GET | `/api/cases/{case_id}` | 获取用例详情 |
| 用例 | PUT | `/api/cases/{case_id}` | 更新用例 |
| 用例 | DELETE | `/api/cases/{case_id}` | 删除用例 |
| 用例 | POST | `/api/cases/{case_id}/rename` | 重命名用例 |
| 用例 | POST | `/api/cases/generate` | NL2Case：自然语言生成 steps（返回 token_usage） |
| 探索 | POST | `/api/explore` | 探索模式：跑通新页面流程并自动生成用例（完成后可在 run 详情中拿到 generated_case_id） |
| 自愈 | POST | `/api/cases/{case_id}/heal/approve` | 审计通过后写回 selector（支持 old_selector 为空时按 intent 定位步骤） |
| 脚本 | GET | `/api/cases/{case_id}/script` | 查看动态生成的 pytest 脚本 |
| 运行 | POST | `/api/run/{case_id}` | 启动单用例运行（返回 run_id/session_id） |
| 运行 | GET | `/api/runs?case_id=...` | 列出运行记录 |
| 运行 | GET | `/api/runs/{run_id}` | 获取运行详情（logs、screenshots、heal_events、token_summary 等） |
| 运行 | DELETE | `/api/runs/{run_id}` | 删除运行记录 |
| 运行 | GET | `/api/runs/{run_id}/screenshots/{filename}` | 获取某张截图（base64） |
| 修复建议 | POST | `/api/runs/{run_id}/ai_fix_suggest` | 生成失败用例修复建议（返回 token_usage） |
| 套件 | GET | `/api/suites` | 列出套件 |
| 套件 | POST | `/api/suites` | 新建套件 |
| 套件 | GET | `/api/suites/{suite_id}` | 获取套件详情 |
| 套件 | PUT | `/api/suites/{suite_id}` | 更新套件 |
| 套件 | DELETE | `/api/suites/{suite_id}` | 删除套件 |
| 套件运行 | POST | `/api/suites/{suite_id}/run` | 启动套件运行 |
| 套件运行 | GET | `/api/suite_runs` | 列出套件运行记录 |
| 套件运行 | GET | `/api/suite_runs/{suite_run_id}` | 获取套件运行详情（items、summary、token 汇总） |
| 套件运行 | DELETE | `/api/suite_runs/{suite_run_id}` | 删除套件运行记录 |

### WebSocket

- `ws://127.0.0.1:8000/ws/run/{session_id}`：运行实时日志与截图推送

### 内部接口（不建议外部调用）

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/internal/push_screenshot/{session_id}` | 引擎向服务端推送截图（供 WS 广播与落盘） |
| POST | `/api/internal/push_heal_event/{session_id}` | 引擎向服务端推送自愈事件（供前端审计与落盘） |

## ❓ 常见问题

## ⚙️ 配置项与环境变量

### `.env`（模型配置）

项目根目录 `.env` 主要包含：

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=xxxx
OPENAI_MODEL_NAME=gpt-4o-mini
```

说明：
- 只要你的模型服务兼容 OpenAI API 形式即可使用（本项目通过 LangChain 的 ChatOpenAI 适配）
- 也可以直接在 Web 控制台的“设置”里填写，服务端会写入 `.env`

### 运行相关环境变量（可选）

| 变量 | 示例 | 说明 |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `1` | 无头运行（1=无头，0/不设=有头） |
| `AI_TESTER_STORAGE_STATE_PATH` | `tests/suite_history/<suite_run_id>/storage_state.json` | 套件运行时共享登录态（storageState） |
| `AI_TESTER_RUN_DIR` | `logs/runs/20260415_120000/` | pytest 插件生成 HTML 报告与失败截图的输出目录 |

---

## 🧩 Chrome 插件录制指南

插件目录在 `extension/`，用于把你在页面上的点击/输入转成 steps，并提示你补充每一步的 intent。

推荐工作方式：
1. 安装插件：Chrome → `chrome://extensions/` → 开发者模式 → 加载已解压 → 选择 `extension/`
2. 打开待测系统页面，点击插件开始录制
3. 每执行一步操作，按提示填写该步骤的 intent（越具体越稳）
4. 停止录制后，产物会同步到 Web 控制台（你可以再在编辑器里补充/调整 steps）

---

## 🏃 命令行 / CI 运行建议

控制台运行本质上是“动态生成 pytest 脚本并执行”。如果你要在 CI 里跑，建议采用：
- 由控制台维护用例 JSON（公司内部仓库/私有目录）
- 在 CI 里拉取代码 + 注入 `.env` + 提供 `tests/recorded_cases/` 数据目录

核心命令：

```bash
pip install -r web_server/requirements.txt
playwright install chromium
python3 -m uvicorn web_server.app:app --host 127.0.0.1 --port 8000
```

然后通过 API 触发套件运行（推荐）：

```bash
curl -X POST "http://127.0.0.1:8000/api/suites/<suite_id>/run"
```

### 1) 运行时报 Playwright 浏览器未安装

```bash

```bash
playwright install chromium
```

### 2) 控制台提示未配置 OPENAI_API_KEY

- 方式 A：在项目根目录创建 `.env`（推荐）
- 方式 B：在 Web 控制台“设置”里配置（会写入 `.env`）

### 3) 自愈后“看起来成功但其实点错了”

- 检查该步骤 selector 是否过于宽泛（例如 `button`），这类 selector 可能点击到页面第一个按钮。
- 推荐在“自愈审计大盘”里对比截图后再批准回写，必要时将 intent 写得更具体。

### 4) 如何控制无头模式

- 后端运行 pytest 时会读取 `PLAYWRIGHT_HEADLESS=1` 控制无头执行（默认开启无头）。

---

## 🔐 安全建议

- 不要提交 `.env`、`tests/`、运行日志与截图产物。
- 如果曾经误推送包含敏感信息的文件，即使重写历史也建议按公司流程处理（例如轮换密钥、通知相关方）。

## 👏 致谢 (Acknowledgments)

本项目在开发过程中，其 DOM 脱水压缩提取思想、提示词设计和多模态视觉元素定位的灵感，部分借鉴或参考了开源社区优秀的同行者，特此致谢：
- [**browser-use**](https://github.com/browser-use/browser-use) 
- [**alibaba/page-agent**](https://github.com/alibaba/page-agent)

---

## 🤝 贡献与支持

欢迎提交 Issue 和 Pull Request 来共同完善这个项目！
如果您觉得这个框架对您有启发，欢迎给本项目点个 ⭐️ **Star**！

[MIT License](LICENSE) © 2026 RockChe
