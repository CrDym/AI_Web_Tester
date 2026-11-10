<div align="center">

# AI Web Tester

**基于大模型驱动的新一代 Web 自动化测试工作台**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Playwright](https://img.shields.io/badge/Playwright-enabled-green.svg)](https://playwright.dev/python/)
[![LangChain](https://img.shields.io/badge/LangChain-powered-orange.svg)](https://python.langchain.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

让 AI 接管脆弱的 CSS 选择器，用自然语言意图驱动端到端测试。

[English](README_EN.md) · [快速开始](#快速开始) · [文档](#文档) · [验证](#验证)

</div>

---

## 为什么需要它

传统 Web UI 自动化通常有两个痛点：

1. 编写成本高：需要频繁找元素、写 selector、维护脚本。
2. 脚本脆弱：页面结构或样式稍有变化，就可能导致大面积失败。

AI Web Tester 把测试表达从“找元素”转向“表达意图”。你可以描述“点击右上角登录按钮”，系统在 selector 缺失或失效时，会结合 DOM、截图和意图触发 AI 自愈，并保留截图、日志、Token 与审计记录。

## 核心特性

- 现代化 Web 控制台：用例、套件、环境、Prompt、运行历史统一管理。
- 意图驱动步骤：步骤可只写 `intent`，selector 可为空。
- AI 自愈：selector 失效时自动寻找候选元素并继续执行。
- 自愈审计与回写：对比自愈前后截图后，可批准 selector 写回用例。
- Token 成本可视化：运行、自愈、修复建议、NL2Case 都记录 token_usage。
- AI 修复建议：失败后生成根因解释和可应用的 `patched_steps`。
- 套件执行：支持 setup case 共享登录态，串行执行并汇总结果。
- Chrome 录制插件：在真实页面录制操作并同步到控制台。
- 数据驱动：支持 `variables`、`dataset` 和 `${today_ymd}` 等内置变量。
- 排队可取消：运行队列以 pending 状态排队，支持在排队中直接取消、释放队列位。
- 断言可信：断言为语义可见断言（`.first + count + wait_for(visible)`），断言永不进入自愈，避免“断言被绕过”；输入数据以 Python 字面量（`repr`）安全序列化后内嵌生成脚本。

## 定位与边界

本工具面向**单团队内部使用**，使用前需了解信任边界：

- 登录用户可在本机执行服务端动态生成的 Python 测试脚本，等价于可信内网执行环境，不要直接暴露到公网。
- Chrome 录制器同步接口（`POST /api/recorder/cases`）默认未鉴权，仅靠可选的 `AI_TESTER_RECORDER_TOKEN` 校验，共享/生产环境请务必配置该 token。
- 自然语言/AI 修复建议生成的脚本在服务端编译执行，输入以 `repr` 安全序列化。

## 快速开始

### 1. 安装依赖

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r web_server/requirements.txt
playwright install chromium
```

### 2. 配置模型

```bash
cp .env.example .env
```

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=github_pat_xxxxxx
OPENAI_MODEL_NAME=gpt-4o
```

也可以在 Web 控制台的“设置”里配置，后端会写入 `.env`。

### 3. 启动服务

后端：

```bash
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。

### 4. Chrome 插件

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 加载 `extension/` 目录
4. 在待测页面点击插件开始录制，录制结果会同步到 Web 控制台

## 文档

- [开发指南](docs/development.md)：本地启动、环境变量、运行数据目录、Chrome 插件、CI 建议。
- [架构说明](docs/architecture.md)：前端 hooks/components 分层、后端 routes/runner 分层、数据流。
- [API 概览](docs/api.md)：auth、cases、runs、suites、config、prompts、internal 接口。
- [E2E 与验证](docs/e2e.md)：pytest、前端测试、生产构建、浏览器烟测。
- [安全说明](docs/security.md)：鉴权、CORS、密钥脱敏、路径校验、敏感数据处理。

## 验证

开发或重构后建议跑：

```bash
venv/bin/python -m pytest web_server/test_web_server_api.py web_server/test_runner.py web_server/test_suite_runner.py -q

cd frontend
npm test
npm run build
npm run e2e:smoke
```

`npm run e2e:smoke` 会启动隔离的临时前后端、临时数据库和临时提示词目录，覆盖注册/登录、设置保存、用例创建/保存、套件创建/维护等主链路。

当前后端测试共 30 个（`test_web_server_api.py` 22 / `test_runner.py` 5 / `test_suite_runner.py` 3），含生成脚本注入回归、断言自愈隔离、排队取消、运行超时与 stopped 终态不被覆盖、备份恢复完整性、鉴权拒绝等关键链路回归。

## 致谢

本项目在 DOM 脱水压缩、提示词设计和多模态视觉元素定位方面，参考了开源社区的优秀项目：

- [browser-use](https://github.com/browser-use/browser-use)
- [alibaba/page-agent](https://github.com/alibaba/page-agent)

## 贡献

欢迎提交 Issue 和 Pull Request。

[MIT License](LICENSE) © 2026 RockChe
