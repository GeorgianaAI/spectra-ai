// Fetch helpers for Spectra AI API routes

import type { Job, JobSummary, GovernanceEntry, ApiErrorResponse } from "./types";
import { API_ROUTES } from "./constants";

export function readAuthToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)__spectra_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getAuthHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchJobs(token: string): Promise<JobSummary[]> {
  const res = await fetch(API_ROUTES.jobs, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  return res.json() as Promise<JobSummary[]>;
}

export async function fetchJobStatus(id: string, token: string): Promise<Job> {
  const res = await fetch(API_ROUTES.job(id), {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  return res.json() as Promise<Job>;
}

export async function fetchJobTrace(id: string, token: string): Promise<GovernanceEntry[]> {
  const res = await fetch(API_ROUTES.jobTrace(id), {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  return res.json() as Promise<GovernanceEntry[]>;
}

export async function issueToken(email: string, password: string): Promise<string> {
  const res = await fetch(API_ROUTES.authToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function refreshToken(currentToken: string): Promise<string> {
  const res = await fetch(API_ROUTES.authRefresh, {
    method: "POST",
    headers: getAuthHeaders(currentToken),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function uploadFiles(
  files: { document?: File; vision?: File; audio?: File },
  token: string,
): Promise<{ jobId: string }> {
  // Step 1: request pre-signed S3 URLs — browser never sends file bytes to Vercel.
  const fileMeta: Record<string, { contentType: string; size: number }> = {};
  if (files.document) fileMeta.document = { contentType: files.document.type, size: files.document.size };
  if (files.vision) fileMeta.vision = { contentType: files.vision.type, size: files.vision.size };
  if (files.audio) fileMeta.audio = { contentType: files.audio.type, size: files.audio.size };

  const presignRes = await fetch(API_ROUTES.uploadPresign, {
    method: "POST",
    headers: { ...getAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ files: fileMeta }),
  });
  if (!presignRes.ok) {
    const err = (await presignRes.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  const { jobId, uploadUrls, s3Keys } = (await presignRes.json()) as {
    jobId: string;
    uploadUrls: Record<string, string>;
    s3Keys: Record<string, string>;
  };

  // Step 2: upload each file directly to S3 via the pre-signed PUT URL.
  const uploads: Promise<void>[] = [];
  if (files.document && uploadUrls.document) {
    uploads.push(
      fetch(uploadUrls.document, {
        method: "PUT",
        headers: { "Content-Type": files.document.type },
        body: files.document,
      }).then((r) => { if (!r.ok) throw new Error("S3 document upload failed"); }),
    );
  }
  if (files.vision && uploadUrls.vision) {
    uploads.push(
      fetch(uploadUrls.vision, {
        method: "PUT",
        headers: { "Content-Type": files.vision.type },
        body: files.vision,
      }).then((r) => { if (!r.ok) throw new Error("S3 vision upload failed"); }),
    );
  }
  if (files.audio && uploadUrls.audio) {
    uploads.push(
      fetch(uploadUrls.audio, {
        method: "PUT",
        headers: { "Content-Type": files.audio.type },
        body: files.audio,
      }).then((r) => { if (!r.ok) throw new Error("S3 audio upload failed"); }),
    );
  }
  await Promise.all(uploads);

  // Step 3: confirm uploads and trigger the processing pipeline.
  const confirmRes = await fetch(API_ROUTES.uploadConfirm, {
    method: "POST",
    headers: { ...getAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, s3Keys }),
  });
  if (!confirmRes.ok) {
    const err = (await confirmRes.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  return { jobId };
}
