import { Resend } from "resend";

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function sendJobCompletionEmail(
  toEmail: string,
  jobId: string,
  confidenceScores: { doc: number; vision: number; audio: number },
): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? "spectra@resend.dev";

  const { doc, vision, audio } = confidenceScores;
  const html = `
    <h2>Spectra AI — Analysis Complete</h2>
    <p>Your job <code>${jobId}</code> has finished processing.</p>
    <h3>Confidence Scores</h3>
    <ul>
      <li>Document: ${doc}%</li>
      <li>Vision: ${vision}%</li>
      <li>Audio: ${audio}%</li>
    </ul>
    <p>Open the <a href="${process.env.NEXT_PUBLIC_API_URL ?? "https://spectra.app"}/dashboard/job/${jobId}">full report</a> to review findings, citations, and the governance trace.</p>
  `;

  await getResendClient().emails.send({
    from,
    to: toEmail,
    subject: "Spectra AI — Your analysis is ready",
    html,
  });
}
