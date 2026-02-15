"use client";

import { cn } from "@/lib/utils";
import type { StepEvent, StepState } from "@/lib/arrays/types";
import {
  ARRAY_CELL_WIDTH,
  ARRAY_TRACK_PADDING,
  getTrackWidth,
  indexToX,
} from "@/components/arrays/layout-constants";

type PartitionState = NonNullable<StepState["partition"]>;
type RangeState = StepState["range"];
type PointerState = StepState["pointers"];

export type PartitionHistoryEntry = {
  stepIndex: number;
  caption: string;
  partition: PartitionState;
  array: number[];
  pointers?: PointerState;
  range?: RangeState;
  events?: StepEvent[];
  isCurrent: boolean;
};

type PartitionViewProps = {
  array: number[];
  partition?: PartitionState;
  pointers?: PointerState;
  range?: RangeState;
  events?: StepEvent[];
  history?: PartitionHistoryEntry[];
};

type PointerRole = "i" | "j" | "pivot" | "pointer";

type PointerMarker = {
  key: string;
  label: string;
  role: PointerRole;
  index: number;
};

function getPartitionEvents(events?: StepEvent[]) {
  return (events ?? []).filter(
    (event): event is StepEvent =>
      event.type === "compare" || event.type === "swap"
  );
}

function formatRange(range?: RangeState) {
  if (!range) {
    return "entire array";
  }

  return `[${range.l}, ${range.r}]`;
}

function inferStage(events?: StepEvent[], caption?: string) {
  const partitionEvents = getPartitionEvents(events);
  if (partitionEvents.some((event) => event.type === "swap")) {
    return "swap";
  }

  if (partitionEvents.some((event) => event.type === "compare")) {
    return "compare";
  }

  const normalizedCaption = caption?.toLowerCase() ?? "";
  if (
    normalizedCaption.includes("pivot") &&
    (normalizedCaption.includes("place") || normalizedCaption.includes("final"))
  ) {
    return "place pivot";
  }

  return "partition step";
}

function normalizePointer(name: string) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName === "i" || normalizedName.includes("store")) {
    return { label: "i", role: "i" as const };
  }

  if (normalizedName === "j" || normalizedName.includes("scan")) {
    return { label: "j", role: "j" as const };
  }

  if (
    normalizedName === "p" ||
    normalizedName === "pivot" ||
    normalizedName.includes("pivot")
  ) {
    return { label: "pivot", role: "pivot" as const };
  }

  return {
    label: name.length > 12 ? `${name.slice(0, 12)}...` : name,
    role: "pointer" as const,
  };
}

function getPointerMarkers(pointers?: PointerState) {
  if (!pointers) {
    return [];
  }

  return Object.entries(pointers).map(([name, index]) => {
    const normalized = normalizePointer(name);
    return {
      key: name,
      label: normalized.label,
      role: normalized.role,
      index,
    } satisfies PointerMarker;
  });
}

function getPointerIndex(pointers: PointerState | undefined, role: PointerRole) {
  const marker = getPointerMarkers(pointers).find((entry) => entry.role === role);
  return marker?.index;
}

function getProgressText(
  partition: PartitionState,
  range: RangeState | undefined,
  pointers: PointerState | undefined,
  arrayLength: number
) {
  const total = range ? Math.max(1, range.r - range.l + 1) : Math.max(1, arrayLength);
  const scanIndex = getPointerIndex(pointers, "j");

  if (typeof scanIndex === "number" && range) {
    const processed = Math.min(total, Math.max(0, scanIndex - range.l + 1));
    return `${processed}/${total} scanned`;
  }

  const classified = Math.min(total, partition.less.length + partition.greater.length);
  return `${classified}/${total} classified`;
}

function formatEventChip(event: StepEvent) {
  if (event.type === "swap") {
    return `swap ${event.i}\u2194${event.j}`;
  }

  const outcome = event.outcome === "lt" ? "<" : event.outcome === "gt" ? ">" : "=";
  return `compare ${event.i} ${outcome} ${event.j}`;
}

function CompactPartitionBucket({ label, values }: { label: string; values: number[] }) {
  return (
    <div className="rounded-md border bg-background/80 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <p className="font-medium text-muted-foreground">{label}</p>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
          {values.length}
        </span>
      </div>
      {values.length ? (
        <div className="flex flex-wrap gap-1">
          {values.map((value, index) => (
            <span
              key={`${label}-${index}-${value}`}
              className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">empty</p>
      )}
    </div>
  );
}

function getMarkerClassName(role: PointerRole) {
  if (role === "i") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-800";
  }

  if (role === "j") {
    return "border-sky-500/40 bg-sky-500/15 text-sky-800";
  }

  if (role === "pivot") {
    return "border-amber-500/40 bg-amber-500/20 text-amber-900";
  }

  return "border-border bg-muted/40 text-foreground";
}

type PartitionArrayTrackProps = {
  values: number[];
  pivotIndex: number;
  range?: RangeState;
  pointers?: PointerState;
  events?: StepEvent[];
};

function PartitionArrayTrack({
  values,
  pivotIndex,
  range,
  pointers,
  events,
}: PartitionArrayTrackProps) {
  const trackWidth = Math.max(getTrackWidth(values.length), 120);
  const pointerMarkers = getPointerMarkers(pointers).filter(
    (marker) => marker.index >= 0 && marker.index < values.length
  );
  const partitionEvents = getPartitionEvents(events);
  const eventIndices = new Set<number>();
  partitionEvents.forEach((event) => {
    eventIndices.add(event.i);
    eventIndices.add(event.j);
  });

  const markersPerIndex = new Map<number, number>();
  pointerMarkers.forEach((marker) => {
    const count = markersPerIndex.get(marker.index) ?? 0;
    markersPerIndex.set(marker.index, count + 1);
  });
  const pointerRows = Math.max(...markersPerIndex.values(), 1);
  const pointerLayerHeight = pointerRows * 18;
  const markerRowByKey = new Map<string, number>();
  const consumedRowsByIndex = new Map<number, number>();
  pointerMarkers.forEach((marker) => {
    const usedRows = consumedRowsByIndex.get(marker.index) ?? 0;
    markerRowByKey.set(marker.key, usedRows);
    consumedRowsByIndex.set(marker.index, usedRows + 1);
  });

  return (
    <div className="space-y-1">
      <div className="relative" style={{ width: trackWidth, height: pointerLayerHeight }}>
        {pointerMarkers.map((marker) => {
          const rowIndex = markerRowByKey.get(marker.key) ?? 0;
          return (
            <div
              key={`marker-${marker.key}-${marker.index}`}
              className="absolute -translate-x-1/2"
              style={{
                left: indexToX(marker.index) + ARRAY_CELL_WIDTH / 2,
                top: rowIndex * 18,
              }}
            >
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                  getMarkerClassName(marker.role)
                )}
              >
                {marker.label}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="flex text-[10px] font-medium text-muted-foreground"
        style={{ marginLeft: ARRAY_TRACK_PADDING }}
      >
        {values.map((_, index) => (
          <div
            key={`partition-index-${index}`}
            className="flex items-center justify-center"
            style={{ width: ARRAY_CELL_WIDTH }}
          >
            {index}
          </div>
        ))}
      </div>

      <div className="flex" style={{ marginLeft: ARRAY_TRACK_PADDING }}>
        {values.map((value, index) => {
          const withinRange = range ? index >= range.l && index <= range.r : true;
          const isPivot = index === pivotIndex;
          const isEventCell = eventIndices.has(index);

          return (
            <div
              key={`partition-value-${index}-${value}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                !withinRange && range && "border-border/70 bg-muted/20 text-muted-foreground",
                withinRange && range && "border-amber-500/35 bg-amber-500/10",
                isEventCell && "border-sky-500/45 bg-sky-500/15",
                isPivot && "border-primary/70 bg-primary/20 shadow-sm"
              )}
              style={{ width: ARRAY_CELL_WIDTH }}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckpointRow({ entry }: { entry: PartitionHistoryEntry }) {
  const partitionEvents = getPartitionEvents(entry.events);
  const compareCount = partitionEvents.filter(
    (event) => event.type === "compare"
  ).length;
  const swapCount = partitionEvents.filter((event) => event.type === "swap").length;
  const stage = inferStage(entry.events, entry.caption);
  const pivotValue = entry.array[entry.partition.pivotIndex];

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 text-[11px]",
        entry.isCurrent
          ? "border-primary/35 bg-primary/10"
          : "bg-background/80"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">
          Step {entry.stepIndex + 1}
          {entry.isCurrent ? " (current)" : ""}
        </p>
        <span className="rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground">
          {stage}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
        <span>Range {formatRange(entry.range)}</span>
        <span>Pivot {entry.partition.pivotIndex}</span>
        <span>Value {pivotValue}</span>
        {(compareCount > 0 || swapCount > 0) && (
          <span>
            {compareCount} compare / {swapCount} swap
          </span>
        )}
      </div>
    </div>
  );
}

export function PartitionView({
  array,
  partition,
  pointers,
  range,
  events,
  history,
}: PartitionViewProps) {
  const entries =
    history && history.length > 0
      ? history
      : partition
        ? [
            {
              stepIndex: 0,
              caption: "",
              partition,
              array,
              pointers,
              range,
              events,
              isCurrent: true,
            },
          ]
        : [];

  const currentEntry = entries.find((entry) => entry.isCurrent) ?? entries.at(-1);

  if (!currentEntry) {
    return null;
  }

  const currentEvents = getPartitionEvents(currentEntry.events);
  const stage = inferStage(currentEntry.events, currentEntry.caption);
  const progress = getProgressText(
    currentEntry.partition,
    currentEntry.range,
    currentEntry.pointers,
    currentEntry.array.length
  );
  const pivotValue = currentEntry.array[currentEntry.partition.pivotIndex];
  const hasDetailedContext =
    Boolean(currentEntry.range) ||
    getPointerMarkers(currentEntry.pointers).length > 0 ||
    currentEvents.length > 0;

  return (
    <div className="rounded-md border bg-muted/20 p-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">
        Partition Progress
      </p>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
            Current Partition State
          </span>
          <span className="rounded border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground">
            {stage}
          </span>
          <span className="rounded border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground">
            {progress}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span>Range: {formatRange(currentEntry.range)}</span>
          <span>Pivot index: {currentEntry.partition.pivotIndex}</span>
          <span>Pivot value: {pivotValue}</span>
        </div>

        {currentEntry.caption && (
          <p className="mb-2 text-[11px] text-muted-foreground">{currentEntry.caption}</p>
        )}

        {hasDetailedContext ? (
          <>
            <PartitionArrayTrack
              values={currentEntry.array}
              pivotIndex={currentEntry.partition.pivotIndex}
              range={currentEntry.range}
              pointers={currentEntry.pointers}
              events={currentEntry.events}
            />
            {currentEvents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {currentEvents.map((event, index) => (
                  <span
                    key={`partition-event-${index}-${event.type}-${event.i}-${event.j}`}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                      event.type === "swap"
                        ? "border-sky-500/40 bg-sky-500/15 text-sky-800"
                        : "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-800"
                    )}
                  >
                    {formatEventChip(event)}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-md border border-dashed bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
            Using fallback partition summary (range, pointers, and events were not provided).
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <CompactPartitionBucket label="Less than pivot" values={currentEntry.partition.less} />
          <CompactPartitionBucket
            label="Greater/equal pivot"
            values={currentEntry.partition.greater}
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Recent Checkpoints
        </p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <CheckpointRow key={`partition-${entry.stepIndex}`} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
