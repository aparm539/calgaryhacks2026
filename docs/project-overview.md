# Project Overview

## What This App Is

This repository is a Next.js + React application that turns natural-language prompts into interactive data-structure and algorithm visualizations.

It supports two visualization lanes:

- DSA playground lane (BST, Linked List, Queue, Stack)
- Arrays lane (array walkthroughs and custom step-by-step visual traces)

The chat UI routes each prompt to the right lane and also returns an explanation to the user.

## Core User Workflows

### 1) DSA Playground Workflow

User asks for DSA operations (for example tree operations or stack operations), and the app:

1. Calls `app/api/chat/route-decision/route.ts` to pick a lane.
2. Calls `app/api/chat/route.ts` for DSA content.
3. Extracts a `dsaupdate` block in `components/chat-ui.tsx`.
4. Renders visual state in `components/dsa-playground.tsx` via `components/dsa/registry-renderer.tsx` and `components/flow-diagram.tsx`.

### 2) Arrays Visualization Workflow

User asks for array walkthroughs, and the app:

1. Calls `app/api/chat/route-decision/route.ts`.
2. Calls `app/api/arrays/chat/route.ts`.
3. Normalizes prompt into input array.
4. Generates and validates a JSON visualization spec.
5. Renders step-by-step in `components/arrays/arrays-visualizer.tsx` via `components/arrays/registry-renderer.tsx`.

### 3) Explanation Workflow

For every prompt, the app also requests a plain-language explanation from `app/api/chat/explanation/route.ts` and displays it in the chat stream.

## Key Capabilities

- Lane routing between DSA and arrays (`components/chat-ui.tsx`)
- Multiple model providers for arrays (Watsonx and OpenRouter)
- Strict schema validation for arrays visualization specs (`lib/arrays/schema.ts`)
- Spec repair retries on validation failure (`app/api/arrays/chat/route.ts`)

## Tech Highlights

- Next.js App Router (`app/`)
- React 19 + TypeScript
- Tailwind CSS + shadcn/Radix UI primitives
- React Flow (`@xyflow/react`) for graph-style diagrams
- Framer Motion for arrays animation components
- Zod for runtime schema validation
