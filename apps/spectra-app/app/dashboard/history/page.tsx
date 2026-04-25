"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Aperture, AudioWaveform } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import SectionLabel from "@/components/SectionLabel";
import GhostButton from "@/components/GhostButton";
import PageHeader from "@/components/PageHeader";
import { fetchJobs, readAuthToken } from "@/lib/api";
import type { JobSummary, JobStatus } from "@/lib/types";

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "#00f2ff",
  processing: "#00f2ff",
  completed: "#2dd4bf",
  failed: "#f87171",
};

const SECURITY_RE = /document rejected|prompt injection|content rejected/i;

function isSecurityRejection(job: JobSummary): boolean {
  return job.status === "failed" && job.error != null && SECURITY_RE.test(job.error);
}

function statusLabel(job: JobSummary): string {
  return isSecurityRejection(job) ? "BLOCKED" : job.status;
}

function statusColor(job: JobSummary): string {
  return isSecurityRejection(job) ? "#f59e0b" : (STATUS_COLORS[job.status] ?? "#fff");
}

function ModalityIcons({ modalities }: { modalities: JobSummary["modalities_used"] }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {modalities.document && <FileText size={13} color="#2dd4bf" />}
      {modalities.vision && <Aperture size={13} color="#38bdf8" />}
      {modalities.audio && <AudioWaveform size={13} color="#f87171" />}
    </div>
  );
}

function avgConfidence(scores: JobSummary["confidence_scores"]): number {
  const vals = [scores.doc, scores.vision, scores.audio].filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
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
        const data = await fetchJobs(token);
        setJobs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

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
      <PageHeader subtitle="JOB HISTORY">
        <GhostButton href="/dashboard">← Back to Dashboard</GhostButton>
        <GhostButton href="/">← Back to Base</GhostButton>
      </PageHeader>

      <GlassPanel>
        <SectionLabel>OPERATOR // JOB_HISTORY</SectionLabel>

        {loading && (
          <p
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: "0.75rem" }}
          >
            Loading...
          </p>
        )}

        {error && (
          <p style={{ color: "#f87171", fontFamily: "monospace", fontSize: "0.75rem" }}>{error}</p>
        )}

        {!loading && !error && jobs.length === 0 && (
          <p
            style={{ color: "rgba(255,255,255,0.2)", fontFamily: "monospace", fontSize: "0.75rem" }}
          >
            No jobs yet. Run your first analysis from the dashboard.
          </p>
        )}

        {!loading && jobs.length > 0 && (
          <div
            role="table"
            aria-label="Job history"
            style={{
              display: "grid",
              gridTemplateColumns: "140px 160px 90px 80px 60px 80px",
              gap: 0,
            }}
          >
            <div role="row" style={{ display: "contents" }}>
              {(["Mission", "Date", "Modalities", "Status", "Avg %", ""] as const).map((h) => (
                <div
                  key={h}
                  role="columnheader"
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.55rem",
                    color: "rgba(255,255,255,0.4)",
                    fontWeight: 500,
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {jobs.map((job) => {
              const mid = `MISSION-${job.id.slice(0, 6).toUpperCase()}`;
              const color = statusColor(job);
              const label = statusLabel(job);
              const date = new Date(job.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const avg = avgConfidence(job.confidence_scores);

              return (
                <div key={job.id} role="row" style={{ display: "contents" }}>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontFamily: "monospace",
                      fontSize: "0.65rem",
                      fontWeight: 500,
                      color: "#00f2ff",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {mid}
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontFamily: "monospace",
                      fontSize: "0.65rem",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    {date}
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <ModalityIcons modalities={job.modalities_used} />
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.55rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: color,
                        padding: "2px 7px",
                        borderRadius: "50px",
                        border: `1px solid ${color}40`,
                        background: `${color}08`,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontFamily: "monospace",
                      fontSize: "0.65rem",
                      color: avg > 0 ? "#2dd4bf" : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {avg > 0 ? `${avg}%` : "—"}
                  </div>
                  <div
                    role="cell"
                    style={{
                      padding: "0.55rem 0.5rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {job.status === "completed" && (
                      <GhostButton href={`/dashboard/job/${job.id}`}>View →</GhostButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
