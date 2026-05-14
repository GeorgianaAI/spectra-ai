"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aperture } from "lucide-react";
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top atmospheric glow */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background:
            "radial-gradient(ellipse at center, rgba(13,148,136,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(13, 148, 136, 0.12)",
          borderRadius: "24px",
          padding: "2.5rem",
          boxShadow: "0 8px 40px rgba(13, 148, 136, 0.1)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(13, 148, 136, 0.1)",
              border: "1px solid rgba(13, 148, 136, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Aperture size={18} color="#0d9488" strokeWidth={1.5} />
          </div>
          <div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#0f2b2a",
              }}
            >
              Spectra AI
            </div>
            <div style={{ fontSize: "0.65rem", color: "#9ab5b3", letterSpacing: "0.12em" }}>
              MULTIMODAL INTELLIGENCE
            </div>
          </div>
        </div>

        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#0f2b2a",
            marginBottom: "0.4rem",
          }}
        >
          Sign in
        </h2>
        <p style={{ fontSize: "0.82rem", color: "#9ab5b3", marginBottom: "1.8rem" }}>
          Demo credentials pre-filled below.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#2e5e5a",
                marginBottom: "0.5rem",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid rgba(13, 148, 136, 0.15)",
                borderRadius: "8px",
                padding: "0.7rem 0.9rem",
                color: "#0f2b2a",
                fontSize: "0.9rem",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.15s",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#2e5e5a",
                marginBottom: "0.5rem",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid rgba(13, 148, 136, 0.15)",
                borderRadius: "8px",
                padding: "0.7rem 0.9rem",
                color: "#0f2b2a",
                fontSize: "0.9rem",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.15s",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "rgba(244, 63, 94, 0.06)",
                border: "1px solid rgba(244, 63, 94, 0.2)",
                borderRadius: "8px",
              }}
            >
              <p style={{ color: "#f43f5e", fontSize: "0.8rem", margin: 0 }}>{error}</p>
            </div>
          )}

          <AzureButton
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.75rem",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </AzureButton>
        </form>

        <p
          style={{
            marginTop: "2rem",
            fontSize: "0.65rem",
            color: "#9ab5b3",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Rate limit: 3 analysis runs / day / IP
        </p>
      </div>
    </main>
  );
}
