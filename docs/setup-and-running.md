# Setup And Running

## Prerequisites

- Node.js 20+ recommended
- npm (repo includes `package-lock.json`)

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Default local URL: `http://localhost:3000`

## Build And Serve Production

```bash
npm run build
npm run start
```

## Lint

```bash
npm run lint
```

## Tests

```bash
npm run test
```

Current Vitest include pattern is configured in `vitest.config.ts` as `**/*.test.ts`.

## Project Scripts

Defined in `package.json`:

- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint`
- `test`: `vitest run`

## TypeScript Alias

`tsconfig.json` maps `@/*` to the repo root, for example:

- `@/components/chat-ui`
- `@/lib/arrays/schema`
