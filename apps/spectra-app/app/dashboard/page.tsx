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
import DownloadPDFButton from "@/components/DownloadPDFButton";
import PageHeader from "@/components/PageHeader";
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
      setAgentStatuses(
        deriveAgentStatuses("pending", {
          document: !!files.document,
          vision: !!files.vision,
          audio: !!files.audio,
        }),
      );
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
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxW = pageW - margin * 2;
    const mid = jobId ? `MISSION-${jobId.slice(0, 6).toUpperCase()}` : "MISSION-NEW";

    let y = 20;
    const checkPage = (needed: number) => {
      if (y + needed > pageH - 15) {
        doc.addPage();
        y = 20;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("SPECTRA AI — Synthesis Report", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${mid}  ·  ${new Date().toUTCString()}`, margin, y);
    y += 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text("CONFIDENCE SCORES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Document: ${confidenceScores.doc}%   Vision: ${confidenceScores.vision}%   Audio: ${confidenceScores.audio}%`,
      margin,
      y,
    );
    y += 7;

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text("SYNTHESIS REPORT", margin, y);
    y += 5;

    const clean = reportText.replace(/\[[DVA]\d+\]/g, "");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const reportLines = doc.splitTextToSize(clean, maxW);
    for (const line of reportLines) {
      checkPage(5);
      doc.text(line, margin, y);
      y += 5;
    }

    if (governanceEntries.length > 0) {
      y += 4;
      checkPage(12);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text("NIST AI RMF — GOVERNANCE TRACE", margin, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text("Time", margin, y);
      doc.text("Agent", margin + 22, y);
      doc.text("Finding", margin + 40, y);
      doc.text("%", margin + 130, y);
      doc.text("NIST Control", margin + 140, y);
      y += 4;
      doc.setDrawColor(210, 210, 210);
      doc.line(margin, y, pageW - margin, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      for (const entry of governanceEntries) {
        checkPage(8);
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const finding = doc.splitTextToSize(entry.finding, 85);
        const control = entry.nistControlId ?? entry.nistTag;
        doc.setTextColor(100, 100, 100);
        doc.text(time, margin, y);
        doc.setTextColor(40, 40, 40);
        doc.text(entry.agent.toUpperCase(), margin + 22, y);
        doc.text(finding[0] ?? "", margin + 40, y);
        doc.text(`${entry.confidence}%`, margin + 130, y);
        doc.text(control, margin + 140, y);
        if (finding.length > 1) {
          y += 4;
          doc.text(finding[1], margin + 40, y);
        }
        y += 5;
      }
    }

    doc.save(`${mid}.pdf`);
  }, [reportText, jobId, confidenceScores, governanceEntries]);

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
            : error
              ? "ERROR"
              : "NOMINAL";

  const statusColor =
    jobStatus === "completed"
      ? "#10b981"
      : jobStatus === "failed"
        ? isSecurityRejection
          ? "#f59e0b"
          : "#f43f5e"
        : isRunning || isUploading
          ? "#0d9488"
          : error
            ? "#f43f5e"
            : "#0d9488";

  return (
    <div style={{ padding: "2rem", minHeight: "100vh" }}>
      {/* Header */}
      <PageHeader
        subtitle="DASHBOARD"
        chip={
          <span
            style={{
              background: "rgba(13,148,136,0.05)",
              border: "1px solid rgba(13,148,136,0.12)",
              borderRadius: "4px",
              padding: "3px 10px",
              fontSize: "0.7rem",
              fontFamily: "monospace",
              color: "#6b8f8c",
              letterSpacing: "0.1em",
            }}
          >
            {missionId}
          </span>
        }
      >
        {error && (
          <span
            style={{
              fontSize: "0.65rem",
              color: isSecurityRejection ? "#f59e0b" : "#f43f5e",
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
            background: `${statusColor}0a`,
          }}
        >
          ● STATUS: {statusLabel}
        </span>
        <GhostButton href="/dashboard/history">History</GhostButton>
        <GhostButton href="/">← Back to Base</GhostButton>
      </PageHeader>

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
            {reportText && <DownloadPDFButton onClick={handleDownloadPDF} />}
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
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Auth: <span style={{ color: "#0f2b2a" }}>JWT / RBAC</span>
        </span>
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Infra: <span style={{ color: "#0f2b2a" }}>AWS / EU-West-1</span>
        </span>
        <span style={{ color: "#9ab5b3", fontWeight: 500 }}>
          Trace: <span style={{ color: "#0d9488" }}>Active</span>
        </span>
      </div>
    </div>
  );
}
