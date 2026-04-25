// Static configuration and string constants for Spectra AI frontend
import { FileText, Aperture, AudioWaveform } from "lucide-react";

export const MODALITY_COLORS = {
  document: "var(--modality-doc)",
  vision: "var(--modality-vision)",
  audio: "var(--modality-audio)",
} as const;

export const MODALITY_LABELS = {
  document: "Document",
  vision: "Vision",
  audio: "Audio",
} as const;

export const ACCEPTED_FILE_TYPES = {
  document: [".pdf", "application/pdf"],
  vision: [".jpg", ".jpeg", ".png", ".webp", "image/jpeg", "image/png", "image/webp"],
  audio: [".mp3", ".wav", ".m4a", ".ogg", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4a", "audio/x-m4a"],
} as const;

export const MAX_FILE_SIZES = {
  document: 2 * 1024 * 1024, // 2 MB
  vision: 1 * 1024 * 1024, // 1 MB
  audio: 10 * 1024 * 1024, // ~30s at 128kbps
} as const;

export const JOB_STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
} as const;

export const NIST_TAG_LABELS = {
  GOVERN: "GOVERN",
  MAP: "MAP",
  MEASURE: "MEASURE",
  MANAGE: "MANAGE",
} as const;

export const CITATION_PREFIXES = {
  document: "D",
  vision: "V",
  audio: "A",
} as const;

export const API_ROUTES = {
  upload: "/api/upload",
  uploadPresign: "/api/upload/presign",
  uploadConfirm: "/api/upload/confirm",
  jobs: "/api/jobs",
  job: (id: string) => `/api/job/${id}`,
  jobTrace: (id: string) => `/api/job/${id}/trace`,
  authToken: "/api/auth/token",
  authRefresh: "/api/auth/refresh",
  inngest: "/api/inngest",
} as const;

export const POLL_INTERVAL_MS = 2000;

export const DEMO_EMAIL = "demo@spectra.app";

export const MODALITIES = [
  {
    label: "Document Intelligence",
    icon: FileText,
    color: "#2dd4bf",
    detail: "Advanced PDF parsing with multi-vector RAG retrieval.",
    sub: "Automatic citation mapping and source grounding.",
  },
  {
    label: "Neural Vision",
    icon: Aperture,
    color: "#38bdf8",
    detail: "Spatial analysis and annotation via GPT-4o vision agents.",
    sub: "Object detection, OCR, and structured data extraction.",
  },
  {
    label: "Audio Extraction",
    icon: AudioWaveform,
    color: "#f87171",
    detail: "Whisper transcription with timestamped diarization.",
    sub: "Summarization and entity recognition from complex audio.",
  },
];
