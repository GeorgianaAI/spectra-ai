"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { FileDown } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import SectionLabel from "@/components/SectionLabel";
import SynthesisPanel from "@/components/SynthesisPanel";
import GovernanceTrace from "@/components/GovernanceTrace";
import GhostButton from "@/components/GhostButton";
import { fetchJobStatus, readAuthToken } from "@/lib/api";
import type { Job, ConfidenceScores, GovernanceEntry } from "@/lib/types";

export default function JobDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = readAuthToken();
      if (!token) {
        router.replace("/auth/login");
        return;
      }
      try {
        const data = await fetchJobStatus(id, token);
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, router]);

  const reportText = job?.result_url ?? "";
  const confidenceScores = useMemo<ConfidenceScores>(
    () => job?.confidence_scores ?? { doc: 0, vision: 0, audio: 0 },
    [job],
  );
  const governanceEntries = useMemo<GovernanceEntry[]>(
    () => job?.governance_trace ?? [],
    [job],
  );
  const missionId = id ? `MISSION-${id.slice(0, 6).toUpperCase()}` : "MISSION";

  const handleDownloadPDF = useCallback(async () => {
    if (!reportText) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = 20;
    const checkPage = (needed: number) => {
      if (y + needed > pageH - 15) { doc.addPage(); y = 20; }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("SPECTRA AI — Synthesis Report", margin, y); y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${missionId}  ·  ${new Date().toUTCString()}`, margin, y); y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y); y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text("CONFIDENCE SCORES", margin, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Document: ${confidenceScores.doc}%   Vision: ${confidenceScores.vision}%   Audio: ${confidenceScores.audio}%`,
      margin, y,
    ); y += 7;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y); y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text("SYNTHESIS REPORT", margin, y); y += 5;
    const clean = reportText.replace(/\[[DVA]\d+\]/g, "");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    for (const line of doc.splitTextToSize(clean, maxW)) {
      checkPage(5);
      doc.text(line, margin, y); y += 5;
    }

    if (governanceEntries.length > 0) {
      y += 4;
      checkPage(12);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y); y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text("NIST AI RMF — GOVERNANCE TRACE", margin, y); y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text("Time", margin, y);
      doc.text("Agent", margin + 22, y);
      doc.text("Finding", margin + 40, y);
      doc.text("%", margin + 130, y);
      doc.text("NIST Control", margin + 140, y);
      y += 4;
      doc.line(margin, y, pageW - margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      for (const entry of governanceEntries) {
        checkPage(8);
        const finding = doc.splitTextToSize(entry.finding, 85);
        doc.setTextColor(100, 100, 100);
        doc.text(new Date(entry.timestamp).toLocaleTimeString(), margin, y);
        doc.setTextColor(40, 40, 40);
        doc.text(entry.agent.toUpperCase(), margin + 22, y);
        doc.text(finding[0] ?? "", margin + 40, y);
        doc.text(`${entry.confidence}%`, margin + 130, y);
        doc.text(entry.nistControlId ?? entry.nistTag, margin + 140, y);
        if (finding.length > 1) { y += 4; doc.text(finding[1], margin + 40, y); }
        y += 5;
      }
    }
    doc.save(`${missionId}.pdf`);
  }, [reportText, missionId, confidenceScores, governanceEntries]);

  const statusColor =
    job?.status === "completed" ? "#2dd4bf" : job?.status === "failed" ? "#f87171" : "#00f2ff";

  return (
    <div
      style={{
        padding: "2rem",
        minHeight: "100vh",
        backgroundColor: "#060609",
        backgroundImage: `
          radial-gradient(circle at 50% -20%, rgba(0, 242, 255, 0.12) 0%, transparent 40%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        color: "#fff",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          marginBottom: "2rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1.25rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#00f2ff",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          SPECTRA AI{" "}
          <span
            style={{
              fontWeight: 500,
              letterSpacing: "0.05em",
              background: "linear-gradient(to bottom, #fff 40%, rgba(255,255,255,0.4))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {missionId}
          </span>
        </h1>

        {job && (
          <span
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              padding: "3px 10px",
              fontSize: "0.7rem",
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em",
            }}
          >
            {new Date(job.created_at).toLocaleString()}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {job?.status && (
            <span
              style={{
                fontSize: "0.65rem",
                color: statusColor,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                padding: "4px 12px",
                borderRadius: "50px",
                border: `1px solid ${statusColor}40`,
                background: `${statusColor}08`,
              }}
            >
              ● {job.status.toUpperCase()}
            </span>
          )}
          <GhostButton href="/dashboard/history">← Back to History</GhostButton>
          <GhostButton href="/">← Back to Base</GhostButton>
        </div>
      </header>

      {loading && (
        <GlassPanel>
          <p style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: "0.75rem" }}>
            Loading...
          </p>
        </GlassPanel>
      )}

      {error && (
        <GlassPanel>
          <p style={{ color: "#f87171", fontFamily: "monospace", fontSize: "0.75rem" }}>{error}</p>
        </GlassPanel>
      )}

      {job && (
        <>
          <GlassPanel style={{ minHeight: "450px", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "1.25rem" }}>
              <SectionLabel style={{ marginBottom: 0 }}>ANALYSIS // SYNTHESIS_PANEL</SectionLabel>
              {reportText && (
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  title="Download synthesis as PDF"
                  aria-label="Download synthesis as PDF"
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "1px solid rgba(0,242,255,0.25)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    color: "rgba(0,242,255,0.7)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.6rem",
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <FileDown size={12} />
                  PDF
                </button>
              )}
            </div>
            <SynthesisPanel reportText={reportText} confidenceScores={confidenceScores} />
          </GlassPanel>

          <GlassPanel>
            <GovernanceTrace entries={governanceEntries} />
          </GlassPanel>
        </>
      )}
    </div>
  );
}
