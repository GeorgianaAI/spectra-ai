import type { CSSProperties } from "react";

// Hex values mirroring the CSS variables defined in globals.css.
// Use these in inline styles so there is one source of truth per token.
export const COLORS = {
  accent: "#0d9488", // --accent
  accentDark: "#0f766e", // --accent-dark
  accentLight: "#14b8a6", // lighter teal, used in NIST tags & AgentGraph document node
  vision: "#0ea5e9", // --modality-vision
  audio: "#f43f5e", // --modality-audio / --status-danger
  textPrimary: "#0f2b2a", // --text-primary
  textSecondary: "#2e5e5a", // --text-secondary
  textMuted: "#6b8f8c", // --text-muted
  textSubtle: "#9ab5b3", // softer muted, not in CSS vars
  success: "#10b981", // --status-success
} as const;

// Shared transition strings
export const TRANSITIONS = {
  hover: "color 0.15s, border-color 0.15s, background 0.15s",
  lift: "transform 0.2s ease, box-shadow 0.2s ease",
} as const;

// Shared border-radius tokens
export const RADIUS = {
  sm: "4px",
  md: "14px",
  lg: "20px",
  full: "50px",
} as const;

// Base glass card style shared across GlassPanel, login card, etc.
// ModalityCard has intentionally slightly different opacity values — keep them inline there.
export const glassCard: CSSProperties = {
  background: "rgba(255, 255, 255, 0.75)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(13, 148, 136, 0.1)",
  borderRadius: RADIUS.lg,
  boxShadow: "0 8px 32px rgba(13, 148, 136, 0.08)",
};
