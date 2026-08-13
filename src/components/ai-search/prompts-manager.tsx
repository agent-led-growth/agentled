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
 * wide "used / limit" counter. Remove is a soft deactivate (history kept). At the
 * plan limit, Add is disabled and an upgrade link points at pricing. ChatGPT-only
 * — one question is one prompt.
 */
export function PromptsManager({ brandId }: { brandId: string | null }) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
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
    if (!text || !brandId || adding || atLimit) return;
    setAdding(true);
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
      setAdding(false);
    }
  }, [draft, brandId, adding, atLimit]);

  // Remove = soft deactivate. Only mutates the list on success; on failure the
  // prompt stays put and we surface an error (the row unfreezes itself).
  const remove = useCallback(async (id: string) => {
    try {
      const r = await fetch(API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = (await r.json().catch(() => ({}))) as { usage?: Usage };
      if (!r.ok) throw new Error();
      setPrompts((ps) => ps.filter((p) => p.id !== id));
      if (d.usage) setUsage(d.usage);
      setError(null);
    } catch {
      setError("Could not remove prompt.");
    }
  }, []);

  // Save on success only: the row's ✓ clears because item.text now matches its
  // input. On failure nothing is committed, the ✓ stays, and we show an error —
  // so an edit can never look saved when it isn't.
  const saveEdit = useCallback(async (id: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    try {
      const r = await fetch(API, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, text: clean }),
      });
      if (!r.ok) throw new Error();
      setPrompts((ps) => ps.map((p) => (p.id === id ? { ...p, text: clean } : p)));
      setError(null);
    } catch {
      setError("Could not save your edit.");
    }
  }, []);

  if (!brandId) return null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--dim)" }}>
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
          disabled={atLimit || adding}
          placeholder={atLimit ? "Plan prompt limit reached" : "Add a question buyers ask…"}
          className="flex-1 text-[14px]"
          style={{ background: "var(--panel2)", border: "1px solid var(--line)", padding: "9px 11px", color: "var(--ink)" }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || atLimit || adding}
          className="whitespace-nowrap text-[13px]"
          style={{
            background: "var(--ink)",
            color: "var(--panel)",
            padding: "9px 16px",
            opacity: !draft.trim() || atLimit || adding ? 0.5 : 1,
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
          <PromptRow key={p.id} item={p} onSave={saveEdit} onRemove={remove} />
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
  onSave,
  onRemove,
}: {
  item: PromptItem;
  onSave: (id: string, text: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState(item.text);
  const [confirming, setConfirming] = useState(false);
  // Per-row busy — one row's save/remove never disables the others.
  const [rowBusy, setRowBusy] = useState(false);
  // A save affordance appears only once the text actually changed.
  const dirty = text.trim() !== "" && text.trim() !== item.text;

  const save = async () => {
    if (!dirty || rowBusy) return;
    setRowBusy(true);
    await onSave(item.id, text.trim());
    setRowBusy(false);
  };
  const doRemove = async () => {
    if (rowBusy) return;
    setConfirming(false);
    setRowBusy(true);
    await onRemove(item.id);
    setRowBusy(false);
  };

  return (
    <div className="flex items-center gap-[8px]">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setText(item.text);
        }}
        maxLength={MAX_LEN}
        className="flex-1 text-[14px]"
        style={{ background: "var(--panel2)", border: "1px solid var(--line)", padding: "8px 11px", color: "var(--ink)" }}
      />

      {confirming ? (
        <span className="inline-flex shrink-0 items-center gap-[6px]">
          <span className="text-[12px]" style={{ color: "var(--dim)" }}>
            Remove?
          </span>
          <button
            type="button"
            onClick={doRemove}
            disabled={rowBusy}
            className="text-[12px] font-semibold"
            style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--panel)", padding: "7px 11px" }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[12px]"
            style={{ border: "1px solid var(--line)", color: "var(--dim)", padding: "7px 11px" }}
          >
            No
          </button>
        </span>
      ) : (
        <>
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={rowBusy}
              aria-label="Save edit"
              className="shrink-0"
              style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--panel)", padding: "8px 12px", fontFamily: MONO, fontSize: 13 }}
            >
              ✓
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={rowBusy}
            aria-label="Remove prompt"
            className="shrink-0"
            style={{ border: "1px solid var(--line)", color: "var(--dim)", padding: "8px 12px", fontFamily: MONO, fontSize: 13 }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
