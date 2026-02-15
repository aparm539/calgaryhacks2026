"use client";

// Shared chat panel — routes each prompt to the needed visualizer APIs.
// It extracts DSA updates and forwards arrays payloads to parent callbacks.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PlaygroundUpdate, StructureMode } from "@/lib/dsa-playground-types";
import {
  DEFAULT_OPENROUTER_ARRAYS_MODEL,
  OPENROUTER_ARRAYS_MODELS,
  type ArraysProvider,
  type ArraysChatErrorResponse,
  type ArraysChatSuccessResponse,
} from "@/lib/arrays/types";

// A single chat message (user or assistant)
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatUIProps = {
  onPlaygroundUpdate?: (update: PlaygroundUpdate) => void;
  onArraysResult?: (payload: ArraysChatSuccessResponse) => void;
  messages?: Message[];
  onAddMessage?: (message: Message) => void;
  onClearMessages?: () => void;
};

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type DSAChatSuccessResponse = {
  content: string;
};

type DSAChatErrorResponse = {
  error: string;
};

type ExplanationSuccessResponse = {
  explanation: string;
};

type ExplanationErrorResponse = {
  error: string;
};

type RouteDecisionSuccessResponse = {
  callDSA: boolean;
  callArrays: boolean;
  reason?: string;
  source?: "model" | "fallback";
};

type RouteDecisionErrorResponse = {
  error: string;
};

function formatErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error =
    "error" in payload && typeof payload.error === "string"
      ? payload.error
      : null;
  const details =
    "details" in payload && typeof payload.details === "string"
      ? payload.details
      : null;

  if (!error) {
    return fallback;
  }

  if (details) {
    return `${error} ${details}`;
  }

  return error;
}

function shouldRequestArraysResult(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  const hasArrayLiteral = /\[[^\]]+\]/.test(prompt);
  const hasKnownArraysAlgorithm =
    lowerPrompt.includes("quicksort") ||
    lowerPrompt.includes("quick sort") ||
    lowerPrompt.includes("mergesort") ||
    lowerPrompt.includes("merge sort") ||
    lowerPrompt.includes("binary search") ||
    lowerPrompt.includes("linear search");
  const hasArraySearchOrSortIntent =
    lowerPrompt.includes("array") &&
    (lowerPrompt.includes("search") || lowerPrompt.includes("sort"));

  return (
    hasArrayLiteral || hasKnownArraysAlgorithm || hasArraySearchOrSortIntent
  );
}

async function requestDSAChat(message: string, history: ChatHistoryItem[]) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const payload = (await response.json().catch(() => null)) as
    | DSAChatSuccessResponse
    | DSAChatErrorResponse
    | null;

  if (!response.ok || !payload || "error" in payload) {
    throw new Error(formatErrorMessage(payload, "DSA request failed."));
  }

  return payload;
}

type ArraysRequestOptions = {
  provider: ArraysProvider;
  modelId?: string;
};

async function requestArraysChat(
  message: string,
  history: ChatHistoryItem[],
  options: ArraysRequestOptions
) {
  const response = await fetch("/api/arrays/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      provider: options.provider,
      modelId: options.modelId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ArraysChatSuccessResponse
    | ArraysChatErrorResponse
    | null;

  if (!response.ok || !payload || "error" in payload) {
    throw new Error(formatErrorMessage(payload, "Arrays request failed."));
  }

  return payload;
}

async function requestExplanation(message: string, history: ChatHistoryItem[]) {
  const response = await fetch("/api/chat/explanation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ExplanationSuccessResponse
    | ExplanationErrorResponse
    | null;

  if (!response.ok || !payload || "error" in payload) {
    throw new Error(formatErrorMessage(payload, "Explanation request failed."));
  }

  return payload;
}

async function requestRouteDecision(
  message: string,
  dsaHistory: ChatHistoryItem[],
  arraysHistory: ChatHistoryItem[]
) {
  const response = await fetch("/api/chat/route-decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, dsaHistory, arraysHistory }),
  });

  const payload = (await response.json().catch(() => null)) as
    | RouteDecisionSuccessResponse
    | RouteDecisionErrorResponse
    | null;

  if (!response.ok || !payload || "error" in payload) {
    throw new Error(formatErrorMessage(payload, "Route decision request failed."));
  }

  return payload;
}

// Loose shape used when trying to infer a playground update from flowjson
type FlowJsonLike = {
  nodes?: Array<{ id?: string; data?: { label?: string } }>;
  edges?: Array<{ id?: string; label?: string; source?: string; target?: string }>;
};

// Remove ALL code blocks (dsaupdate, flowjson, json) so the chat only shows text
function stripCodeBlocks(content: string) {
  return content
    .replace(/```dsaupdate[\s\S]*?```/gi, "")
    .replace(/```(?:flowjson|json)[\s\S]*?```/gi, "")
    .trim();
}

// Remove only dsaupdate blocks (used when building explanation text)
function stripDsaUpdateBlocks(content: string) {
  return content.replace(/```dsaupdate[\s\S]*?```/gi, "").trim();
}

// Map common mode strings to valid StructureMode values
function normalizeMode(mode: string): StructureMode | null {
  const value = mode.trim().toLowerCase();
  if (value === "bst") return "bst";
  if (value === "linked-list" || value === "linkedlist" || value === "linked_list") {
    return "linked-list";
  }
  if (value === "queue") return "queue";
  if (value === "stack") return "stack";
  return null;
}

// Parse the ```dsaupdate``` code block from model output into a PlaygroundUpdate
function extractPlaygroundUpdate(content: string): PlaygroundUpdate | null {
  const match = content.match(/```dsaupdate([\s\S]*?)```/i);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim()) as {
      mode?: string;
      values?: unknown[];
      explanation?: string;
    };

    if (!parsed.mode || !Array.isArray(parsed.values)) {
      return null;
    }

    const mode = normalizeMode(parsed.mode);
    if (!mode) return null;

    const values = parsed.values
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .slice(0, 24);

    if (values.length === 0) {
      return null;
    }

    return {
      mode,
      values,
      explanation:
        typeof parsed.explanation === "string" && parsed.explanation.trim()
          ? parsed.explanation.trim()
          : `Model updated ${mode} with ${values.length} values.`,
    };
  } catch {
    return null;
  }
}

// Extract the first flowjson/json code block (used as fallback)
function parseFirstFlowJson(content: string): FlowJsonLike | null {
  const match = content.match(/```(?:flowjson|json)([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as FlowJsonLike;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Pull numeric values out of node labels (e.g. "Node 42" → 42)
function extractNumericValues(labels: string[]) {
  const values: number[] = [];
  labels.forEach((label) => {
    const match = label.match(/-?\d+(?:\.\d+)?/g);
    if (!match) return;
    match.forEach((item) => {
      const value = Number(item);
      if (Number.isFinite(value)) values.push(value);
    });
  });
  return values.slice(0, 24);
}

// Fallback: if no dsaupdate block exists, try to guess mode + values from flowjson
function inferPlaygroundUpdateFromFlow(content: string): PlaygroundUpdate | null {
  const flow = parseFirstFlowJson(content);
  if (!flow?.nodes?.length) return null;

  const nodeIds = flow.nodes.map((node) => String(node.id ?? "").toLowerCase());
  const labels = flow.nodes.map((node) => String(node.data?.label ?? ""));
  const lowerLabels = labels.map((item) => item.toLowerCase());
  const edgeLabels = (flow.edges ?? []).map((edge) =>
    String(edge.label ?? "").toLowerCase()
  );

  const hasQueueMarkers =
    lowerLabels.some((label) => label.includes("front:")) ||
    lowerLabels.some((label) => label.includes("rear:")) ||
    nodeIds.some((id) => id.startsWith("q-"));
  const hasStackMarkers =
    lowerLabels.some((label) => label.includes("top:")) ||
    nodeIds.some((id) => id.startsWith("s-"));
  const hasLinkedListMarkers =
    edgeLabels.some((label) => label.includes("next")) ||
    nodeIds.some((id) => id.startsWith("ll-"));
  const hasBSTMarkers = nodeIds.some((id) => id.startsWith("bst-"));

  const mode: StructureMode = hasQueueMarkers
    ? "queue"
    : hasStackMarkers
      ? "stack"
      : hasLinkedListMarkers
        ? "linked-list"
        : hasBSTMarkers
          ? "bst"
          : "bst";

  const filteredLabels = labels.filter((label) => {
    const lower = label.toLowerCase();
    return (
      !lower.startsWith("front:") &&
      !lower.startsWith("rear:") &&
      !lower.startsWith("top:") &&
      !lower.includes("empty")
    );
  });

  const values = extractNumericValues(filteredLabels);
  if (values.length === 0) return null;

  const explanationText = stripDsaUpdateBlocks(content)
    .replace(/```(?:flowjson|json)[\s\S]*?```/gi, "")
    .trim();

  return {
    mode,
    values,
    explanation:
      explanationText ||
      `Inferred ${mode} update from flow diagram with ${values.length} values.`,
  };
}

// Main chat component
export function ChatUI({
  onPlaygroundUpdate,
  onArraysResult,
  messages: externalMessages = [],
  onAddMessage,
  onClearMessages,
}: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>(externalMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [explanationHistory, setExplanationHistory] = useState<ChatHistoryItem[]>([]);
  const [dsaHistory, setDsaHistory] = useState<ChatHistoryItem[]>([]);
  const [arraysHistory, setArraysHistory] = useState<ChatHistoryItem[]>([]);
  const [arraysProvider, setArraysProvider] = useState<ArraysProvider>("watson");
  const [watsonModelId, setWatsonModelId] = useState("");
  const [openRouterModelId, setOpenRouterModelId] = useState(
    DEFAULT_OPENROUTER_ARRAYS_MODEL
  );
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // 同步外部messages
  useEffect(() => {
    setMessages(externalMessages);
  }, [externalMessages]);

  // Auto-scroll to bottom when a new message arrives
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleMessageCollapse = (messageId: string) => {
    setCollapsedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Send one prompt, route it, then run explanation + selected visualizer calls in parallel
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    onAddMessage?.(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      let routeDecision: RouteDecisionSuccessResponse;
      try {
        routeDecision = await requestRouteDecision(text, dsaHistory, arraysHistory);
      } catch {
        const callArrays = shouldRequestArraysResult(text);
        routeDecision = {
          callDSA: !callArrays,
          callArrays,
          source: "fallback",
          reason: "Client-side fallback routing.",
        };
      }

      const nextExplanationHistory: ChatHistoryItem[] = [
        ...explanationHistory,
        { role: "user", content: text },
      ];
      const [explanationResult, dsaResult, arraysResult] = await Promise.allSettled([
        requestExplanation(text, explanationHistory),
        routeDecision.callDSA
          ? requestDSAChat(text, dsaHistory)
          : Promise.resolve<DSAChatSuccessResponse | null>(null),
        routeDecision.callArrays
          ? requestArraysChat(text, arraysHistory, {
              provider: arraysProvider,
              modelId:
                arraysProvider === "openrouter"
                  ? openRouterModelId.trim() || undefined
                  : watsonModelId.trim() || undefined,
            })
          : Promise.resolve<ArraysChatSuccessResponse | null>(null),
      ]);

      const nextDsaHistory: ChatHistoryItem[] = routeDecision.callDSA
        ? [...dsaHistory, { role: "user", content: text }]
        : dsaHistory;
      const nextArraysHistory: ChatHistoryItem[] = routeDecision.callArrays
        ? [...arraysHistory, { role: "user", content: text }]
        : arraysHistory;

      let explanationText: string | null = null;
      let dsaError: string | null = null;
      let arraysError: string | null = null;
      let explanationError: string | null = null;

      if (explanationResult.status === "fulfilled" && explanationResult.value) {
        const explanation = explanationResult.value.explanation.trim();
        if (explanation) {
          explanationText = explanation;
          setExplanationHistory([
            ...nextExplanationHistory,
            { role: "assistant", content: explanationText },
          ]);
        } else {
          explanationError = "Explanation response was empty.";
          setExplanationHistory(nextExplanationHistory);
        }
      } else {
        explanationError =
          explanationResult.status === "rejected" &&
          explanationResult.reason instanceof Error
            ? explanationResult.reason.message
            : "Unable to generate explanation.";
        setExplanationHistory(nextExplanationHistory);
      }

      if (
        routeDecision.callDSA &&
        dsaResult.status === "fulfilled" &&
        dsaResult.value
      ) {
        const assistantContent = dsaResult.value.content;
        const update =
          extractPlaygroundUpdate(assistantContent) ||
          inferPlaygroundUpdateFromFlow(assistantContent);
        if (update) {
          onPlaygroundUpdate?.(update);
        }

        setDsaHistory([
          ...nextDsaHistory,
          { role: "assistant", content: assistantContent },
        ]);
      } else if (routeDecision.callDSA && dsaResult.status === "rejected") {
        dsaError =
          dsaResult.reason instanceof Error
            ? dsaResult.reason.message
            : "Unable to reach DSA API.";
        setDsaHistory(nextDsaHistory);
      }

      if (
        routeDecision.callArrays &&
        arraysResult.status === "fulfilled" &&
        arraysResult.value
      ) {
        const arraysPayload = arraysResult.value;
        onArraysResult?.(arraysPayload);
        const arraysStatusText = `Arrays visualization updated for ${arraysPayload.normalizedInput.algorithm}.`;
        setArraysHistory([
          ...nextArraysHistory,
          { role: "assistant", content: arraysStatusText },
        ]);
      } else if (routeDecision.callArrays && arraysResult.status === "rejected") {
        arraysError =
          arraysResult.reason instanceof Error
            ? arraysResult.reason.message
            : "Unable to reach arrays API.";
        setArraysHistory(nextArraysHistory);
      } else if (routeDecision.callArrays) {
        setArraysHistory(nextArraysHistory);
      }

      const sections: string[] = [];
      if (explanationText) sections.push(explanationText);
      if (explanationError) sections.push(`Explanation error: ${explanationError}`);
      if (dsaError) {
        sections.push(`DSA error: ${dsaError}`);
      }
      if (routeDecision.callArrays && arraysError) {
        sections.push(`Arrays error: ${arraysError}`);
      }
      if (sections.length === 0) {
        sections.push("No response generated.");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: sections.join("\n\n"),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      onAddMessage?.(assistantMessage);
    } catch (error) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "Error: Unable to reach the server.",
      };
      onAddMessage?.(assistantMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[300px] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-foreground">DSA Visualizer</h2>
          <p className="text-xs text-muted-foreground">
            One chat routes to the DSA playground or arrays visualizer.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onClearMessages?.();
              setMessages([]);
            }}
          >
            Reset
          </Button>
          <div className="flex flex-col gap-1">
            <label className="sr-only" htmlFor="arrays-provider">
              Arrays provider
            </label>
            <select
              id="arrays-provider"
              value={arraysProvider}
              onChange={(event) => setArraysProvider(event.target.value as ArraysProvider)}
              disabled={isLoading}
              className="h-8 w-[220px] rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="watson">Watsonx</option>
              <option value="openrouter">OpenRouter</option>
            </select>
            <label
              className="sr-only"
              htmlFor={arraysProvider === "openrouter" ? "openrouter-model" : "watson-model"}
            >
              {arraysProvider === "openrouter" ? "OpenRouter model" : "Watson model"}
            </label>
            <Input
              id={arraysProvider === "openrouter" ? "openrouter-model" : "watson-model"}
              value={arraysProvider === "openrouter" ? openRouterModelId : watsonModelId}
              onChange={(event) => {
                if (arraysProvider === "openrouter") {
                  setOpenRouterModelId(event.target.value);
                } else {
                  setWatsonModelId(event.target.value);
                }
              }}
              list={arraysProvider === "openrouter" ? "openrouter-model-options" : undefined}
              placeholder={
                arraysProvider === "openrouter"
                  ? "openai/gpt-4o-mini"
                  : "meta-llama/llama-3-3-70b-instruct"
              }
              disabled={isLoading}
              className="h-8 w-[220px] text-xs"
            />
          </div>
          <datalist id="openrouter-model-options">
            {OPENROUTER_ARRAYS_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs">Send a message to start the conversation.</p>
            </div>
          )}
          {messages.map((msg) => {
            const isCollapsed = collapsedMessages.has(msg.id);
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleMessageCollapse(msg.id)}
                      className="mt-0.5 shrink-0 focus:outline-none"
                      aria-label={isCollapsed ? "Expand message" : "Collapse message"}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    </button>
                    {!isCollapsed && (
                      msg.role === "assistant" ? (
                        <div
                          className={cn(
                            "flex-1 break-words leading-relaxed",
                            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
                            "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
                            "[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
                            "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
                            "[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
                            "[&_hr]:my-2 [&_hr]:border-border",
                            "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
                            "[&_p]:mb-2 [&_p:last-child]:mb-0",
                            "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/70 [&_pre]:p-2",
                            "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
                            "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
                            "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
                            "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
                            "[&_code]:rounded-sm [&_code]:bg-background/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
                            "[&_pre_code]:bg-transparent [&_pre_code]:p-0"
                          )}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {stripCodeBlocks(msg.content)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="flex-1 whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-current" />
                <span className="size-2 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
                <span className="size-2 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t p-4 shrink-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try: Run quicksort, binary search for 7, or build a BST with 8,3,10"
          className="min-w-0 flex-1"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
