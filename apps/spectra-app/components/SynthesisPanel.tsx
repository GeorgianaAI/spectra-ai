"use client";

import { useState, useEffect } from "react";
import ConfidenceBar from "./ConfidenceBar";
import type { ConfidenceScores } from "@/lib/types";

interface SynthesisPanelProps {
  stream?: ReadableStream;
  reportText?: string;
  confidenceScores: ConfidenceScores;
}

const CITATION_COLORS: Record<string, string> = {
  D: "#2dd4bf",
  V: "#38bdf8",
  A: "#f87171",
};

function renderWithCitations(text: string): React.ReactNode {
  const parts = text.split(/(\[[DVA]\d+\])/);
  return parts.map((part, i) => {
    const match = part.match(/^\[([DVA])(\d+)\]$/);
    if (match) {
      const color = CITATION_COLORS[match[1]];
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: "3px",
            padding: "0 4px",
            color,
            fontSize: "0.68rem",
            fontFamily: "monospace",
            fontWeight: 700,
            lineHeight: 1.5,
            margin: "0 2px",
            verticalAlign: "middle",
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SynthesisPanel({
  stream,
  reportText,
  confidenceScores,
}: SynthesisPanelProps) {
  const [text, setText] = useState<string>(reportText ?? "");

  useEffect(() => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let cancelled = false;

    async function pump() {
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value));
      }
    }
    void pump();
    return () => {
      cancelled = true;
      void reader.cancel();
    };
  }, [stream]);

  const displayText = stream ? text : (reportText ?? "");
  const hasContent = displayText.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}>
      <ConfidenceBar scores={confidenceScores} />

      <div
        style={{
          flex: 1,
          fontFamily: "monospace",
          fontSize: "0.8rem",
          color: "#e8e6df",
          lineHeight: 1.85,
          overflowY: "auto",
          paddingRight: "0.25rem",
        }}
      >
        {hasContent ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{renderWithCitations(displayText)}</div>
        ) : (
          <div
            style={{
              color: "rgba(255,255,255,0.18)",
              fontFamily: "monospace",
              fontSize: "0.72rem",
              paddingTop: "0.5rem",
            }}
          >
            Awaiting synthesis output...
          </div>
        )}
      </div>
    </div>
  );
}
