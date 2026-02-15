"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { AStarNode } from "./astar-node";

// ---- Types ----

type RoomStatus = "clean" | "dirty";

type AStarNodeData = {
  label: string;
  status: RoomStatus;
  hasVacuum: boolean;
};

type AStarFlowNode = Node<AStarNodeData, "astar">;

type VacuumFrame = {
  label: string;
  vacuumRoom: string;
  /** status of every room by id */
  rooms: Record<string, RoomStatus>;
};

// ---- 15-room binary tree definition ----

type RoomDef = {
  id: string;
  label: string;
  parentId: string | null;
  dirty: boolean; // initial state
  depth: number;
  index: number; // position within its level (0-indexed)
};

//  Depth 0:  1 room  (root)
//  Depth 1:  2 rooms
//  Depth 2:  4 rooms
//  Depth 3:  8 rooms
//  Total = 15

function buildRoomTree(): RoomDef[] {
  const rooms: RoomDef[] = [];
  let counter = 1;

  // BFS-style generation
  const queue: { parentId: string | null; depth: number; index: number }[] = [
    { parentId: null, depth: 0, index: 0 },
  ];

  while (queue.length > 0 && counter <= 15) {
    const item = queue.shift()!;
    const id = `room-${counter}`;
    const dirtyRooms = new Set([1, 3, 4, 6, 9, 11, 13, 15]); // 8 of 15 start dirty
    rooms.push({
      id,
      label: `R${counter}`,
      parentId: item.parentId,
      dirty: dirtyRooms.has(counter),
      depth: item.depth,
      index: item.index,
    });

    if (item.depth < 3) {
      queue.push({ parentId: id, depth: item.depth + 1, index: item.index * 2 });
      queue.push({ parentId: id, depth: item.depth + 1, index: item.index * 2 + 1 });
    }
    counter++;
  }

  return rooms;
}

const roomTree = buildRoomTree();

// ---- Layout positions (tree shape) ----

const NODE_W = 110;
const H_GAP = 30;
const V_GAP = 100;

function layoutX(depth: number, index: number): number {
  const levelCount = Math.pow(2, depth);
  const totalWidth = (Math.pow(2, 3)) * (NODE_W + H_GAP); // based on deepest level
  const slotWidth = totalWidth / levelCount;
  return slotWidth * index + slotWidth / 2 - NODE_W / 2;
}

function layoutY(depth: number): number {
  return depth * V_GAP;
}

// ---- Edges (parent → child) ----

function buildEdges(): Edge[] {
  return roomTree
    .filter((r) => r.parentId !== null)
    .map((r) => ({
      id: `e-${r.parentId}-${r.id}`,
      source: r.parentId!,
      target: r.id,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }));
}

const treeEdges = buildEdges();

// ---- Build animation frames (DFS traversal) ----

function buildFrames(): VacuumFrame[] {
  const frames: VacuumFrame[] = [];

  // Initial room statuses
  const statuses: Record<string, RoomStatus> = {};
  roomTree.forEach((r) => {
    statuses[r.id] = r.dirty ? "dirty" : "clean";
  });

  const snap = (vacuumRoom: string, label: string) => {
    frames.push({ label, vacuumRoom, rooms: { ...statuses } });
  };

  // Map id → RoomDef for quick lookup
  const byId = new Map(roomTree.map((r) => [r.id, r]));

  // Build adjacency: parent → [left, right]
  const children = new Map<string, string[]>();
  roomTree.forEach((r) => {
    if (r.parentId) {
      const siblings = children.get(r.parentId) ?? [];
      siblings.push(r.id);
      children.set(r.parentId, siblings);
    }
  });

  snap("room-1", "Start: Agent at root R1 — 8 rooms are dirty");

  // DFS traversal
  function visit(id: string, fromLabel: string) {
    const room = byId.get(id);
    if (!room) return;

    // Arrive
    snap(id, `Move to ${room.label} (${fromLabel})`);

    // Check & clean
    if (statuses[id] === "dirty") {
      snap(id, `Percept: [${room.label}, Dirty] → Action: Suck`);
      statuses[id] = "clean";
      snap(id, `${room.label} is now clean`);
    } else {
      snap(id, `Percept: [${room.label}, Clean] → no cleaning needed`);
    }

    // Go to children (left then right)
    const kids = children.get(id) ?? [];
    if (kids.length >= 1) {
      const leftRoom = byId.get(kids[0]);
      visit(kids[0], `go left from ${room.label}`);
      // back up
      snap(id, `Backtrack to ${room.label}`);

      if (kids.length >= 2) {
        const rightRoom = byId.get(kids[1]);
        visit(kids[1], `go right from ${room.label}`);
        // back up (unless root)
        if (room.parentId) {
          snap(id, `Backtrack to ${room.label}`);
        }
      }
    }
  }

  visit("room-1", "start");

  // Final frame
  const allClean = Object.values(statuses).every((s) => s === "clean");
  snap(
    "room-1",
    allClean ? "All 15 rooms clean — goal achieved!" : "Traversal complete"
  );

  return frames;
}

// ---- Scenario prompt ----

const scenarioPrompt = `You are a vacuum cleaner agent in a building with 15 rooms arranged as a binary tree (4 levels).
The root room is R1. Each room branches into a left and right child room.
8 of the 15 rooms start dirty: R1, R3, R4, R6, R9, R11, R13, R15.
The agent starts at R1 and uses a depth-first search (DFS) strategy:
1. Check the current room — if dirty, suck (clean it).
2. Go to the left child room first, then the right child room.
3. Backtrack to the parent after visiting both children.
Explain the agent's percepts, actions, and which rooms get cleaned at each step.`;

const nodeTypes: NodeTypes = { astar: AStarNode };

// ---- Component ----

export function AStarSearch() {
  const frames = useMemo(() => buildFrames(), []);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeFrame = frames[Math.min(frameIndex, frames.length - 1)];

  const nodes = useMemo<AStarFlowNode[]>(
    () =>
      roomTree.map((room) => ({
        id: room.id,
        type: "astar" as const,
        position: { x: layoutX(room.depth, room.index), y: layoutY(room.depth) },
        data: {
          label: room.label,
          status: activeFrame.rooms[room.id] ?? "clean",
          hasVacuum: activeFrame.vacuumRoom === room.id,
        },
        draggable: false,
        selectable: false,
      })),
    [activeFrame]
  );

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || frames.length < 2) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          setIsPlaying(false);
          return frames.length - 1;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length]);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Scenario card */}
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground">
          Vacuum Cleaner Agent — 15-Room Tree
        </div>
        <p className="mt-1">
          15 rooms in a binary tree (4 levels). Agent starts at the root (R1) and
          traverses depth-first: check → clean if dirty → go left → go right → backtrack.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigator.clipboard.writeText(scenarioPrompt)}
          >
            Copy Prompt
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Paste into the chat to align the explanation with this visualization.
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setIsPlaying(false);
            setFrameIndex((prev) => Math.max(0, prev - 1));
          }}
          disabled={frameIndex <= 0}
        >
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (frameIndex >= frames.length - 1) {
              setFrameIndex(0);
            }
            setIsPlaying((prev) => !prev);
          }}
          disabled={frames.length <= 1}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setIsPlaying(false);
            setFrameIndex((prev) => Math.min(frames.length - 1, prev + 1));
          }}
          disabled={frameIndex >= frames.length - 1}
        >
          Next
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsPlaying(false);
            setFrameIndex(0);
          }}
        >
          Reset
        </Button>
        <span className="text-xs text-muted-foreground">
          Step {frameIndex + 1}/{frames.length}: {activeFrame.label}
        </span>
      </div>

      {/* React Flow — tree diagram */}
      <div className="flex-1 min-h-[340px] overflow-hidden rounded-lg border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={treeEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          preventScrolling={false}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
