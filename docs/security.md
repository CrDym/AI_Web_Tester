# 安全说明

## 鉴权模型

Web 控制台使用本地用户和 Bearer token 鉴权：

- `/api/auth/setup` 初始化首个用户
- `/api/auth/login` 返回 token
- 普通 `/api/*` 请求需要 `Authorization: Bearer <token>`

例外：

- `/api/auth/*`：公开，用于初始化和登录
- `/api/recorder/cases`：可通过 `AI_TESTER_RECORDER_TOKEN` 保护
- `/api/internal/*`：只接受后端运行时生成的 internal token

## 密钥处理

`GET /api/config` 会返回脱敏后的 `OPENAI_API_KEY`，并返回 `OPENAI_API_KEY_SET` 表示是否已配置密钥。

`POST /api/config` 如果没有传入新 key，或传入空 key，会保留已有 key，避免误清空。

## CORS

默认只允许本地 Vite 来源：

- `http://127.0.0.1:5173`
- `http://localhost:5173`

可以通过 `AI_TESTER_CORS_ORIGINS` 覆盖，多个来源用逗号分隔。

## 路径安全

后端使用受控目录和安全路径校验，保护：

- 上传脚本文件名
- Prompt 文件名
- run/suite/case id 中的路径穿越

相关工具位于 `web_server/runtime_utils.py`。

## 敏感数据

不要提交：

- `.env`
- `tests/`
- 运行日志
- 截图
- Prompt 中的真实业务密钥或账号

如果误提交过包含敏感信息的文件，即使后续删除，也应按公司流程轮换密钥。

## 录制器同步

如果部署在共享环境，建议设置：

```env
AI_TESTER_RECORDER_TOKEN=your-secret
```

Chrome 插件同步时需要携带匹配 token，否则后端拒绝写入用例。
