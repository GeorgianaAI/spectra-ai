"use client";

import { useState, useEffect, useCallback } from "react";
import ConfidenceBar from "./ConfidenceBar";
import type { ConfidenceScores, Citation } from "@/lib/types";
import { COLORS } from "@/lib/theme";

interface SynthesisPanelProps {
  stream?: ReadableStream;
  reportText?: string;
  confidenceScores: ConfidenceScores;
  citations?: Citation[];
}

const CITATION_COLORS: Record<string, string> = {
  D: COLORS.accent,
  V: COLORS.vision,
  A: COLORS.audio,
};

const CITATION_MODALITY: Record<string, string> = {
  D: "Document",
  V: "Vision",
  A: "Audio",
};

interface CitationTooltipProps {
  letter: string;
  index: string;
  citations: Citation[];
  onClose: () => void;
}

function CitationTooltip({ letter, index, citations, onClose }: CitationTooltipProps) {
  const id = `${letter}${index}`;
  const match = citations.find((c) => c.id === id);
  const modality = CITATION_MODALITY[letter] ?? letter;
  const color = CITATION_COLORS[letter] ?? COLORS.accent;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  return (
    <span
      role="tooltip"
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#f8fffe",
        border: `1px solid ${color}40`,
        borderRadius: "6px",
        padding: "0.5rem 0.75rem",
        fontSize: "0.65rem",
        fontFamily: "monospace",
        color: COLORS.textPrimary,
        zIndex: 10,
        boxShadow: "0 4px 20px rgba(13,148,136,0.12)",
        lineHeight: 1.5,
        minWidth: "160px",
        maxWidth: "280px",
        whiteSpace: "normal",
      }}
    >
      <span style={{ color, fontWeight: 700 }}>[{id}]</span>{" "}
      <span style={{ color: COLORS.textMuted }}>{modality}</span>
      {match && (
        <span
          style={{
            display: "block",
            marginTop: "0.3rem",
            color: COLORS.textSecondary,
            fontSize: "0.6rem",
          }}
        >
          {match.source}
        </span>
      )}
    </span>
  );
}

function CitationBadge({
  letter,
  index,
  full,
  citations,
}: {
  letter: string;
  index: string;
  full: string;
  citations: Citation[];
}) {
  const [open, setOpen] = useState<boolean>(false);
  const color = CITATION_COLORS[letter] ?? COLORS.accent;

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label={`Citation ${full} — ${CITATION_MODALITY[letter] ?? letter} source`}
        aria-expanded={open}
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
          cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        {full}
      </button>
      {open && (
        <CitationTooltip
          letter={letter}
          index={index}
          citations={citations}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function renderWithCitations(text: string, citations: Citation[]): React.ReactNode {
  const parts = text.split(/(\[[DVA]\d+\])/);
  return parts.map((part, i) => {
    const match = part.match(/^\[([DVA])(\d+)\]$/);
    if (match) {
      return (
        <CitationBadge
          key={i}
          letter={match[1]}
          index={match[2]}
          full={part}
          citations={citations}
        />
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SynthesisPanel({
  stream,
  reportText,
  confidenceScores,
  citations = [],
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
    <div
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}
      aria-label="Synthesis report"
    >
      <ConfidenceBar scores={confidenceScores} />

      <div
        role="article"
        aria-label="Report content"
        aria-live="polite"
        aria-atomic="false"
        style={{
          flex: 1,
          fontFamily: "monospace",
          fontSize: "0.8rem",
          color: COLORS.textPrimary,
          lineHeight: 1.85,
          overflowY: "auto",
          paddingRight: "0.25rem",
        }}
      >
        {hasContent ? (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {renderWithCitations(displayText, citations)}
          </div>
        ) : (
          <div
            style={{
              color: COLORS.textSubtle,
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
