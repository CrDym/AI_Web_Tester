# 开发指南

## 本地启动

后端：

```bash
source venv/bin/activate
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

默认访问地址是 `http://127.0.0.1:5173/`。开发环境下，Vite 会把 `/api` 和 `/ws` 代理到后端。

## 模型配置

项目根目录 `.env`：

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=xxxx
OPENAI_MODEL_NAME=gpt-4o-mini
```

也可以在 Web 控制台“设置”里配置。服务端会保留已有 `OPENAI_API_KEY`，避免只修改 Base URL 或模型名时误清空密钥。

## 运行时环境变量

| 变量 | 示例 | 说明 |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `1` | 无头运行，`1` 表示无头 |
| `AI_TESTER_DB_PATH` | `/tmp/ai-web-tester/tester.db` | 覆盖 SQLite 数据库路径，适合测试、CI 或多环境隔离 |
| `AI_TESTER_PROMPTS_DIR` | `/tmp/ai-web-tester/prompts` | 覆盖提示词目录，避免测试改写真正提示词文件 |
| `AI_TESTER_RUN_TIMEOUT_SECONDS` | `1800` | 单用例运行超时时间 |
| `AI_TESTER_RECORDER_TOKEN` | `recorder-secret` | Chrome 录制器同步接口的可选 token |
| `AI_TESTER_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | 允许的 CORS 来源，逗号分隔 |
| `AI_TESTER_STORAGE_STATE_PATH` | `tests/suite_history/<suite_run_id>/storage_state.json` | 套件共享登录态 |
| `AI_TESTER_RUN_DIR` | `logs/runs/20260415_120000/` | pytest 插件报告与截图输出目录 |

前端代理变量：

| 变量 | 示例 | 说明 |
|---|---|---|
| `VITE_API_TARGET` | `http://127.0.0.1:8000` | Vite `/api` 代理目标 |
| `VITE_WS_TARGET` | `ws://127.0.0.1:8000` | Vite WebSocket 代理目标 |

## 数据目录

`tests/` 是运行时数据目录，默认被 `.gitignore` 忽略：

- `tests/tester.db`：SQLite 数据库，存储 cases、runs、suites 等元数据
- `tests/recorded_cases/`：用例备份，包含 `.bak`
- `tests/run_history/`：单用例运行产物，包括 meta、截图、token
- `tests/suite_history/`：套件运行产物，包括 meta 和 storage_state

## Chrome 插件

插件目录在 `extension/`。

1. 打开 Chrome 的 `chrome://extensions/`
2. 开启开发者模式
3. 加载 `extension/`
4. 在待测页面开始录制
5. 停止录制后，插件会同步到 Web 控制台；如果后端不可用，会下载 JSON 兜底

## CI 建议

控制台运行本质是动态生成 pytest 脚本并执行。CI 可以：

1. 安装 Python/Node/Playwright 依赖
2. 注入 `.env`
3. 挂载或准备 `tests/tester.db`
4. 启动后端
5. 通过 API 触发套件运行

```bash
curl -X POST "http://127.0.0.1:8000/api/suites/<suite_id>/run"
```
