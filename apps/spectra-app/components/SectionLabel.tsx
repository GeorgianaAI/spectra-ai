import type { CSSProperties, ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  style?: CSSProperties;
  id?: string;
}

export default function SectionLabel({ children, style, id }: SectionLabelProps) {
  return (
    <p
      id={id}
      role="heading"
      aria-level={3}
      style={{
        color: "#0d9488",
        opacity: 0.85,
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        fontFamily: "monospace",
        marginBottom: "1.25rem",
        ...style,
      }}
    >
      {children}
    </p>
  );
}
