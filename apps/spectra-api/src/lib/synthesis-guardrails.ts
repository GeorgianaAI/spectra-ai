import { detectPromptInjection } from "./prompt-injection";

export function validateSynthesisReport(report: string, activeModalities: string[]): void {
  if (report.trim().length < 100) {
    throw new Error("Synthesis report too short — pipeline may have failed silently");
  }
  const injectionCheck = detectPromptInjection(report);
  if (!injectionCheck.safe) {
    throw new Error(`Synthesis output failed safety check: ${injectionCheck.reason}`);
  }
  if (activeModalities.length > 0 && !/\[[DVA]\d+\]/.test(report)) {
    console.warn("[synthesisNode] report has no inline citation tags — possible grounding failure");
  }
}
