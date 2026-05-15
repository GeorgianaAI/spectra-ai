"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { COLORS, TRANSITIONS, RADIUS } from "@/lib/theme";

interface GhostButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export default function GhostButton({
  children,
  href,
  onClick,
  disabled = false,
  style,
}: GhostButtonProps) {
  const [hovered, setHovered] = useState<boolean>(false);

  const base: CSSProperties = {
    fontSize: "0.65rem",
    color: hovered ? COLORS.accent : COLORS.textMuted,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    padding: "4px 12px",
    borderRadius: RADIUS.full,
    border: hovered ? "1px solid rgba(13,148,136,0.3)" : "1px solid rgba(13,148,136,0.12)",
    background: hovered ? "rgba(13,148,136,0.06)" : "rgba(13,148,136,0.02)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: TRANSITIONS.hover,
    display: "inline-block",
    ...style,
  };

  const handlers = {
    onMouseEnter: () => !disabled && setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (href) {
    return (
      <a href={href} aria-disabled={disabled} style={base} {...handlers}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={base} {...handlers}>
      {children}
    </button>
  );
}
