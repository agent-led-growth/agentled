/**
 * Scan cron — fires the daily sweep hourly. Owns no scan logic and no secrets
 * beyond the shared INTERNAL_SECRET: on its cron trigger it POSTs the app's
 * internal /scan/sweep route, which selects due paid brands and enqueues them
 * onto the scan queue for the consumer to drain. A failed sweep just logs; the
 * next hour retries, and per-brand due-ness is recomputed each time.
 *
 * Deployed on its own: `cd workers/scan-cron && wrangler deploy`.
 */

interface Env {
  APP_URL: string;
  INTERNAL_SECRET: string;
}

const handler = {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    try {
      const res = await fetch(`${env.APP_URL}/api/ai-search/scan/sweep`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": env.INTERNAL_SECRET,
        },
        body: "{}",
      });
      if (!res.ok) {
        console.error(`scan-cron: sweep returned ${res.status}`);
      }
    } catch (err) {
      console.error("scan-cron: sweep threw", err);
    }
  },
};

export default handler;
