export type StructureMode = "bst" | "linked-list" | "queue" | "stack";

export type PlaygroundUpdate = {
  mode: StructureMode;
  values: number[];
  explanation: string;
};
