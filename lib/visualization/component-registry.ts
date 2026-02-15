export const VISUAL_COMPONENT_TYPES = [
  "FlowDiagram",
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

export const ARRAYS_COMPONENT_TYPES = [
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

export const DSA_COMPONENT_TYPES = ["FlowDiagram"] as const;

export type VisualComponentType = (typeof VISUAL_COMPONENT_TYPES)[number];
export type ArraysComponentType = (typeof ARRAYS_COMPONENT_TYPES)[number];
export type DSAComponentType = (typeof DSA_COMPONENT_TYPES)[number];

export const COMPONENT_DOMAIN: Record<VisualComponentType, "dsa" | "arrays"> = {
  FlowDiagram: "dsa",
  ArrayView: "arrays",
  BarArrayView: "arrays",
  Pointer: "arrays",
  RangeHighlight: "arrays",
  SwapAnimation: "arrays",
  CompareAnimation: "arrays",
  CaptionCallout: "arrays",
  CodeBlock: "arrays",
  TimelineStepper: "arrays",
  StackView: "arrays",
  PartitionView: "arrays",
  MergeView: "arrays",
};
