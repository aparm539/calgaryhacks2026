import type { DSAComponentType } from "@/lib/visualization/component-registry";

type PrimitiveProps = Record<string, string | number | boolean>;

type BaseRegistryComponent<T extends DSAComponentType> = {
  id: string;
  type: T;
  props?: PrimitiveProps;
};

export type DSARegistryComponentRef = BaseRegistryComponent<"FlowDiagram">;

export const DEFAULT_DSA_COMPONENTS: DSARegistryComponentRef[] = [
  { id: "flow-diagram", type: "FlowDiagram" },
];
