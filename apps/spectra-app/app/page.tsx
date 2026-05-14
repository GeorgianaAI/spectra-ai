"use client";

import { useSyncExternalStore } from "react";
import { Aperture } from "lucide-react";
import AzureButton from "@/components/AzureButton";
import ModalityCard from "@/components/ModalityCard";
import { MODALITIES } from "@/lib/constants";

const AUTH_RE = /(?:^|;\s*)__spectra_token=([^;]+)/;
const getAuthSnapshot = () => AUTH_RE.test(document.cookie);
const getServerAuthSnapshot = () => false;
const subscribeToAuth = () => () => {};

export default function LandingPage() {
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <section style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div
          style={{
            display: "inline-block",
            padding: "0.2rem 0.65rem 0.2rem 0.85rem",
            borderRadius: "50px",
            background: "rgba(13, 148, 136, 0.08)",
            border: "1px solid rgba(13, 148, 136, 0.2)",
            color: "#0d9488",
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            marginBottom: "1.5rem",
          }}
        >
          Multi-Agent Synthesis Engine v1.0
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2.8rem, 7vw, 4.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              margin: 0,
              background:
                "linear-gradient(135deg, #0f2b2a 0%, #0f766e 40%, #0d9488 70%, #14b8a6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            SPECTRA AI
          </h1>
          <Aperture size={56} color="#0d9488" strokeWidth={1.5} />
        </div>

        <p
          style={{
            color: "#2e5e5a",
            fontSize: "1.2rem",
            maxWidth: "600px",
            margin: "0 auto 2.5rem",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Intelligence across{" "}
          <span style={{ color: "#0f2b2a", fontWeight: 600 }}>PDF, Vision, and Audio</span>.
          <br />
          Unified into a single grounded report.
        </p>

        <AzureButton href={isAuthenticated ? "/dashboard" : "/auth/login"}>
          {isAuthenticated ? "GO TO DASHBOARD" : "INITIALIZE WORKSPACE"}
        </AzureButton>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
          width: "100%",
          maxWidth: "1100px",
          marginTop: "1.5rem",
        }}
      >
        {MODALITIES.map((m) => (
          <ModalityCard key={m.label} {...m} />
        ))}
      </div>

      <footer
        style={{
          position: "fixed",
          bottom: "2rem",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          display: "flex",
          gap: "2rem",
        }}
      >
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Engine: <span style={{ color: "#0f2b2a" }}>v1.0</span>
        </span>
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Nodes: <span style={{ color: "#0f2b2a" }}>06</span>
        </span>
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Models: <span style={{ color: "#0f2b2a" }}>03</span>
        </span>
      </footer>
    </main>
  );
}
