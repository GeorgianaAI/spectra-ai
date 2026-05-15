"use client";

import type { ConfidenceScores } from "@/lib/types";
import { COLORS } from "@/lib/theme";

interface ConfidenceBarProps {
  scores: ConfidenceScores;
}

const BARS = [
  { key: "doc" as const, label: "Document", color: COLORS.accent },
  { key: "vision" as const, label: "Vision", color: COLORS.vision },
  { key: "audio" as const, label: "Audio", color: COLORS.audio },
];

export default function ConfidenceBar({ scores }: ConfidenceBarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {BARS.map(({ key, label, color }) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              color: COLORS.textMuted,
              fontSize: "0.75rem",
              width: "64px",
              flexShrink: 0,
            }}
          >
            {label}
          </span>
          <div
            role="progressbar"
            aria-valuenow={scores[key]}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} confidence: ${scores[key]}%`}
            style={{
              flex: 1,
              height: "3px",
              background: "rgba(13, 148, 136, 0.1)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${scores[key]}%`,
                height: "100%",
                background: color,
                borderRadius: "2px",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span
            style={{
              color,
              fontSize: "0.7rem",
              fontFamily: "monospace",
              width: "36px",
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {scores[key]}%
          </span>
        </div>
      ))}
    </div>
  );
}
