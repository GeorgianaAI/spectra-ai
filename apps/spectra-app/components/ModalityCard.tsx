import { LucideIcon } from "lucide-react";

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
        borderRadius: "20px",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 8px 32px rgba(13, 148, 136, 0.07)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "14px",
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
            color: "#0f2b2a",
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#2e5e5a",
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
            color: "#0d9488",
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
