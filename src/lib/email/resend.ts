import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

let client: Resend | null = null;

export function resend() {
  if (!client) {
    client = new Resend(env.resendApiKey());
  }
  return client;
}

/** Default sender. The domain must be verified in Resend before this works. */
export const FROM = "Agentled <hello@agentled.co>";
