"use client";

import { Button } from "@/components/ui/button";

type TimelineStepperProps = {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  onStepChange: (index: number) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function TimelineStepper({
  currentStep,
  totalSteps,
  isPlaying,
  onStepChange,
  onPlayPause,
  onPrev,
  onNext,
}: TimelineStepperProps) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {currentStep + 1}/{totalSteps}
        </span>
        <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, totalSteps - 1)}
        value={currentStep}
        onChange={(event) => onStepChange(Number(event.target.value))}
        className="mb-3 h-2 w-full cursor-pointer accent-primary"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={currentStep <= 0}
        >
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onPlayPause}
          disabled={totalSteps <= 1}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
