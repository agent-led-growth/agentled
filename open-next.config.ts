import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Incremental cache, tag cache and queue can be enabled here once we know
  // which Cloudflare resources (KV / R2 / D1) we want to back them with.
  // See https://opennext.js.org/cloudflare/caching
});
