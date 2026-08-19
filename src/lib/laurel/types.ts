/**
 * Row and input types for the Laurel data model (see supabase/migrations/0005 &
 * 0006, and laurel-schema.md). The Supabase clients in this project are untyped,
 * so these are hand-written to mirror the tables; timestamps come back as ISO
 * strings from PostgREST.
 */

export type BrandStatus = "anonymous" | "active";
export type Platform = "chatgpt" | "claude";
export type BrandRole = "owner" | "member";
/** Geo scope of a brand's measurement (0017). 'worldwide' = today's default. */
export type LocationMode = "worldwide" | "country" | "city";

export interface Brand {
  id: string;
  domain: string;
  name: string | null;
  description: string | null;
  logo_url: string | null;
  status: BrandStatus;
  first_scan_completed_at: string | null;
  scan_started_at: string | null;
  scan_failed_at: string | null;
  created_at: string;
  claimed_at: string | null;
  // Scheduling (0012): last_scan_at anchors the daily-sweep due check; is_active
  // lets a row be paused (Epic 5) without losing it or its history.
  last_scan_at: string | null;
  is_active: boolean;
  // Location targeting (0017). location_country is ISO-3166 alpha-2; location_city
  // is a GeoNames display name; location_label is the human string for UI + prompt
  // bias. All null/'worldwide' for the default, globally-measured brand.
  location_mode: LocationMode;
  location_country: string | null;
  location_city: string | null;
  location_label: string | null;
}

/** A validated location selection, as chosen in onboarding and persisted. */
export interface BrandLocation {
  mode: LocationMode;
  country: string | null;
  city: string | null;
  label: string | null;
}

export interface Topic {
  id: string;
  brand_id: string;
  label: string;
  selected: boolean;
  sort_order: number | null;
  created_at: string;
}

export interface Prompt {
  id: string;
  brand_id: string;
  topic_id: string | null;
  text: string;
  active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

/** A scan run — one execution of a brand's prompts (0012). */
export type ScanRunStatus = "pending" | "running" | "completed" | "failed";
export type ScanRunTrigger = "onboarding" | "scheduled" | "manual";

export interface ScanRun {
  id: string;
  brand_id: string;
  user_id: string | null;
  status: ScanRunStatus;
  trigger: ScanRunTrigger;
  model: string | null;
  prompts_attempted: number;
  prompts_completed: number;
  error: string | null;
  cost_usd: number | null;
  tokens: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Fields enrichment fills in on an already-created brand. */
export interface BrandEnrichment {
  name?: string | null;
  description?: string | null;
  logoUrl?: string | null;
}

/** One prompt to insert under a brand (topic optional → Ungrouped). */
export interface NewPrompt {
  topicId: string | null;
  text: string;
  sortOrder?: number | null;
}
