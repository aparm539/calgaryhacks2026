"use client";

import { ArrayView } from "@/components/arrays/array-view";
import type { StepState } from "@/lib/arrays/types";

type PartitionState = NonNullable<StepState["partition"]>;

export type PartitionHistoryEntry = {
  stepIndex: number;
  caption: string;
  partition: PartitionState;
  isCurrent: boolean;
};

type PartitionViewProps = {
  partition?: PartitionState;
  history?: PartitionHistoryEntry[];
};

function PartitionBucket({
  label,
  values,
}: {
  label: string;
  values: number[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {values.length > 0 ? (
        <div className="rounded-md border bg-background/70 p-1">
          <ArrayView values={values} />
        </div>
      ) : (
        <div className="rounded border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          empty
        </div>
      )}
    </div>
  );
}

function PartitionSnapshot({ entry }: { entry: PartitionHistoryEntry }) {
  const { partition } = entry;

  return (
    <div
      className={
        entry.isCurrent
          ? "rounded-md border border-primary/30 bg-primary/5 p-2"
          : "rounded-md border bg-background/70 p-2"
      }
    >
      <p className="mb-2 text-[11px] font-medium text-foreground">
        Step {entry.stepIndex + 1}
        {entry.isCurrent ? " (current)" : ""}
      </p>
      <p className="mb-2 text-[11px] text-muted-foreground">{entry.caption}</p>
      <p className="mb-2 text-[11px] text-foreground">Pivot index: {partition.pivotIndex}</p>
      <div className="space-y-2">
        <PartitionBucket label="Less" values={partition.less} />
        <PartitionBucket label="Greater" values={partition.greater} />
      </div>
    </div>
  );
}

export function PartitionView({ partition, history }: PartitionViewProps) {
  const entries =
    history && history.length > 0
      ? history
      : partition
        ? [
            {
              stepIndex: 0,
              caption: "",
              partition,
              isCurrent: true,
            },
          ]
        : [];

  if (!entries.length) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
        Partition History
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <PartitionSnapshot
            key={`partition-${entry.stepIndex}`}
            entry={entry}
          />
        ))}
      </div>
    </div>
  );
}
