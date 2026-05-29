# Architecture

## Overview

AI Web Tester uses a decoupled frontend/backend architecture:

```text
ai-web-tester/
├── src/ai_tester/              # Playwright driver, Agent, self-healing engine
├── web_server/                 # FastAPI backend
├── frontend/                   # React + Tailwind console
├── extension/                  # Chrome recording extension
├── tools/                      # E2E and helper scripts
└── tests/                      # Runtime data
```

## Frontend Layers

`frontend/src/App.tsx` assembles the page and coordinates cross-domain state. Business state is split into hooks:

- `useAuth`: login, setup, token injection
- `useCaseLibrary`: case list, search, tags, groups, selection
- `useCaseEditor`: current case, step editing, save state, script view
- `useRunHistory`: run history, filters, batch deletion
- `useRunScreenshots`: screenshot cache, timeline, heal comparison images
- `useSettings`: model config, environments, prompts
- `useModalDialogs`: confirm and prompt dialogs
- `useGenerateCaseForm` / `useNaturalLanguageImport`: AI generation and NL import form state

View components live under `frontend/src/components/`.

## Backend Layers

`web_server/app.py` handles:

- FastAPI assembly
- CORS and auth middleware
- WebSocket log/screenshot streaming
- suite run entrypoint
- internal screenshot/heal event push
- shared helpers and runner dependency assembly

Routes are split by domain:

- `routes_auth.py`: setup, login, current user
- `routes_cases.py`: case CRUD, groups, restore, heal approval, script view
- `routes_case_generation.py`: NL2Case and natural-language batch import
- `routes_config.py`: model config, environments, prompts
- `routes_runs.py`: run history, stop, delete, AI fix suggestions
- `routes_suites.py`: suite CRUD

Execution modules:

- `runner.py`: single-case execution, process management, stop, timeout, artifacts
- `suite_runner.py`: serial suite execution and shared storageState
- `runtime_utils.py`: path validation, secret masking, status constants
- `auth_utils.py`: password hashing, token validation, Bearer parsing

## Data Flow

1. Frontend calls `/api/run/{case_id}`.
2. Backend reads the case and generates a pytest script.
3. `runner.py` starts a subprocess running Playwright.
4. Logs and screenshots are written to `tests/run_history/<run_id>/`.
5. WebSocket streams logs/screenshots to the frontend.
6. If a selector fails, the self-healing engine pushes a heal event.
7. The frontend shows the audit view; approval calls `/api/cases/{case_id}/heal/approve` to write the selector back.

## Case and Suite Data

Cases are stored in SQLite and backed up to `.bak` before updates. Suites reference case ids and may specify `setup_case_id` for shared login state.

Run artifacts are append-only runtime data under `tests/run_history/` and `tests/suite_history/`.
