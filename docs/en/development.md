# Development Guide

## Local Services

Backend:

```bash
source venv/bin/activate
cd web_server
python3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. In development, Vite proxies `/api` and `/ws` to the backend.

## Model Config

Root `.env`:

```env
OPENAI_API_BASE=https://models.inference.ai.azure.com
OPENAI_API_KEY=xxxx
OPENAI_MODEL_NAME=gpt-4o-mini
```

You can also configure these values from the Web Console Settings page. The server preserves an existing `OPENAI_API_KEY` if you only change Base URL or model name.

## Runtime Environment Variables

| Variable | Example | Notes |
|---|---|---|
| `PLAYWRIGHT_HEADLESS` | `1` | Headless mode |
| `AI_TESTER_DB_PATH` | `/tmp/ai-web-tester/tester.db` | Override SQLite DB path for tests/CI/isolation |
| `AI_TESTER_PROMPTS_DIR` | `/tmp/ai-web-tester/prompts` | Override prompts directory |
| `AI_TESTER_RUN_TIMEOUT_SECONDS` | `1800` | Single-run timeout |
| `AI_TESTER_RECORDER_TOKEN` | `recorder-secret` | Optional token for Chrome recorder sync |
| `AI_TESTER_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Allowed CORS origins |
| `AI_TESTER_STORAGE_STATE_PATH` | `tests/suite_history/<suite_run_id>/storage_state.json` | Shared suite login state |
| `AI_TESTER_RUN_DIR` | `logs/runs/20260415_120000/` | pytest report/screenshot output |

Frontend proxy variables:

| Variable | Example | Notes |
|---|---|---|
| `VITE_API_TARGET` | `http://127.0.0.1:8000` | Vite `/api` proxy target |
| `VITE_WS_TARGET` | `ws://127.0.0.1:8000` | Vite WebSocket proxy target |

## Runtime Data

`tests/` is runtime data and is ignored by default:

- `tests/tester.db`: SQLite metadata
- `tests/recorded_cases/`: case backups, including `.bak`
- `tests/run_history/`: single-run artifacts
- `tests/suite_history/`: suite-run artifacts

## Chrome Extension

The extension lives under `extension/`.

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Load `extension/`
4. Start recording on a target page
5. Recorded steps sync to the console; if the backend is unavailable, the extension downloads JSON as fallback

## CI Notes

Console execution dynamically generates and runs pytest scripts. CI can:

1. Install Python/Node/Playwright dependencies
2. Inject `.env`
3. Prepare or mount `tests/tester.db`
4. Start the backend
5. Trigger suite runs through API

```bash
curl -X POST "http://127.0.0.1:8000/api/suites/<suite_id>/run"
```
