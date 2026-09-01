import "server-only";

import type { ModelConfig } from "../registry";
import { openaiGenerateStructured } from "./openai";
import type { StructuredRequest, StructuredResponse } from "./types";

export type { StructuredRequest, StructuredResponse } from "./types";

/**
 * The thin provider adapter: dispatch a structured-output call to the provider
 * named in the role's config. Adding Claude later is a new case here plus its
 * own file — the call sites never change.
 */
export function runStructured(
  config: ModelConfig,
  req: StructuredRequest,
): Promise<StructuredResponse> {
  switch (config.provider) {
    case "openai":
      return openaiGenerateStructured(config, req);
    case "anthropic":
      throw new Error("AI Search: anthropic provider not implemented yet");
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`AI Search: unknown provider ${String(exhaustive)}`);
    }
  }
}
