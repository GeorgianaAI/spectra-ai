"use client";

import { Aperture } from "lucide-react";
import AzureButton from "@/components/AzureButton";
import ModalityCard from "@/components/ModalityCard";
import { MODALITIES } from "@/lib/constants";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#060609",
        backgroundImage: `
          radial-gradient(circle at 50% -20%, rgba(0, 242, 255, 0.15) 0%, transparent 40%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#fff",
      }}
    >
      <section style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div
          style={{
            display: "inline-block",
            padding: "0.2rem 0.65rem 0.2rem 0.85rem",
            borderRadius: "50px",
            background: "rgba(0, 242, 255, 0.1)",
            border: "1px solid rgba(0, 242, 255, 0.2)",
            color: "#00f2ff",
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
              fontSize: "clamp(3rem, 8vw, 5rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
              margin: 0,
              background:
                "linear-gradient(to bottom, #fff 40%, rgba(255,255,255,0.4))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SPECTRA AI
          </h1>
          <Aperture size={56} color="#00f2ff" strokeWidth={1.5} />
        </div>

        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "1.2rem",
            maxWidth: "600px",
            margin: "0 auto 2.5rem",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Intelligence across{" "}
          <span style={{ color: "#fff" }}>PDF, Vision, and Audio</span>.
          <br />
          Unified into a single grounded report.
        </p>

        <AzureButton href="/auth/login">INITIALIZE WORKSPACE</AzureButton>
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
          color: "rgba(255,255,255,0.2)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          display: "flex",
          gap: "2rem",
        }}
      >
        <span>
          Status: <span style={{ color: "#10b981" }}>Systems Nominal</span>
        </span>
        <span>
          Agents: <span style={{ color: "#fff" }}>03 Active</span>
        </span>
        <span>
          Latency: <span style={{ color: "#fff" }}>24ms</span>
        </span>
      </footer>
    </main>
  );
}
