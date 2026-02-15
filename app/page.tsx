"use client";

import { useState } from "react";
import { ChatUI } from "@/components/chat-ui";
import { DSAPlayground } from "@/components/dsa-playground";
import type { PlaygroundUpdate } from "@/lib/dsa-playground-types";

export default function Home() {
  const [playgroundUpdate, setPlaygroundUpdate] =
    useState<PlaygroundUpdate | null>(null);
  const [playgroundVersion, setPlaygroundVersion] = useState(0);

  const handlePlaygroundUpdate = (update: PlaygroundUpdate) => {
    setPlaygroundUpdate(update);
    setPlaygroundVersion((value) => value + 1);
  };

  return (
    <div className="flex h-screen flex-row gap-4 bg-muted/30 p-4">
      <div className="flex-1">
        <DSAPlayground
          key={`playground-${playgroundVersion}`}
          externalUpdate={playgroundUpdate}
        />
      </div>
      <div className="flex-1">
        <ChatUI onPlaygroundUpdate={handlePlaygroundUpdate} />
      </div>
    </div>
  );
}
