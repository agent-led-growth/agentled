// Runs once in the browser before the app hydrates — Next's client-side
// instrumentation hook. posthog-js auto-captures pageviews (including App
// Router client navigations) and pageleaves via the `defaults` config, so no
// manual router wiring is needed. Init is skipped when the key is unset, which
// keeps local/dev builds without a key from erroring.
import posthog from "posthog-js";

import { env } from "@/lib/env";

const key = env.posthogKey();

if (key) {
  posthog.init(key, {
    api_host: env.posthogHost(),
    defaults: "2026-05-30",
  });
}
