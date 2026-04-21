import type { CSSProperties, ReactNode, AriaRole } from "react";

interface GlassPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  role?: AriaRole;
  "aria-label"?: string;
}

export default function GlassPanel({ children, style, role, "aria-label": ariaLabel }: GlassPanelProps) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(25px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "24px",
        padding: "1.5rem",
        boxShadow: "0 40px 100px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
