# Agent runbook: start SOLO AI Web Tester locally

[中文](agent-deploy.md) · [Project README](../README_EN.md)

**Done means:** both services listen on loopback and belong to the intended checkout. The console returns `200`, and an unauthenticated request through its backend proxy returns `401`. No API key, account, or Chrome extension is required. These instructions target a POSIX shell on macOS or Linux, not a public production deployment.

## 1. Locate the checkout and check for running services

If the repository already exists, enter its root. Do not clone again, pull, or reset it. Only for a new checkout:

```sh
git clone https://github.com/CrDym/AI_Web_Tester.git
cd AI_Web_Tester
```

Look for `web_server/requirements.txt`, `frontend/package-lock.json`, and `extension/manifest.json`. Start **each subsequent command block at this root**.

```sh
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

No output from `lsof` means no listener. On Linux, `ss -ltnp` is an alternative. For each listener, check the working directory with `lsof -a -p <PID> -d cwd` or its equivalent. If both belong to this checkout and pass section 4, report success without changing anything. Prepare and start only a missing service. If a listener belongs to another process or ownership is unclear, report the port and PID and stop. Do not kill it or switch ports silently.

## 2. Prepare missing dependencies

Use the tested Python 3.8 dependency set and Node.js 22.x (22.12 or later in that line), with npm. Check versions first. The commands assume `python3` is the chosen interpreter; otherwise substitute its executable when creating the environment. Do not overwrite an existing `venv` or run `npm ci` against a running frontend: it replaces `node_modules`.

```sh
python3 --version
node --version
npm --version
```

First install of the backend and replay browser:

```sh
test -d venv || python3 -m venv venv
./venv/bin/python -m pip install -r web_server/requirements.txt
./venv/bin/python -m playwright install chromium
```

First install of the frontend:

```sh
(cd frontend && npm ci)
```

If a download fails, report the dependency and error; do not rewrite the lockfile. If Chromium needs system libraries on Linux, report what is missing and get approval before installing system packages. Basic deployment **does not create or overwrite `.env`**. Do not supply a placeholder key. Configure credentials separately only when the user requests AI healing or natural-language generation; never print keys in chat or logs.

## 3. Start the services

Use two long-lived terminals or background tasks, each starting at the repository root. Keep track of any process you launch so you can stop only your own services.

Backend (port 8000):

```sh
(cd web_server && exec ../venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000)
```

Frontend (port 5173):

```sh
(cd frontend && exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort)
```

## 4. Verify without writing data

```sh
curl --noproxy '*' -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
curl --noproxy '*' -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/api/auth/me
```

Expect `200` then `401`. The second request deliberately **omits credentials**: `401` shows the backend is reachable through the frontend proxy. Retry briefly during startup. If the result persists, inspect the relevant process log and probe `http://127.0.0.1:8000/api/auth/me` directly to distinguish backend and proxy failures. Report the console URL `http://127.0.0.1:5173/`, both status codes, and which processes were started or reused. On failure, report the unsuccessful step instead of declaring success.

Do not register accounts, reset passwords, save settings, or run a state-changing smoke test to verify deployment. If recording is requested separately, have the user load `extension/` as an unpacked Chrome extension in developer mode. The extension uses the fixed ports above and does not send `X-Recorder-Token`. Enabling `AI_TESTER_RECORDER_TOKEN` only on the server will reject sync; do not disable existing protections to pass verification.
