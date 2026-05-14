import type { CSSProperties, ReactNode, AriaRole } from "react";

interface GlassPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  role?: AriaRole;
  "aria-label"?: string;
}

export default function GlassPanel({
  children,
  style,
  role,
  "aria-label": ariaLabel,
}: GlassPanelProps) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      style={{
        background: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(13, 148, 136, 0.1)",
        borderRadius: "20px",
        padding: "1.5rem",
        boxShadow: "0 8px 32px rgba(13, 148, 136, 0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
