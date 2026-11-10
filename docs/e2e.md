# E2E 与验证

## 后端测试

```bash
venv/bin/python -m pytest web_server/test_web_server_api.py web_server/test_runner.py web_server/test_suite_runner.py -q
```

覆盖内容：

- API 鉴权（含未授权 401 拒绝）、路径校验、配置保存、Prompt 备份
- 用例创建、更新、删除、恢复（含 variables/group_name 恢复完整性）、自愈批准
- 生成脚本注入回归（intent/dataset 字面量安全）、断言永不进入自愈、断言无 HTML 源码兜底
- 套件缺失引用校验、删除用例后套件清理
- runner 停止、排队取消（pending cancel）、超时分支（timeout 终态与 failure_reason）、stopped 终态不被非 0 退出码覆盖、失败原因推断
- 套件 setup 失败停止、运行汇总、`wait_run_finished` 超时兜底

各测试文件实际覆盖点：

`web_server/test_web_server_api.py`（22 项）：

- 路径穿越拒绝（upload_script、prompt 更新）
- 配置保存与脱敏、保留未知 env key、使用已存 key 测试连接
- Prompt 备份写入
- CompatChatOpenAI 字符串响应兼容
- 生成脚本：断言不进入自愈且无 `page.content()` 兜底、intent 注入可编译、dataset True/None 字面量
- 备份恢复完整性：steps 与 variables 都恢复到备份版本
- 鉴权拒绝：无 Authorization 头返回 401
- 自愈批准：歧义空 selector intent 拒绝

`web_server/test_runner.py`（5 项）：

- `stop_active_run` 未知 run_id 返回 404
- `stop_active_run` 终止进程并写入 stopped meta
- `stop_active_run` 取消排队中的 pending run
- `run_pytest_worker` 超时分支：status=timeout、failure_reason.category=timeout
- `run_pytest_worker` stopped 终态不被非 0 退出码覆盖

`web_server/test_suite_runner.py`（3 项）：

- `wait_run_finished` meta 缺失时返回 timeout
- `run_suite_worker` 汇总已完成运行（passed/failed/heal/token）
- `run_suite_worker` setup 用例失败时停止后续执行

## 前端测试

```bash
cd frontend
npm test
```

`npm test` 使用 TypeScript 编译和 Node 内置 test runner，不依赖额外测试框架。当前覆盖：

- 状态和时间格式化
- 运行日志分类和样式元数据
- 自愈批准 key 生成逻辑

## 生产构建

```bash
cd frontend
npm run build
```

构建会同时执行 TypeScript project build 和 Vite production build。

## 浏览器烟测

```bash
cd frontend
npm run e2e:smoke
```

烟测脚本会：

1. 创建临时数据库和临时 Prompt 目录
2. 启动隔离后端
3. 启动 Vite 前端
4. 使用 Playwright 浏览器执行主链路

覆盖链路：

- 初始化/登录
- 导航可见性
- 设置弹窗打开与保存
- 创建用例
- 选择用例
- 新增步骤并保存
- 创建套件
- 添加用例到套件并保存

脚本会临时设置：

- `AI_TESTER_DB_PATH`
- `AI_TESTER_PROMPTS_DIR`
- `AI_TESTER_CORS_ORIGINS`

因此不会写入真实的 `tests/tester.db`，也不会改动真实 Prompt。

## 常见问题

### Playwright 浏览器未安装

```bash
playwright install chromium
```

### E2E 端口被占用

`tools/e2e_smoke.py` 会自动选择临时端口。若仍失败，优先查看脚本输出中的 frontend/backend URL。
