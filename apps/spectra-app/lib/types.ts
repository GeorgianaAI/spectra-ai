// Shared TypeScript interfaces for Spectra AI frontend

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type Modality = "document" | "vision" | "audio";

export type AgentStatus = "idle" | "processing" | "complete";

export interface ConfidenceScores {
  doc: number;
  vision: number;
  audio: number;
}

export interface ModalitiesUsed {
  document: boolean;
  vision: boolean;
  audio: boolean;
}

export interface GovernanceEntry {
  timestamp: string;
  agent: Modality | "synthesis";
  finding: string;
  confidence: number;
  nistTag: "GOVERN" | "MAP" | "MEASURE" | "MANAGE";
  nistControlId?: string;
}

export interface Citation {
  id: string;
  modality: Modality;
  source: string;
}

export interface Job {
  id: string;
  user_id: string;
  status: JobStatus;
  created_at: string;
  completed_at: string | null;
  result_url: string | null;
  confidence_scores: ConfidenceScores;
  governance_trace: GovernanceEntry[];
  modalities_used: ModalitiesUsed;
  error: string | null;
}

export interface UploadedFiles {
  document?: File;
  vision?: File;
  audio?: File;
}

export type AgentStatuses = Record<string, AgentStatus>;

export interface JobSummary {
  id: string;
  status: JobStatus;
  created_at: string;
  completed_at: string | null;
  modalities_used: ModalitiesUsed;
  confidence_scores: ConfidenceScores;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}
