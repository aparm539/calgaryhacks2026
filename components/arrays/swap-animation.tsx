"use client";

import { motion } from "framer-motion";
import { getTrackWidth, indexToX } from "@/components/arrays/layout-constants";

type SwapEvent = {
  i: number;
  j: number;
};

type SwapAnimationProps = {
  events: SwapEvent[];
  arrayLength: number;
  animationKey: string;
};

export function SwapAnimation({
  events,
  arrayLength,
  animationKey,
}: SwapAnimationProps) {
  if (!events.length) {
    return null;
  }

  return (
    <div
      className="relative h-8"
      style={{ width: Math.max(getTrackWidth(arrayLength), 120) }}
    >
      {events.map((event, index) => (
        <motion.div
          key={`${animationKey}-swap-${index}-${event.i}-${event.j}`}
          initial={{ x: indexToX(event.i), opacity: 0 }}
          animate={{
            x: indexToX(event.j),
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute top-0 rounded border border-sky-500/60 bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-700"
        >
          swap {event.i}↔{event.j}
        </motion.div>
      ))}
    </div>
  );
}
