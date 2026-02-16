# Components Map

## Top-Level Screen Composition

- `app/page.tsx`
  - Left panel: visualization area
    - `components/dsa-playground.tsx` (DSA lane)
    - `components/arrays/arrays-visualizer.tsx` (arrays lane)
  - Right panel: `components/chat-ui.tsx` (chat control plane)

## Chat Control Plane

- `components/chat-ui.tsx`
  - Sends requests to API routes.
  - Parses DSA update blocks.
  - Forwards arrays payloads to parent callbacks.
  - Renders markdown explanation text.

## DSA Lane

- `components/dsa-playground.tsx`
  - Maintains mode-specific structures and operations (BST/list/queue/stack).
  - Builds FlowDiagram-compatible JSON payload (`nodes`, `edges`).
  - Drives timeline playback for traversals and operation history.

- `components/dsa/registry-renderer.tsx`
  - Registry dispatcher for DSA components.
  - Currently renders `FlowDiagram` only.

- `components/flow-diagram.tsx`
  - React Flow wrapper.
  - Parses, normalizes, and renders graph JSON.

- `components/custom-node.tsx`
  - Custom React Flow node type used by DSA diagrams.

DSA registry definitions:

- `lib/dsa/registry-types.ts`
- `lib/visualization/component-registry.ts`

## Arrays Lane

- `components/arrays/arrays-visualizer.tsx`
  - Owns current step and playback state.
  - Delegates rendering to `RegistryRenderer`.

- `components/arrays/registry-renderer.tsx`
  - Orders and deduplicates scene components.
  - Renders component implementations based on `spec.scene.components`.

Arrays atomic visual components:

- `components/arrays/array-view.tsx`
- `components/arrays/bar-array-view.tsx`
- `components/arrays/pointer-layer.tsx`
- `components/arrays/range-highlight.tsx`
- `components/arrays/swap-animation.tsx`
- `components/arrays/compare-animation.tsx`
- `components/arrays/partition-view.tsx`
- `components/arrays/merge-view.tsx`
- `components/arrays/stack-view.tsx`
- `components/arrays/code-block.tsx`
- `components/arrays/timeline-stepper.tsx`
- `components/arrays/caption-callout.tsx`

Arrays registry definitions:

- `lib/visualization/component-registry.ts`
- `lib/arrays/types.ts`

## Shared UI Primitives

- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/scroll-area.tsx`

Utility:

- `lib/utils.ts` (`cn` class merge helper)
