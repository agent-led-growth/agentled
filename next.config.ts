import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Populate the Cloudflare context (env + ctx.waitUntil) during `next dev`; a
// no-op in production, where the worker provides it. Required for
// getCloudflareContext(), which the background scan trigger uses to detach the
// scan from the request.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
