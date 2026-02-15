import { ARRAYS_COMPONENT_TYPES } from "@/lib/visualization/component-registry";

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

export const ARRAYS_MODEL_PROVIDERS = ["watson", "openrouter"] as const;
export type ArraysProvider = (typeof ARRAYS_MODEL_PROVIDERS)[number];

export const OPENROUTER_ARRAYS_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },

] as const;

export const DEFAULT_OPENROUTER_ARRAYS_MODEL = "google/gemini-3-flash-preview";

export type ArraysChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ArraysChatRequest = {
  message: string;
  history?: ArraysChatHistoryMessage[];
  provider?: ArraysProvider;
  modelId?: string;
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

export const RECURSION_PHASES = [
  "enter",
  "base",
  "divide",
  "recurse-left",
  "recurse-right",
  "combine",
  "return",
] as const;

export type RecursionPhase = (typeof RECURSION_PHASES)[number];

export type RecursionState = {
  callId: string;
  parentCallId?: string;
  fn: string;
  depth: number;
  phase: RecursionPhase;
  args: string;
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
  recursion?: RecursionState;
};

export type StepSpec = {
  id: string;
  caption: string;
  activeCodeLine: number;
  state: StepState;
  events?: StepEvent[];
};

export const REGISTRY_COMPONENT_TYPES = ARRAYS_COMPONENT_TYPES;

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
  spec: ArraysVizSpec;
  normalizedInput: NormalizedArraysInput;
  provider?: ArraysProvider;
  modelId?: string;
};

export type ArraysChatErrorResponse = {
  error: string;
  details?: string;
};
