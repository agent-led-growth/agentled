"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandTile, Lockup } from "./brand";
import { BRAND, LOG, type LogColor } from "./fixtures";
import { saveOnboarding } from "./onboarding-store";
import { MONO, SANS, appTokens } from "./tokens";

type Step = "brief" | "scan" | "topics";
const logColor: Record<LogColor, string> = {
  mut: "var(--mut)",
  pos: "var(--pos)",
  dim: "var(--dim)",
};

type PrescanResult = {
  brandId: string;
  brand: {
    id: string;
    domain: string;
    name: string | null;
    description: string | null;
    logoUrl: string | null;
    status: string;
  };
  topics: { id: string; label: string; selected: boolean }[];
};

export function OnboardingFlow({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [url, setUrl] = useState(initialUrl);
  const [about, setAbout] = useState("");
  const [result, setResult] = useState<PrescanResult | null>(null);
  const [failed, setFailed] = useState(false);

  // Kick off the real pre-scan (brand create + enrichment) the moment the brief
  // is submitted. The scan step animates while this is in flight and only
  // advances once it resolves; a failure degrades to the fallback topics rather
  // than trapping the visitor mid-onboarding.
  async function runPrescan() {
    setResult(null);
    setFailed(false);
    try {
      const res = await fetch("/api/ai-search/prescan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: url, about: about.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`prescan ${res.status}`);
      setResult((await res.json()) as PrescanResult);
    } catch {
      setFailed(true);
    }
  }

  return (
    <main
      style={appTokens}
      className="min-h-[100svh] w-full"
    >
      {step === "brief" && (
        <Brief
          url={url}
          setUrl={setUrl}
          about={about}
          setAbout={setAbout}
          onContinue={() => {
            setStep("scan");
            void runPrescan();
          }}
        />
      )}
      {step === "scan" && (
        <Scan ready={result !== null || failed} onDone={() => setStep("topics")} />
      )}
      {step === "topics" && (
        <Topics
          result={result}
          fallbackUrl={url}
          onDone={(topics) => {
            saveOnboarding({
              brandId: result?.brandId,
              website: url,
              description: about,
              topics,
            });
            router.push("/ai-search/dashboard");
          }}
        />
      )}
    </main>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: SANS,
        fontSize: 17,
        fontWeight: 600,
        color: "var(--dim)",
      }}
    >
      {children}
    </span>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "#14170f",
  color: "#eef1ec",
  fontWeight: 700,
};

// ── 1. Brief ─────────────────────────────────────────────────────────────────
function Brief({
  url,
  setUrl,
  about,
  setAbout,
  onContinue,
}: {
  url: string;
  setUrl: (v: string) => void;
  about: string;
  setAbout: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="px-[20px] py-[40px] md:px-[56px] md:py-[64px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
        className="mx-auto flex max-w-[620px] flex-col gap-[30px]"
      >
        <h1
          className="text-[32px] md:text-[44px]"
          style={{ lineHeight: 1.02, letterSpacing: "-0.045em" }}
        >
          Start tracking your brand
        </h1>
        <p className="text-[17px]" style={{ color: "var(--mut)", lineHeight: 1.5 }}>
          This is the brand we will monitor across AI answers.
        </p>

        <label className="flex flex-col gap-[10px]">
          <FieldLabel>Website</FieldLabel>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-[52px] w-full px-[16px] text-[17px] md:h-[58px]"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          />
        </label>

        <label className="flex flex-col gap-[10px]">
          <FieldLabel>Tell us about your brand (optional)</FieldLabel>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="About your brand…"
            className="h-[118px] w-full resize-none px-[16px] py-[13px] text-[16px] placeholder:text-[var(--dim)] md:h-[130px]"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              lineHeight: 1.5,
            }}
          />
          <div className="flex flex-col gap-[2px] text-[13.5px]">
            <span style={{ color: "var(--mut)" }}>
              The more specific you are, the better the results.
            </span>
            <span style={{ color: "var(--dim)" }}>
              — What products or services do you offer?
            </span>
            <span style={{ color: "var(--dim)" }}>
              — Do you serve any specific regions?
            </span>
          </div>
        </label>

        <button
          type="submit"
          className="h-[58px] w-full text-[17px]"
          style={primaryBtn}
        >
          Continue
        </button>
      </form>
    </div>
  );
}

// ── 2. Scan ──────────────────────────────────────────────────────────────────
function Scan({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const firedRef = useRef(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const iv = setInterval(() => {
      setRevealed((n) => {
        if (n >= LOG.length) return n;
        return n + 1;
      });
    }, 720);
    return () => clearInterval(iv);
  }, []);

  // Advance only once the log has fully revealed AND the real pre-scan has
  // resolved (or failed). If enrichment outruns the animation we wait for the
  // animation to finish; if it lags, we hold at 100% until it's done.
  useEffect(() => {
    if (revealed >= LOG.length && ready && !firedRef.current) {
      firedRef.current = true;
      const t = setTimeout(() => doneRef.current(), 700);
      return () => clearTimeout(t);
    }
  }, [revealed, ready]);

  const pct = Math.round((revealed / LOG.length) * 100);

  return (
    <div className="flex min-h-[100svh] flex-col px-[20px] py-[20px] md:px-[40px] md:py-[28px]">
      <header className="flex items-center gap-[16px] pb-[24px]">
        <Lockup markSize={30} wordSize={13} gap={11} />
      </header>

      <div className="flex-1">
        <div style={{ border: "1px solid var(--line)", background: "var(--panel)" }}>
          <div
            className="flex items-center justify-between gap-[16px] px-[20px] py-[14px] md:px-[26px]"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontSize: 16,
                color: "var(--dim)",
              }}
            >
              Live scan log
            </span>
            <div className="flex items-center gap-[12px]">
              <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--mut)" }}>
                {pct}%
              </span>
              <span
                style={{
                  width: 180,
                  height: 4,
                  background: "var(--line)",
                  display: "block",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${pct}%`,
                    background: "var(--grn)",
                    transition: "width 0.3s",
                  }}
                />
              </span>
            </div>
          </div>

          <div
            className="px-[20px] py-[26px] md:px-[26px]"
            style={{ fontFamily: MONO, fontSize: 14, lineHeight: 1.5 }}
          >
            <div className="flex flex-col gap-[9px]">
              {LOG.slice(0, revealed).map(([glyph, text, color], i) => (
                <div key={i} className="flex gap-[12px]">
                  <span style={{ color: logColor[color], width: 14, flex: "none" }}>
                    {glyph}
                  </span>
                  <span style={{ color: "var(--mut)" }}>{text}</span>
                </div>
              ))}
              <span
                aria-hidden="true"
                style={{
                  color: "var(--grn)",
                  animation: "ais-blink 1s step-end infinite",
                }}
              >
                █
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Topics ────────────────────────────────────────────────────────────────
/** First-two-word initials for the brand tile, falling back to a bullet. */
function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Topics({
  result,
  fallbackUrl,
  onDone,
}: {
  result: PrescanResult | null;
  fallbackUrl: string;
  onDone: (topics: string[]) => void;
}) {
  // Real suggested topics arrive unselected — pre-select the first three so the
  // "up to 3" quota starts full. When we couldn't confidently read the site,
  // start empty and let the user add their own (a normal manual step, below).
  const [topics, setTopics] = useState(() =>
    result && result.topics.length > 0
      ? result.topics.map((t, i) => ({ label: t.label, on: i < 3 }))
      : [],
  );
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const chosen = topics.filter((t) => t.on).length;

  const brandName = result?.brand.name?.trim() || BRAND.name;
  const brandUrl = result?.brand.domain || fallbackUrl;
  const brandInitials = initialsOf(brandName);

  function toggle(i: number) {
    setTopics((ts) =>
      ts.map((t, j) =>
        j === i
          ? { ...t, on: t.on ? false : chosen < 3 ? true : false }
          : t,
      ),
    );
  }

  function addCustom() {
    const label = custom.trim();
    if (!label) {
      setAdding(false);
      setCustom("");
      return;
    }
    setTopics((ts) => [...ts, { label, on: chosen < 3 }]);
    setCustom("");
    setAdding(false);
  }

  return (
    <div className="px-[20px] py-[40px] md:px-[56px] md:py-[64px]">
      <div className="mx-auto flex max-w-[760px] flex-col gap-[26px]">

        <div className="flex items-center gap-[10px]">
          <BrandTile size={26} label={brandInitials} />
          <span className="text-[15px] font-bold">{brandName}</span>
          <span
            className="hidden md:inline"
            style={{ fontFamily: MONO, fontSize: 12, color: "var(--dim)" }}
          >
            {brandUrl}
          </span>
        </div>

        <h1
          className="max-w-[26ch] text-[30px] md:text-[40px]"
          style={{ lineHeight: 1.05, letterSpacing: "-0.04em" }}
        >
          Which topics do you want to monitor?
        </h1>

        {topics.length === 0 && (
          <p className="text-[15px]" style={{ color: "var(--mut)", lineHeight: 1.5 }}>
            Add the topics you want to track across AI answers — the questions your
            customers ask where your brand should come up.
          </p>
        )}

        <div className="flex flex-col gap-[10px]">
          <span className="text-[14px]" style={{ color: "var(--mut)" }}>
            Select up to 3 topics · {chosen} chosen
          </span>
          <span style={{ height: 3, background: "var(--line)", display: "block" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${(chosen / 3) * 100}%`,
                background: "var(--ink)",
                transition: "width 0.2s",
              }}
            />
          </span>
        </div>

        <div className="flex flex-wrap gap-[10px]">
          {topics.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => toggle(i)}
              className="inline-flex items-center gap-[10px] text-[14.5px]"
              style={{
                border: `1px solid ${t.on ? "var(--ink)" : "var(--line)"}`,
                background: "var(--panel)",
                color: "var(--ink)",
                padding: "11px 16px 11px 12px",
              }}
            >
              <Checkbox on={t.on} />
              {t.label}
            </button>
          ))}

          {adding ? (
            <span
              className="inline-flex items-center gap-[8px]"
              style={{ border: "1px solid var(--line)", background: "var(--panel)", padding: "7px 8px 7px 12px" }}
            >
              <input
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Custom topic"
                className="w-[150px] text-[14.5px] placeholder:text-[var(--dim)] md:w-[200px]"
                style={{ background: "transparent", color: "var(--ink)", outline: "none", border: "none" }}
              />
              <button
                type="button"
                onClick={addCustom}
                className="px-[12px] py-[6px] text-[13px]"
                style={primaryBtn}
              >
                Add
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center text-[14.5px]"
              style={{
                border: "1px dashed var(--dim)",
                color: "var(--dim)",
                padding: "11px 16px",
              }}
            >
              + Add custom
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDone(topics.filter((t) => t.on).map((t) => t.label))}
          className="h-[56px] w-full text-[17px]"
          style={primaryBtn}
        >
          Looks good
        </button>
      </div>
    </div>
  );
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 16,
        height: 16,
        flex: "none",
        display: "grid",
        placeItems: "center",
        border: `1px solid ${on ? "var(--ink)" : "var(--dim)"}`,
        background: on ? "var(--ink)" : "transparent",
        color: "var(--panel)",
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      {on ? "✓" : ""}
    </span>
  );
}
