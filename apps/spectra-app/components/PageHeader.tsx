import type { ReactNode } from "react";

interface PageHeaderProps {
  subtitle: string;
  chip?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({ subtitle, chip, children }: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
        marginBottom: "2rem",
        borderBottom: "1px solid rgba(13, 148, 136, 0.1)",
        paddingBottom: "1.25rem",
      }}
    >
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          letterSpacing: "0.2em",
          color: "#0d9488",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        SPECTRA AI{" "}
        <span
          style={{
            fontWeight: 500,
            letterSpacing: "0.05em",
            color: "#0f2b2a",
          }}
        >
          {subtitle}
        </span>
      </h1>

      {chip}

      {children && (
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {children}
        </div>
      )}
    </header>
  );
}
