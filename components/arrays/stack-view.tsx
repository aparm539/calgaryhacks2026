"use client";

import type { RecursionState } from "@/lib/arrays/types";

type StackViewProps = {
  items?: string[];
  recursion?: RecursionState;
};

function formatRecursionContext(recursion?: RecursionState) {
  if (!recursion) {
    return null;
  }

  const callText = `${recursion.fn}(${recursion.args})`;
  return `Depth ${recursion.depth} \u00b7 ${recursion.phase} \u00b7 ${callText}`;
}

export function StackView({ items, recursion }: StackViewProps) {
  const entries = items ?? [];
  const recursionContext = formatRecursionContext(recursion);

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recursion Stack
      </p>
      {recursionContext && (
        <p className="mb-2 text-[11px] text-muted-foreground">{recursionContext}</p>
      )}
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Stack empty.</p>
      ) : (
        <div className="flex flex-col-reverse gap-1">
          {entries.map((item, index) => (
            <div
              key={`stack-${index}-${item}`}
              className="rounded border bg-background px-2 py-1 text-xs"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
