"use client";

import { motion } from "framer-motion";
import { ArrayView } from "@/components/arrays/array-view";

type MergeState = {
  left: number[];
  right: number[];
  merged: number[];
  writeRange?: {
    l: number;
    r: number;
  };
};

type MergeViewProps = {
  merge?: MergeState;
  animationKey: string;
};

type LaneProps = {
  label: string;
  values: number[];
  animationKey: string;
  offsetY: number;
  highlight?: boolean;
};

function MergeLane({
  label,
  values,
  animationKey,
  offsetY,
  highlight,
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
          className={highlight ? "rounded-md border border-primary/30 bg-primary/5 p-1" : ""}
        >
          <ArrayView values={values} />
        </motion.div>
      ) : (
        <div className="rounded border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          empty
        </div>
      )}
    </div>
  );
}

export function MergeView({ merge, animationKey }: MergeViewProps) {
  if (!merge) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
        Merge Buffer
      </p>
      <div className="space-y-3">
        <MergeLane
          label="Left"
          values={merge.left}
          animationKey={animationKey}
          offsetY={-10}
        />
        <MergeLane
          label="Right"
          values={merge.right}
          animationKey={animationKey}
          offsetY={10}
        />
        <MergeLane
          label="Merged"
          values={merge.merged}
          animationKey={animationKey}
          offsetY={14}
          highlight
        />
      </div>
      {merge.writeRange && (
        <p className="mt-2 text-muted-foreground">
          Write range: [{merge.writeRange.l}, {merge.writeRange.r}]
        </p>
      )}
    </div>
  );
}
