# E2E 与验证

## 后端测试

```bash
venv/bin/python -m pytest web_server/test_web_server_api.py web_server/test_runner.py web_server/test_suite_runner.py -q
```

覆盖内容：

- API 鉴权、路径校验、配置保存、Prompt 备份
- 用例创建、更新、删除、恢复、自愈批准
- 套件缺失引用校验、删除用例后套件清理
- runner 停止、超时、失败原因推断
- suite runner 汇总与串行执行辅助逻辑

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
