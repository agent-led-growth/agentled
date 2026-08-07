/**
 * Provider-agnostic contract for the two "agnostic" roles (enrichment,
 * extraction). Both are structured-output calls: given a prompt and a JSON
 * schema, return validated JSON. The scan role is NOT here — it's OpenAI-locked
 * and must answer naturally, so it gets its own client in the scan phase.
 */

export interface StructuredRequest {
  /** System / instructions. */
  system?: string;
  /** The user content the model reasons over. */
  input: string;
  /** Name for the JSON schema (provider requires one). */
  schemaName: string;
  /** JSON schema the output must satisfy (keep it strict-mode-safe). */
  schema: Record<string, unknown>;
}

export interface StructuredResponse {
  /** Parsed JSON conforming to the schema. Caller validates the concrete shape. */
  data: unknown;
  /** Full provider response, for logging / reprocessing. */
  raw: unknown;
}
