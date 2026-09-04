/**
 * OpenAPI 3.1 description of the public API (`/api/v1`).
 *
 * This object is the SINGLE SOURCE OF TRUTH for the API reference: it is served
 * verbatim at `GET /api/v1/openapi.json` (see `openapi/route.ts`) and the
 * Mintlify docs site points at that URL to render the reference. When you add or
 * change an endpoint under `/api/v1`, update this file in the same PR.
 *
 * Kept as a plain object (not generated from the handlers) because the route
 * handlers validate by hand rather than from a schema — so there is nothing to
 * generate from. Accuracy is maintained by review against the handlers.
 */

const bearer = [{ bearerAuth: [] as string[] }];

const paginationQuery = [
  {
    name: "limit",
    in: "query",
    required: false,
    description: "Page size, 1–200. Invalid values fall back to the default.",
    schema: { type: "integer", minimum: 1, maximum: 200 },
  },
  {
    name: "offset",
    in: "query",
    required: false,
    description: "Rows to skip (0 or more). Use with `pagination.hasMore` to page.",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];

const uuidParam = (name: string, what: string) => ({
  name,
  in: "path",
  required: true,
  description: `${what} id (UUID). A value that is not a UUID returns 404.`,
  schema: { type: "string", format: "uuid" },
});

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "agentled API",
    version: "1.0.0",
    description:
      "Programmatic access to the agentled AI Search monitor: manage brands and " +
      "prompts, set a brand's measurement location, and read scan results — the " +
      "same data behind the dashboard.\n\n" +
      "All requests are authenticated with an API key you mint in the Account tab, " +
      "sent as `Authorization: Bearer agl_live_...`. Every key is scoped to your " +
      "account: you only ever see brands your account belongs to.\n\n" +
      "**Base URL:** `https://agentled.co/api/v1`",
    license: {
      name: "Apache-2.0",
      url: "https://www.apache.org/licenses/LICENSE-2.0",
    },
    contact: { name: "agentled", url: "https://agentled.co" },
  },
  servers: [{ url: "https://agentled.co/api/v1", description: "Production" }],
  security: bearer,
  tags: [
    { name: "Plan", description: "The account's plan and its limits." },
    { name: "Brands", description: "Brands the account monitors." },
    { name: "Prompts", description: "The questions asked about a brand each scan." },
    { name: "Answers", description: "Per-scan answer history for a prompt." },
    { name: "Metrics", description: "A brand's AI-visibility metrics." },
    { name: "Scans", description: "Scan runs." },
    { name: "Geo", description: "Valid country/city values for a brand's location." },
  ],
  paths: {
    "/plan": {
      get: {
        tags: ["Plan"],
        summary: "Get the account's plan",
        description: "The account's plan and the capability limits it grants.",
        operationId: "getPlan",
        responses: {
          "200": {
            description: "The plan and its features.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands": {
      get: {
        tags: ["Brands"],
        summary: "List brands",
        description: "The account's brands, newest first.",
        operationId: "listBrands",
        parameters: paginationQuery,
        responses: {
          "200": {
            description: "A page of brands.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BrandList" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Brands"],
        summary: "Create a brand",
        description:
          "Create a brand from a website. The name, description and logo are enriched " +
          "automatically in the background. **No prompts are created** — add them with " +
          "`POST /brands/{id}/prompts`, and note that a brand with no active prompts is " +
          "never scanned.\n\n" +
          "Idempotent per account+domain: posting a domain your account already has " +
          "returns the existing brand unchanged (200, and it does not count against your " +
          "brand limit).",
        operationId: "createBrand",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateBrandInput" } },
          },
        },
        responses: {
          "201": {
            description: "A new brand was created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BrandEnvelope" } } },
          },
          "200": {
            description: "The account already had this domain; the existing brand is returned unchanged.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BrandEnvelope" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "409": { $ref: "#/components/responses/LimitReached" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}": {
      get: {
        tags: ["Brands"],
        summary: "Get a brand",
        operationId: "getBrand",
        parameters: [uuidParam("id", "Brand")],
        responses: {
          "200": {
            description: "The brand.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BrandEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      patch: {
        tags: ["Brands"],
        summary: "Set a brand's location",
        description:
          "Update the brand's measurement location — the market the AI answers are " +
          "measured from. Send `mode: \"worldwide\"` to clear any country/city scope. " +
          "Use the Geo endpoints to discover valid `country` and `city` values.",
        operationId: "updateBrandLocation",
        parameters: [uuidParam("id", "Brand")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateLocationInput" } },
          },
        },
        responses: {
          "200": {
            description: "The updated brand.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BrandEnvelope" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}/prompts": {
      get: {
        tags: ["Prompts"],
        summary: "List a brand's prompts",
        description:
          "The brand's prompts. Returns both active and disabled prompts by default; " +
          "filter with `?active=true` or `?active=false`. Disabling a prompt is a soft " +
          "delete — it is kept for history and can be re-enabled.",
        operationId: "listPrompts",
        parameters: [
          uuidParam("id", "Brand"),
          {
            name: "active",
            in: "query",
            required: false,
            description: "Filter by state. Omit to return both active and disabled prompts.",
            schema: { type: "boolean" },
          },
          ...paginationQuery,
        ],
        responses: {
          "200": {
            description: "A page of prompts.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PromptList" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Prompts"],
        summary: "Add a prompt",
        description:
          "Add an active prompt to the brand. Counts against your account-wide prompt " +
          "limit (across all brands); exceeding it returns 409.",
        operationId: "createPrompt",
        parameters: [uuidParam("id", "Brand")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreatePromptInput" } },
          },
        },
        responses: {
          "201": {
            description: "The created prompt, plus current prompt usage.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PromptCreated" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/LimitReached" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}/prompts/{promptId}": {
      patch: {
        tags: ["Prompts"],
        summary: "Edit or enable/disable a prompt",
        description:
          "Change a prompt's `text`, its `active` state, or both. Send at least one. " +
          "Prompts are never hard-deleted: `active:false` disables (keeps scan history), " +
          "`active:true` re-enables (and counts against your prompt limit again).",
        operationId: "updatePrompt",
        parameters: [uuidParam("id", "Brand"), uuidParam("promptId", "Prompt")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdatePromptInput" } },
          },
        },
        responses: {
          "200": {
            description: "The updated prompt.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PromptEnvelope" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/LimitReached" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}/prompts/{promptId}/answers": {
      get: {
        tags: ["Answers"],
        summary: "List a prompt's answers",
        description:
          "The answer this prompt got in each completed scan, newest first, with the " +
          "brands named and the domains cited. Pages over completed scan runs, so a page " +
          "can hold fewer than `limit` answers when a run had no answer for this prompt.",
        operationId: "listPromptAnswers",
        parameters: [uuidParam("id", "Brand"), uuidParam("promptId", "Prompt"), ...paginationQuery],
        responses: {
          "200": {
            description: "A page of answers.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AnswerList" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}/metrics": {
      get: {
        tags: ["Metrics"],
        summary: "Get a brand's metrics",
        description:
          "AI-visibility metrics for the brand over a trailing window: how often it is " +
          "named, the leaderboard against competitors, citation share, per-prompt detail " +
          "and a trend series.",
        operationId: "getBrandMetrics",
        parameters: [
          uuidParam("id", "Brand"),
          {
            name: "days",
            in: "query",
            required: false,
            description: "Trailing window in days, 1–365. Defaults to 30. Invalid values fall back to 30.",
            schema: { type: "integer", minimum: 1, maximum: 365, default: 30 },
          },
        ],
        responses: {
          "200": {
            description: "The metrics and the window they cover.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MetricsEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/brands/{id}/scans": {
      get: {
        tags: ["Scans"],
        summary: "List a brand's scans",
        description: "The brand's scan runs, newest first. Default page size here is 90.",
        operationId: "listScans",
        parameters: [
          uuidParam("id", "Brand"),
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Page size, 1–200. Defaults to 90 for this endpoint.",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 90 },
          },
          {
            name: "offset",
            in: "query",
            required: false,
            description: "Rows to skip (0 or more).",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "A page of scan runs.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ScanList" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/scans/{runId}": {
      get: {
        tags: ["Scans"],
        summary: "Get a scan",
        operationId: "getScan",
        parameters: [uuidParam("runId", "Scan")],
        responses: {
          "200": {
            description: "The scan run.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ScanEnvelope" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/geo/countries": {
      get: {
        tags: ["Geo"],
        summary: "List countries",
        description:
          "Every country a brand can be scoped to. Each `code` is the value to send as " +
          "`location.country` on `PATCH /brands/{id}`.",
        operationId: "listCountries",
        responses: {
          "200": {
            description: "The full country list.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CountryList" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/geo/countries/{code}/cities": {
      get: {
        tags: ["Geo"],
        summary: "List a country's cities",
        description:
          "Cities that can be sent as `location.city` for the country (major cities, " +
          "population ≥ 100k). An empty list means only country-level scope is available.",
        operationId: "listCities",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            description: "ISO 3166-1 alpha-2 country code (case-insensitive).",
            schema: { type: "string", example: "US" },
          },
        ],
        responses: {
          "200": {
            description: "The country and its cities.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CityList" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "An API key from the Account tab, sent as `Authorization: Bearer agl_live_...`. " +
          "Keys are secret; store them server-side.",
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "The resource does not exist, or your account cannot see it.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      BadRequest: {
        description: "The request body or a parameter was invalid.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      LimitReached: {
        description: "A plan limit was reached. The error carries `upgradeUrl`.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ServerError: {
        description: "Something went wrong. Retry.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
    schemas: {
      Error: {
        type: "object",
        description: "Every error has this shape. Branch on the stable `error.code`.",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                description: "Stable machine-readable code.",
                enum: ["unauthorized", "not_found", "bad_request", "limit_reached", "server_error"],
              },
              message: { type: "string", description: "Human-readable explanation." },
              upgradeUrl: {
                type: "string",
                description: "Present only when `code` is `limit_reached`: where to upgrade the plan.",
              },
            },
          },
        },
      },
      Pagination: {
        type: "object",
        description: "Offset pagination. `hasMore` tells you whether another page exists.",
        required: ["limit", "offset", "hasMore"],
        properties: {
          limit: { type: "integer", description: "The effective (clamped) page size used." },
          offset: { type: "integer", description: "The offset used." },
          hasMore: { type: "boolean", description: "True if more rows exist past this page." },
        },
      },
      Location: {
        type: "object",
        description: "The market a brand's AI answers are measured from.",
        required: ["mode", "country", "city", "label"],
        properties: {
          mode: {
            type: "string",
            enum: ["worldwide", "country", "city"],
            description: "Scope granularity.",
          },
          country: {
            type: ["string", "null"],
            description: "ISO 3166-1 alpha-2 code, when scoped to a country or city.",
          },
          city: { type: ["string", "null"], description: "City name, when scoped to a city." },
          label: { type: ["string", "null"], description: "Human-readable label, e.g. \"Austin, United States\"." },
        },
      },
      Brand: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          domain: { type: "string" },
          name: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          logoUrl: { type: ["string", "null"], format: "uri" },
          status: {
            type: "string",
            enum: ["anonymous", "active"],
            description: "`active` once the brand is claimed by an account.",
          },
          isActive: { type: "boolean" },
          firstScanCompletedAt: { type: ["string", "null"], format: "date-time" },
          lastScanAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          claimedAt: { type: ["string", "null"], format: "date-time" },
          location: { $ref: "#/components/schemas/Location" },
        },
      },
      Prompt: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          brandId: { type: "string", format: "uuid" },
          text: { type: "string" },
          active: { type: "boolean", description: "False = disabled (soft-deleted, kept for history)." },
          sortOrder: { type: ["integer", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Answer: {
        type: "object",
        properties: {
          runId: { type: "string", format: "uuid", description: "The scan run this answer came from." },
          at: { type: "string", format: "date-time", description: "When that run completed." },
          answer: { type: ["string", "null"], description: "The AI's answer text." },
          promptText: { type: ["string", "null"], description: "The prompt as it was asked in that run." },
          named: { type: "boolean", description: "Whether the brand was named in the answer." },
          highlight: { type: ["string", "null"], description: "The sentence naming the brand, if any." },
          brands: {
            type: "array",
            items: { type: "string" },
            description: "Brands named in the answer, in order of appearance.",
          },
          cites: {
            type: "array",
            items: { type: "string" },
            description: "Unique domains cited in the answer.",
          },
        },
      },
      Scan: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          brandId: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: ["pending", "running", "completed", "failed"],
          },
          trigger: {
            type: "string",
            enum: ["onboarding", "scheduled", "manual"],
            description: "What started the run.",
          },
          model: { type: ["string", "null"] },
          promptsAttempted: { type: "integer" },
          promptsCompleted: { type: "integer" },
          error: { type: ["string", "null"] },
          startedAt: { type: ["string", "null"], format: "date-time" },
          completedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Plan: {
        type: "object",
        required: ["plan", "features"],
        properties: {
          plan: {
            type: "string",
            enum: ["free", "starter", "pro", "business", "unlimited"],
          },
          features: {
            type: "object",
            required: ["brands", "prompts", "frequency", "models"],
            properties: {
              brands: { type: "integer", description: "Max brands on this plan." },
              prompts: { type: "integer", description: "Max active prompts across all brands." },
              frequency: {
                type: "string",
                enum: ["one-time", "daily"],
                description: "How often brands are scanned.",
              },
              models: {
                type: "array",
                items: { type: "string", enum: ["chatgpt"] },
                description: "AI platforms scanned (more coming).",
              },
            },
          },
        },
      },
      Country: {
        type: "object",
        required: ["code", "name"],
        properties: {
          code: { type: "string", description: "ISO 3166-1 alpha-2 (uppercase)." },
          name: { type: "string" },
        },
      },
      BrandMetrics: {
        type: "object",
        description: "A brand's AI-visibility metrics. Zero state (no completed scans) has `scanned:false`, numeric fields 0, arrays empty and deltas null.",
        properties: {
          platform: { type: "string", enum: ["chatgpt"] },
          scanned: { type: "boolean", description: "True once at least one scan has completed." },
          answers: { type: "integer", description: "Count of usable answers in the window." },
          visibility: { type: "number", description: "Share of answers naming the brand, 0–1." },
          visibilityNamed: { type: "integer", description: "Count of answers naming the brand." },
          rankValue: { type: "integer", description: "1-based standing on the leaderboard (0 if absent)." },
          leaderboard: { type: "array", items: { $ref: "#/components/schemas/LeaderRow" } },
          groups: { type: "array", items: { $ref: "#/components/schemas/GroupMetric" } },
          citationShare: { type: "number", description: "Own citations / all citations, 0–1." },
          citationOwn: { type: "number" },
          citationTotal: { type: "number" },
          citationRankValue: { type: "integer", description: "1-based rank of the brand's own domain among cited domains (0 if absent)." },
          citationDomains: { type: "array", items: { $ref: "#/components/schemas/DomainMetric" } },
          trend: { type: "array", items: { $ref: "#/components/schemas/TrendPoint" } },
          visibilityDelta: { type: ["number", "null"], description: "Latest vs previous run." },
          citationDelta: { type: ["number", "null"] },
          rankDelta: { type: ["number", "null"], description: "Positive = moved up (rank got smaller)." },
        },
      },
      LeaderRow: {
        type: "object",
        properties: {
          name: { type: "string" },
          visibility: { type: "number", description: "0–1." },
          isSelf: { type: "boolean" },
        },
      },
      GroupMetric: {
        type: "object",
        properties: {
          topicId: { type: ["string", "null"] },
          name: { type: "string" },
          promptCount: { type: "integer" },
          score: { type: "number" },
          rank: { type: "integer" },
          pos: { type: ["number", "null"] },
          cite: { type: "number" },
          items: { type: "array", items: { $ref: "#/components/schemas/PromptMetric" } },
        },
      },
      PromptMetric: {
        type: "object",
        properties: {
          promptId: { type: "string", format: "uuid" },
          q: { type: "string", description: "The prompt text." },
          score: { type: "number", description: "1 if named in the latest answer, else 0." },
          pos: { type: ["number", "null"] },
          cite: { type: "number" },
          answer: { type: ["string", "null"] },
          brands: { type: "array", items: { type: "string" } },
          cites: { type: "array", items: { type: "string" } },
          highlight: { type: ["string", "null"] },
        },
      },
      DomainMetric: {
        type: "object",
        properties: {
          domain: { type: "string" },
          share: { type: "number", description: "0–1." },
          owned: { type: "boolean", description: "True if this is the brand's own domain." },
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                share: { type: "number" },
                title: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      TrendPoint: {
        type: "object",
        properties: {
          at: { type: "string", format: "date-time" },
          visibility: { type: "number", description: "0–1." },
          citationShare: { type: "number", description: "0–1." },
        },
      },
      CreateBrandInput: {
        type: "object",
        required: ["website"],
        properties: {
          website: {
            type: "string",
            maxLength: 2048,
            description: "The brand's website or domain, e.g. `example.com`. Must be a valid domain.",
            example: "example.com",
          },
          about: {
            type: "string",
            maxLength: 5000,
            description: "Optional context to improve enrichment.",
          },
        },
      },
      UpdateLocationInput: {
        type: "object",
        required: ["location"],
        properties: {
          location: {
            type: "object",
            required: ["mode"],
            properties: {
              mode: {
                type: "string",
                enum: ["worldwide", "country", "city"],
                description: "`worldwide` clears any scope. `country`/`city` require the fields below.",
              },
              country: {
                type: "string",
                description: "ISO 3166-1 alpha-2 (case-insensitive). Required when mode is country or city. See GET /geo/countries.",
                example: "US",
              },
              city: {
                type: "string",
                description: "City name. Required when mode is city. Must be one of GET /geo/countries/{code}/cities.",
                example: "Austin",
              },
            },
          },
        },
      },
      CreatePromptInput: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            maxLength: 300,
            description: "The question to ask about the brand.",
            example: "What are the best project management tools?",
          },
        },
      },
      UpdatePromptInput: {
        type: "object",
        description: "Provide `text`, `active`, or both.",
        minProperties: 1,
        properties: {
          text: { type: "string", maxLength: 300 },
          active: { type: "boolean", description: "false disables (soft-delete); true re-enables." },
        },
      },
      BrandEnvelope: {
        type: "object",
        required: ["brand"],
        properties: { brand: { $ref: "#/components/schemas/Brand" } },
      },
      BrandList: {
        type: "object",
        required: ["brands", "pagination"],
        properties: {
          brands: { type: "array", items: { $ref: "#/components/schemas/Brand" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      PromptEnvelope: {
        type: "object",
        required: ["prompt"],
        properties: { prompt: { $ref: "#/components/schemas/Prompt" } },
      },
      PromptList: {
        type: "object",
        required: ["prompts", "pagination"],
        properties: {
          prompts: { type: "array", items: { $ref: "#/components/schemas/Prompt" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      PromptCreated: {
        type: "object",
        required: ["prompt", "usage"],
        properties: {
          prompt: { $ref: "#/components/schemas/Prompt" },
          usage: {
            type: "object",
            required: ["used", "limit"],
            properties: {
              used: { type: "integer", description: "Active prompts across all your brands after this add." },
              limit: { type: "integer", description: "Your plan's prompt limit." },
            },
          },
        },
      },
      AnswerList: {
        type: "object",
        required: ["answers", "pagination"],
        properties: {
          answers: { type: "array", items: { $ref: "#/components/schemas/Answer" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      ScanEnvelope: {
        type: "object",
        required: ["scan"],
        properties: { scan: { $ref: "#/components/schemas/Scan" } },
      },
      ScanList: {
        type: "object",
        required: ["scans", "pagination"],
        properties: {
          scans: { type: "array", items: { $ref: "#/components/schemas/Scan" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      MetricsEnvelope: {
        type: "object",
        required: ["days", "metrics"],
        properties: {
          days: { type: "integer", description: "The effective window used." },
          metrics: { $ref: "#/components/schemas/BrandMetrics" },
        },
      },
      CountryList: {
        type: "object",
        required: ["countries"],
        properties: {
          countries: { type: "array", items: { $ref: "#/components/schemas/Country" } },
        },
      },
      CityList: {
        type: "object",
        required: ["country", "cities"],
        properties: {
          country: { $ref: "#/components/schemas/Country" },
          cities: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
