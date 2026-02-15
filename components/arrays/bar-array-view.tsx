"use client";

import { motion } from "framer-motion";
import { ARRAY_CELL_WIDTH } from "@/components/arrays/layout-constants";

type BarArrayViewProps = {
  values: number[];
};

export function BarArrayView({ values }: BarArrayViewProps) {
  const maxMagnitude = Math.max(...values.map((value) => Math.abs(value)), 1);

  return (
    <div className="space-y-2">
      <div className="flex h-36 items-end">
        {values.map((value, index) => {
          const height = Math.max(18, (Math.abs(value) / maxMagnitude) * 128);
          return (
            <div
              key={`bar-wrap-${index}-${value}`}
              className="flex flex-col items-center justify-end"
              style={{ width: ARRAY_CELL_WIDTH }}
            >
              <motion.div
                initial={{ height: 0, opacity: 0.5 }}
                animate={{ height, opacity: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full rounded-md bg-primary/75"
              />
              <span className="mt-1 text-[10px] text-muted-foreground">{index}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
