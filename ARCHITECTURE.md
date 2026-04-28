# 项目架构说明 (Architecture)

本作是一个基于 Playwright 和 大语言模型 (LLM) 构建的**自愈式 Web 自动化测试平台**。
项目包含前端控制台、后端调度服务、浏览器录制插件以及核心的 AI 测试引擎。

## 目录结构

```text
.
├── frontend/             # 前端控制台 (React + Vite + TailwindCSS)
│   ├── src/              # 前端源码 (React 组件, 状态管理, WebSocket 客户端)
│   └── package.json      # 前端依赖
├── web_server/           # 后端调度服务 (Python + FastAPI)
│   ├── app.py            # 提供 REST API 与 WebSocket 实时日志/截图推送
│   └── requirements.txt  # 后端依赖
├── src/ai_tester/        # 🌟 核心引擎 (AI 自愈与执行层)
│   ├── driver.py         # Playwright 驱动封装 (处理 iframe, 滚动, 遮挡物消除等高级操作)
│   ├── healer.py         # AI 自愈引擎 (DOM + 可选截图, LLM 意图匹配, 自愈事件上报)
│   ├── inject/           # 注入到浏览器的 JS 脚本 (用于提取页面 DOM 树和交互元素)
│   └── agent.py          # (规划中) 高级自主测试 Agent
├── extension/            # Chrome 浏览器录制插件 (CRX)
│   ├── manifest.json     # 插件清单
│   └── src/              # 注入脚本，用于捕获用户的点击、输入并生成测试 JSON
├── tests/                # 用户数据目录 (持久化存储)
│   ├── tester.db         # SQLite 数据库：持久化存储 Cases / Runs / Suites
│   ├── recorded_cases/   # 用例备份目录（.bak）
│   ├── recorded_scripts/ # 运行时动态生成的 Python (Playwright) 脚本（默认不入库）
│   └── run_history/      # 每次测试执行的运行记录、日志和截图存档（默认不入库）
│   ├── suites/           # 套件（测试计划模板）：由多个 case_id 组成的有序集合
│   └── suite_history/    # 套件运行记录：一次套件执行的聚合报告（关联多个 run_id）（默认不入库）
├── docs/                 # 项目文档与规划设计
└── logs/                 # 引擎与后端的运行时日志（默认不入库）
```

## 核心组件交互链路

1. **用例创建 (两种方式)**
   - **手工录制**: 通过 `extension/` Chrome 插件，在页面上点击操作，插件会生成标准化 JSON 格式的测试步骤，并通过后端写入 SQLite（`tests/tester.db`）；同时会生成 `.bak` 备份到 `tests/recorded_cases/`。
   - **自然语言 (NL2Case)**: 在 `frontend/` 输入自然语言步骤，`web_server/` 调用 LLM 转换为标准化 JSON 步骤，但此时 `selector` 为空。

2. **用例执行与动态编译**
   - 用户在控制台点击运行，`web_server/app.py` 读取 JSON 用例，动态将其编译为可执行的 Playwright Python 脚本（运行时生成，默认不提交到仓库）。
   - 通过 `subprocess` 启动该脚本，并通过 WebSocket 将 stdout/stderr 日志和实时 base64 截图推送回前端展示。

3. **AI 自愈机制 (Self-Healing)**
   - 脚本执行过程中，所有动作交由 `src/ai_tester/driver.py` 路由。
   - 如果某个元素的 `selector` 找不到（页面改版，或者 NL2Case 生成的空 selector），捕获到异常后，引擎会触发 `src/ai_tester/healer.py`。
   - `healer` 提取当前页面的 DOM 树与截图，连同该步骤的 `intent` (操作意图) 一起发给 LLM。
   - LLM 返回新的目标元素 ID，引擎在当前页面完成操作。
   - 引擎会将自愈结果作为 `heal_events` 上报到 Web 控制台，并记录 Token 消耗；由用户在控制台中进行审计后，手工“批准更新”写回用例 steps.selector，避免误写入不稳定选择器。

4. **套件执行 (Suite Run)**
   - 套件定义保存在 `tests/suites/`，核心是 `case_ids`（按顺序串行运行）与统一的 `env_id`。
   - 套件可选配置 `setup_case_id`（前置用例），用于登录等准备动作；后端通过 Playwright storageState（cookie）在套件内共享会话。
   - 运行套件时，后端会为每个 case 创建独立的 run（生成 run_id），即使中途失败也继续执行后续 case。
   - 套件运行的聚合结果保存到 `tests/suite_history/`，并在前端展示通过/失败/自愈次数汇总。

5. **Token 统计**
   - 所有大模型调用会记录 Token 使用情况，并在单次运行记录与套件汇总中展示总计与明细，便于成本核算与优化。

## 技术栈
- **Frontend**: React 18, Vite, TailwindCSS, Lucide React, react-syntax-highlighter
- **Backend**: FastAPI, Uvicorn, LangChain
- **Testing Engine**: Playwright (Python)
- **AI Models**: 兼容 OpenAI 格式的视觉大模型 (如 GPT-4o, Claude 3.5 Sonnet 等)
