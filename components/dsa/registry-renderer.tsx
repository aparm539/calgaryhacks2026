"use client";

import { FlowDiagram } from "@/components/flow-diagram";
import type { DSARegistryComponentRef } from "@/lib/dsa/registry-types";

type DSARegistryRendererProps = {
  components: DSARegistryComponentRef[];
  flowCode: string;
  flowKey: string;
};

const COMPONENT_RENDER_ORDER: Record<DSARegistryComponentRef["type"], number> = {
  FlowDiagram: 10,
};

function dedupeComponentsByType(components: DSARegistryComponentRef[]) {
  const seenTypes = new Set<DSARegistryComponentRef["type"]>();

  return components.filter((component) => {
    if (seenTypes.has(component.type)) {
      return false;
    }

    seenTypes.add(component.type);
    return true;
  });
}

function sortComponentsByRenderOrder(components: DSARegistryComponentRef[]) {
  return [...components].sort((a, b) => {
    const aOrder = COMPONENT_RENDER_ORDER[a.type] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = COMPONENT_RENDER_ORDER[b.type] ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

export function DSARegistryRenderer({
  components,
  flowCode,
  flowKey,
}: DSARegistryRendererProps) {
  const orderedComponents = sortComponentsByRenderOrder(
    dedupeComponentsByType(components)
  );

  return (
    <div className="overflow-hidden">
      {orderedComponents.map((component) => {
        if (component.type === "FlowDiagram") {
          return (
            <FlowDiagram
              key={`${component.id}-${flowKey}`}
              code={flowCode}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
