"use client";

import { ArrayView } from "@/components/arrays/array-view";
import { BarArrayView } from "@/components/arrays/bar-array-view";
import { CaptionCallout } from "@/components/arrays/caption-callout";
import { CodeBlock } from "@/components/arrays/code-block";
import { CompareAnimation } from "@/components/arrays/compare-animation";
import {
  PartitionView,
  type PartitionHistoryEntry,
} from "@/components/arrays/partition-view";
import { PointerLayer } from "@/components/arrays/pointer-layer";
import { RangeHighlight } from "@/components/arrays/range-highlight";
import { StackView } from "@/components/arrays/stack-view";
import { SwapAnimation } from "@/components/arrays/swap-animation";
import { TimelineStepper } from "@/components/arrays/timeline-stepper";
import { MergeView, type MergeHistoryEntry } from "@/components/arrays/merge-view";
import type {
  ArraysVizSpec,
  RegistryComponentRef,
  StepEvent,
  StepSpec,
} from "@/lib/arrays/types";

type RegistryRendererProps = {
  components: RegistryComponentRef[];
  spec: ArraysVizSpec;
  step: StepSpec;
  stepIndex: number;
  isPlaying: boolean;
  onStepChange: (index: number) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
};

const COMPONENT_RENDER_ORDER: Record<RegistryComponentRef["type"], number> = {
  Pointer: 10,
  RangeHighlight: 20,
  ArrayView: 30,
  BarArrayView: 40,
  SwapAnimation: 50,
  CompareAnimation: 60,
  PartitionView: 70,
  MergeView: 75,
  StackView: 80,
  CodeBlock: 90,
  CaptionCallout: 100,
  TimelineStepper: 110,
};

function dedupeComponentsByType(components: RegistryComponentRef[]) {
  const seenTypes = new Set<RegistryComponentRef["type"]>();

  return components.filter((component) => {
    if (seenTypes.has(component.type)) {
      return false;
    }

    seenTypes.add(component.type);
    return true;
  });
}

function sortComponentsByRenderOrder(components: RegistryComponentRef[]) {
  return [...components].sort((a, b) => {
    const aOrder = COMPONENT_RENDER_ORDER[a.type] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = COMPONENT_RENDER_ORDER[b.type] ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

function getSwapEvents(events?: StepEvent[]) {
  return (events ?? []).filter(
    (event): event is Extract<StepEvent, { type: "swap" }> => event.type === "swap"
  );
}

function getCompareEvents(events?: StepEvent[]) {
  return (events ?? []).filter(
    (event): event is Extract<StepEvent, { type: "compare" }> =>
      event.type === "compare"
  );
}

export function RegistryRenderer({
  components,
  spec,
  step,
  stepIndex,
  isPlaying,
  onStepChange,
  onPlayPause,
  onPrev,
  onNext,
}: RegistryRendererProps) {
  const swapEvents = getSwapEvents(step.events);
  const compareEvents = getCompareEvents(step.events);
  const arrayLength = step.state.array.length;
  const orderedComponents = sortComponentsByRenderOrder(
    dedupeComponentsByType(components)
  );
  const stepsToCurrent = spec.steps.slice(0, stepIndex + 1);
  const partitionHistory = stepsToCurrent.reduce<PartitionHistoryEntry[]>(
    (history, timelineStep, timelineIndex) => {
      if (!timelineStep.state.partition) {
        return history;
      }

      history.push({
        stepIndex: timelineIndex,
        caption: timelineStep.caption,
        partition: timelineStep.state.partition,
        isCurrent: timelineIndex === stepIndex,
      });
      return history;
    },
    []
  );
  const mergeHistory = stepsToCurrent.reduce<MergeHistoryEntry[]>(
    (history, timelineStep, timelineIndex) => {
      if (!timelineStep.state.merge) {
        return history;
      }

      history.push({
        stepIndex: timelineIndex,
        caption: timelineStep.caption,
        merge: timelineStep.state.merge,
        stepId: timelineStep.id,
        isCurrent: timelineIndex === stepIndex,
      });
      return history;
    },
    []
  );

  return (
    <div className="flex flex-col gap-3">
      {orderedComponents.map((component) => {
        if (component.type === "ArrayView") {
          return <ArrayView key={component.id} values={step.state.array} />;
        }

        if (component.type === "BarArrayView") {
          return <BarArrayView key={component.id} values={step.state.array} />;
        }

        if (component.type === "Pointer") {
          return (
            <PointerLayer
              key={component.id}
              pointers={step.state.pointers}
              arrayLength={arrayLength}
            />
          );
        }

        if (component.type === "RangeHighlight") {
          return (
            <RangeHighlight
              key={component.id}
              range={step.state.range}
              arrayLength={arrayLength}
            />
          );
        }

        if (component.type === "SwapAnimation") {
          return (
            <SwapAnimation
              key={component.id}
              events={swapEvents}
              arrayLength={arrayLength}
              animationKey={step.id}
            />
          );
        }

        if (component.type === "CompareAnimation") {
          return (
            <CompareAnimation
              key={component.id}
              events={compareEvents}
              arrayLength={arrayLength}
              animationKey={step.id}
            />
          );
        }

        if (component.type === "CaptionCallout") {
          return <CaptionCallout key={component.id} caption={step.caption} />;
        }

        if (component.type === "CodeBlock") {
          return (
            <CodeBlock
              key={component.id}
              lines={spec.code.lines}
              activeLine={step.activeCodeLine}
            />
          );
        }

        if (component.type === "TimelineStepper") {
          return (
            <TimelineStepper
              key={component.id}
              currentStep={stepIndex}
              totalSteps={spec.steps.length}
              isPlaying={isPlaying}
              onStepChange={onStepChange}
              onPlayPause={onPlayPause}
              onPrev={onPrev}
              onNext={onNext}
            />
          );
        }

        if (component.type === "StackView") {
          return <StackView key={component.id} items={step.state.stack} />;
        }

        if (component.type === "PartitionView") {
          return (
            <PartitionView
              key={component.id}
              partition={step.state.partition}
              history={partitionHistory}
            />
          );
        }

        if (component.type === "MergeView") {
          return (
            <MergeView
              key={component.id}
              merge={step.state.merge}
              animationKey={step.id}
              history={mergeHistory}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
