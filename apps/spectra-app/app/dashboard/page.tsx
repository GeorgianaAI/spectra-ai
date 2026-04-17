// Phase 3: wire UploadZone, AgentGraph, SynthesisPanel, ConfidenceBar against real API
export default function DashboardPage() {
  return (
    <div style={{ padding: "2rem", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "1rem",
        }}
      >
        <span
          style={{
            color: "var(--accent)",
            fontWeight: 500,
            fontSize: "1.1rem",
            letterSpacing: "0.08em",
          }}
        >
          SPECTRA
        </span>
        <span
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "0.7rem",
            fontFamily: "monospace",
            color: "var(--text-secondary)",
          }}
        >
          MISSION-001
        </span>
        <span
          style={{
            marginLeft: "auto",
            background: "#c8922a22",
            border: "1px solid var(--accent)",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "0.7rem",
            color: "var(--accent)",
          }}
        >
          Idle
        </span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "40% 1fr", gap: "1.5rem" }}>
        {/* Left column: upload + agent graph */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "1.25rem",
            }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "1rem" }}>
              UploadZone — Phase 3
            </p>
            {/* UploadZone component goes here */}
          </section>

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "1.25rem",
            }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "1rem" }}>
              AgentGraph — Phase 3
            </p>
            {/* AgentGraph component goes here */}
          </section>
        </div>

        {/* Right column: synthesis panel */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "1.25rem",
          }}
        >
          <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "1rem" }}>
            SynthesisPanel — Phase 3
          </p>
          {/* SynthesisPanel + ConfidenceBar goes here */}
        </section>
      </div>

      {/* Governance trace bottom strip */}
      <section
        style={{
          marginTop: "1.5rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "1.25rem",
        }}
      >
        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
          GovernanceTrace — Phase 3
        </p>
      </section>
    </div>
  );
}
