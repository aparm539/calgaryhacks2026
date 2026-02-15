"use client";

import { motion } from "framer-motion";
import { ArrayView } from "@/components/arrays/array-view";
import type { StepState } from "@/lib/arrays/types";

type MergeState = NonNullable<StepState["merge"]>;

export type MergeHistoryEntry = {
  stepIndex: number;
  caption: string;
  merge: MergeState;
  stepId: string;
  isCurrent: boolean;
};

type MergeViewProps = {
  merge?: MergeState;
  animationKey: string;
  history?: MergeHistoryEntry[];
};

type LaneProps = {
  label: string;
  values: number[];
  animationKey: string;
  offsetY: number;
  highlight?: boolean;
  animate?: boolean;
};

function MergeLane({
  label,
  values,
  animationKey,
  offsetY,
  highlight,
  animate = true,
}: LaneProps) {
  const laneKey = `${label}-${animationKey}-${values.join(",")}`;

  return (
    <div className="space-y-1">
      <p
        className={
          highlight
            ? "text-xs font-medium text-foreground"
            : "text-xs font-medium text-muted-foreground"
        }
      >
        {label}
      </p>

      {values.length > 0 ? (
        animate ? (
          <motion.div
            key={laneKey}
            initial={{ opacity: 0, y: offsetY }}
            animate={
              highlight
                ? {
                    opacity: 1,
                    y: 0,
                    scale: [1, 1.02, 1],
                  }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }
            }
            transition={{
              type: "tween",
              duration: 0.35,
              ease: "easeOut",
            }}
            className={
              highlight ? "rounded-md border border-primary/30 bg-primary/5 p-1" : ""
            }
          >
            <ArrayView values={values} />
          </motion.div>
        ) : (
          <div className={highlight ? "rounded-md border border-primary/30 bg-primary/5 p-1" : ""}>
            <ArrayView values={values} />
          </div>
        )
      ) : (
        <div className="rounded border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          empty
        </div>
      )}
    </div>
  );
}

type MergeSnapshotProps = {
  entry: MergeHistoryEntry;
};

function MergeSnapshot({ entry }: MergeSnapshotProps) {
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
      <div className="space-y-2">
        <MergeLane
          label="Left"
          values={entry.merge.left}
          animationKey={entry.stepId}
          offsetY={-10}
          animate={entry.isCurrent}
        />
        <MergeLane
          label="Right"
          values={entry.merge.right}
          animationKey={entry.stepId}
          offsetY={10}
          animate={entry.isCurrent}
        />
        <MergeLane
          label="Merged"
          values={entry.merge.merged}
          animationKey={entry.stepId}
          offsetY={14}
          highlight
          animate={entry.isCurrent}
        />
      </div>
      {entry.merge.writeRange && (
        <p className="mt-2 text-muted-foreground">
          Write range: [{entry.merge.writeRange.l}, {entry.merge.writeRange.r}]
        </p>
      )}
    </div>
  );
}

export function MergeView({ merge, animationKey, history }: MergeViewProps) {
  const entries =
    history && history.length > 0
      ? history
      : merge
        ? [
            {
              stepIndex: 0,
              caption: "",
              merge,
              stepId: animationKey,
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
        Merge Buffer History
      </p>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <MergeSnapshot key={`merge-${entry.stepIndex}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
