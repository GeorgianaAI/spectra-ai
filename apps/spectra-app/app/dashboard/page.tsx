"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import GlassPanel from "@/components/GlassPanel";
import SectionLabel from "@/components/SectionLabel";
import AzureButton from "@/components/AzureButton";
import UploadZone from "@/components/UploadZone";
import AgentGraph from "@/components/AgentGraph";
import SynthesisPanel from "@/components/SynthesisPanel";
import GovernanceTrace from "@/components/GovernanceTrace";
import GhostButton from "@/components/GhostButton";
import { FileDown } from "lucide-react";
import { uploadFiles, fetchJobStatus, fetchJobTrace } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type {
  UploadedFiles,
  AgentStatuses,
  ConfidenceScores,
  GovernanceEntry,
  JobStatus,
} from "@/lib/types";

const DEFAULT_STATUSES: AgentStatuses = {
  router: "idle",
  document: "idle",
  vision: "idle",
  audio: "idle",
  synthesis: "idle",
};

const DEFAULT_SCORES: ConfidenceScores = { doc: 0, vision: 0, audio: 0 };

function deriveAgentStatuses(
  status: JobStatus,
  modalities?: { document: boolean; vision: boolean; audio: boolean },
): AgentStatuses {
  switch (status) {
    case "pending":
      return { ...DEFAULT_STATUSES, router: "processing" };
    case "processing":
      return {
        router: "complete",
        document: modalities?.document ? "processing" : "idle",
        vision: modalities?.vision ? "processing" : "idle",
        audio: modalities?.audio ? "processing" : "idle",
        synthesis: "idle",
      };
    case "completed":
      return {
        router: "complete",
        document: modalities?.document ? "complete" : "idle",
        vision: modalities?.vision ? "complete" : "idle",
        audio: modalities?.audio ? "complete" : "idle",
        synthesis: "complete",
      };
    default:
      return DEFAULT_STATUSES;
  }
}

function readToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)__spectra_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFiles>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatuses>(DEFAULT_STATUSES);
  const [confidenceScores, setConfidenceScores] = useState<ConfidenceScores>(DEFAULT_SCORES);
  const [governanceEntries, setGovernanceEntries] = useState<GovernanceEntry[]>([]);
  const [reportText, setReportText] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (id: string, token: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const job = await fetchJobStatus(id, token);
          setJobStatus(job.status);
          setAgentStatuses(deriveAgentStatuses(job.status, job.modalities_used));

          if (job.status === "completed") {
            stopPolling();
            setConfidenceScores(job.confidence_scores);
            if (job.result_url) setReportText(job.result_url);
            const trace = await fetchJobTrace(id, token);
            setGovernanceEntries(trace);
          }

          if (job.status === "failed") {
            stopPolling();
            setError(job.error ?? "Job failed.");
          }
        } catch (err) {
          stopPolling();
          setError(err instanceof Error ? err.message : "Polling error.");
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  const handleRun = useCallback(async () => {
    const hasFiles = Object.keys(files).length > 0;
    if (!hasFiles || isUploading) return;

    const token = readToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setIsUploading(true);
    setError(null);
    setReportText("");
    setGovernanceEntries([]);
    setConfidenceScores(DEFAULT_SCORES);
    setAgentStatuses(DEFAULT_STATUSES);
    setJobStatus(null);

    try {
      const { jobId: id } = await uploadFiles(files, token);
      setJobId(id);
      setJobStatus("pending");
      setAgentStatuses(deriveAgentStatuses("pending", {
        document: !!files.document,
        vision: !!files.vision,
        audio: !!files.audio,
      }));
      startPolling(id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setAgentStatuses(DEFAULT_STATUSES);
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, router, startPolling]);

  const handleDownloadPDF = useCallback(async () => {
    if (!reportText) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxW = pageW - margin * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("SPECTRA AI — Synthesis Report", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const mid = jobId ? `MISSION-${jobId.slice(0, 6).toUpperCase()}` : "MISSION-NEW";
    doc.text(`${mid}  ·  ${new Date().toUTCString()}`, margin, 27);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 30, pageW - margin, 30);

    const clean = reportText.replace(/\[[DVA]\d+\]/g, "");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(clean, maxW);
    doc.text(lines, margin, 38);
    doc.save(`${mid}.pdf`);
  }, [reportText, jobId]);

  const isRunning = jobStatus === "pending" || jobStatus === "processing";
  const hasFiles = Object.keys(files).length > 0;
  const missionId = jobId ? `MISSION-${jobId.slice(0, 6).toUpperCase()}` : "MISSION-NEW";

  const isSecurityRejection =
    jobStatus === "failed" &&
    error != null &&
    /document rejected|prompt injection|content rejected/i.test(error);

  const statusLabel = isUploading
    ? "UPLOADING"
    : jobStatus === "pending"
      ? "ROUTING"
      : jobStatus === "processing"
        ? "PROCESSING"
        : jobStatus === "completed"
          ? "COMPLETE"
          : jobStatus === "failed"
            ? isSecurityRejection
              ? "BLOCKED"
              : "FAILED"
            : "NOMINAL";

  const statusColor =
    jobStatus === "completed"
      ? "#2dd4bf"
      : jobStatus === "failed"
        ? isSecurityRejection
          ? "#f59e0b"
          : "#f87171"
        : isRunning || isUploading
          ? "#00f2ff"
          : "#00f2ff";

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
      {/* Header */}
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
            DASHBOARD
          </span>
        </h1>

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
          {missionId}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {error && (
            <span
              style={{
                fontSize: "0.65rem",
                color: statusColor,
                fontFamily: "monospace",
                maxWidth: "600px",
                wordBreak: "break-word",
                whiteSpace: "normal",
              }}
              title={error}
            >
              {error}
            </span>
          )}
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
            ● STATUS: {statusLabel}
          </span>

          <GhostButton href="/">← Back to Base</GhostButton>
        </div>
      </header>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40% 1fr",
          gap: "1.5rem",
          alignItems: "stretch",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <GlassPanel>
            <SectionLabel>OPERATOR // UPLOAD_ZONE</SectionLabel>
            <UploadZone onUpload={setFiles} disabled={isRunning || isUploading} />
            <div style={{ marginTop: "1.25rem" }}>
              <AzureButton
                type="button"
                disabled={!hasFiles || isRunning || isUploading}
                style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "0.75rem" }}
                onClick={handleRun}
              >
                {isUploading ? "UPLOADING..." : isRunning ? "PROCESSING..." : "RUN ANALYSIS"}
              </AzureButton>
            </div>
          </GlassPanel>

          <GlassPanel style={{ flex: 1 }}>
            <SectionLabel>SYSTEM // AGENT_GRAPH</SectionLabel>
            <AgentGraph agentStatuses={agentStatuses} />
          </GlassPanel>
        </div>

        {/* Right column — synthesis */}
        <GlassPanel style={{ minHeight: "450px" }}>
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
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <FileDown size={12} />
                PDF
              </button>
            )}
          </div>
          <SynthesisPanel reportText={reportText} confidenceScores={confidenceScores} />
        </GlassPanel>
      </div>

      {/* Governance trace */}
      <GlassPanel style={{ marginTop: "1.5rem" }}>
        <GovernanceTrace entries={governanceEntries} />
      </GlassPanel>

      {/* Footer */}
      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontFamily: "monospace",
          padding: "0 0.25rem",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
          Auth: <span style={{ color: "#fff" }}>JWT / RBAC</span>
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
          Infra: <span style={{ color: "#fff" }}>AWS / EU-West-1</span>
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
          Trace: <span style={{ color: "#00f2ff" }}>Active</span>
        </span>
      </div>
    </div>
  );
}
