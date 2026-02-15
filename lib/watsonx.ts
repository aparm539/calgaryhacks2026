export type WatsonxRole = "system" | "user" | "assistant";

export type WatsonxMessage = {
  role: WatsonxRole;
  content: string;
};

export type WatsonxChatParams = {
  apiKey: string;
  projectId: string;
  modelId?: string;
  accessToken?: string;
  messages: WatsonxMessage[];
  temperature?: number;
  maxTokens?: number;
};

const IAM_URL = "https://iam.cloud.ibm.com/identity/token";
const CHAT_URL =
  "https://ca-tor.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29";

export class WatsonxRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
    this.name = "WatsonxRequestError";
  }
}

function extractMessageContent(data: Record<string, unknown>) {
  const modelData = data as {
    choices?: { message?: { content?: string } }[];
    results?: { generated_text?: string; output_text?: string }[];
    output?: { message?: { content?: string } }[];
  };

  return (
    modelData.choices?.[0]?.message?.content ||
    modelData.results?.[0]?.generated_text ||
    modelData.results?.[0]?.output_text ||
    modelData.output?.[0]?.message?.content ||
    ""
  );
}

export async function getWatsonxAccessToken(apiKey: string) {
  const form = new URLSearchParams();
  form.set("grant_type", "urn:ibm:params:oauth:grant-type:apikey");
  form.set("apikey", apiKey);

  const response = await fetch(IAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new WatsonxRequestError(
      `IAM token error: ${response.status} ${text}`,
      response.status
    );
  }

  const payload = (await response.json()) as { access_token?: string };

  if (!payload.access_token) {
    throw new WatsonxRequestError("IAM token missing in response.", 502);
  }

  return payload.access_token;
}

export async function callWatsonxChat({
  apiKey,
  projectId,
  modelId,
  accessToken,
  messages,
  temperature = 0.25,
  maxTokens = 1600,
}: WatsonxChatParams) {
  const token = accessToken ?? (await getWatsonxAccessToken(apiKey));

  const payload = {
    messages,
    project_id: projectId,
    model_id: modelId ?? "meta-llama/llama-3-3-70b-instruct",
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new WatsonxRequestError(
      `Watsonx error: ${response.status} ${text}`,
      response.status
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = extractMessageContent(data).trim();

  if (!content) {
    throw new WatsonxRequestError("Empty response from Watsonx.", 502);
  }

  return content;
}
