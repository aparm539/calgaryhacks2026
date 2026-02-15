import {
  MAX_ARRAY_LENGTH,
  MAX_CODE_LINES,
  MAX_TIMELINE_STEPS,
  type ArraysChatHistoryMessage,
  type NormalizedArraysInput,
} from "@/lib/arrays/types";

type PromptContext = {
  question: string;
  normalizedInput: NormalizedArraysInput;
  history?: ArraysChatHistoryMessage[];
};

type VizPromptContext = PromptContext & {
  explanation: string;
};

type RepairPromptContext = {
  question: string;
  normalizedInput: NormalizedArraysInput;
  explanation: string;
  invalidSpec: string;
  validationError: string;
  repairHint?: string;
};

function formatInputSummary(input: NormalizedArraysInput) {
  const targetText =
    typeof input.target === "number" ? `\nTarget: ${input.target}` : "";

  return `Algorithm: ${input.algorithm}\nArray: [${input.array.join(", ")}]${targetText}`;
}

function formatHistory(history?: ArraysChatHistoryMessage[]) {
  if (!history?.length) {
    return "No prior history.";
  }

  return history
    .slice(-6)
    .map(
      (item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.content}`
    )
    .join("\n");
}

export function buildExplainerPrompts({
  question,
  normalizedInput,
  history,
}: PromptContext) {
  const system = `You are an algorithms tutor focused on arrays.
Give a concise, educational explanation only.
Constraints:
- 3 to 6 sentences.
- Plain text only.
- Mention key invariant and complexity in simple terms.
- Use the provided normalized input exactly.`;

  const user = `User question:\n${question}\n\nNormalized input:\n${formatInputSummary(
    normalizedInput
  )}\n\nRecent chat history:\n${formatHistory(history)}`;

  return { system, user };
}

export function buildVisualizationPrompts({
  question,
  normalizedInput,
  history,
  explanation,
}: VizPromptContext) {
  const system = `Return JSON only (no markdown, no prose).
Generate a complete arrays visualization spec using this exact structure:
{
  "version": "1.0",
  "algorithm": "linear-search|binary-search|quicksort|mergesort",
  "title": "string",
  "code": { "lines": ["string", "..."] },
  "scene": {
    "components": [
      { "id": "string", "type": "ArrayView|BarArrayView|Pointer|RangeHighlight|SwapAnimation|CompareAnimation|CaptionCallout|CodeBlock|TimelineStepper|StackView|PartitionView|MergeView" }
    ]
  },
  "steps": [
    {
      "id": "string",
      "caption": "string",
      "activeCodeLine": 1,
      "state": {
        "array": [1, 2, 3],
        "pointers": { "name": 0 },
        "range": { "l": 0, "r": 2 },
        "stack": ["lo=0 hi=4"],
        "partition": { "pivotIndex": 2, "less": [1], "greater": [9] },
        "merge": { "left": [1], "right": [2], "merged": [1], "writeRange": { "l": 0, "r": 1 } }
      },
      "events": [
        { "type": "swap", "i": 0, "j": 1 },
        { "type": "compare", "i": 0, "j": 0, "outcome": "lt|eq|gt" }
      ]
    }
  ]
}
Hard rules:
- Allowed component types: ArrayView, BarArrayView, Pointer, RangeHighlight, SwapAnimation, CompareAnimation, CaptionCallout, CodeBlock, TimelineStepper, StackView, PartitionView, MergeView.
- Use only the allowed component types and event types.
- Include each component type at most once in scene.components.
- Always include a CodeBlock component in scene.components.
- version must be "1.0".
- code.lines length: 1..${MAX_CODE_LINES}.
- steps length: 1..${MAX_TIMELINE_STEPS}.
- Every step.state.array length: 1..${MAX_ARRAY_LENGTH}.
- activeCodeLine is 1-based and must always reference an existing code line.
- Pointer/range/event indices must be valid for that step's array.
- Include full timeline progression from start to finish.
- Keep algorithm equal to normalized input algorithm.
- scene.components is a static component registry list. Dynamic algorithm data must live in steps[*].state and steps[*].events only.
- For mergesort, include MergeView in scene.components and provide state.merge on merge phases.
- Prefer omitting props entirely. If props is used, every props value must be a primitive (string | number | boolean).
- Never place array/code/state/steps/events/pointers/range data under scene.components[*].props.
- Output strict JSON only: no comments, no markdown fences, no trailing commas.
- Do not use null anywhere in the output.
- For optional fields, omit the key entirely when not needed.
- For every compare/swap event, i and j must both be integers.
- For search target comparisons, set j equal to i (never null).`;

  const user = `User question:\n${question}\n\nNormalized input:\n${formatInputSummary(
    normalizedInput
  )}\n\nExplanation text:\n${explanation}\n\nRecent chat history:\n${formatHistory(
    history
  )}\n\nReturn only JSON.`;

  return { system, user };
}

export function buildSpecRepairPrompts({
  question,
  normalizedInput,
  explanation,
  invalidSpec,
  validationError,
  repairHint,
}: RepairPromptContext) {
  const system = `You are repairing a JSON visualization spec so it passes strict schema validation.
Return corrected JSON only.
Rules:
- Keep the same top-level schema and algorithm intent.
- Do not use null anywhere.
- For compare/swap events, i and j must both be integers.
- For target comparisons, use j equal to i.
- scene.components should usually be objects with only id + type.
- Remove duplicate component types in scene.components (keep one entry per type).
- Ensure scene.components includes one CodeBlock component.
- For mergesort specs, ensure scene.components includes MergeView and merge phases include state.merge.
- If a props value is an array/object/null, remove that props key or remove props entirely.
- Omit optional keys entirely when unused.
- Output valid JSON only (no markdown, no comments).`;

  const hintBlock = repairHint ? `\nRepair hint:\n${repairHint}\n` : "";

  const user = `Fix this invalid arrays visualization spec.

User question:
${question}

Normalized input:
${formatInputSummary(normalizedInput)}

Explanation:
${explanation}

Validation errors:
${validationError}
${hintBlock}

Invalid JSON to repair:
${invalidSpec}

Return corrected JSON only.`;

  return { system, user };
}
