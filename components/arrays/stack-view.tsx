"use client";

type StackViewProps = {
  items?: string[];
};

export function StackView({ items }: StackViewProps) {
  const entries = items ?? [];

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recursion Stack
      </p>
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
