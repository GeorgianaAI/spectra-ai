/**
 * ConfidenceBar — three labeled percentage bars, one per modality.
 *
 * Phase 3 implementation:
 *   - Three thin horizontal bars: Document (teal), Vision (sky blue), Audio (coral).
 *   - Labeled with modality name and percentage score.
 *   - Used inside SynthesisPanel above the streaming report.
 *
 * Style: CSS modules or inline styles only — no Tailwind utility classes.
 */

"use client";

import type { ConfidenceScores } from "@/lib/types";

interface ConfidenceBarProps {
  scores: ConfidenceScores;
}

const BARS = [
  { key: "doc" as const, label: "Document", color: "#2dd4bf" },
  { key: "vision" as const, label: "Vision", color: "#38bdf8" },
  { key: "audio" as const, label: "Audio", color: "#f87171" },
];

export default function ConfidenceBar({ scores }: ConfidenceBarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {BARS.map(({ key, label, color }) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.45)",
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
              background: "#1e1e26",
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
