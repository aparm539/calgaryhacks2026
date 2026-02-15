import { NextResponse } from "next/server";
import {
  WatsonxRequestError,
  callWatsonxChat,
  getWatsonxAccessToken,
} from "@/lib/watsonx";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type RouteDecisionRequest = {
  message: string;
  dsaHistory?: ClientMessage[];
  arraysHistory?: ClientMessage[];
};

type RouteDecision = {
  callDSA: boolean;
  callArrays: boolean;
  reason?: string;
  source: "model";
};

const ROUTER_SYSTEM_PROMPT = `You route user prompts to exactly one visualization engine.
Return strict JSON only:
{"callDSA":true|false,"callArrays":true|false,"reason":"short optional reason"}

Routing rules:
- callDSA=true for DSA playground intent (bst, linked list, queue, stack, tree operations, general non-array DSA operations).
- callArrays=true for arrays visualizer intent (array search/sort walkthroughs, explicit array literals, quicksort/mergesort/binary-search/linear-search).
- If user mentions both categories, choose the primary requested action and set only one target true.
- If unsure, set callDSA=true.
- Exactly one of callDSA/callArrays must be true.
- No markdown, no prose, no code fences.`;

function shouldRouteArrays(message: string) {
  const lowerMessage = message.toLowerCase();
  const hasArrayLiteral = /\[[^\]]+\]/.test(message);

  return (
    hasArrayLiteral ||
    lowerMessage.includes("array") ||
    lowerMessage.includes("sort") ||
    lowerMessage.includes("search") ||
    lowerMessage.includes("quicksort") ||
    lowerMessage.includes("quick sort") ||
    lowerMessage.includes("mergesort") ||
    lowerMessage.includes("merge sort") ||
    lowerMessage.includes("binary search") ||
    lowerMessage.includes("linear search")
  );
}

function stripMarkdownFences(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutStart.replace(/\s*```$/, "").trim();
}

function sanitizeHistory(history?: ClientMessage[]) {
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
    .slice(-6)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

function formatHistory(name: string, history: ClientMessage[]) {
  if (!history.length) {
    return `${name}: none`;
  }

  const lines = history
    .map((item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
  return `${name}:\n${lines}`;
}

function parseRouteDecision(raw: string, message: string): Omit<RouteDecision, "source"> {
  const text = stripMarkdownFences(raw);
  const parsed = JSON.parse(text) as {
    callDSA?: unknown;
    callArrays?: unknown;
    reason?: unknown;
  };

  const callDSA = typeof parsed.callDSA === "boolean" ? parsed.callDSA : true;
  const callArrays =
    typeof parsed.callArrays === "boolean" ? parsed.callArrays : false;

  if (callDSA === callArrays) {
    const shouldUseArrays = shouldRouteArrays(message);

    return {
      callDSA: !shouldUseArrays,
      callArrays: shouldUseArrays,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim().length > 0
          ? `${parsed.reason} Normalized to a single route target.`
          : "Router returned an invalid multi-target result. Normalized to one route target.",
    };
  }

  return {
    callDSA,
    callArrays,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RouteDecisionRequest;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const dsaHistory = sanitizeHistory(body.dsaHistory);
    const arraysHistory = sanitizeHistory(body.arraysHistory);

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

    const routerUserPrompt = `User prompt:
${message}

Recent histories:
${formatHistory("DSA history", dsaHistory)}

${formatHistory("Arrays history", arraysHistory)}

Return JSON only.`;

    const rawDecision = await callWatsonxChat({
      apiKey,
      projectId,
      modelId,
      accessToken,
      messages: [
        { role: "system", content: ROUTER_SYSTEM_PROMPT },
        { role: "user", content: routerUserPrompt },
      ],
      temperature: 0,
      maxTokens: 180,
    });

    const parsedDecision = parseRouteDecision(rawDecision, message);
    return NextResponse.json({
      ...parsedDecision,
      source: "model",
    } satisfies RouteDecision);
  } catch (error) {
    if (
      error instanceof WatsonxRequestError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Route decision failed.",
        },
        { status: 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
