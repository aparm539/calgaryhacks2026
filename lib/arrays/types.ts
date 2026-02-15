export const MAX_ARRAY_LENGTH = 32;
export const MAX_TIMELINE_STEPS = 300;
export const MAX_CODE_LINES = 40;

export const ARRAYS_ALGORITHMS = [
  "linear-search",
  "binary-search",
  "quicksort",
  "mergesort",
] as const;

export type ArraysAlgorithm = (typeof ARRAYS_ALGORITHMS)[number];

export type ArraysChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ArraysChatRequest = {
  message: string;
  history?: ArraysChatHistoryMessage[];
};

export type NormalizedArraysInput = {
  algorithm: ArraysAlgorithm;
  array: number[];
  target?: number;
};

export type StepEvent =
  | {
      type: "swap";
      i: number;
      j: number;
    }
  | {
      type: "compare";
      i: number;
      j: number;
      outcome?: "lt" | "eq" | "gt";
    };

export type StepState = {
  array: number[];
  pointers?: Record<string, number>;
  range?: {
    l: number;
    r: number;
  };
  stack?: string[];
  partition?: {
    pivotIndex: number;
    less: number[];
    greater: number[];
  };
  merge?: {
    left: number[];
    right: number[];
    merged: number[];
    writeRange?: {
      l: number;
      r: number;
    };
  };
};

export type StepSpec = {
  id: string;
  caption: string;
  activeCodeLine: number;
  state: StepState;
  events?: StepEvent[];
};

export const REGISTRY_COMPONENT_TYPES = [
  "ArrayView",
  "BarArrayView",
  "Pointer",
  "RangeHighlight",
  "SwapAnimation",
  "CompareAnimation",
  "CaptionCallout",
  "CodeBlock",
  "TimelineStepper",
  "StackView",
  "PartitionView",
  "MergeView",
] as const;

export type RegistryComponentType = (typeof REGISTRY_COMPONENT_TYPES)[number];

type PrimitiveProps = Record<string, string | number | boolean>;

type BaseRegistryComponent<T extends RegistryComponentType> = {
  id: string;
  type: T;
  props?: PrimitiveProps;
};

export type RegistryComponentRef =
  | BaseRegistryComponent<"ArrayView">
  | BaseRegistryComponent<"BarArrayView">
  | BaseRegistryComponent<"Pointer">
  | BaseRegistryComponent<"RangeHighlight">
  | BaseRegistryComponent<"SwapAnimation">
  | BaseRegistryComponent<"CompareAnimation">
  | BaseRegistryComponent<"CaptionCallout">
  | BaseRegistryComponent<"CodeBlock">
  | BaseRegistryComponent<"TimelineStepper">
  | BaseRegistryComponent<"StackView">
  | BaseRegistryComponent<"PartitionView">
  | BaseRegistryComponent<"MergeView">;

export type ArraysVizSpec = {
  version: "1.0";
  algorithm: ArraysAlgorithm;
  title: string;
  code: {
    lines: string[];
  };
  scene: {
    components: RegistryComponentRef[];
  };
  steps: StepSpec[];
};

export type ArraysChatSuccessResponse = {
  explanation: string;
  spec: ArraysVizSpec;
  normalizedInput: NormalizedArraysInput;
};

export type ArraysChatErrorResponse = {
  error: string;
  details?: string;
};
