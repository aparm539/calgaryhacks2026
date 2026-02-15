import { NextResponse } from "next/server";
import { ArraysParserError, normalizeArraysPrompt } from "@/lib/arrays/parser";
import {
  ArraysSpecValidationError,
  parseAndValidateArraysSpec,
} from "@/lib/arrays/schema";
import {
  type ArraysChatHistoryMessage,
  type ArraysChatRequest,
  type ArraysVizSpec,
  type NormalizedArraysInput,
} from "@/lib/arrays/types";
import {
  buildExplainerPrompts,
  buildSpecRepairPrompts,
  buildVisualizationPrompts,
} from "@/lib/arrays/prompts";
import {
  WatsonxRequestError,
  callWatsonxChat,
  getWatsonxAccessToken,
} from "@/lib/watsonx";

const SPEC_MAX_REPAIR_ATTEMPTS = 3;

type BuildSpecParams = {
  apiKey: string;
  projectId: string;
  modelId: string;
  accessToken: string;
  question: string;
  history: ArraysChatHistoryMessage[];
  explanation: string;
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

  return hints.join(" ");
}

async function generateValidatedSpec({
  apiKey,
  projectId,
  modelId,
  accessToken,
  question,
  history,
  explanation,
  normalizedInput,
}: BuildSpecParams) {
  const visualizationPrompts = buildVisualizationPrompts({
    question,
    normalizedInput,
    history,
    explanation,
  });

  let candidateSpec = await callWatsonxChat({
    apiKey,
    projectId,
    modelId,
    accessToken,
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
        explanation,
        invalidSpec: candidateSpec,
        validationError: error.details ?? error.message,
        repairHint: buildRepairHint(error.details),
      });

      candidateSpec = await callWatsonxChat({
        apiKey,
        projectId,
        modelId,
        accessToken,
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

    const apiKey = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;
    const modelId =
      process.env.WATSONX_MODEL_ID || "meta-llama/llama-3-3-70b-instruct";

    if (!apiKey || !projectId) {
      return NextResponse.json(
        { error: "Missing WATSONX_API_KEY or WATSONX_PROJECT_ID." },
        { status: 500 }
      );
    }

    const accessToken = await getWatsonxAccessToken(apiKey);

    const explainerPrompts = buildExplainerPrompts({
      question: message,
      normalizedInput,
      history,
    });

    const explanation = await callWatsonxChat({
      apiKey,
      projectId,
      modelId,
      accessToken,
      messages: [
        { role: "system", content: explainerPrompts.system },
        { role: "user", content: explainerPrompts.user },
      ],
      temperature: 0.35,
      maxTokens: 700,
    });

    const spec = await generateValidatedSpec({
      apiKey,
      projectId,
      modelId,
      accessToken,
      question: message,
      history,
      explanation,
      normalizedInput,
    });

    return NextResponse.json({
      explanation,
      spec,
      normalizedInput,
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

    if (error instanceof WatsonxRequestError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
