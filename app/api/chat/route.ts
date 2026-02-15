import { NextResponse } from "next/server";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message: string;
  history?: ClientMessage[];
};

const SYSTEM_PROMPT = `You are a data structures and algorithms tutor and visualizer.

When the user asks about a data structure or algorithm, respond with:
1. A short explanation of what you did and why (2-3 sentences).
2. A conceptual follow-up question to test the user's understanding (e.g. "What would happen if we inserted 5 next?" or "What is the time complexity of this operation?").
3. Exactly one code block tagged dsaupdate with valid JSON: {"mode":"bst|linked-list|queue|stack","values":[numbers],"explanation":"short summary of the change"}.

Do NOT include flowjson or mermaid blocks. The visualization is handled automatically from dsaupdate.
Keep your visible text educational, concise, and conversational. Always include at least one value in dsaupdate.values.`;

const IAM_URL = "https://iam.cloud.ibm.com/identity/token";
const CHAT_URL =
  "https://ca-tor.ml.cloud.ibm.com/ml/v1/text/chat?version=2023-05-29";

async function getAccessToken(apiKey: string) {
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
    const errorText = await response.text();
    throw new Error(`IAM token error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("IAM token missing in response.");
  }

  return data.access_token;
}

function extractContent(data: Record<string, unknown>) {
  const anyData = data as {
    choices?: { message?: { content?: string } }[];
    results?: { generated_text?: string; output_text?: string }[];
    output?: { message?: { content?: string } }[];
  };

  return (
    anyData.choices?.[0]?.message?.content ||
    anyData.results?.[0]?.generated_text ||
    anyData.results?.[0]?.output_text ||
    anyData.output?.[0]?.message?.content ||
    ""
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

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

    const accessToken = await getAccessToken(apiKey);

    const history = (body.history || []).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const payload = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
      project_id: projectId,
      model_id: modelId,
      temperature: 0.4,
      max_tokens: 1200,
    };

    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Watsonx error: ${response.status} ${errorText}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const content = extractContent(data);

    if (!content) {
      return NextResponse.json(
        { error: "Empty response from model." },
        { status: 502 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
