import { LucideIcon } from "lucide-react";
import { COLORS, TRANSITIONS, RADIUS } from "@/lib/theme";

interface ModalityCardProps {
  label: string;
  icon: LucideIcon;
  color: string;
  detail: string;
  sub: string;
}

export default function ModalityCard({ label, icon: Icon, color, detail, sub }: ModalityCardProps) {
  return (
    <div
      role="article"
      aria-label={label}
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(13, 148, 136, 0.08)",
        borderRadius: RADIUS.lg,
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 8px 32px rgba(13, 148, 136, 0.07)",
        transition: TRANSITIONS.lift,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: RADIUS.md,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div>
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: COLORS.textPrimary,
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: COLORS.textSecondary,
            lineHeight: 1.6,
            marginBottom: "0.75rem",
          }}
        >
          {detail}
        </p>
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            paddingTop: "0.85rem",
            borderTop: "1px solid rgba(13, 148, 136, 0.08)",
            color: COLORS.accent,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
