/**
 * Scan consumer — the durable host for one-time scans. It owns no scan logic and
 * no OpenAI/Supabase secrets: for each queued job it calls the app's internal
 * /scan/execute route (server-to-server, INTERNAL_SECRET) and acks on success.
 * A crash (5xx / network) is retried; on the final attempt the brand is recorded
 * as failed via /scan/fail, so a run never hangs or silently vanishes.
 *
 * Deployed on its own: `cd workers/scan-consumer && wrangler deploy`.
 */

interface Env {
  APP_URL: string;
  INTERNAL_SECRET: string;
}

type ScanJob = { brandId: string; triggerEmail: string | null };

// Minimal Cloudflare Queue consumer types — avoids a @cloudflare/workers-types
// dependency (this file is bundled by wrangler, not the app build).
interface QueueMessage<Body> {
  readonly body: Body;
  readonly attempts: number;
  ack(): void;
  retry(): void;
}
interface QueueBatch<Body> {
  readonly messages: readonly QueueMessage<Body>[];
}

// Keep in sync with max_retries in wrangler.toml: total attempts = max_retries + 1.
const MAX_ATTEMPTS = 3;

const handler = {
  async queue(batch: QueueBatch<ScanJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      await handle(msg, env);
    }
  },
};

export default handler;

async function handle(msg: QueueMessage<ScanJob>, env: Env): Promise<void> {
  const { brandId } = msg.body;
  try {
    const res = await post(env, "/api/ai-search/scan/execute", msg.body);
    if (res.ok) {
      msg.ack();
      return;
    }
    console.error(`scan-consumer: execute ${res.status} for ${brandId} (attempt ${msg.attempts})`);
  } catch (err) {
    console.error(`scan-consumer: execute threw for ${brandId} (attempt ${msg.attempts})`, err);
  }

  // Reached only on a crash / network error. Retry until the final attempt, then
  // record a terminal failure so the brand doesn't sit "scanning" forever.
  if (msg.attempts >= MAX_ATTEMPTS) {
    try {
      await post(env, "/api/ai-search/scan/fail", { brandId });
    } catch (err) {
      console.error(`scan-consumer: recording failure failed for ${brandId}`, err);
    }
    msg.ack();
  } else {
    msg.retry();
  }
}

function post(env: Env, path: string, body: unknown): Promise<Response> {
  return fetch(`${env.APP_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.INTERNAL_SECRET,
    },
    body: JSON.stringify(body),
  });
}
