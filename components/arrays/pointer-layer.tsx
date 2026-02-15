"use client";

import { motion } from "framer-motion";
import { getTrackWidth, indexToX } from "@/components/arrays/layout-constants";

type PointerLayerProps = {
  pointers?: Record<string, number>;
  arrayLength: number;
};

export function PointerLayer({ pointers, arrayLength }: PointerLayerProps) {
  const entries = Object.entries(pointers ?? {});

  if (!entries.length) {
    return null;
  }

  return (
    <div
      className="relative h-14"
      style={{ width: Math.max(getTrackWidth(arrayLength), 120) }}
    >
      {entries.map(([name, index], pointerIndex) => {
        const yOffset = pointerIndex % 2 === 0 ? 0 : 22;
        return (
          <motion.div
            key={`${name}-${index}`}
            className="absolute top-0"
            initial={false}
            animate={{ x: indexToX(index), y: yOffset }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
          >
            <div className="flex flex-col items-center">
              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {name}
              </span>
              <span className="-mt-0.5 text-xs leading-none text-primary">▼</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
