# Architecture

## High-Level Runtime Flow

1. User submits prompt in `components/chat-ui.tsx`.
2. UI calls `app/api/chat/route-decision/route.ts` to select one visualization target.
3. UI always calls `app/api/chat/explanation/route.ts` for natural-language explanation.
4. Depending on route decision:
   - DSA lane: call `app/api/chat/route.ts`
   - Arrays lane: call `app/api/arrays/chat/route.ts`
5. UI updates parent state in `app/page.tsx`.
6. Visual panel renders either:
   - `components/dsa-playground.tsx`, or
   - `components/arrays/arrays-visualizer.tsx`

## Frontend Composition

### App Shell

- `app/page.tsx` is the main client page.
- It coordinates chat messages, DSA updates, arrays specs, and learning mode state.

### Chat Orchestrator

- `components/chat-ui.tsx` owns prompt submission, API orchestration, and lane history.
- It maintains separate histories for:
  - explanation
  - DSA route
  - arrays route
- It parses structured DSA updates from assistant content (`dsaupdate` fenced block).

### DSA Rendering Path

- `components/dsa-playground.tsx` manages BST/Linked List/Queue/Stack operations and timeline state.
- `components/dsa/registry-renderer.tsx` maps registry components (currently `FlowDiagram`) to UI.
- `components/flow-diagram.tsx` renders node/edge JSON using React Flow.

### Arrays Rendering Path

- `components/arrays/arrays-visualizer.tsx` manages current step and playback controls.
- `components/arrays/registry-renderer.tsx` maps spec-declared components to real UI components.
- Atomic visual components live in `components/arrays/*` (pointer layer, range, stack, partition, merge, swap, compare, code block, timeline, caption).

## Backend Route Responsibilities

- `app/api/chat/route-decision/route.ts`: choose DSA or arrays target for a prompt.
- `app/api/chat/explanation/route.ts`: return educational explanation text.
- `app/api/chat/route.ts`: generate DSA assistant content containing `dsaupdate` JSON block.
- `app/api/arrays/chat/route.ts`: normalize arrays prompt, generate/repair/validate spec, and return visualizable JSON.

## Shared Libraries

- `lib/watsonx.ts`: Watsonx token and chat call utilities.
- `lib/openrouter.ts`: OpenRouter chat utility.
- `lib/arrays/parser.ts`: parse natural-language arrays prompts into normalized inputs.
- `lib/arrays/schema.ts`: strict arrays spec schema and semantic validation rules.
- `lib/arrays/prompts.ts`: model prompt templates for generation and repair.
- `lib/visualization/component-registry.ts`: allowed visual component types per domain.

## Data Contracts At Runtime

- DSA lane contract to UI: `PlaygroundUpdate` in `lib/dsa-playground-types.ts`.
- Arrays lane contract to UI: `ArraysChatSuccessResponse` in `lib/arrays/types.ts`.
- Arrays spec contract: `ArraysVizSpec` in `lib/arrays/types.ts`, validated by `lib/arrays/schema.ts`.
