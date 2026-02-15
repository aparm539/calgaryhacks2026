"use client";

type CaptionCalloutProps = {
  caption: string;
};

export function CaptionCallout({ caption }: CaptionCalloutProps) {
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm text-foreground">
      {caption}
    </div>
  );
}
