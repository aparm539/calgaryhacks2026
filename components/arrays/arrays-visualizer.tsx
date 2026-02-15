"use client";

import { useEffect, useMemo, useState } from "react";
import { CaptionCallout } from "@/components/arrays/caption-callout";
import { RegistryRenderer } from "@/components/arrays/registry-renderer";
import { TimelineStepper } from "@/components/arrays/timeline-stepper";
import type {
  ArraysVizSpec,
  NormalizedArraysInput,
  RegistryComponentRef,
} from "@/lib/arrays/types";

type ArraysVisualizerProps = {
  spec: ArraysVizSpec | null;
  normalizedInput: NormalizedArraysInput | null;
};

function formatAlgorithmLabel(value: string) {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function filterCanvasComponents(components: RegistryComponentRef[]) {
  return components.filter(
    (component) =>
      component.type !== "TimelineStepper" && component.type !== "CaptionCallout"
  );
}

export function ArraysVisualizer({ spec, normalizedInput }: ArraysVisualizerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!spec || !isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= spec.steps.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlaying, spec]);

  const clampedIndex = spec ? Math.min(stepIndex, spec.steps.length - 1) : 0;
  const currentStep = spec?.steps[clampedIndex] ?? null;

  const canvasComponents = useMemo(
    () => (spec ? filterCanvasComponents(spec.scene.components) : []),
    [spec]
  );

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">

      {!spec || !currentStep ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          Send a prompt
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="mb-3 text-sm font-medium text-foreground">{spec.title}</p>
            <div className="overflow-x-auto">
              <div className="min-w-max pr-2">
                <RegistryRenderer
                  components={canvasComponents}
                  spec={spec}
                  step={currentStep}
                  stepIndex={clampedIndex}
                  isPlaying={isPlaying}
                  onStepChange={(index) => {
                    setIsPlaying(false);
                    setStepIndex(index);
                  }}
                  onPlayPause={() => {
                    if (clampedIndex >= spec.steps.length - 1) {
                      setStepIndex(0);
                    }
                    setIsPlaying((value) => !value);
                  }}
                  onPrev={() => {
                    setIsPlaying(false);
                    setStepIndex((value) => Math.max(0, value - 1));
                  }}
                  onNext={() => {
                    setIsPlaying(false);
                    setStepIndex((value) => Math.min(spec.steps.length - 1, value + 1));
                  }}
                />
              </div>
            </div>
          </div>

          <CaptionCallout caption={currentStep.caption} />

          <TimelineStepper
            currentStep={clampedIndex}
            totalSteps={spec.steps.length}
            isPlaying={isPlaying}
            onStepChange={(index) => {
              setIsPlaying(false);
              setStepIndex(index);
            }}
            onPlayPause={() => {
              if (clampedIndex >= spec.steps.length - 1) {
                setStepIndex(0);
              }
              setIsPlaying((value) => !value);
            }}
            onPrev={() => {
              setIsPlaying(false);
              setStepIndex((value) => Math.max(0, value - 1));
            }}
            onNext={() => {
              setIsPlaying(false);
              setStepIndex((value) => Math.min(spec.steps.length - 1, value + 1));
            }}
          />
        </>
      )}
    </div>
  );
}
