export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        gap: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "600px" }}>
        <h1
          style={{
            color: "var(--accent)",
            fontSize: "2.5rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          SPECTRA
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          Multimodal intelligence agent. Route documents, images, and audio through a
          specialist multi-agent graph — synthesised, cited, and scored in real time.
        </p>

        {/* Demo credentials — displayed prominently for recruiters */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
            textAlign: "left",
          }}
        >
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.75rem",
            }}
          >
            Demo Access
          </p>
          <p style={{ fontFamily: "monospace", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Email: </span>demo@spectra.app
          </p>
          <p style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
            <span style={{ color: "var(--text-secondary)" }}>Password: </span>spectra-demo
          </p>
        </div>

        <a
          href="/auth/login"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "#09090b",
            padding: "0.75rem 2rem",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.95rem",
            letterSpacing: "0.02em",
          }}
        >
          Try the Demo
        </a>
      </div>

      {/* Modality highlights */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center", maxWidth: "700px" }}>
        {[
          { label: "Document", color: "var(--modality-doc)", desc: "PDF parsing, RAG retrieval, citations" },
          { label: "Vision", color: "var(--modality-vision)", desc: "GPT-4o image analysis, annotations" },
          { label: "Audio", color: "var(--modality-audio)", desc: "Whisper transcription, structured extraction" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--surface)",
              border: `1px solid ${m.color}33`,
              borderTop: `2px solid ${m.color}`,
              borderRadius: "8px",
              padding: "1rem 1.25rem",
              minWidth: "180px",
              flex: 1,
            }}
          >
            <p style={{ color: m.color, fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>{m.label}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", lineHeight: 1.5 }}>{m.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
