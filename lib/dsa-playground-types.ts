export type StructureMode = "bst" | "linked-list" | "queue" | "stack" | "astar";

export type PlaygroundUpdate = {
  mode: StructureMode;
  values: number[];
  explanation: string;
};
