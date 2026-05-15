import type { CSSProperties } from "react";
import { COLORS, TRANSITIONS, RADIUS } from "@/lib/theme";

interface AzureButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  display: "inline-block",
  background: `linear-gradient(135deg, ${COLORS.accentDark}, ${COLORS.accent})`,
  color: "#ffffff",
  border: "none",
  borderRadius: RADIUS.full,
  padding: "1rem 3rem",
  fontWeight: 800,
  fontSize: "0.8rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 4px 20px rgba(13, 148, 136, 0.3)",
  transition: TRANSITIONS.lift,
  fontFamily: "inherit",
};

const disabledStyle: CSSProperties = {
  background: "rgba(13, 148, 136, 0.08)",
  color: "rgba(13, 148, 136, 0.35)",
  boxShadow: "none",
  cursor: "not-allowed",
};

export default function AzureButton({
  children,
  onClick,
  href,
  type = "button",
  disabled,
  style,
}: AzureButtonProps) {
  const merged: CSSProperties = { ...baseStyle, ...(disabled ? disabledStyle : {}), ...style };

  if (href) {
    return (
      <a href={href} aria-disabled={disabled} style={merged}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={merged}>
      {children}
    </button>
  );
}
