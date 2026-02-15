"use client";

import { useState } from "react";
import { ChatUI } from "@/components/chat-ui";
import { DSAPlayground } from "@/components/dsa-playground";
import { ArraysVisualizer } from "@/components/arrays/arrays-visualizer";
import type { PlaygroundUpdate } from "@/lib/dsa-playground-types";
import type {
  ArraysChatSuccessResponse,
  ArraysVizSpec,
  NormalizedArraysInput,
} from "@/lib/arrays/types";

export default function Home() {
  const [playgroundUpdate, setPlaygroundUpdate] =
    useState<PlaygroundUpdate | null>(null);
  const [playgroundVersion, setPlaygroundVersion] = useState(0);
  const [arraysSpec, setArraysSpec] = useState<ArraysVizSpec | null>(null);
  const [arraysVersion, setArraysVersion] = useState(0);
  const [normalizedArraysInput, setNormalizedArraysInput] =
    useState<NormalizedArraysInput | null>(null);

  const handlePlaygroundUpdate = (update: PlaygroundUpdate) => {
    setPlaygroundUpdate(update);
    setPlaygroundVersion((value) => value + 1);
  };

  const handleArraysResult = (payload: ArraysChatSuccessResponse) => {
    setArraysSpec(payload.spec);
    setNormalizedArraysInput(payload.normalizedInput);
    setArraysVersion((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto flex w-full max-w-7xl gap-4">
        <div className="min-w-0 flex-1 flex flex-col gap-4">
          {playgroundUpdate && (
            <DSAPlayground
              key={`playground-${playgroundVersion}`}
              externalUpdate={playgroundUpdate}
            />
          )}
          {arraysSpec && (
            <ArraysVisualizer
              key={`arrays-${arraysVersion}`}
              spec={arraysSpec}
              normalizedInput={normalizedArraysInput}
            />
          )}
          {!playgroundUpdate && !arraysSpec && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground">
              <p className="text-sm">Diagrams will appear here when you send a message from the chat.</p>
            </div>
          )}
        </div>
        <div className="w-[380px] flex-shrink-0">
          <ChatUI
            onPlaygroundUpdate={handlePlaygroundUpdate}
            onArraysResult={handleArraysResult}
          />
        </div>
      </div>

      {/* Debug: arrays viz payload (pretty-printed JSON) */}
      {(arraysSpec || normalizedArraysInput) && (
        <div className="mx-auto mt-6 w-full max-w-7xl">
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Debug: arrays viz output (JSON)
            </summary>
            <pre className="max-h-80 overflow-auto p-4 text-xs text-foreground">
              {JSON.stringify(
                { spec: arraysSpec, normalizedInput: normalizedArraysInput },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
