"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    // Placeholder: echo back. Replace with real API call later.
    await new Promise((r) => setTimeout(r, 600));
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `You said: ${text}`,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-foreground">Chat</h2>
        <p className="text-xs text-muted-foreground">
          Basic chatbot — connect an API to get real responses.
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs">Send a message to start the conversation.</p>
            </div>
          )}
          {messages.map((msg) => (
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
                {msg.content}
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

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t p-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
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
