"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

type AStarNodeData = {
  label: string;
  status: "clean" | "dirty";
  hasVacuum: boolean;
};

type AStarNodeType = Node<AStarNodeData, "astar">;

export function AStarNode({ data, isConnectable }: NodeProps<AStarNodeType>) {
  return (
    <div
      className={cn(
        "relative flex h-[72px] w-[110px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-1.5 transition-all duration-500",
        data.status === "dirty"
          ? "border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100/80"
          : "border-emerald-400 bg-gradient-to-b from-emerald-50 to-emerald-100/80",
        data.hasVacuum && "ring-2 ring-blue-400 ring-offset-1"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-slate-400 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-slate-400 !w-2 !h-2"
      />

      <div className="flex items-center gap-1">
        {data.hasVacuum && (
          <span className="text-base animate-bounce" role="img" aria-label="vacuum">
            🤖
          </span>
        )}
        <span className="text-[11px] font-bold text-foreground leading-tight">
          {data.label}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-base" role="img" aria-label={data.status}>
          {data.status === "dirty" ? "💨" : "✨"}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold",
            data.status === "dirty" ? "text-amber-700" : "text-emerald-700"
          )}
        >
          {data.status === "dirty" ? "Dirty" : "Clean"}
        </span>
      </div>
    </div>
  );
}
