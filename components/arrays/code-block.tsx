"use client";

import { cn } from "@/lib/utils";

type CodeBlockProps = {
  lines: string[];
  activeLine: number;
};

export function CodeBlock({ lines, activeLine }: CodeBlockProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="overflow-x-auto">
        <pre className="min-w-[320px] text-xs leading-6 text-foreground">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const isActive = lineNumber === activeLine;

            return (
              <div
                key={`line-${lineNumber}`}
                className={cn(
                  "grid grid-cols-[2rem_1fr] rounded px-2",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <span className="select-none text-muted-foreground">{lineNumber}</span>
                <code>{line}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
