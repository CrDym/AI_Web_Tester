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

- `tests/tester.db`：SQLite 数据库，存储业务主数据（cases / suites / environments）
- `tests/recorded_cases/`：用例备份，包含 `.bak`
- `tests/run_history/<run_id>/meta.json`：单用例运行元数据（状态、日志、截图、token 等以文件系统为准）
- `tests/suite_history/`：套件运行产物，包括 meta 和 storage_state

> 说明：`database.py` 中定义的 `RunModel` / `SuiteRunModel` 为预留表结构（未启用）。运行记录以文件系统为准（`tests/run_history/<run_id>/meta.json`），SQLite 仅存业务主数据。

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
curl -X POST "http://127.0.0.1:8000/api/suites/<suite_id>/run" \
  -H "Authorization: Bearer <token>"
```

## 已知限制与信任边界

本平台为单团队内部测试工具，使用前需了解以下信任边界：

1. **内部工具信任模型**：登录用户可在本机执行服务端动态生成的 Python 测试脚本，等价于可信内网执行环境；不要在公网或不可信网络直接暴露后端。
2. **recorder 接口默认未鉴权**：`POST /api/recorder/cases` 不走登录 token，仅靠可选的 `AI_TESTER_RECORDER_TOKEN` 校验，默认不设置即放开。生产/共享环境请务必配置该 token。
3. **断言为语义可见断言**：文本/可见断言走 Playwright `.first + count + wait_for(visible)`，断言失败永不进入自愈，避免“断言被绕过”。
4. **生成脚本由服务端编译执行**：自然语言/AI 修复建议生成的脚本会在服务端编译并执行，输入数据以 Python 字面量（`repr`）安全序列化后内嵌。
5. **多 WS 连接策略**：同一 `session_id` 的新 WS 连接会覆盖旧注册但不主动关闭旧连接；运行结束时新连接会立即收到终态 `status` 消息。
