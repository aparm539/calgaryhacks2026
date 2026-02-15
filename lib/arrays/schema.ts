import { z } from "zod";
import {
  ARRAYS_ALGORITHMS,
  MAX_ARRAY_LENGTH,
  MAX_CODE_LINES,
  MAX_TIMELINE_STEPS,
  REGISTRY_COMPONENT_TYPES,
  type ArraysVizSpec,
} from "@/lib/arrays/types";

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
