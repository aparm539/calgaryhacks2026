export type OpenRouterRole = "system" | "user" | "assistant";

export type OpenRouterMessage = {
  role: OpenRouterRole;
  content: string;
};

export type OpenRouterChatParams = {
  apiKey: string;
  modelId: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
};

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
    this.name = "OpenRouterRequestError";
  }
}

type OpenRouterMessageContentPart = {
  type?: string;
  text?: string;
};

function extractMessageContent(data: Record<string, unknown>) {
  const payload = data as {
    choices?: {
      message?: {
        content?: string | OpenRouterMessageContentPart[];
      };
    }[];
  };

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim();
  }

  return "";
}

export async function callOpenRouterChat({
  apiKey,
  modelId,
  messages,
  temperature = 0.25,
  maxTokens = 100000,
}: OpenRouterChatParams) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const appUrl =
    process.env.OPENROUTER_HTTP_REFERER || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    headers["HTTP-Referer"] = appUrl;
  }

  const appName = process.env.OPENROUTER_APP_NAME || process.env.NEXT_PUBLIC_APP_NAME;
  if (appName) {
    headers["X-Title"] = appName;
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OpenRouterRequestError(
      `OpenRouter error: ${response.status} ${text}`,
      response.status
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = extractMessageContent(data).trim();

  if (!content) {
    throw new OpenRouterRequestError("Empty response from OpenRouter.", 502);
  }

  return content;
}
