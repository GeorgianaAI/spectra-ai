"use client";

import type { AgentStatuses } from "@/lib/types";
import { COLORS } from "@/lib/theme";

interface AgentGraphProps {
  agentStatuses: AgentStatuses;
}

const NODES = [
  { id: "router", label: "Router", color: COLORS.accent, x: 50, y: 9 },
  { id: "document", label: "Document", color: COLORS.accentLight, x: 16, y: 50 },
  { id: "vision", label: "Vision", color: COLORS.vision, x: 50, y: 50 },
  { id: "audio", label: "Audio", color: COLORS.audio, x: 84, y: 50 },
  { id: "synthesis", label: "Synthesis", color: COLORS.accent, x: 50, y: 88 },
] as const;

const EDGES: [string, string][] = [
  ["router", "document"],
  ["router", "vision"],
  ["router", "audio"],
  ["document", "synthesis"],
  ["vision", "synthesis"],
  ["audio", "synthesis"],
];

const STATUS_DOT_IDLE = "rgba(15, 43, 42, 0.15)";

export default function AgentGraph({ agentStatuses }: AgentGraphProps) {
  const getStatus = (id: string) => agentStatuses[id] ?? "idle";

  return (
    <>
      <style>{`
        @keyframes spectra-node-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.4); }
          50%      { box-shadow: 0 0 0 7px rgba(13,148,136,0); }
        }
      `}</style>

      <div
        role="img"
        aria-label="Agent pipeline graph showing node statuses"
        style={{ position: "relative", height: "250px", width: "100%" }}
      >
        {/* SVG edge layer */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {EDGES.map(([fromId, toId]) => {
            const from = NODES.find((n) => n.id === fromId)!;
            const to = NODES.find((n) => n.id === toId)!;
            const toStatus = getStatus(toId);
            const active =
              toStatus !== "idle" &&
              (getStatus(fromId) === "complete" || toStatus === "processing");
            return (
              <line
                key={`${fromId}-${toId}`}
                x1={from.x}
                y1={from.y + 7}
                x2={to.x}
                y2={to.y - 7}
                stroke={active ? "rgba(13,148,136,0.4)" : "rgba(15,43,42,0.08)"}
                strokeWidth="0.6"
                strokeDasharray={active ? undefined : "2 3"}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map(({ id, label, color, x, y }) => {
          const status = getStatus(id);
          const isProcessing = status === "processing";
          const isActive = status !== "idle";

          return (
            <div
              key={id}
              aria-label={`${label} agent: ${status}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                width: "82px",
                background: isActive ? `${color}10` : "rgba(255,255,255,0.6)",
                border: `1px solid ${isActive ? color + "50" : "rgba(15,43,42,0.08)"}`,
                borderRadius: "10px",
                padding: "0.45rem 0.6rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
                animation: isProcessing
                  ? "spectra-node-pulse 1.6s ease-in-out infinite"
                  : undefined,
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isActive ? color : STATUS_DOT_IDLE,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: isActive ? COLORS.textPrimary : COLORS.textSubtle,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: "0.5rem",
                  color: isActive ? color : "rgba(15,43,42,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
