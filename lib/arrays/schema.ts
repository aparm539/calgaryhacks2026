import { z } from "zod";
import {
  ARRAYS_ALGORITHMS,
  MAX_ARRAY_LENGTH,
  MAX_CODE_LINES,
  MAX_TIMELINE_STEPS,
  RECURSION_PHASES,
  REGISTRY_COMPONENT_TYPES,
  type ArraysAlgorithm,
  type ArraysVizSpec,
  type RecursionPhase,
} from "@/lib/arrays/types";

const RECURSIVE_ALGORITHMS = new Set<ArraysAlgorithm>(["quicksort", "mergesort"]);

type RecursiveAlgorithm = "quicksort" | "mergesort";

type RecursionFrame = {
  stepIndex: number;
  callId: string;
  fn: string;
  depth: number;
  phase: RecursionPhase;
};

function isRecursiveAlgorithm(
  algorithm: ArraysAlgorithm
): algorithm is RecursiveAlgorithm {
  return RECURSIVE_ALGORITHMS.has(algorithm);
}

function hasComponentType(
  components: ArraysVizSpec["scene"]["components"],
  type: (typeof REGISTRY_COMPONENT_TYPES)[number]
) {
  return components.some((component) => component.type === type);
}

function findPhaseIndex(frames: RecursionFrame[], phase: RecursionPhase) {
  return frames.findIndex((frame) => frame.phase === phase);
}

function validateCallLifecycle(
  algorithm: RecursiveAlgorithm,
  callId: string,
  frames: RecursionFrame[]
) {
  const issues: string[] = [];
  if (!frames.length) {
    return issues;
  }

  if (frames[0].phase !== "enter") {
    issues.push(`Call ${callId} must begin with phase "enter".`);
  }

  const hasBase = frames.some((frame) => frame.phase === "base");
  const hasReturn = frames.some((frame) => frame.phase === "return");

  if (!hasReturn) {
    issues.push(`Call ${callId} must include phase "return".`);
  }

  if (hasBase) {
    const baseIndex = findPhaseIndex(frames, "base");
    const returnIndex = findPhaseIndex(frames, "return");
    if (baseIndex < 0 || returnIndex < 0 || baseIndex > returnIndex) {
      issues.push(`Call ${callId} base lifecycle must be enter -> base -> return.`);
    }

    const hasRecursivePhase = frames.some(
      (frame) =>
        frame.phase === "divide" ||
        frame.phase === "recurse-left" ||
        frame.phase === "recurse-right" ||
        frame.phase === "combine"
    );
    if (hasRecursivePhase) {
      issues.push(
        `Call ${callId} cannot mix base-case and divide/recurse/combine phases.`
      );
    }

    return issues;
  }

  const requiredPhases: RecursionPhase[] =
    algorithm === "mergesort"
      ? ["enter", "divide", "recurse-left", "recurse-right", "combine", "return"]
      : ["enter", "divide", "recurse-left", "recurse-right", "return"];

  let lastIndex = -1;
  requiredPhases.forEach((phase) => {
    const phaseIndex = findPhaseIndex(frames, phase);
    if (phaseIndex < 0) {
      issues.push(`Call ${callId} is missing required phase "${phase}".`);
      return;
    }

    if (phaseIndex < lastIndex) {
      issues.push(
        `Call ${callId} phase "${phase}" appears out of order for ${algorithm}.`
      );
      return;
    }

    lastIndex = phaseIndex;
  });

  return issues;
}

const primitivePropValueSchema = z.unknown().refine(
  (value): value is string | number | boolean =>
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)),
  {
    message:
      "Props values must be string, number, or boolean. Put array/code/state data in steps instead.",
  }
);

const componentPropsSchema = z
  .record(z.string(), primitivePropValueSchema)
  .optional();

const componentSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[0]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[1]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[2]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[3]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[4]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[5]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[6]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[7]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[8]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[9]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[10]),
      props: componentPropsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal(REGISTRY_COMPONENT_TYPES[11]),
      props: componentPropsSchema,
    })
    .strict(),
]);

const numberArraySchema = z
  .array(z.number().finite())
  .min(1)
  .max(MAX_ARRAY_LENGTH);

const stepEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("swap"),
      i: z.number().int(),
      j: z.number().int(),
    })
    .strict(),
  z
    .object({
      type: z.literal("compare"),
      i: z.number().int(),
      j: z.number().int(),
      outcome: z.enum(["lt", "eq", "gt"]).optional(),
    })
    .strict(),
]);

const stepStateSchema = z
  .object({
    array: numberArraySchema,
    pointers: z.record(z.string(), z.number().int()).optional(),
    range: z
      .object({
        l: z.number().int(),
        r: z.number().int(),
      })
      .strict()
      .optional(),
    stack: z.array(z.string()).max(128).optional(),
    recursion: z
      .object({
        callId: z.string().min(1),
        parentCallId: z.string().min(1).optional(),
        fn: z.string().min(1),
        depth: z.number().int().min(0),
        phase: z.enum(RECURSION_PHASES),
        args: z.string().min(1),
      })
      .strict()
      .optional(),
    partition: z
      .object({
        pivotIndex: z.number().int(),
        less: z.array(z.number().finite()),
        greater: z.array(z.number().finite()),
      })
      .strict()
      .optional(),
    merge: z
      .object({
        left: z.array(z.number().finite()).max(MAX_ARRAY_LENGTH),
        right: z.array(z.number().finite()).max(MAX_ARRAY_LENGTH),
        merged: z.array(z.number().finite()).max(MAX_ARRAY_LENGTH),
        writeRange: z
          .object({
            l: z.number().int(),
            r: z.number().int(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const stepSchema = z
  .object({
    id: z.string().min(1),
    caption: z.string().min(1),
    activeCodeLine: z.number().int().min(1),
    state: stepStateSchema,
    events: z.array(stepEventSchema).max(48).optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    const arrayLength = step.state.array.length;

    if (step.state.pointers) {
      Object.entries(step.state.pointers).forEach(([name, index]) => {
        if (index < 0 || index >= arrayLength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["state", "pointers", name],
            message: `Pointer index ${index} is out of bounds for array length ${arrayLength}.`,
          });
        }
      });
    }

    if (step.state.range) {
      const { l, r } = step.state.range;
      if (l < 0 || r < 0 || l >= arrayLength || r >= arrayLength || l > r) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state", "range"],
          message: `Range [${l}, ${r}] is invalid for array length ${arrayLength}.`,
        });
      }
    }

    if (
      step.state.partition &&
      (step.state.partition.pivotIndex < 0 ||
        step.state.partition.pivotIndex >= arrayLength)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state", "partition", "pivotIndex"],
        message: `pivotIndex ${step.state.partition.pivotIndex} is out of bounds for array length ${arrayLength}.`,
      });
    }

    if (step.state.merge) {
      const { left, right, merged, writeRange } = step.state.merge;

      if (merged.length > left.length + right.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state", "merge", "merged"],
          message:
            "Merged buffer cannot contain more elements than left + right.",
        });
      }

      if (writeRange) {
        const { l, r } = writeRange;
        if (l < 0 || r < 0 || l >= arrayLength || r >= arrayLength || l > r) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["state", "merge", "writeRange"],
            message: `writeRange [${l}, ${r}] is invalid for array length ${arrayLength}.`,
          });
        }
      }
    }

    if (step.events) {
      step.events.forEach((event, index) => {
        if (
          event.i < 0 ||
          event.j < 0 ||
          event.i >= arrayLength ||
          event.j >= arrayLength
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["events", index],
            message: `Event indices (${event.i}, ${event.j}) are invalid for array length ${arrayLength}.`,
          });
        }
      });
    }
  });

export const arraysVizSpecSchema = z
  .object({
    version: z.literal("1.0"),
    algorithm: z.enum(ARRAYS_ALGORITHMS),
    title: z.string().min(1).max(140),
    code: z
      .object({
        lines: z.array(z.string().min(1)).min(1).max(MAX_CODE_LINES),
      })
      .strict(),
    scene: z
      .object({
        components: z.array(componentSchema).min(1).max(32),
      })
      .strict(),
    steps: z.array(stepSchema).min(1).max(MAX_TIMELINE_STEPS),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const lineCount = spec.code.lines.length;

    spec.steps.forEach((step, index) => {
      if (step.activeCodeLine < 1 || step.activeCodeLine > lineCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "activeCodeLine"],
          message: `activeCodeLine ${step.activeCodeLine} is outside code lines range 1..${lineCount}.`,
        });
      }
    });

    if (!isRecursiveAlgorithm(spec.algorithm)) {
      return;
    }
    const recursiveAlgorithm = spec.algorithm;

    if (!hasComponentType(spec.scene.components, "StackView")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scene", "components"],
        message:
          "Recursive algorithms must include StackView in scene.components.",
      });
    }

    const recursionByCallId = new Map<string, RecursionFrame[]>();

    spec.steps.forEach((step, index) => {
      if (step.caption.trim().toLowerCase() === "recursion") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "caption"],
          message: 'Generic recursion caption "Recursion" is not allowed.',
        });
      }

      const stack = step.state.stack;
      if (!stack || stack.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "stack"],
          message:
            "Recursive algorithms require a non-empty state.stack on every step.",
        });
      }

      const recursion = step.state.recursion;
      if (!recursion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "recursion"],
          message:
            "Recursive algorithms require state.recursion on every step.",
        });
        return;
      }

      if (recursion.depth !== (stack?.length ?? 0) - 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "recursion", "depth"],
          message:
            "state.recursion.depth must equal state.stack.length - 1.",
        });
      }

      if (
        recursiveAlgorithm === "quicksort" &&
        recursion.phase === "divide" &&
        !step.state.partition
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "partition"],
          message:
            'Quicksort divide phases must include state.partition for the active call.',
        });
      }

      if (
        recursiveAlgorithm === "mergesort" &&
        recursion.phase === "combine" &&
        !step.state.merge
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "merge"],
          message:
            'Mergesort combine phases must include state.merge for the active call.',
        });
      }

      const frames = recursionByCallId.get(recursion.callId) ?? [];
      frames.push({
        stepIndex: index,
        callId: recursion.callId,
        fn: recursion.fn,
        depth: recursion.depth,
        phase: recursion.phase,
      });
      recursionByCallId.set(recursion.callId, frames);
    });

    const firstRecursion = spec.steps[0]?.state.recursion;
    if (firstRecursion) {
      if (firstRecursion.depth !== 0 || firstRecursion.phase !== "enter") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", 0, "state", "recursion"],
          message:
            'First recursive step must start at depth 0 with phase "enter".',
        });
      }
    }

    for (let index = 1; index < spec.steps.length; index += 1) {
      const previous = spec.steps[index - 1].state.recursion;
      const current = spec.steps[index].state.recursion;
      if (!previous || !current) {
        continue;
      }

      const depthDelta = current.depth - previous.depth;
      if (depthDelta < -1 || depthDelta > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "state", "recursion", "depth"],
          message:
            "Recursion depth jump between adjacent steps must be -1, 0, or +1.",
        });
        continue;
      }

      if (depthDelta === 1) {
        if (
          previous.phase !== "recurse-left" &&
          previous.phase !== "recurse-right"
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index - 1, "state", "recursion", "phase"],
            message:
              'Depth increase requires previous phase to be "recurse-left" or "recurse-right".',
          });
        }

        if (current.phase !== "enter") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, "state", "recursion", "phase"],
            message: 'Depth increase requires current phase to be "enter".',
          });
        }
      }

      if (depthDelta === -1 && previous.phase !== "return") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index - 1, "state", "recursion", "phase"],
          message: 'Depth decrease requires previous phase to be "return".',
        });
      }
    }

    const lastRecursion = spec.steps.at(-1)?.state.recursion;
    if (lastRecursion) {
      if (lastRecursion.depth !== 0 || lastRecursion.phase !== "return") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", spec.steps.length - 1, "state", "recursion"],
          message:
            'Last recursive step must end at depth 0 with phase "return".',
        });
      }
    }

    recursionByCallId.forEach((frames, callId) => {
      const callIssues = validateCallLifecycle(recursiveAlgorithm, callId, frames);
      callIssues.forEach((issue) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", frames[0].stepIndex, "state", "recursion"],
          message: issue,
        });
      });
    });
  });

export class ArraysSpecValidationError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "ArraysSpecValidationError";
    this.details = details;
  }
}

function stripMarkdownFences(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutStart.replace(/\s*```$/, "").trim();
}

function formatZodIssues(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseAndValidateArraysSpec(raw: string): ArraysVizSpec {
  const jsonText = stripMarkdownFences(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch {
    throw new ArraysSpecValidationError(
      "Visualization spec is not valid JSON.",
      "Model output could not be parsed as JSON."
    );
  }

  const parsed = arraysVizSpecSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new ArraysSpecValidationError(
      "Visualization spec failed validation.",
      formatZodIssues(parsed.error.issues)
    );
  }

  return parsed.data;
}
