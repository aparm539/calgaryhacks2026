"use client";

import { motion } from "framer-motion";
import { getTrackWidth, indexToX } from "@/components/arrays/layout-constants";

type CompareEvent = {
  i: number;
  j: number;
  outcome?: "lt" | "eq" | "gt";
};

type CompareAnimationProps = {
  events: CompareEvent[];
  arrayLength: number;
  animationKey: string;
};

function outcomeLabel(outcome?: "lt" | "eq" | "gt") {
  if (!outcome) return "compare";
  if (outcome === "lt") return "<";
  if (outcome === "gt") return ">";
  return "=";
}

export function CompareAnimation({
  events,
  arrayLength,
  animationKey,
}: CompareAnimationProps) {
  if (!events.length) {
    return null;
  }

  return (
    <div
      className="relative h-8"
      style={{ width: Math.max(getTrackWidth(arrayLength), 120) }}
    >
      {events.map((event, index) => {
        const midpoint = (indexToX(event.i) + indexToX(event.j)) / 2;

        return (
          <motion.div
            key={`${animationKey}-compare-${index}-${event.i}-${event.j}`}
            initial={{ x: midpoint, scale: 0.7, opacity: 0 }}
            animate={{
              x: midpoint,
              scale: [0.7, 1.1, 1],
              opacity: [0, 1, 0.9],
            }}
            transition={{ type: "tween", duration: 0.45, ease: "easeOut" }}
            className="absolute top-0 -translate-x-1/2 rounded border border-fuchsia-500/60 bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700"
          >
            {event.i} {outcomeLabel(event.outcome)} {event.j}
          </motion.div>
        );
      })}
    </div>
  );
}
