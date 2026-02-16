# Environment Variables

This project expects model provider credentials in environment variables. Place them in `.env` for local development.

## Required For Watsonx Routes

- `WATSONX_API_KEY`
- `WATSONX_PROJECT_ID`

Used by:

- `app/api/chat/route.ts`
- `app/api/chat/explanation/route.ts`
- `app/api/chat/route-decision/route.ts`
- `app/api/arrays/chat/route.ts` when arrays provider is `watson`

## Optional Watsonx Configuration

- `WATSONX_MODEL_ID` (default is `meta-llama/llama-3-3-70b-instruct` in multiple routes)

## Required For OpenRouter Arrays Provider

- `OPENROUTER_API_KEY`

Used by:

- `app/api/arrays/chat/route.ts` when arrays provider is `openrouter`

## Optional OpenRouter Configuration

- `OPENROUTER_MODEL_ID` (fallback model for arrays route)
- `OPENROUTER_HTTP_REFERER` (sent as `HTTP-Referer` header)
- `OPENROUTER_APP_NAME` (sent as `X-Title` header)

Additional fallback fields read by `lib/openrouter.ts`:

- `NEXT_PUBLIC_APP_URL` (fallback referer)
- `NEXT_PUBLIC_APP_NAME` (fallback title)

## Minimal Local `.env` Example

```env
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_MODEL_ID=meta-llama/llama-3-3-70b-instruct

# Optional (arrays provider = openrouter)
OPENROUTER_API_KEY=...
OPENROUTER_MODEL_ID=google/gemini-3-flash-preview
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_NAME=CalgaryHacks DSA Visualizer
```
