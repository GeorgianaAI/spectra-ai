"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AzureButton from "@/components/AzureButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@spectra.app");
  const [password, setPassword] = useState("spectra-demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      document.cookie = `__spectra_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
      router.push("/dashboard");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#060609",
        backgroundImage: `
          radial-gradient(circle at 50% -20%, rgba(0, 242, 255, 0.12) 0%, transparent 40%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#fff",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(25px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "24px",
          padding: "3rem",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
          position: "relative",
        }}
      >
        {/* Module Header */}
        <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              letterSpacing: "0.2em",
              marginBottom: "0.5rem",
              color: "#00f2ff",
              textTransform: "uppercase",
            }}
          >
            SPECTRA AI{" "}
            <span style={{ fontWeight: 300, opacity: 0.5 }}>AUTH</span>
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Initialize Secure Session
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div>
            <label
              style={{
                color: "#00f2ff",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                display: "block",
                marginBottom: "0.75rem",
                opacity: 0.8,
              }}
            >
              Operator Identity
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "1rem",
                color: "#fff",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                color: "#00f2ff",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                display: "block",
                marginBottom: "0.75rem",
                opacity: 0.8,
              }}
            >
              Access Key
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "1rem",
                color: "#fff",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "1rem",
                background: "rgba(248, 113, 113, 0.05)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                borderRadius: "12px",
              }}
            >
              <p
                style={{
                  color: "#f87171",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  textAlign: "center",
                }}
              >
                &gt; SYSTEM_ERR: {error}
              </p>
            </div>
          )}

          <AzureButton type="submit" disabled={loading} style={{ width: "100%", marginTop: "1rem", padding: "1rem" }}>
            {loading ? "Decrypting..." : "Initialize Session"}
          </AzureButton>
        </form>

        <div
          style={{
            marginTop: "2.5rem",
            textAlign: "center",
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.05em",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            paddingTop: "1.5rem",
          }}
        >
          DEFAULT CREDENTIALS:{" "}
          <span style={{ color: "#fff", fontFamily: "monospace" }}>
            spectra-demo
          </span>
        </div>
      </div>

      {/* Persistence Footer */}
      <footer
        style={{
          position: "fixed",
          bottom: "2rem",
          fontSize: "0.7rem",
          color: "rgba(255,255,255,0.2)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          display: "flex",
          gap: "2rem",
        }}
      >
        <span>
          Auth: <span style={{ color: "#fff" }}>Enforced</span>
        </span>
        <span>
          Node: <span style={{ color: "#fff" }}>SPECTRA_PRIME</span>
        </span>
        <span>
          Status: <span style={{ color: "#10b981" }}>Nominal</span>
        </span>
      </footer>
    </main>
  );
}
