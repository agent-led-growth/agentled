/**
 * Row and input types for the Laurel data model (see supabase/migrations/0005 &
 * 0006, and laurel-schema.md). The Supabase clients in this project are untyped,
 * so these are hand-written to mirror the tables; timestamps come back as ISO
 * strings from PostgREST.
 */

export type BrandStatus = "anonymous" | "active";
export type Platform = "chatgpt" | "claude";
export type BrandRole = "owner" | "member";

export interface Brand {
  id: string;
  domain: string;
  name: string | null;
  description: string | null;
  logo_url: string | null;
  status: BrandStatus;
  first_scan_completed_at: string | null;
  scan_started_at: string | null;
  created_at: string;
  claimed_at: string | null;
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
