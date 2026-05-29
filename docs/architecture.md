# 架构说明

## 总览

AI Web Tester 采用前后端分离架构：

```text
ai-web-tester/
├── src/ai_tester/              # Playwright 驱动、Agent、自愈引擎
├── web_server/                 # FastAPI 后端
├── frontend/                   # React + Tailwind 控制台
├── extension/                  # Chrome 录制插件
├── tools/                      # E2E 和辅助脚本
└── tests/                      # 运行时数据目录
```

## 前端分层

`frontend/src/App.tsx` 负责页面总装配和跨域状态协调。具体业务状态已拆到 hooks：

- `useAuth`：登录、注册、token 注入
- `useCaseLibrary`：用例列表、搜索、标签、分组、多选
- `useCaseEditor`：当前用例、步骤编辑、保存状态、脚本视图
- `useRunHistory`：运行历史、筛选、多选删除
- `useRunScreenshots`：截图缓存、截图时间轴、自愈对比图
- `useSettings`：模型配置、环境、Prompt 加载和保存
- `useModalDialogs`：确认弹窗和输入弹窗
- `useGenerateCaseForm` / `useNaturalLanguageImport`：AI 生成和自然语言导入表单状态

视图组件位于 `frontend/src/components/`，例如侧边栏、设置弹窗、套件编辑器、运行回放面板、截图面板、自愈对比弹窗等。

## 后端分层

`web_server/app.py` 负责：

- FastAPI app 装配
- CORS 和认证中间件
- WebSocket 实时日志/截图推送
- suite run 执行入口
- 内部截图/自愈事件上报
- 共享 helper 和 runner 依赖组装

路由已按领域拆分：

- `routes_auth.py`：初始化、登录、当前用户
- `routes_cases.py`：用例 CRUD、分组、恢复、自愈批准、脚本读取
- `routes_case_generation.py`：NL2Case 和自然语言批量导入
- `routes_config.py`：模型配置、环境、Prompt
- `routes_runs.py`：运行历史、停止、删除、AI 修复建议
- `routes_suites.py`：套件 CRUD

执行逻辑拆分为：

- `runner.py`：单用例执行、进程管理、停止、超时、运行产物落盘
- `suite_runner.py`：套件串行执行、storageState 共享登录态
- `runtime_utils.py`：路径校验、密钥脱敏、运行状态常量
- `auth_utils.py`：密码哈希、token 校验、Bearer 解析

## 数据流

1. 前端调用 `/api/run/{case_id}`。
2. 后端读取 case，动态生成 pytest 脚本。
3. `runner.py` 启动子进程运行 Playwright。
4. 执行日志和截图写入 `tests/run_history/<run_id>/`。
5. WebSocket 将日志和截图推送到前端。
6. 如果 selector 失效，底层自愈引擎推送 heal event。
7. 前端展示自愈审计，用户批准后调用 `/api/cases/{case_id}/heal/approve` 写回 selector。

## 用例与套件数据

用例存储在 SQLite 中，并在更新前写 `.bak` 备份。套件引用 case id，并可指定 `setup_case_id` 用于共享登录态。

运行产物是追加型数据，保存在 `tests/run_history/` 和 `tests/suite_history/`，便于回放和审计。
