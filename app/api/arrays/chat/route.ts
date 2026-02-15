import { NextResponse } from "next/server";
import { ArraysParserError, normalizeArraysPrompt } from "@/lib/arrays/parser";
import {
  ArraysSpecValidationError,
  parseAndValidateArraysSpec,
} from "@/lib/arrays/schema";
import {
  DEFAULT_OPENROUTER_ARRAYS_MODEL,
  MAX_TIMELINE_STEPS,
  type ArraysAlgorithm,
  type ArraysChatHistoryMessage,
  type ArraysChatRequest,
  type ArraysProvider,
  type ArraysVizSpec,
  type NormalizedArraysInput,
} from "@/lib/arrays/types";
import {
  buildSpecRepairPrompts,
  buildVisualizationPrompts,
} from "@/lib/arrays/prompts";
import {
  OpenRouterRequestError,
  callOpenRouterChat,
} from "@/lib/openrouter";
import {
  WatsonxRequestError,
  callWatsonxChat,
  getWatsonxAccessToken,
} from "@/lib/watsonx";

const SPEC_MAX_REPAIR_ATTEMPTS = 3;
const RECURSIVE_ALGORITHMS = new Set<ArraysAlgorithm>(["quicksort", "mergesort"]);
const DEFAULT_WATSON_MODEL = "meta-llama/llama-3-3-70b-instruct";

type ModelChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelChatParams = {
  messages: ModelChatMessage[];
  temperature: number;
  maxTokens: number;
};

type ModelChatFn = (params: ModelChatParams) => Promise<string>;

type BuildSpecParams = {
  requestModelChat: ModelChatFn;
  question: string;
  history: ArraysChatHistoryMessage[];
  normalizedInput: NormalizedArraysInput;
};

type QuicksortPhase =
  | "enter"
  | "base"
  | "divide"
  | "recurse-left"
  | "recurse-right"
  | "return";

type QuicksortTraceContext = {
  array: number[];
  steps: ArraysVizSpec["steps"];
  nextStepId: number;
  nextCallId: number;
};

function isRecursiveAlgorithm(algorithm: ArraysAlgorithm) {
  return RECURSIVE_ALGORITHMS.has(algorithm);
}

function stripMarkdownFences(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutStart.replace(/\s*```$/, "").trim();
}

function getCandidateStepCount(candidateSpec: string) {
  try {
    const parsed = JSON.parse(stripMarkdownFences(candidateSpec)) as {
      steps?: unknown;
    };
    if (Array.isArray(parsed.steps)) {
      return parsed.steps.length;
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeHistory(history?: ArraysChatHistoryMessage[]) {
  if (!history?.length) {
    return [];
  }

  return history
    .filter(
      (item) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

function sanitizeProvider(provider?: string): ArraysProvider {
  return provider === "openrouter" ? "openrouter" : "watson";
}

function sanitizeModelId(modelId?: string) {
  if (typeof modelId !== "string") {
    return null;
  }

  const trimmed = modelId.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function validateAlgorithmMatch(
  spec: ArraysVizSpec,
  normalizedInput: NormalizedArraysInput
) {
  if (spec.algorithm !== normalizedInput.algorithm) {
    throw new ArraysSpecValidationError(
      "Visualization spec failed validation.",
      `Expected algorithm ${normalizedInput.algorithm} but received ${spec.algorithm}.`
    );
  }
}

function buildRepairHint(validationDetails?: string) {
  if (!validationDetails) {
    return "";
  }

  const hints: string[] = [];

  if (
    validationDetails.includes("scene.components") &&
    validationDetails.includes(".props")
  ) {
    hints.push(
      "Remove scene.components[*].props keys that contain arrays or objects (for example props.array or props.code). Keep scene.components mostly as id + type."
    );
  }

  if (validationDetails.includes("events") && validationDetails.includes(".j")) {
    hints.push(
      "Every event must include integer i and j. For search target comparisons, set j equal to i."
    );
  }

  if (validationDetails.includes("state.merge")) {
    hints.push(
      "For mergesort merge phases, include state.merge with left, right, merged, and optional writeRange."
    );
  }

  if (
    validationDetails.includes("scene.components") &&
    validationDetails.includes("MergeView")
  ) {
    hints.push(
      "When algorithm is mergesort, include one MergeView component in scene.components."
    );
  }

  if (
    validationDetails.includes("scene.components") &&
    validationDetails.includes("StackView")
  ) {
    hints.push(
      "For quicksort and mergesort, include one StackView in scene.components."
    );
  }

  if (validationDetails.includes("state.recursion")) {
    hints.push(
      "For quicksort and mergesort, include state.recursion on every step with callId, fn, depth, phase, and args."
    );
  }

  if (validationDetails.includes("state.stack")) {
    hints.push(
      "For quicksort and mergesort, include a non-empty state.stack on every step."
    );
  }

  if (validationDetails.includes("depth jump")) {
    hints.push(
      "Recursive depth can only change by -1, 0, or +1 between adjacent steps."
    );
  }

  if (validationDetails.includes('caption') && validationDetails.includes("Recursion")) {
    hints.push('Do not use generic caption "Recursion"; use specific call-phase captions.');
  }

  if (
    validationDetails.includes('phase "divide"') &&
    validationDetails.includes("partition")
  ) {
    hints.push("Quicksort divide phases must include state.partition.");
  }

  if (
    validationDetails.includes(
      "Quicksort divide phases must include state.partition"
    )
  ) {
    hints.push("For quicksort, every divide phase must include state.partition.");
  }

  if (
    validationDetails.includes('phase "combine"') &&
    validationDetails.includes("merge")
  ) {
    hints.push("Mergesort combine phases must include state.merge.");
  }

  if (
    validationDetails.includes("is missing required phase") ||
    validationDetails.includes('must include phase "return"') ||
    validationDetails.includes('must begin with phase "enter"')
  ) {
    hints.push(
      "Give every recursive invocation a unique callId and keep a full phase lifecycle per callId in order (quicksort: enter -> base -> return OR enter -> divide -> recurse-left -> recurse-right -> return)."
    );
  }

  if (
    validationDetails.includes(
      'Last recursive step must end at depth 0 with phase "return".'
    )
  ) {
    hints.push(
      'Ensure the final step is the root call at depth 0 with recursion.phase set to "return".'
    );
  }

  if (
    validationDetails.includes(
      'First recursive step must start at depth 0 with phase "enter".'
    )
  ) {
    hints.push(
      'Ensure the first step is the root call at depth 0 with recursion.phase set to "enter".'
    );
  }

  return hints.join(" ");
}

function getQuicksortCodeLineForPhase(phase: QuicksortPhase) {
  switch (phase) {
    case "enter":
      return 1;
    case "base":
      return 2;
    case "divide":
      return 3;
    case "recurse-left":
      return 4;
    case "recurse-right":
      return 5;
    case "return":
      return 6;
    default:
      return 1;
  }
}

function createValidRange(arrayLength: number, lo: number, hi: number) {
  if (lo < 0 || hi < 0 || lo >= arrayLength || hi >= arrayLength || lo > hi) {
    return undefined;
  }

  return { l: lo, r: hi };
}

function createValidPointers(arrayLength: number, lo: number, hi: number) {
  const pointers: Record<string, number> = {};

  if (lo >= 0 && lo < arrayLength) {
    pointers.lo = lo;
  }

  if (hi >= 0 && hi < arrayLength) {
    pointers.hi = hi;
  }

  return Object.keys(pointers).length > 0 ? pointers : undefined;
}

function partitionLomuto(values: number[], lo: number, hi: number) {
  const pivotValue = values[hi];
  let storeIndex = lo;

  for (let scanIndex = lo; scanIndex < hi; scanIndex += 1) {
    if (values[scanIndex] <= pivotValue) {
      [values[storeIndex], values[scanIndex]] = [
        values[scanIndex],
        values[storeIndex],
      ];
      storeIndex += 1;
    }
  }

  [values[storeIndex], values[hi]] = [values[hi], values[storeIndex]];

  return {
    pivotIndex: storeIndex,
    pivotValue,
  };
}

type PushQuicksortStepParams = {
  context: QuicksortTraceContext;
  callId: string;
  parentCallId?: string;
  depth: number;
  phase: QuicksortPhase;
  lo: number;
  hi: number;
  stack: string[];
  caption: string;
  partition?: {
    pivotIndex: number;
    less: number[];
    greater: number[];
  };
  events?: ArraysVizSpec["steps"][number]["events"];
};

function pushQuicksortStep({
  context,
  callId,
  parentCallId,
  depth,
  phase,
  lo,
  hi,
  stack,
  caption,
  partition,
  events,
}: PushQuicksortStepParams) {
  const range = createValidRange(context.array.length, lo, hi);
  const basePointers = createValidPointers(context.array.length, lo, hi);
  const pointers =
    phase === "divide" && partition
      ? {
          ...(basePointers ?? {}),
          pivot: partition.pivotIndex,
        }
      : basePointers;

  context.steps.push({
    id: `s${context.nextStepId}`,
    caption,
    activeCodeLine: getQuicksortCodeLineForPhase(phase),
    state: {
      array: [...context.array],
      ...(pointers ? { pointers } : {}),
      ...(range ? { range } : {}),
      stack: [...stack],
      recursion: {
        callId,
        ...(parentCallId ? { parentCallId } : {}),
        fn: "quicksort",
        depth,
        phase,
        args: `lo=${lo} hi=${hi}`,
      },
      ...(partition ? { partition } : {}),
    },
    ...(events && events.length > 0 ? { events } : {}),
  });
  context.nextStepId += 1;
}

type TraceQuicksortCallParams = {
  context: QuicksortTraceContext;
  lo: number;
  hi: number;
  depth: number;
  parentCallId?: string;
  stackPrefix: string[];
};

function traceQuicksortCall({
  context,
  lo,
  hi,
  depth,
  parentCallId,
  stackPrefix,
}: TraceQuicksortCallParams) {
  const callId = `q${context.nextCallId}`;
  context.nextCallId += 1;

  const stack = [...stackPrefix, `${callId}(lo=${lo}, hi=${hi})`];
  const argsText = `lo=${lo}, hi=${hi}`;

  pushQuicksortStep({
    context,
    callId,
    parentCallId,
    depth,
    phase: "enter",
    lo,
    hi,
    stack,
    caption: `Enter quicksort(${argsText})`,
  });

  if (lo >= hi) {
    pushQuicksortStep({
      context,
      callId,
      parentCallId,
      depth,
      phase: "base",
      lo,
      hi,
      stack,
      caption: `Base case reached for quicksort(${argsText})`,
    });

    pushQuicksortStep({
      context,
      callId,
      parentCallId,
      depth,
      phase: "return",
      lo,
      hi,
      stack,
      caption: `Return from quicksort(${argsText})`,
    });
    return;
  }

  const { pivotIndex, pivotValue } = partitionLomuto(context.array, lo, hi);
  const partition = {
    pivotIndex,
    less: context.array.slice(lo, pivotIndex),
    greater: context.array.slice(pivotIndex + 1, hi + 1),
  };
  const divideEvents: ArraysVizSpec["steps"][number]["events"] = [
    { type: "compare", i: hi, j: hi, outcome: "eq" },
    { type: "swap", i: pivotIndex, j: hi },
  ];

  pushQuicksortStep({
    context,
    callId,
    parentCallId,
    depth,
    phase: "divide",
    lo,
    hi,
    stack,
    caption: `Partition [${lo}, ${hi}] with pivot ${pivotValue} at index ${pivotIndex}`,
    partition,
    events: divideEvents,
  });

  const leftLo = lo;
  const leftHi = pivotIndex - 1;
  const rightLo = pivotIndex + 1;
  const rightHi = hi;

  pushQuicksortStep({
    context,
    callId,
    parentCallId,
    depth,
    phase: "recurse-left",
    lo,
    hi,
    stack,
    caption: `Recurse left: quicksort(lo=${leftLo}, hi=${leftHi})`,
  });

  traceQuicksortCall({
    context,
    lo: leftLo,
    hi: leftHi,
    depth: depth + 1,
    parentCallId: callId,
    stackPrefix: stack,
  });

  pushQuicksortStep({
    context,
    callId,
    parentCallId,
    depth,
    phase: "recurse-right",
    lo,
    hi,
    stack,
    caption: `Recurse right: quicksort(lo=${rightLo}, hi=${rightHi})`,
  });

  traceQuicksortCall({
    context,
    lo: rightLo,
    hi: rightHi,
    depth: depth + 1,
    parentCallId: callId,
    stackPrefix: stack,
  });

  pushQuicksortStep({
    context,
    callId,
    parentCallId,
    depth,
    phase: "return",
    lo,
    hi,
    stack,
    caption: `Return from quicksort(${argsText})`,
  });
}

function buildDeterministicQuicksortSpec(
  normalizedInput: NormalizedArraysInput
): ArraysVizSpec {
  const traceContext: QuicksortTraceContext = {
    array: [...normalizedInput.array],
    steps: [],
    nextStepId: 0,
    nextCallId: 0,
  };

  traceQuicksortCall({
    context: traceContext,
    lo: 0,
    hi: traceContext.array.length - 1,
    depth: 0,
    stackPrefix: [],
  });

  return {
    version: "1.0",
    algorithm: "quicksort",
    title: `Quicksort walkthrough for [${normalizedInput.array.join(", ")}]`,
    code: {
      lines: [
        "function quicksort(a, lo, hi):",
        "  if lo >= hi: return",
        "  p = partition(a, lo, hi)",
        "  quicksort(a, lo, p - 1)",
        "  quicksort(a, p + 1, hi)",
        "  return",
      ],
    },
    scene: {
      components: [
        { id: "bars", type: "BarArrayView" },
        { id: "pointer", type: "Pointer" },
        { id: "range", type: "RangeHighlight" },
        { id: "swap", type: "SwapAnimation" },
        { id: "compare", type: "CompareAnimation" },
        { id: "partition", type: "PartitionView" },
        { id: "stack", type: "StackView" },
        { id: "caption", type: "CaptionCallout" },
        { id: "code", type: "CodeBlock" },
        { id: "timeline", type: "TimelineStepper" },
      ],
    },
    steps: traceContext.steps,
  };
}

function buildDeterministicFallbackSpec(
  normalizedInput: NormalizedArraysInput
) {
  if (normalizedInput.algorithm === "quicksort") {
    return buildDeterministicQuicksortSpec(normalizedInput);
  }

  return null;
}

async function generateValidatedSpec({
  requestModelChat,
  question,
  history,
  normalizedInput,
}: BuildSpecParams) {
  const visualizationPrompts = buildVisualizationPrompts({
    question,
    normalizedInput,
    history,
  });

  let candidateSpec = await requestModelChat({
    messages: [
      { role: "system", content: visualizationPrompts.system },
      { role: "user", content: visualizationPrompts.user },
    ],
    temperature: 0,
    maxTokens: 3500,
  });

  let lastValidationError: ArraysSpecValidationError | null = null;

  for (let attempt = 0; attempt <= SPEC_MAX_REPAIR_ATTEMPTS; attempt += 1) {
    try {
      const spec = parseAndValidateArraysSpec(candidateSpec);
      validateAlgorithmMatch(spec, normalizedInput);
      return spec;
    } catch (error) {
      if (!(error instanceof ArraysSpecValidationError)) {
        throw error;
      }

      lastValidationError = error;

      if (attempt >= SPEC_MAX_REPAIR_ATTEMPTS) {
        break;
      }

      const repairPrompts = buildSpecRepairPrompts({
        question,
        normalizedInput,
        invalidSpec: candidateSpec,
        validationError: error.details ?? error.message,
        repairHint: buildRepairHint(error.details),
      });

      candidateSpec = await requestModelChat({
        messages: [
          { role: "system", content: repairPrompts.system },
          { role: "user", content: repairPrompts.user },
        ],
        temperature: 0,
        maxTokens: 3500,
      });
    }
  }

  const fallbackSpec = buildDeterministicFallbackSpec(normalizedInput);
  if (fallbackSpec) {
    try {
      const validatedFallback = parseAndValidateArraysSpec(
        JSON.stringify(fallbackSpec)
      );
      validateAlgorithmMatch(validatedFallback, normalizedInput);
      return validatedFallback;
    } catch {
      // Keep the original validation error if deterministic fallback is invalid.
    }
  }

  if (isRecursiveAlgorithm(normalizedInput.algorithm)) {
    const stepCount = getCandidateStepCount(candidateSpec);
    if (stepCount !== null && stepCount >= MAX_TIMELINE_STEPS) {
      throw new ArraysSpecValidationError(
        "Visualization spec failed validation.",
        `Recursive detail exceeded step budget of ${MAX_TIMELINE_STEPS} steps. Provide a smaller array so the full recursion lifecycle can be shown.`
      );
    }
  }

  throw (
    lastValidationError ??
    new ArraysSpecValidationError("Visualization spec failed validation.")
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ArraysChatRequest;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const normalizedInput = normalizeArraysPrompt(message);
    const history = sanitizeHistory(body.history);
    const provider = sanitizeProvider(body.provider);
    const requestedModelId = sanitizeModelId(body.modelId);
    let modelId: string;
    let requestModelChat: ModelChatFn;

    if (provider === "openrouter") {
      const apiKey = process.env.OPENROUTER_API_KEY;
      modelId =
        requestedModelId ??
        process.env.OPENROUTER_MODEL_ID ??
        DEFAULT_OPENROUTER_ARRAYS_MODEL;

      if (!apiKey) {
        return NextResponse.json(
          { error: "Missing OPENROUTER_API_KEY." },
          { status: 500 }
        );
      }

      requestModelChat = ({ messages, temperature, maxTokens }) =>
        callOpenRouterChat({
          apiKey,
          modelId,
          messages,
          temperature,
          maxTokens,
        });
    } else {
      const apiKey = process.env.WATSONX_API_KEY;
      const projectId = process.env.WATSONX_PROJECT_ID;
      modelId =
        requestedModelId ?? process.env.WATSONX_MODEL_ID ?? DEFAULT_WATSON_MODEL;

      if (!apiKey || !projectId) {
        return NextResponse.json(
          { error: "Missing WATSONX_API_KEY or WATSONX_PROJECT_ID." },
          { status: 500 }
        );
      }

      const accessToken = await getWatsonxAccessToken(apiKey);
      requestModelChat = ({ messages, temperature, maxTokens }) =>
        callWatsonxChat({
          apiKey,
          projectId,
          modelId,
          accessToken,
          messages,
          temperature,
          maxTokens,
        });
    }

    const spec = await generateValidatedSpec({
      requestModelChat,
      question: message,
      history,
      normalizedInput,
    });

    return NextResponse.json({
      spec,
      normalizedInput,
      provider,
      modelId,
    });
  } catch (error) {
    if (error instanceof ArraysParserError) {
      return NextResponse.json(
        {
          error: "Invalid arrays prompt.",
          details: error.message,
        },
        { status: 422 }
      );
    }

    if (error instanceof ArraysSpecValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: 422 }
      );
    }

    if (
      error instanceof WatsonxRequestError ||
      error instanceof OpenRouterRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
