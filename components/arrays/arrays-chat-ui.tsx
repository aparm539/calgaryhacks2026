"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  ArraysChatErrorResponse,
  ArraysChatSuccessResponse,
} from "@/lib/arrays/types";

type ArraysMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ArraysChatUIProps = {
  onResult: (payload: ArraysChatSuccessResponse) => void;
};

export function ArraysChatUI({ onResult }: ArraysChatUIProps) {
  const [messages, setMessages] = useState<ArraysMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setErrorBanner(null);

    const userMessage: ArraysMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/arrays/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((messageItem) => ({
            role: messageItem.role,
            content: messageItem.content,
          })),
        }),
      });

      const payload = (await response.json()) as
        | ArraysChatSuccessResponse
        | ArraysChatErrorResponse;

      if (!response.ok || "error" in payload) {
        const errorPayload: ArraysChatErrorResponse =
          "error" in payload
            ? payload
            : { error: "Arrays request failed." };
        const detailText =
          errorPayload.details
            ? `${errorPayload.error} ${errorPayload.details}`
            : errorPayload.error;

        throw new Error(detailText);
      }

      onResult(payload);

      const assistantMessage: ArraysMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.explanation,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reach arrays API.";

      setErrorBanner(message);

      const assistantMessage: ArraysMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${message}`,
      };

      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[420px] w-full max-w-6xl flex-col rounded-xl border bg-card shadow-sm">
      {errorBanner && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorBanner}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <p className="text-sm">No arrays messages yet.</p>
              <p className="text-xs">Try: Explain binary search on [1, 3, 5, 7, 9] target 7</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-lg px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Try: Run quicksort on [9, 3, 7, 1, 5]"
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
