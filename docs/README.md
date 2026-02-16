# Documentation

This folder documents the architecture, setup, and API behavior of the CalgaryHacks 2026 DSA visualizer project.

## Start Here

1. Read `docs/project-overview.md` for product scope and capabilities.
2. Follow `docs/setup-and-running.md` to run the app locally.
3. Configure secrets using `docs/environment-variables.md`.
4. Use `docs/architecture.md` to understand runtime flow.

## Reference Map

- `docs/project-overview.md`: Product purpose, user workflows, and feature boundaries.
- `docs/setup-and-running.md`: Install, run, build, lint, and test commands.
- `docs/environment-variables.md`: Required and optional environment variables.
- `docs/architecture.md`: End-to-end request and rendering pipeline.
- `docs/api-reference.md`: Route contracts and error behavior.
- `docs/arrays-visualization-spec.md`: Arrays spec shape, schema validation rules, and repair loop.
- `docs/components-map.md`: UI component and registry relationships.

## Primary Code Entry Points

- App shell: `app/page.tsx`
- Chat orchestration: `components/chat-ui.tsx`
- DSA playground: `components/dsa-playground.tsx`
- Arrays visualizer: `components/arrays/arrays-visualizer.tsx`
- Arrays API route: `app/api/arrays/chat/route.ts`
