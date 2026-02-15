"use client";

// Interactive DSA Playground — supports BST, Linked List, Queue, and Stack.
// Users can insert, delete, find, and run traversals. The playground also
// accepts external updates from the chat panel (model-driven changes).

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FlowDiagram } from "@/components/flow-diagram";
import type { PlaygroundUpdate, StructureMode } from "@/lib/dsa-playground-types";

// Node shape used when building React Flow JSON
type FlowNode = {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type?: string;
};

// Edge shape used when building React Flow JSON
type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

// Internal BST node for tree operations
type BSTNode = {
  id: string;
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
};

// A single frame in the animation timeline (traversals, queue/stack history)
type TimelineFrame = {
  label: string;
  values?: number[];
  highlight?: number | null;
};

// Insert a value into the BST (duplicates ignored)
function insertBST(root: BSTNode | null, value: number, idSeed: string): BSTNode {
  if (!root) {
    return { id: idSeed, value, left: null, right: null };
  }
  if (value < root.value) {
    root.left = insertBST(root.left, value, idSeed);
  } else if (value > root.value) {
    root.right = insertBST(root.right, value, idSeed);
  }
  return root;
}

// Find the smallest value in a subtree (used for in-order successor)
function minValue(node: BSTNode): number {
  let current = node;
  while (current.left) {
    current = current.left;
  }
  return current.value;
}

// Delete a value from the BST (handles 0, 1, and 2 child cases)
function deleteBST(root: BSTNode | null, value: number): BSTNode | null {
  if (!root) {
    return null;
  }
  if (value < root.value) {
    root.left = deleteBST(root.left, value);
    return root;
  }
  if (value > root.value) {
    root.right = deleteBST(root.right, value);
    return root;
  }

  if (!root.left) return root.right;
  if (!root.right) return root.left;

  const successor = minValue(root.right);
  root.value = successor;
  root.right = deleteBST(root.right, successor);
  return root;
}

// Build a BST from an array of numbers
function buildBST(values: number[]): BSTNode | null {
  return values.reduce<BSTNode | null>(
    (acc, value, index) => insertBST(acc, value, `bst-${value}-${index}`),
    null
  );
}

// --- BST traversal helpers (each pushes visited values into output[]) ---

function preorder(root: BSTNode | null, output: number[]) {
  if (!root) return;
  output.push(root.value);
  preorder(root.left, output);
  preorder(root.right, output);
}

function inorder(root: BSTNode | null, output: number[]) {
  if (!root) return;
  inorder(root.left, output);
  output.push(root.value);
  inorder(root.right, output);
}

function postorder(root: BSTNode | null, output: number[]) {
  if (!root) return;
  postorder(root.left, output);
  postorder(root.right, output);
  output.push(root.value);
}

function levelorder(root: BSTNode | null, output: number[]) {
  if (!root) return;
  const queue: BSTNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    output.push(node.value);
    if (node.left) queue.push(node.left);
    if (node.right) queue.push(node.right);
  }
}

// Convert BST values into React Flow nodes and edges for rendering
function buildBSTFlow(values: number[], highlighted: number | null) {
  let root: BSTNode | null = null;
  values.forEach((value, index) => {
    root = insertBST(root, value, `bst-${value}-${index}`);
  });

  if (!root) {
    return {
      nodes: [
        {
          id: "empty",
          position: { x: 120, y: 80 },
          data: { label: "BST is empty" },
          type: "input",
        },
      ] as FlowNode[],
      edges: [] as FlowEdge[],
    };
  }

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const traverse = (
    node: BSTNode | null,
    depth: number,
    x: number,
    spread: number,
    parentId?: string
  ) => {
    if (!node) return;
    const y = depth * 110 + 40;

    nodes.push({
      id: node.id,
      position: { x, y },
      data: {
        label:
          highlighted !== null && node.value === highlighted
            ? `${node.value} ★`
            : String(node.value),
      },
    });

    if (parentId) {
      edges.push({ id: `${parentId}-${node.id}`, source: parentId, target: node.id });
    }

    const nextSpread = Math.max(80, spread * 0.55);
    traverse(node.left, depth + 1, x - spread, nextSpread, node.id);
    traverse(node.right, depth + 1, x + spread, nextSpread, node.id);
  };

  const spread = Math.max(140, values.length * 22);
  traverse(root, 0, 420, spread);

  return { nodes, edges };
}

// Convert linked-list values into a horizontal chain of React Flow nodes
function buildLinkedListFlow(values: number[]) {
  const nodes: FlowNode[] = values.map((value, index) => ({
    id: `ll-${index}`,
    position: { x: index * 170 + 40, y: 100 },
    data: { label: String(value) },
    type: index === 0 ? "input" : undefined,
  }));

  const edges: FlowEdge[] = values.slice(0, -1).map((_, index) => ({
    id: `ll-e-${index}`,
    source: `ll-${index}`,
    target: `ll-${index + 1}`,
    label: "next",
  }));

  return {
    nodes: nodes.length
      ? nodes
      : [{ id: "empty", position: { x: 120, y: 90 }, data: { label: "List is empty" } }],
    edges,
  };
}

// Convert queue values into a horizontal row with Front/Rear labels
function buildQueueFlow(values: number[]) {
  const nodes: FlowNode[] = values.map((value, index) => ({
    id: `q-${index}`,
    position: { x: index * 140 + 80, y: 120 },
    data: { label: String(value) },
    type: index === 0 ? "input" : undefined,
  }));

  const edges: FlowEdge[] = values.slice(0, -1).map((_, index) => ({
    id: `q-e-${index}`,
    source: `q-${index}`,
    target: `q-${index + 1}`,
  }));

  const labels: FlowNode[] = nodes.length
    ? [
        { id: "front", position: { x: 20, y: 30 }, data: { label: `Front: ${values[0]}` }, type: "input" },
        {
          id: "rear",
          position: { x: values.length * 140 + 40, y: 30 },
          data: { label: `Rear: ${values[values.length - 1]}` },
        },
      ]
    : [{ id: "empty", position: { x: 120, y: 90 }, data: { label: "Queue is empty" } }];

  return { nodes: [...nodes, ...labels], edges };
}

// Convert stack values into a vertical column with a Top label
function buildStackFlow(values: number[]) {
  const nodes: FlowNode[] = values.map((value, index) => {
    const reverseIndex = values.length - index - 1;
    return {
      id: `s-${index}`,
      position: { x: 180, y: reverseIndex * 90 + 60 },
      data: { label: String(value) },
      type: index === values.length - 1 ? "input" : undefined,
    };
  });

  const edges: FlowEdge[] = values.slice(1).map((_, index) => ({
    id: `s-e-${index}`,
    source: `s-${index + 1}`,
    target: `s-${index}`,
  }));

  const topLabel: FlowNode[] = nodes.length
    ? [{ id: "top", position: { x: 20, y: 40 }, data: { label: `Top: ${values[values.length - 1]}` }, type: "input" }]
    : [{ id: "empty", position: { x: 120, y: 90 }, data: { label: "Stack is empty" } }];

  return { nodes: [...nodes, ...topLabel], edges };
}

// Display names for each data-structure mode
const modeLabels: Record<StructureMode, string> = {
  bst: "BST",
  "linked-list": "Linked List",
  queue: "Queue",
  stack: "Stack",
};

type DSAPlaygroundProps = {
  externalUpdate?: PlaygroundUpdate | null; // injected from the chat panel
};

// Main playground component
export function DSAPlayground({ externalUpdate }: DSAPlaygroundProps) {
  // Use the model-provided mode/values if available, otherwise defaults
  const initialMode = externalUpdate?.mode ?? "bst";
  const initialValues = externalUpdate?.values
    ?.map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .slice(0, 24) ?? [];
  const initialBstValues =
    initialMode === "bst"
      ? Array.from(new Set(initialValues.length ? initialValues : [8, 3, 10, 1, 6, 14]))
      : [8, 3, 10, 1, 6, 14];
  const initialLinkedListValues =
    initialMode === "linked-list"
      ? initialValues.length
        ? initialValues
        : [4, 8, 15]
      : [4, 8, 15];
  const initialQueueValues =
    initialMode === "queue"
      ? initialValues.length
        ? initialValues
        : [10, 20, 30]
      : [10, 20, 30];
  const initialStackValues =
    initialMode === "stack"
      ? initialValues.length
        ? initialValues
        : [2, 4, 6]
      : [2, 4, 6];

  const [mode, setMode] = useState<StructureMode>(initialMode);
  const [valueInput, setValueInput] = useState("");
  const [bstValues, setBSTValues] = useState<number[]>(initialBstValues);
  const [linkedListValues, setLinkedListValues] = useState<number[]>(
    initialLinkedListValues
  );
  const [queueValues, setQueueValues] = useState<number[]>(initialQueueValues);
  const [stackValues, setStackValues] = useState<number[]>(initialStackValues);
  const [bstHighlight, setBSTHighlight] = useState<number | null>(null);
  const [bstFrames, setBSTFrames] = useState<TimelineFrame[]>([]);
  const [queueFrames, setQueueFrames] = useState<TimelineFrame[]>(
    initialMode === "queue"
      ? [{ label: "Model-generated queue", values: initialQueueValues }]
      : [{ label: "Initial queue", values: [10, 20, 30] }]
  );
  const [stackFrames, setStackFrames] = useState<TimelineFrame[]>(
    initialMode === "stack"
      ? [{ label: "Model-generated stack", values: initialStackValues }]
      : [{ label: "Initial stack", values: [2, 4, 6] }]
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const modelExplanation = externalUpdate?.explanation ?? "";

  // Pick the right timeline frames based on the active mode
  const activeFrames = useMemo(() => {
    if (mode === "bst") return bstFrames;
    if (mode === "queue") return queueFrames;
    if (mode === "stack") return stackFrames;
    return [] as TimelineFrame[];
  }, [mode, bstFrames, queueFrames, stackFrames]);

  const clampedFrameIndex =
    activeFrames.length === 0 ? 0 : Math.min(frameIndex, activeFrames.length - 1);
  const activeFrame = activeFrames[clampedFrameIndex];

  const displayedQueue =
    mode === "queue" && activeFrame?.values ? activeFrame.values : queueValues;
  const displayedStack =
    mode === "stack" && activeFrame?.values ? activeFrame.values : stackValues;
  const displayedBstHighlight =
    mode === "bst" ? activeFrame?.highlight ?? bstHighlight : null;

  // Build the React Flow JSON for the current data structure
  const flow = useMemo(() => {
    if (mode === "bst") {
      return buildBSTFlow(bstValues, displayedBstHighlight);
    }
    if (mode === "linked-list") {
      return buildLinkedListFlow(linkedListValues);
    }
    if (mode === "queue") {
      return buildQueueFlow(displayedQueue);
    }
    return buildStackFlow(displayedStack);
  }, [
    mode,
    bstValues,
    linkedListValues,
    displayedQueue,
    displayedStack,
    displayedBstHighlight,
  ]);

  const flowCode = useMemo(
    () => JSON.stringify({ nodes: flow.nodes, edges: flow.edges }),
    [flow]
  );

  // Parse the text input into a number (returns null if invalid)
  const parseValue = () => {
    const parsed = Number(valueInput.trim());
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  };

  // Insert / Enqueue / Push depending on the active mode
  const onInsertLike = () => {
    const parsed = parseValue();
    if (parsed === null) return;

    if (mode === "bst") {
      setBSTValues((prev) => (prev.includes(parsed) ? prev : [...prev, parsed]));
      setBSTHighlight(null);
    } else if (mode === "linked-list") {
      setLinkedListValues((prev) => [...prev, parsed]);
    } else if (mode === "queue") {
      setQueueValues((prev) => {
        const next = [...prev, parsed];
        setQueueFrames((frames) => [...frames, { label: `Enqueue ${parsed}`, values: next }]);
        return next;
      });
    } else {
      setStackValues((prev) => {
        const next = [...prev, parsed];
        setStackFrames((frames) => [...frames, { label: `Push ${parsed}`, values: next }]);
        return next;
      });
    }
    if (mode === "queue") {
      setFrameIndex(queueFrames.length);
    }
    if (mode === "stack") {
      setFrameIndex(stackFrames.length);
    }
    setIsPlaying(false);
    setValueInput("");
  };

  // Delete / Dequeue / Pop depending on the active mode
  const onDeleteLike = () => {
    if (mode === "bst") {
      const parsed = parseValue();
      if (parsed === null) return;
      const root = bstValues.reduce<BSTNode | null>(
        (acc, value, index) => insertBST(acc, value, `bst-${value}-${index}`),
        null
      );
      const updatedRoot = deleteBST(root, parsed);
      const flattened: number[] = [];
      const stack: Array<BSTNode | null> = [updatedRoot];
      while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        flattened.push(node.value);
        stack.push(node.right);
        stack.push(node.left);
      }
      setBSTValues(flattened);
      setBSTHighlight(null);
    } else if (mode === "linked-list") {
      const parsed = parseValue();
      if (parsed === null) return;
      setLinkedListValues((prev) => prev.filter((value, index) => {
        const firstMatch = prev.indexOf(parsed);
        return index !== firstMatch;
      }));
    } else if (mode === "queue") {
      setQueueValues((prev) => {
        const next = prev.slice(1);
        setQueueFrames((frames) => [...frames, { label: "Dequeue", values: next }]);
        return next;
      });
    } else {
      setStackValues((prev) => {
        const next = prev.slice(0, -1);
        setStackFrames((frames) => [...frames, { label: "Pop", values: next }]);
        return next;
      });
    }
    if (mode === "queue") {
      setFrameIndex(queueFrames.length);
    }
    if (mode === "stack") {
      setFrameIndex(stackFrames.length);
    }
    setIsPlaying(false);
    setValueInput("");
  };

  // Highlight a BST node if it exists in the tree
  const onSearchBST = () => {
    if (mode !== "bst") return;
    const parsed = parseValue();
    if (parsed === null) return;
    setBSTHighlight(bstValues.includes(parsed) ? parsed : null);
    setValueInput("");
  };

  // Run a BST traversal and build timeline frames for step-by-step animation
  const runBSTTraversal = (kind: "pre" | "in" | "post" | "level") => {
    const root = buildBST(bstValues);
    const order: number[] = [];
    if (kind === "pre") preorder(root, order);
    if (kind === "in") inorder(root, order);
    if (kind === "post") postorder(root, order);
    if (kind === "level") levelorder(root, order);

    const title =
      kind === "pre"
        ? "Pre-order"
        : kind === "in"
          ? "In-order"
          : kind === "post"
            ? "Post-order"
            : "Level-order";

    const nextFrames: TimelineFrame[] = [
      { label: `${title} traversal start`, highlight: null },
      ...order.map((value, index) => ({
        label: `${title} step ${index + 1}: visit ${value}`,
        highlight: value,
      })),
      { label: `${title} traversal complete`, highlight: null },
    ];

    setBSTFrames(nextFrames);
    setFrameIndex(0);
    setIsPlaying(false);
  };

  // Reset the current data structure to its default values
  const onReset = () => {
    if (mode === "bst") {
      setBSTValues([8, 3, 10, 1, 6, 14]);
      setBSTHighlight(null);
      setBSTFrames([]);
    } else if (mode === "linked-list") {
      setLinkedListValues([4, 8, 15]);
    } else if (mode === "queue") {
      setQueueValues([10, 20, 30]);
      setQueueFrames([{ label: "Initial queue", values: [10, 20, 30] }]);
    } else {
      setStackValues([2, 4, 6]);
      setStackFrames([{ label: "Initial stack", values: [2, 4, 6] }]);
    }
    setFrameIndex(0);
    setIsPlaying(false);
  };

  // Auto-advance the timeline when playing
  useEffect(() => {
    if (!isPlaying || activeFrames.length < 2) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= activeFrames.length) {
          setIsPlaying(false);
          return activeFrames.length - 1;
        }
        return next;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [isPlaying, activeFrames]);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h2 className="font-semibold text-foreground">Interactive DSA Playground</h2>
        <p className="text-xs text-muted-foreground">
          BST, Linked List, Queue, and Stack in React Flow.
        </p>
      </div>

      {modelExplanation && (
        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
          {modelExplanation}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(modeLabels) as StructureMode[]).map((item) => (
          <Button
            key={item}
            type="button"
            variant={mode === item ? "default" : "outline"}
            onClick={() => {
              setMode(item);
              setFrameIndex(0);
              setIsPlaying(false);
            }}
          >
            {modeLabels[item]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={valueInput}
          onChange={(event) => setValueInput(event.target.value)}
          placeholder={cn(
            "Enter a number",
            mode === "queue" && "Optional for dequeue",
            mode === "stack" && "Optional for pop"
          )}
          className="w-full max-w-xs"
        />
        <Button type="button" onClick={onInsertLike}>
          {mode === "queue" ? "Enqueue" : mode === "stack" ? "Push" : "Insert"}
        </Button>
        <Button type="button" variant="outline" onClick={onDeleteLike}>
          {mode === "queue" ? "Dequeue" : mode === "stack" ? "Pop" : "Delete"}
        </Button>
        {mode === "bst" && (
          <>
            <Button type="button" variant="secondary" onClick={onSearchBST}>
              Find
            </Button>
            <Button type="button" variant="outline" onClick={() => runBSTTraversal("pre")}>
              Pre-order
            </Button>
            <Button type="button" variant="outline" onClick={() => runBSTTraversal("in")}>
              In-order
            </Button>
            <Button type="button" variant="outline" onClick={() => runBSTTraversal("post")}>
              Post-order
            </Button>
            <Button type="button" variant="outline" onClick={() => runBSTTraversal("level")}>
              Level-order
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>

      {(mode === "bst" || mode === "queue" || mode === "stack") && activeFrames.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={clampedFrameIndex <= 0}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (clampedFrameIndex >= activeFrames.length - 1) {
                setFrameIndex(0);
              }
              setIsPlaying((prev) => !prev);
            }}
            disabled={activeFrames.length <= 1}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex((prev) => Math.min(activeFrames.length - 1, prev + 1));
            }}
            disabled={clampedFrameIndex >= activeFrames.length - 1}
          >
            Next
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {clampedFrameIndex + 1}/{activeFrames.length}: {activeFrame?.label}
          </span>
        </div>
      )}

      <FlowDiagram key={`${mode}-${flowCode}`} code={flowCode} />
    </div>
  );
}
