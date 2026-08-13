"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MONO } from "./tokens";

type PromptItem = { id: string; text: string };
type Usage = { used: number; limit: number };

const API = "/api/ai-search/prompts";
const MAX_LEN = 300;

/**
 * Add / edit / remove the monitored questions for a brand, with a live account-
 * wide "used / limit" counter. Edits go straight to the prompts table; remove is
 * a soft deactivate (history kept). At the plan limit, Add is disabled and an
 * upgrade link points at pricing. ChatGPT-only — one question is one prompt.
 */
export function PromptsManager({ brandId }: { brandId: string | null }) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;
    let active = true;
    fetch(`${API}?brand=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((d: { prompts?: PromptItem[]; usage?: Usage }) => {
        if (!active) return;
        setPrompts(d.prompts ?? []);
        setUsage(d.usage ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [brandId]);

  const atLimit = usage != null && usage.used >= usage.limit;

  const add = useCallback(async () => {
    const text = draft.trim();
    if (!text || !brandId || busy || atLimit) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, text }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error === "limit_reached" ? "limit" : "Could not add prompt.");
        if (d.usage) setUsage(d.usage);
        return;
      }
      setPrompts((ps) => [...ps, d.prompt as PromptItem]);
      setUsage(d.usage as Usage);
      setDraft("");
    } catch {
      setError("Could not add prompt.");
    } finally {
      setBusy(false);
    }
  }, [draft, brandId, busy, atLimit]);

  const remove = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const r = await fetch(API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (r.ok) {
        setPrompts((ps) => ps.filter((p) => p.id !== id));
        if (d.usage) setUsage(d.usage as Usage);
        setError(null);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const saveEdit = useCallback(async (id: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setPrompts((ps) => ps.map((p) => (p.id === id ? { ...p, text: clean } : p)));
    await fetch(API, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, text: clean }),
    }).catch(() => {});
  }, []);

  if (!brandId) return null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
          {usage ? `${usage.used} / ${usage.limit} used` : loading ? "Loading…" : ""}
        </span>
        {atLimit && (
          <Link
            href="/ai-search/pricing"
            className="inline-flex items-center whitespace-nowrap no-underline"
            style={{ fontFamily: MONO, fontSize: 11, background: "var(--ink)", color: "var(--panel)", padding: "5px 10px" }}
          >
            Upgrade for more prompts →
          </Link>
        )}
      </div>

      <div className="flex gap-[8px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          maxLength={MAX_LEN}
          disabled={atLimit || busy}
          placeholder={atLimit ? "Plan prompt limit reached" : "Add a question buyers ask…"}
          className="flex-1 text-[14px]"
          style={{ background: "var(--panel2)", border: "1px solid var(--line)", padding: "9px 11px", color: "var(--ink)" }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || atLimit || busy}
          className="whitespace-nowrap text-[13px]"
          style={{
            background: "var(--ink)",
            color: "var(--panel)",
            padding: "9px 16px",
            opacity: !draft.trim() || atLimit || busy ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </div>

      {error && error !== "limit" && (
        <span className="text-[13px]" style={{ color: "var(--neg, #c0392b)" }}>
          {error}
        </span>
      )}

      <div className="flex flex-col gap-[8px]">
        {prompts.map((p) => (
          <PromptRow key={p.id} item={p} disabled={busy} onSave={saveEdit} onRemove={remove} />
        ))}
        {!loading && prompts.length === 0 && (
          <span className="text-[14px]" style={{ color: "var(--dim)" }}>
            No prompts yet. Add the questions your buyers ask.
          </span>
        )}
      </div>
    </div>
  );
}

function PromptRow({
  item,
  disabled,
  onSave,
  onRemove,
}: {
  item: PromptItem;
  disabled: boolean;
  onSave: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState(item.text);
  return (
    <div className="flex items-center gap-[8px]">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const clean = text.trim();
          if (clean && clean !== item.text) onSave(item.id, clean);
          else if (!clean) setText(item.text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        maxLength={MAX_LEN}
        className="flex-1 text-[14px]"
        style={{ background: "var(--panel2)", border: "1px solid var(--line)", padding: "8px 11px", color: "var(--ink)" }}
      />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        aria-label="Remove prompt"
        className="shrink-0"
        style={{ border: "1px solid var(--line)", color: "var(--dim)", padding: "8px 11px", fontFamily: MONO, fontSize: 13 }}
      >
        ×
      </button>
    </div>
  );
}
