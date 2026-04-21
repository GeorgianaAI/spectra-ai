import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    }
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
  const { error } = await getSupabaseClient().from("jobs").update({ status }).eq("id", jobId);
  if (error) throw new Error(`Failed to update job ${jobId} status: ${error.message}`);
}

export async function completeJob(
  jobId: string,
  confidenceScores: { doc: number; vision: number; audio: number },
  governanceTrace: unknown[],
  report: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      confidence_scores: confidenceScores,
      governance_trace: governanceTrace,
      result_url: report,
    })
    .eq("id", jobId);
  if (error) throw new Error(`Failed to complete job ${jobId}: ${error.message}`);
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("jobs")
    .update({ status: "failed", error: errorMessage })
    .eq("id", jobId);
  if (error) throw new Error(`Failed to mark job ${jobId} as failed: ${error.message}`);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}
