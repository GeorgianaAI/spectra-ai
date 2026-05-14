"use client";

import { useState } from "react";
import type { GovernanceEntry } from "@/lib/types";

const AGENT_COLORS: Record<string, string> = {
  document: "#0d9488",
  vision: "#0ea5e9",
  audio: "#f43f5e",
  synthesis: "#0d9488",
};

const NIST_COLORS: Record<string, string> = {
  GOVERN: "#0d9488",
  MAP: "#0ea5e9",
  MEASURE: "#14b8a6",
  MANAGE: "#f43f5e",
};

interface GovernanceTraceProps {
  entries: GovernanceEntry[];
}

export default function GovernanceTrace({ entries }: GovernanceTraceProps) {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div style={{ overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="governance-trace-table"
        style={{
          width: "100%",
          padding: "0",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          color: "#6b8f8c",
          fontSize: "0.65rem",
          fontWeight: 700,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          textAlign: "left",
        }}
      >
        <span aria-hidden="true" style={{ color: "#0d9488", opacity: 0.8 }}>
          {expanded ? "▼" : "▶"}
        </span>
        <span style={{ color: "#0d9488", opacity: 0.85 }}>Governance</span>
        <span style={{ color: "#0d9488", opacity: 0.85 }}>{"// Trace"}</span>
        <span
          aria-label={`${entries.length} governance entries`}
          style={{
            marginLeft: "auto",
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.2)",
            borderRadius: "4px",
            padding: "1px 8px",
            color: "#0d9488",
            opacity: 0.8,
            fontSize: "0.6rem",
          }}
        >
          {entries.length} entries
        </span>
      </button>

      <div
        id="governance-trace-table"
        role="region"
        aria-label="Governance trace entries"
        hidden={!expanded}
        style={{ marginTop: expanded ? "1rem" : undefined, maxHeight: "280px", overflowY: "auto" }}
      >
        {entries.length === 0 ? (
          <p
            style={{
              color: "#9ab5b3",
              fontSize: "0.7rem",
              fontFamily: "monospace",
            }}
          >
            No entries yet.
          </p>
        ) : (
          <div
            role="table"
            aria-label="Governance trace"
            style={{
              display: "grid",
              gridTemplateColumns: "90px 72px 1fr 44px 1fr",
              gap: "0",
            }}
          >
            {/* Header row */}
            <div role="row" style={{ display: "contents" }}>
              {(["Time", "Agent", "Finding", "%", "NIST Control"] as const).map((h) => (
                <div
                  key={h}
                  role="columnheader"
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.55rem",
                    color: "#9ab5b3",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    borderBottom: "1px solid rgba(13,148,136,0.08)",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {entries.map((entry, i) => {
              const agentColor = AGENT_COLORS[entry.agent] ?? "#0d9488";
              const nistColor = NIST_COLORS[entry.nistTag] ?? "#0d9488";
              const controlLabel = entry.nistControlId ?? entry.nistTag;
              return (
                <div key={i} role="row" style={{ display: "contents" }}>
                  <div
                    role="cell"
                    style={{
                      padding: "0.45rem 0.5rem",
                      borderLeft: `2px solid ${agentColor}35`,
                      borderBottom: "1px solid rgba(13,148,136,0.06)",
                      fontSize: "0.65rem",
                      color: "#9ab5b3",
                      fontFamily: "monospace",
                    }}
                  >
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.45rem 0.5rem",
                      borderBottom: "1px solid rgba(13,148,136,0.06)",
                      fontSize: "0.65rem",
                      color: agentColor,
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {entry.agent}
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.45rem 0.5rem",
                      borderBottom: "1px solid rgba(13,148,136,0.06)",
                      fontSize: "0.65rem",
                      color: "#0f2b2a",
                      fontFamily: "monospace",
                      lineHeight: 1.4,
                    }}
                  >
                    {entry.finding}
                  </div>
                  <div
                    role="cell"
                    aria-label={`${entry.confidence}% confidence`}
                    style={{
                      padding: "0.45rem 0.5rem",
                      borderBottom: "1px solid rgba(13,148,136,0.06)",
                      fontSize: "0.65rem",
                      color: "#6b8f8c",
                      fontFamily: "monospace",
                      textAlign: "right",
                    }}
                  >
                    {entry.confidence}%
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.45rem 0.5rem",
                      borderBottom: "1px solid rgba(13,148,136,0.06)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span
                      title={
                        entry.nistControlId ? `NIST AI RMF: ${entry.nistControlId}` : entry.nistTag
                      }
                      style={{
                        background: `${nistColor}10`,
                        border: `1px solid ${nistColor}35`,
                        borderRadius: "3px",
                        padding: "1px 5px",
                        color: nistColor,
                        fontSize: "0.55rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        cursor: "default",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {controlLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
