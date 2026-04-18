import { LucideIcon } from "lucide-react";

interface ModalityCardProps {
  label: string;
  icon: LucideIcon;
  color: string;
  detail: string;
  sub: string;
}

export default function ModalityCard({
  label,
  icon: Icon,
  color,
  detail,
  sub,
}: ModalityCardProps) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "24px",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
      }}
    >
      {/* Subtle grid layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Icon */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
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
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "rgba(255, 255, 255, 0.5)",
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
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            background:
              "linear-gradient(to bottom, #fff 40%, rgba(255, 255, 255, 0.4))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
