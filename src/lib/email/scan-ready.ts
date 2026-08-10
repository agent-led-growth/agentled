import "server-only";

import { FROM, resend } from "@/lib/email/resend";

const DASHBOARD_URL = "https://agentled.co/ai-search";

/**
 * Tell a brand member their one-time scan has finished. Fires after the scan
 * lands (never before), so it's the safety net for someone who closed the tab
 * during the ~2-minute run. Best-effort: a send failure is logged, never thrown,
 * since the scan itself already succeeded. Deliberately shows no results — just
 * a link back to the dashboard.
 */
export async function sendScanReadyEmail(to: string, brandName: string): Promise<void> {
  const { error } = await resend().emails.send({
    from: FROM,
    to,
    subject: `Your AI Search scan for ${brandName} is ready`,
    text:
      `Your scan is ready.\n\n` +
      `We've finished checking how ${brandName} shows up in AI-generated answers. ` +
      `See your results:\n${DASHBOARD_URL}`,
    html: scanReadyHtml(brandName),
  });
  if (error) console.error("sendScanReadyEmail: send failed", to, error);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scanReadyHtml(brandName: string): string {
  const name = esc(brandName);
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#14170f;">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 12px;">Your scan is ready</h1>
  <p style="font-size:15px;line-height:1.55;color:#444;margin:0 0 24px;">
    We've finished checking how <strong>${name}</strong> shows up in AI-generated answers. Your results are ready to view.
  </p>
  <a href="${DASHBOARD_URL}" style="display:inline-block;background:#14170f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px;">View your results &rarr;</a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;">Agent-led Growth &middot; AI Search Monitor</p>
</div>`;
}
