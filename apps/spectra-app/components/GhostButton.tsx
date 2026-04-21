"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

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
    color: hovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    padding: "4px 12px",
    borderRadius: "50px",
    border: hovered ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
    background: hovered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "color 0.15s, border-color 0.15s, background 0.15s",
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
