// Fetch helpers for Spectra AI API routes

import type { Job, GovernanceEntry, ApiErrorResponse } from "./types";
import { API_ROUTES } from "./constants";

function getAuthHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
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
  const form = new FormData();
  if (files.document) form.append("document", files.document);
  if (files.vision) form.append("vision", files.vision);
  if (files.audio) form.append("audio", files.audio);

  const res = await fetch(API_ROUTES.upload, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: form,
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(`[${err.code}] ${err.error}`);
  }
  return res.json() as Promise<{ jobId: string }>;
}
