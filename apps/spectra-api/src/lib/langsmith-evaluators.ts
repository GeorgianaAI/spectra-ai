import type { AuditorOutput, SynthesisOutput } from "./schemas";

export interface EvaluationResult {
  name: string;
  score: number;
  comment: string;
}

export function faithfulnessEvaluator(auditorOutput: AuditorOutput): EvaluationResult {
  const score = auditorOutput.overallFaithfulness / 100;
  const hallucinationCount = auditorOutput.hallucinations.length;
  return {
    name: "faithfulness",
    score,
    comment:
      hallucinationCount > 0
        ? `${hallucinationCount} potential hallucination(s) detected`
        : "No hallucinations detected",
  };
}

export function citationAccuracyEvaluator(
  synthesisOutput: SynthesisOutput,
  auditorOutput: AuditorOutput,
): EvaluationResult {
  const highConfidenceFindings = auditorOutput.governanceTrace.filter(
    (e) => e.confidence >= 70,
  ).length;
  const totalFindings = auditorOutput.governanceTrace.length;
  const citationCoverage = synthesisOutput.citations.length;
  const score = totalFindings > 0 ? highConfidenceFindings / totalFindings : 0;
  return {
    name: "citation_accuracy",
    score,
    comment: `${highConfidenceFindings}/${totalFindings} high-confidence findings; ${citationCoverage} citation(s) in report`,
  };
}

export function logEvaluations(jobId: string, evaluations: EvaluationResult[]): void {
  console.log(
    "[langsmith-evaluators]",
    JSON.stringify({
      jobId,
      evaluations: evaluations.map((e) => ({
        name: e.name,
        score: Math.round(e.score * 100) / 100,
        comment: e.comment,
      })),
    }),
  );
}
