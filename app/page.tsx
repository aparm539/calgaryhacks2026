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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
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
        <ChatUI
          onPlaygroundUpdate={handlePlaygroundUpdate}
          onArraysResult={handleArraysResult}
        />
      </div>
    </div>
  );
}
