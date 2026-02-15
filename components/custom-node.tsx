"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

type CustomNodeData = {
  label: string;
  status?: "default" | "active";
};

type CustomNodeType = Node<CustomNodeData, "custom">;

export function CustomNode({ data, isConnectable }: NodeProps<CustomNodeType>) {
  const statusStyles: Record<NonNullable<CustomNodeData["status"]>, string> = {
    default: "border-2 border-border bg-card text-card-foreground shadow-sm",
    active: "border-2 border-blue-500 ring-2 ring-blue-500/50 bg-blue-50 text-blue-900",
  };

  const status = data.status ?? "default";

  return (
    <div
      className={cn(
        "relative min-w-[60px] rounded-full px-4 py-3 text-center font-bold transition-all duration-300",
        statusStyles[status]
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-muted-foreground !w-3 !h-3"
      />
      <span className="text-sm">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-muted-foreground !w-3 !h-3"
      />
    </div>
  );
}
