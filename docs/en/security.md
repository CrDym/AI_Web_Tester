# Security Notes

## Auth Model

The Web Console uses local user auth and Bearer tokens:

- `/api/auth/setup` initializes the first user
- `/api/auth/login` returns a token
- regular `/api/*` requests require `Authorization: Bearer <token>`

Exceptions:

- `/api/auth/*`: public setup/login routes
- `/api/recorder/cases`: can be protected by `AI_TESTER_RECORDER_TOKEN`
- `/api/internal/*`: accepts only the backend runtime internal token

## Secret Handling

`GET /api/config` returns a masked `OPENAI_API_KEY` and `OPENAI_API_KEY_SET`.

`POST /api/config` preserves an existing key if no new key is provided or the provided key is blank.

## CORS

Default allowed origins are local Vite dev addresses:

- `http://127.0.0.1:5173`
- `http://localhost:5173`

Override with `AI_TESTER_CORS_ORIGINS`, comma-separated.

## Path Safety

The backend validates paths for:

- uploaded script filenames
- prompt filenames
- run/suite/case ids with path traversal attempts

Shared helpers live in `web_server/runtime_utils.py`.

## Sensitive Data

Do not commit:

- `.env`
- `tests/`
- run logs
- screenshots
- real credentials in prompts

If sensitive data was ever committed, rotate affected credentials according to your company process.

## Recorder Sync

For shared environments, set:

```env
AI_TESTER_RECORDER_TOKEN=your-secret
```

Chrome extension sync must include the matching token or the backend rejects the write.
