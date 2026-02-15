"use client";

// Chat panel — sends messages to the Watsonx API and displays text responses.
// Extracts dsaupdate / flowjson blocks from the model output and forwards
// them to the DSA Playground via the onPlaygroundUpdate callback.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, ChevronDown } from "lucide-react";
import type { PlaygroundUpdate, StructureMode } from "@/lib/dsa-playground-types";

// A single chat message (user or assistant)
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatUIProps = {
  onPlaygroundUpdate?: (update: PlaygroundUpdate) => void;
  thinkingMode?: boolean;
  onThinkingModeChange?: (mode: boolean) => void;
};

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
export function ChatUI({ onPlaygroundUpdate, thinkingMode = false, onThinkingModeChange }: ChatUIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Send the user message to /api/chat and process the response
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // When thinking mode is on, always ask questions regardless of user input
      let finalMessage = text;
      
      if (thinkingMode) {
        // In thinking mode, always generate questions based on user input
        finalMessage = `[THINKING MODE] Ask 1-2 key multiple choice questions based on this topic/problem to help the user think deeper. Each question should have 3-4 answer options (A, B, C, D). Then, after the questions, include a code block with dsaupdate to generate a diagram. Format:\n\n **Key Questions:**\n\n**Question 1:** [Question text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\n\n**Question 2:** [Question text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\n\nThen provide the dsaupdate code block for visualization.\n\nTopic/Context: ${text}`;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          history: messages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      const data = (await response.json()) as
        | { content: string }
        | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data ? data.error : "Request failed."
        );
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
      };

      // Try to extract a playground update (dsaupdate first, flowjson fallback)
      const update =
        extractPlaygroundUpdate(data.content) ||
        inferPlaygroundUpdateFromFlow(data.content);
      if (update) {
        onPlaygroundUpdate?.(update);
      }
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "Error: Unable to reach the server.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3 flex-shrink-0">
        <h2 className="font-semibold text-foreground">DSA Visualizer</h2>
        <p className="text-xs text-muted-foreground">
          Prompt a data structure or algorithm to get a diagram.
        </p>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
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
                      className="mt-0.5 flex-shrink-0 focus:outline-none"
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
                      <p className="whitespace-pre-wrap flex-1">
                        {stripCodeBlocks(msg.content)}
                      </p>
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
        className="flex gap-2 border-t p-4 flex-shrink-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try: Visualize binary search on [1,3,5,7,9]"
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
