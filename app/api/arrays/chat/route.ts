import { NextResponse } from "next/server";
import { ArraysParserError, normalizeArraysPrompt } from "@/lib/arrays/parser";
import {
  ArraysSpecValidationError,
  parseAndValidateArraysSpec,
} from "@/lib/arrays/schema";
import {
  DEFAULT_OPENROUTER_ARRAYS_MODEL,
  type ArraysChatHistoryMessage,
  type ArraysChatRequest,
  type ArraysProvider,
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
    hints.push("Every event must include integer i and j.");
  }

  if (validationDetails.includes("state.recursion")) {
    hints.push(
      "If recursion is used, include state.recursion with callId, fn, depth, phase, and args."
    );
  }

  if (validationDetails.includes("state.stack")) {
    hints.push("If recursion is used, include a non-empty state.stack.");
  }

  if (validationDetails.includes("depth jump")) {
    hints.push(
      "Recursion depth can only change by -1, 0, or +1 between adjacent recursion steps."
    );
  }

  if (
    validationDetails.includes("is missing required phase") ||
    validationDetails.includes('must include phase "return"') ||
    validationDetails.includes('must begin with phase "enter"')
  ) {
    hints.push(
      "For recursive call traces, keep a full lifecycle per callId in order and include a final return phase."
    );
  }

  return hints.join(" ");
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
      return parseAndValidateArraysSpec(candidateSpec);
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
