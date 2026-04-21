"use client";

import type { AgentStatuses } from "@/lib/types";

interface AgentGraphProps {
  agentStatuses: AgentStatuses;
}

const NODES = [
  { id: "router", label: "Router", color: "#00f2ff", x: 50, y: 9 },
  { id: "document", label: "Document", color: "#2dd4bf", x: 16, y: 50 },
  { id: "vision", label: "Vision", color: "#38bdf8", x: 50, y: 50 },
  { id: "audio", label: "Audio", color: "#f87171", x: 84, y: 50 },
  { id: "synthesis", label: "Synthesis", color: "#00f2ff", x: 50, y: 88 },
] as const;

const EDGES: [string, string][] = [
  ["router", "document"],
  ["router", "vision"],
  ["router", "audio"],
  ["document", "synthesis"],
  ["vision", "synthesis"],
  ["audio", "synthesis"],
];

const STATUS_DOT: Record<string, string> = {
  idle: "rgba(255,255,255,0.15)",
  processing: "currentColor",
  complete: "currentColor",
};

export default function AgentGraph({ agentStatuses }: AgentGraphProps) {
  const getStatus = (id: string) => agentStatuses[id] ?? "idle";

  return (
    <>
      <style>{`
        @keyframes spectra-node-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,242,255,0.5); }
          50%      { box-shadow: 0 0 0 7px rgba(0,242,255,0); }
        }
      `}</style>

      <div style={{ position: "relative", height: "250px", width: "100%" }}>
        {/* SVG edge layer */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
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
            const active = getStatus(fromId) === "complete" || getStatus(toId) === "processing";
            return (
              <line
                key={`${fromId}-${toId}`}
                x1={from.x}
                y1={from.y + 7}
                x2={to.x}
                y2={to.y - 7}
                stroke={active ? "rgba(0,242,255,0.35)" : "rgba(255,255,255,0.06)"}
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
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                width: "82px",
                background: isActive ? `rgba(${hexToRgb(color)}, 0.06)` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? color + "50" : "rgba(255,255,255,0.07)"}`,
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
                  background: isActive ? color : STATUS_DOT.idle,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
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
                  color: isActive ? color : "rgba(255,255,255,0.18)",
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

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
