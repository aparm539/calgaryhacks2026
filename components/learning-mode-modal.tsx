"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, X } from "lucide-react";
import type { StructureMode } from "@/lib/dsa-playground-types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type LearningModeProps = {
  onClose: () => void;
  currentStructure?: {
    mode: StructureMode;
    values: number[];
  };
};

// Remove code blocks from display
function stripCodeBlocks(content: string) {
  return content
    .replace(/```dsaupdate[\s\S]*?```/gi, "")
    .replace(/```(?:flowjson|json)[\s\S]*?```/gi, "")
    .trim();
}

export function LearningMode({
  onClose,
  currentStructure,
}: LearningModeProps) {
  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Follow-up conversation after feedback
  const [followUpMessages, setFollowUpMessages] = useState<Message[]>([]);

  // API context
  const [apiHistory, setApiHistory] = useState<Message[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentQuestion, userAnswer, feedback]);

  // Generate initial question on mount
  useEffect(() => {
    if (!currentQuestion && currentStructure) {
      generateQuestion();
    }
  }, []);

  const generateQuestion = async () => {
    setIsLoading(true);
    try {
      const structureInfo = `Current data structure: ${currentStructure?.mode} with values: ${currentStructure?.values.join(", ")}`;

      const prompt =
        apiHistory.length === 0
          ? `Generate ONE clear question about this data structure. Format: Start with "Q: " followed by the question. ${structureInfo}`
          : `Based on the conversation, generate ONE new question about related data structure concepts. Format: Start with "Q: "`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: apiHistory,
          mode: "learning",
        }),
      });

      const data = (await response.json()) as
        | { content: string }
        | { error: string };

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Request failed.");
      }

      const content = (data as { content: string }).content;
      const questionMatch = content.match(/Q:\s*(.+?)(?:\n|$)/i);
      const questionText = questionMatch
        ? questionMatch[1].trim()
        : content.trim();

      setCurrentQuestion(questionText);
      setUserAnswer("");
      setFeedback("");
      setFollowUpMessages([]);

      // Add to API history for context
      setApiHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: questionText,
        },
      ]);
    } catch (error) {
      setCurrentQuestion(
        error instanceof Error ? `Error: ${error.message}` : "Error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || isLoading) return;

    const answer = userAnswer;
    setIsLoading(true);
    setUserAnswer("");

    try {
      if (feedback) {
        // This is a follow-up question
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Add user question to follow-up messages
        setFollowUpMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: answer,
          },
        ]);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `[LEARNING MODE FOLLOW-UP] User's follow-up: "${answer}"

Answer their question directly. Do NOT ask new questions or suggest next steps.
Keep response concise (2-3 sentences max).`,
            history: apiHistory,
            mode: "learning",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = (await response.json()) as
          | { content: string }
          | { error: string };

        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Request failed.");
        }

        const responseText = (data as { content: string }).content;
        
        // Clean up response: remove questions
        let cleanedResponse = stripCodeBlocks(responseText).trim();
        const lines = cleanedResponse.split('\n');
        const responseOnly = lines
          .filter(line => {
            const trimmed = line.trim();
            // Remove lines that are questions
            if (trimmed.match(/^(What|Let's|How|When|Why|If we|Consider|Try|Now|So|Then)/i) || trimmed.endsWith('?')) {
              return false;
            }
            return trimmed.length > 0;
          })
          .slice(0, 2)
          .join('\n');

        // Add assistant response to follow-up messages
        setFollowUpMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: responseOnly || "Got it!",
          },
        ]);

        // Add to API history
        setApiHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: answer,
          },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: responseText,
          },
        ]);
      } else {
        // This is answering the main question
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `[LEARNING MODE FEEDBACK ONLY] The user answered: "${answer}"

IMPORTANT: Respond with ONLY feedback. Do NOT ask new questions or suggest next steps.
Format your response:
- First line: [CORRECT] or [INCORRECT]
- Then: 2-3 sentences explaining why this is correct/incorrect
- STOP. Do not add anything else.`,
            history: apiHistory,
            mode: "learning",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = (await response.json()) as
          | { content: string }
          | { error: string };

        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Request failed.");
        }

        const feedbackText = (data as { content: string }).content;
        // Remove the [CORRECT]/[INCORRECT] tag
        let cleanedFeedback = stripCodeBlocks(feedbackText.replace(/\[\w+\]\s*/i, "")).trim();
        
        // Remove any sentences starting with "What", "Let's", "How", "When", "Why", "If we", etc. (question-like phrases)
        const lines = cleanedFeedback.split('\n');
        const feedbackOnly = lines
          .filter(line => {
            const trimmed = line.trim();
            // Keep lines that are actual feedback, not questions
            if (trimmed.match(/^(What|Let's|How|When|Why|If we|Consider|Try|Now|So|Then)/i)) {
              return false;
            }
            return trimmed.length > 0;
          })
          .slice(0, 3)
          .join('\n');
        
        setFeedback(feedbackOnly.trim());

        // Add to API history
        setApiHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: answer,
          },
        ]);
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Error. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestion("");
    setUserAnswer("");
    setFeedback("");
    setFollowUpMessages([]);
    generateQuestion();
  };

  const handleClose = () => {
    setCurrentQuestion("");
    setUserAnswer("");
    setFeedback("");
    setFollowUpMessages([]);
    setApiHistory([]);
    onClose();
  };

  return (
    <div className="flex h-full w-full flex-col rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-foreground">Learning Mode</h2>
          <p className="text-xs text-muted-foreground">
            Answer questions about {currentStructure?.mode}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="rounded-lg p-1 hover:bg-muted focus:outline-none"
          aria-label="Close learning mode"
        >
          <X className="size-5 text-foreground" />
        </button>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 p-4">
          {isLoading && !currentQuestion && (
            <div className="flex items-center justify-center gap-1.5 py-8 text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-current" />
              <span className="size-2 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
              <span className="size-2 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
            </div>
          )}

          {/* Question */}
          {currentQuestion && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Question:
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {stripCodeBlocks(currentQuestion)}
                </p>
              </div>
            </div>
          )}

          {/* User Answer - Show only after submitted */}
          {userAnswer && feedback && (
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-lg bg-primary text-primary-foreground p-3">
                <p className="text-sm whitespace-pre-wrap">{userAnswer}</p>
              </div>
            </div>
          )}

          {/* Feedback - Only the feedback, not mixed with follow-up */}
          {feedback && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg bg-orange-50 dark:bg-orange-950 p-4 border border-orange-200 dark:border-orange-800">
                <p className="font-semibold text-orange-900 dark:text-orange-100 mb-2 text-sm">
                  Feedback:
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {feedback}
                </p>
              </div>
            </div>
          )}

          {/* Follow-up conversation */}
          {followUpMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-lg p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 dark:bg-gray-800 text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 shrink-0">
        <form onSubmit={handleSubmitAnswer} className="flex gap-2">
          <Input
            ref={inputRef}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={
              feedback ? "Ask a follow-up question..." : "Type your answer..."
            }
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !userAnswer.trim()}
          >
            <Send className="size-4" aria-hidden />
            <span className="sr-only">Submit</span>
          </Button>
          {feedback && (
            <Button
              type="button"
              onClick={handleNextQuestion}
              disabled={isLoading}
              variant="outline"
            >
              Next Q
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
