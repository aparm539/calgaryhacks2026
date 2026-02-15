"use client";

import { useState } from "react";
import { ChatUI } from "@/components/chat-ui";
import { DSAPlayground } from "@/components/dsa-playground";
import { LearningMode } from "@/components/learning-mode-modal";
import type { PlaygroundUpdate, StructureMode } from "@/lib/dsa-playground-types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [playgroundUpdate, setPlaygroundUpdate] =
    useState<PlaygroundUpdate | null>(null);
  const [playgroundVersion, setPlaygroundVersion] = useState(0);
  const [learningMode, setLearningMode] = useState(false);
  const [currentStructure, setCurrentStructure] = useState<{
    mode: StructureMode;
    values: number[];
  } | null>(null);
  // 全局消息历史
  const [messages, setMessages] = useState<Message[]>([]);

  const handlePlaygroundUpdate = (update: PlaygroundUpdate) => {
    setPlaygroundUpdate(update);
    setPlaygroundVersion((value) => value + 1);
  };

  const handleAddMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-screen flex-row gap-4 bg-muted/30 p-4">
      <div className="flex-1">
        <DSAPlayground
          key={`playground-${playgroundVersion}`}
          externalUpdate={playgroundUpdate}
          learningMode={learningMode}
          onLearningModeChange={setLearningMode}
          onStructureChange={setCurrentStructure}
        />
      </div>
      <div className="flex-1">
        {learningMode && currentStructure ? (
          <LearningMode
            onClose={() => setLearningMode(false)}
            currentStructure={currentStructure}
          />
        ) : (
          <ChatUI 
            onPlaygroundUpdate={handlePlaygroundUpdate}
            messages={messages}
            onAddMessage={handleAddMessage}
            onClearMessages={handleClearMessages}
          />
        )}
      </div>
    </div>
  );
}
