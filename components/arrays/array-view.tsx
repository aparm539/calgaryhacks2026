"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ARRAY_CELL_WIDTH,
  ARRAY_TRACK_PADDING,
  getTrackWidth,
} from "@/components/arrays/layout-constants";

type ArrayViewProps = {
  values: number[];
  className?: string;
};

export function ArrayView({ values, className }: ArrayViewProps) {
  const trackWidth = getTrackWidth(values.length);

  return (
    <div
      className={cn("space-y-2", className)}
      style={{ width: Math.max(trackWidth, 120) }}
    >
      <div
        className="flex text-[10px] font-medium text-muted-foreground"
        style={{ marginLeft: ARRAY_TRACK_PADDING }}
      >
        {values.map((_, index) => (
          <div
            key={`index-${index}`}
            className="flex items-center justify-center"
            style={{ width: ARRAY_CELL_WIDTH }}
          >
            {index}
          </div>
        ))}
      </div>
      <div className="flex" style={{ marginLeft: ARRAY_TRACK_PADDING }}>
        {values.map((value, index) => (
          <motion.div
            key={`value-${index}-${value}`}
            layout
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="flex h-12 items-center justify-center rounded-lg border bg-background text-sm font-semibold shadow-sm"
            style={{ width: ARRAY_CELL_WIDTH }}
          >
            {value}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
