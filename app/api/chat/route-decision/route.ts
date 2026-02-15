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

const ROUTER_SYSTEM_PROMPT = `You route user prompts to one or both visualization engines.
Return strict JSON only:
{"callDSA":true|false,"callArrays":true|false,"reason":"short optional reason"}

Routing rules:
- callDSA=true for DSA playground intent (bst, linked list, queue, stack, tree operations, general non-array DSA operations).
- callArrays=true for arrays visualizer intent (array search/sort walkthroughs, explicit array literals, quicksort/mergesort/binary-search/linear-search).
- If user asks for both, set both true.
- If unsure, set callDSA=true.
- At least one of callDSA/callArrays must be true.
- No markdown, no prose, no code fences.`;

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

function parseRouteDecision(raw: string): Omit<RouteDecision, "source"> {
  const text = stripMarkdownFences(raw);
  const parsed = JSON.parse(text) as {
    callDSA?: unknown;
    callArrays?: unknown;
    reason?: unknown;
  };

  const callDSA = typeof parsed.callDSA === "boolean" ? parsed.callDSA : true;
  const callArrays =
    typeof parsed.callArrays === "boolean" ? parsed.callArrays : false;

  if (!callDSA && !callArrays) {
    return {
      callDSA: true,
      callArrays: false,
      reason:
        "Router returned no target. Forced DSA to ensure at least one responder.",
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

    const parsedDecision = parseRouteDecision(rawDecision);
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
