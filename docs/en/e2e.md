# E2E & Verification

## Backend Tests

```bash
venv/bin/python -m pytest web_server/test_web_server_api.py web_server/test_runner.py web_server/test_suite_runner.py -q
```

Coverage:

- API auth, path validation, config save, prompt backups
- case create/update/delete/restore/heal approval
- suite missing-reference validation and suite cleanup after case deletion
- runner stop, timeout, failure reason inference
- suite runner summary and serial execution helpers

## Frontend Tests

```bash
cd frontend
npm test
```

`npm test` uses TypeScript compilation and Node's built-in test runner. Current coverage:

- status and time formatting
- run log classification and visual metadata
- heal approval key generation

## Production Build

```bash
cd frontend
npm run build
```

This runs TypeScript project build and Vite production build.

## Browser Smoke Test

```bash
cd frontend
npm run e2e:smoke
```

The smoke script:

1. Creates a temporary database and prompts directory
2. Starts an isolated backend
3. Starts the Vite frontend
4. Uses Playwright to exercise the main flow

Covered flow:

- setup/login
- navigation visibility
- settings modal open and save
- case creation
- case selection
- add step and save
- suite creation
- add case to suite and save

The script sets:

- `AI_TESTER_DB_PATH`
- `AI_TESTER_PROMPTS_DIR`
- `AI_TESTER_CORS_ORIGINS`

So it does not write to real `tests/tester.db` or real prompt files.

## Troubleshooting

### Playwright Browser Missing

```bash
playwright install chromium
```

### E2E Port Conflict

`tools/e2e_smoke.py` chooses temporary ports automatically. If it still fails, check the frontend/backend URLs printed by the script.
