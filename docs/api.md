# API 概览

后端默认监听 `http://127.0.0.1:8000`。开发环境前端通过 Vite 代理访问。

## Auth

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/auth/setup` | 初始化本地用户 |
| POST | `/api/auth/login` | 登录并返回 token |
| GET | `/api/auth/me` | 获取当前用户 |

## Config / Environments / Prompts

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/config` | 获取模型配置，API key 会脱敏 |
| POST | `/api/config` | 保存模型配置 |
| POST | `/api/config/test` | 测试模型连通性 |
| GET | `/api/environments` | 获取环境列表 |
| POST | `/api/environments` | 保存环境列表 |
| GET | `/api/prompts` | 获取 Prompt 文本 |
| PUT | `/api/prompts/{filename}` | 更新 Prompt，并写备份 |

## Cases

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/cases` | 列出用例 |
| POST | `/api/cases` | 创建用例 |
| GET | `/api/cases/{case_id}` | 获取用例详情 |
| PUT | `/api/cases/{case_id}` | 更新用例 |
| DELETE | `/api/cases/{case_id}` | 删除用例，并清理套件引用 |
| POST | `/api/cases/{case_id}/rename` | 重命名用例 |
| POST | `/api/cases/{case_id}/restore` | 从 `.bak` 恢复上一版 |
| GET | `/api/cases/{case_id}/script` | 获取动态生成的 pytest 脚本 |
| POST | `/api/cases/batch_group` | 批量移动分组 |
| POST | `/api/cases/{case_id}/heal/approve` | 批准自愈 selector 写回 |

## Case Generation

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/cases/generate` | 自然语言生成单个用例 |
| POST | `/api/cases/import_nl/preview` | 批量自然语言导入预览 |
| POST | `/api/cases/import_nl/confirm` | 确认导入预览结果 |
| POST | `/api/recorder/cases` | Chrome 插件同步录制用例 |

## Runs

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/run/{case_id}` | 启动单用例运行 |
| GET | `/api/runs` | 列出运行记录，可传 `case_id` 或 `include_all` |
| GET | `/api/runs/{run_id}` | 获取运行详情 |
| POST | `/api/runs/{run_id}/stop` | 停止运行 |
| DELETE | `/api/runs/{run_id}` | 删除运行记录 |
| POST | `/api/runs/batch_delete` | 批量删除运行记录 |
| GET | `/api/runs/{run_id}/screenshots/{filename}` | 获取截图 base64 |
| POST | `/api/runs/{run_id}/ai_fix_suggest` | 生成失败修复建议 |

## Suites

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/suites` | 列出套件 |
| POST | `/api/suites` | 创建套件 |
| GET | `/api/suites/{suite_id}` | 获取套件详情 |
| PUT | `/api/suites/{suite_id}` | 更新套件 |
| DELETE | `/api/suites/{suite_id}` | 删除套件 |
| POST | `/api/suites/{suite_id}/run` | 启动套件运行 |
| GET | `/api/suite_runs` | 列出套件运行记录 |
| GET | `/api/suite_runs/{suite_run_id}` | 获取套件运行详情 |
| DELETE | `/api/suite_runs/{suite_run_id}` | 删除套件运行记录 |

## WebSocket

| 路由 | 说明 |
|---|---|
| `/ws/run/{session_id}` | 运行实时日志和截图推送 |

## Internal

内部接口由运行进程调用，不建议外部使用。

| 方法 | 路由 | 说明 |
|---|---|---|
| POST | `/api/internal/push_screenshot/{session_id}` | 引擎推送截图 |
| POST | `/api/internal/push_heal_event/{session_id}` | 引擎推送自愈事件 |
