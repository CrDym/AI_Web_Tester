# API Overview

The backend listens on `http://127.0.0.1:8000` by default. In development, the frontend accesses it through the Vite proxy.

## Auth

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/setup` | Initialize local user |
| POST | `/api/auth/login` | Login and return token |
| GET | `/api/auth/me` | Current user |

## Config / Environments / Prompts

| Method | Route | Notes |
|---|---|---|
| GET | `/api/config` | Read model config with masked API key |
| POST | `/api/config` | Save model config |
| POST | `/api/config/test` | Test model connectivity |
| GET | `/api/environments` | List environments |
| POST | `/api/environments` | Save environments |
| GET | `/api/prompts` | Read prompt files |
| PUT | `/api/prompts/{filename}` | Update prompt and create backup |

## Cases

| Method | Route | Notes |
|---|---|---|
| GET | `/api/cases` | List cases |
| POST | `/api/cases` | Create case |
| GET | `/api/cases/{case_id}` | Case detail |
| PUT | `/api/cases/{case_id}` | Update case |
| DELETE | `/api/cases/{case_id}` | Delete case and clean suite references |
| POST | `/api/cases/{case_id}/rename` | Rename case |
| POST | `/api/cases/{case_id}/restore` | Restore from `.bak` |
| GET | `/api/cases/{case_id}/script` | Generated pytest script |
| POST | `/api/cases/batch_group` | Move cases to group |
| POST | `/api/cases/{case_id}/heal/approve` | Approve selector rewrite |

## Case Generation

| Method | Route | Notes |
|---|---|---|
| POST | `/api/cases/generate` | Generate a case from natural language |
| POST | `/api/cases/import_nl/preview` | Preview batch NL import |
| POST | `/api/cases/import_nl/confirm` | Confirm preview import |
| POST | `/api/recorder/cases` | Chrome extension recorder sync |

## Runs

| Method | Route | Notes |
|---|---|---|
| POST | `/api/run/{case_id}` | Start a single-case run |
| GET | `/api/runs` | List runs, supports `case_id` or `include_all` |
| GET | `/api/runs/{run_id}` | Run detail |
| POST | `/api/runs/{run_id}/stop` | Stop run |
| DELETE | `/api/runs/{run_id}` | Delete run |
| POST | `/api/runs/batch_delete` | Batch delete runs |
| GET | `/api/runs/{run_id}/screenshots/{filename}` | Screenshot base64 |
| POST | `/api/runs/{run_id}/ai_fix_suggest` | Generate AI fix suggestion |

## Suites

| Method | Route | Notes |
|---|---|---|
| GET | `/api/suites` | List suites |
| POST | `/api/suites` | Create suite |
| GET | `/api/suites/{suite_id}` | Suite detail |
| PUT | `/api/suites/{suite_id}` | Update suite |
| DELETE | `/api/suites/{suite_id}` | Delete suite |
| POST | `/api/suites/{suite_id}/run` | Start suite run |
| GET | `/api/suite_runs` | List suite runs |
| GET | `/api/suite_runs/{suite_run_id}` | Suite run detail |
| DELETE | `/api/suite_runs/{suite_run_id}` | Delete suite run |

## WebSocket

| Route | Notes |
|---|---|
| `/ws/run/{session_id}` | Real-time run logs and screenshots |

## Internal

Internal routes are called by the execution process and are not intended for external use.

| Method | Route | Notes |
|---|---|---|
| POST | `/api/internal/push_screenshot/{session_id}` | Engine screenshot push |
| POST | `/api/internal/push_heal_event/{session_id}` | Engine heal event push |
