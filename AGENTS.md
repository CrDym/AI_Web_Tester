# SOLO 仓库协作指南

SOLO 是单团队使用的 Web 测试工作台。`extension/` 负责录制，`frontend/` 是 React 控制台，`web_server/` 提供 FastAPI 服务、生成回放脚本并调度运行，`src/ai_tester/` 执行浏览器操作和 AI 自愈。

## 启动与数据

- 收到启动或部署任务时，按部署手册检查现有进程、准备依赖并做只读验收。[中文手册](docs/agent-deploy.md) · [English runbook](docs/agent-deploy.en.md)
- `tests/tester.db`、`tests/recorded_cases/`、`tests/recorded_scripts/` 和 `tests/run_history/` 可能含真实用例、脚本、日志及截图。`_deleted/` 保存软删除的记录。测试写入使用临时数据库和运行目录，保留用户数据、账号和备份。
- `.env` 可含真实模型密钥。验证基础录制和回放时使用隔离配置及临时浏览器 profile，提交和日志中只使用测试数据。

## 按改动选择验收方式

以下命令从仓库根目录执行。

| 改动范围 | 验收命令 | 检查结果 |
| --- | --- | --- |
| 后端接口或运行调度 | `./venv/bin/python -m pytest web_server -q` | 查看 pytest 的通过数和失败项。 |
| 前端编辑逻辑或构建配置 | `(cd frontend && npm test && npm run lint && npm run build)` | 确认输出列出具名测试且有断言执行，lint 与生产构建通过。 |
| 录制、同步或回放 | `RECORDER_HEADLESS=0 ./venv/bin/python tools/recorder_e2e.py` | 在有图形桌面的环境运行。控制台运行状态应为 `completed`，测试页在回放阶段应再次收到点击和输入。 |

纯选择器回放应能在没有模型密钥时运行。涉及 AI 自愈的改动另行验证对应分支。只改文档时，核对引用路径和命令即可。

## 交付约定

- 保留现有工作台布局。涉及主观视觉改版时，先给用户看效果图，确认后再实现。
- 提交信息用中文，每次提交只包含本次任务的文件。完成后说明实际执行的检查、结果和未验证的范围。
- 如果本地已有 `PROGRESS.md`，收尾时更新已完成事项、验证结果和下一步。该文件是本地进度账本，保持其 Git 忽略状态。
