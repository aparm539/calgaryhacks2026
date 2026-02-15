"use client";

type PartitionState = {
  pivotIndex: number;
  less: number[];
  greater: number[];
};

type PartitionViewProps = {
  partition?: PartitionState;
};

export function PartitionView({ partition }: PartitionViewProps) {
  if (!partition) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
        Partition
      </p>
      <p className="mb-2 text-foreground">Pivot index: {partition.pivotIndex}</p>
      <p className="mb-1 text-muted-foreground">Less: [{partition.less.join(", ")}]</p>
      <p className="text-muted-foreground">Greater: [{partition.greater.join(", ")}]</p>
    </div>
  );
}
