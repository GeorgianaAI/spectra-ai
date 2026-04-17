export default function LoginPage() {
  // Phase 3: implement email/password form + Supabase Auth sign-in
  // Demo credentials pre-filled: demo@spectra.app / spectra-demo
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "2rem",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h1
          style={{
            color: "var(--accent)",
            fontSize: "1.5rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            marginBottom: "0.5rem",
          }}
        >
          SPECTRA
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "2rem" }}>
          Sign in to access the dashboard
        </p>

        <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ color: "var(--text-secondary)", fontSize: "0.75rem", display: "block", marginBottom: "0.4rem" }}>
              Email
            </label>
            <input
              type="email"
              defaultValue="demo@spectra.app"
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "0.6rem 0.75rem",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                fontFamily: "monospace",
              }}
            />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)", fontSize: "0.75rem", display: "block", marginBottom: "0.4rem" }}>
              Password
            </label>
            <input
              type="password"
              defaultValue="spectra-demo"
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "0.6rem 0.75rem",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                fontFamily: "monospace",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#09090b",
              border: "none",
              borderRadius: "6px",
              padding: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem",
              marginTop: "0.5rem",
            }}
          >
            Sign In
          </button>
        </form>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "1.5rem", textAlign: "center" }}>
          Demo: demo@spectra.app / spectra-demo
        </p>
      </div>
    </main>
  );
}
