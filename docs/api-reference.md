# API Reference

All routes are Next.js route handlers under `app/api`.

## `POST /api/chat/route-decision`

Path: `app/api/chat/route-decision/route.ts`

### Request Body

```json
{
  "message": "string",
  "dsaHistory": [{ "role": "user|assistant", "content": "string" }],
  "arraysHistory": [{ "role": "user|assistant", "content": "string" }]
}
```

### Success Response

```json
{
  "callDSA": true,
  "callArrays": false,
  "reason": "optional short reason",
  "source": "model"
}
```

Constraints:

- Exactly one of `callDSA` or `callArrays` is expected to be true after normalization.

## `POST /api/chat/explanation`

Path: `app/api/chat/explanation/route.ts`

### Request Body

```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

### Success Response

```json
{
  "explanation": "string"
}
```

## `POST /api/chat`

Path: `app/api/chat/route.ts`

### Request Body

```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

### Success Response

```json
{
  "content": "string"
}
```

Notes:

- The assistant content should include one fenced `dsaupdate` JSON block expected by the UI parser in `components/chat-ui.tsx`.

## `POST /api/arrays/chat`

Path: `app/api/arrays/chat/route.ts`

### Request Body

```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }],
  "provider": "watson|openrouter",
  "modelId": "optional model id"
}
```

### Success Response

```json
{
  "spec": { "version": "1.0", "title": "...", "code": { "lines": [] }, "scene": { "components": [] }, "steps": [] },
  "normalizedInput": { "array": [9, 3, 7, 1, 5] },
  "provider": "watson",
  "modelId": "meta-llama/llama-3-3-70b-instruct"
}
```

## Common Error Shape

Routes return JSON errors in this shape:

```json
{
  "error": "message",
  "details": "optional details"
}
```

Typical status codes:

- `400`: invalid request (missing message)
- `422`: arrays parse/validation failure
- `500`: server configuration/runtime error
- `502`: upstream model provider failure
