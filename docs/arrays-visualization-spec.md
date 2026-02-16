# Arrays Visualization Spec

This document explains the JSON spec used by the arrays visualizer lane.

Canonical types and constants live in:

- `lib/arrays/types.ts`
- `lib/arrays/schema.ts`

Generation and repair prompts live in:

- `lib/arrays/prompts.ts`

## Top-Level Shape

```json
{
  "version": "1.0",
  "title": "string",
  "code": { "lines": ["..."] },
  "scene": {
    "components": [{ "id": "string", "type": "ArrayView|BarArrayView|Pointer|RangeHighlight|SwapAnimation|CompareAnimation|CaptionCallout|CodeBlock|TimelineStepper|StackView|PartitionView|MergeView" }]
  },
  "steps": [
    {
      "id": "s0",
      "caption": "string",
      "activeCodeLine": 1,
      "state": {
        "array": [1, 2, 3]
      },
      "events": []
    }
  ]
}
```

## Hard Limits

From `lib/arrays/types.ts` and `lib/arrays/schema.ts`:

- Max array length: `MAX_ARRAY_LENGTH = 32`
- Max timeline steps: `MAX_TIMELINE_STEPS = 300`
- Max code lines: `MAX_CODE_LINES = 40`

## Step-Level State

`steps[*].state` may include:

- `array` (required)
- `pointers` (name -> index)
- `range` (`l`, `r`)
- `stack`
- `recursion` (call metadata)
- `partition`
- `merge`

`events` supports:

- `swap`: `{ type: "swap", i, j }`
- `compare`: `{ type: "compare", i, j, outcome? }`

Indices are validated against `state.array` length.

## Recursion Validation Rules

If recursion is present, schema validation enforces coherence checks:

- Recursion steps should include non-empty `state.stack`
- `state.recursion.depth` should match `state.stack.length - 1`
- First recursion step must be `depth=0` with phase `enter`
- Last recursion step must be `depth=0` with phase `return`
- Depth delta between adjacent recursion steps must be `-1`, `0`, or `+1`
- Each call lifecycle must include `enter` and `return` in order

## Validation + Repair Loop

In `app/api/arrays/chat/route.ts`:

1. Model generates candidate JSON.
2. Candidate is validated by `parseAndValidateArraysSpec`.
3. If invalid, repair prompts are generated using validation errors.
4. Up to `SPEC_MAX_REPAIR_ATTEMPTS = 3` repair attempts are made.
