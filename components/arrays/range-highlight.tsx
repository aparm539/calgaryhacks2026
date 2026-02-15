"use client";

import { motion } from "framer-motion";
import {
  ARRAY_CELL_WIDTH,
  getTrackWidth,
  indexToX,
} from "@/components/arrays/layout-constants";

type RangeHighlightProps = {
  range?: { l: number; r: number };
  arrayLength: number;
};

export function RangeHighlight({ range, arrayLength }: RangeHighlightProps) {
  if (!range) {
    return null;
  }

  const left = indexToX(range.l);
  const width = (range.r - range.l + 1) * ARRAY_CELL_WIDTH;

  return (
    <div
      className="relative h-4"
      style={{ width: Math.max(getTrackWidth(arrayLength), 120) }}
    >
      <motion.div
        className="absolute top-0 h-4 rounded-md border border-amber-500/50 bg-amber-500/20"
        initial={false}
        animate={{ x: left, width, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}
