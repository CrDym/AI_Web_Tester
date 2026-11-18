# 给 Agent：在本机启动 SOLO AI Web Tester

[English](agent-deploy.en.md) · [项目 README](../README.md)

**完成条件**：只在本机回环地址提供服务。确认进程属于目标仓库，控制台首页返回 `200`，经控制台代理访问后端的未登录请求返回 `401`，即可交付。无需 API key、账号或 Chrome 插件。以下命令适用于 macOS/Linux 的 POSIX shell，不是公网生产部署流程。

## 1. 找到仓库，先检查是否已经运行

已有检出目录时直接进入其根目录，不要重复克隆、拉取或重置。只有没有本地副本时才执行：

```sh
git clone https://github.com/CrDym/AI_Web_Tester.git
cd AI_Web_Tester
```

根目录应有 `web_server/requirements.txt`、`frontend/package-lock.json`、`extension/manifest.json`。后续每个代码块都**从此根目录**执行。

```sh
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

没有监听时 `lsof` 无输出。Linux 也可用 `ss -ltnp`。有监听时，先用 `lsof -a -p <PID> -d cwd` 或等价工具核对工作目录。若两项均属于此仓库且通过第 4 节验收，直接交付；只有一项缺失则只准备并启动该项。若端口被其他进程占用或归属不明，报告端口和 PID 后停止，不杀进程、不自动换端口。

## 2. 准备缺失的依赖

已验证的依赖组合使用 Python 3.8 和 Node.js 22.x（至少 22.12）；需要 npm。先检查版本。下例假定 `python3` 是所选解释器；否则用相应可执行文件创建环境。不覆盖已有 `venv`，不在运行中的前端目录执行 `npm ci`（它会替换 `node_modules`）。

```sh
python3 --version
node --version
npm --version
```

首次安装后端及回放浏览器：

```sh
test -d venv || python3 -m venv venv
./venv/bin/python -m pip install -r web_server/requirements.txt
./venv/bin/python -m playwright install chromium
```

首次安装前端：

```sh
(cd frontend && npm ci)
```

若下载失败，报告具体依赖和错误，不改锁文件。若 Linux 缺 Chromium 系统库，先报告缺项，获准后再安装系统包。基础部署**不创建或覆盖 `.env`**，也不填示例密钥。只有用户需要 AI 自愈或自然语言生成功能时才另行配置；不要在对话或日志中输出密钥。

## 3. 启动服务

分别在两个可持续运行的终端或后台任务中执行；每个进程都从仓库根目录开始。记录自己启动的进程，以便只停止自己的服务。

后端（端口 8000）：

```sh
(cd web_server && exec ../venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000)
```

前端（端口 5173）：

```sh
(cd frontend && exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort)
```

## 4. 只读验收与交付

```sh
curl --noproxy '*' -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
curl --noproxy '*' -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/api/auth/me
```

依次应为 `200`、`401`。第二条**不带凭据**，`401` 表示后端经前端代理可达，不是启动失败。刚启动时可短暂重试；若仍不符，检查对应进程的启动日志，并直接访问 `http://127.0.0.1:8000/api/auth/me` 区分后端与代理问题。交付控制台地址 `http://127.0.0.1:5173/`、两个状态码以及哪些进程为新启动或复用；未通过则报告失败步骤，不宣称成功。

不要为验收注册账号、重置密码、保存设置或运行会写数据的烟测。若用户另需录制功能，由用户在 Chrome 开发者模式加载仓库的 `extension/`。当前插件使用上述固定端口，不发送 `X-Recorder-Token`；仅在服务端启用 `AI_TESTER_RECORDER_TOKEN` 会导致同步被拒绝，不要为通过验收而关闭已有保护。
