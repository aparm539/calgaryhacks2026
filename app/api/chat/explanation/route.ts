import { NextResponse } from "next/server";
import { DSA_EXPLANATION_SYSTEM_PROMPT } from "@/lib/dsa/chat-prompts";
import {
  WatsonxRequestError,
  callWatsonxChat,
  getWatsonxAccessToken,
} from "@/lib/watsonx";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ExplanationRequest = {
  message: string;
  history?: ClientMessage[];
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExplanationRequest;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

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
    const explanation = await callWatsonxChat({
      apiKey,
      projectId,
      modelId,
      accessToken,
      messages: [
        { role: "system", content: DSA_EXPLANATION_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
      temperature: 0.35,
      maxTokens: 600,
    });

    return NextResponse.json({ explanation: explanation.trim() });
  } catch (error) {
    if (error instanceof WatsonxRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
