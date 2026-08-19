"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { COUNTRIES } from "@/lib/geo/countries";
import type { LocationInput } from "@/lib/geo/location";
import { isValidWebsite } from "@/lib/laurel/domain";

import { BrandTile, Lockup } from "./brand";
import { EXAMPLE_URL, type LogColor } from "./fixtures";
import { saveOnboarding } from "./onboarding-store";
import { MONO, SANS, appTokens } from "./tokens";

type Step = "brief" | "location" | "scan" | "topics";
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
  const [location, setLocation] = useState<LocationInput>({
    mode: "worldwide",
    country: null,
    city: null,
  });
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
            // Kick off the pre-scan now so it runs while they pick a location — the
            // location screen adds no wait; the scan step still waits on `ready`.
            setStep("location");
            void runPrescan();
          }}
        />
      )}
      {step === "location" && (
        <Location
          value={location}
          onChange={setLocation}
          onContinue={() => setStep("scan")}
        />
      )}
      {step === "scan" && (
        <Scan
          domain={url}
          result={result}
          ready={result !== null || failed}
          onDone={() => setStep("topics")}
        />
      )}
      {step === "topics" && (
        <Topics
          result={result}
          fallbackUrl={url}
          onDone={async (topics) => {
            const brandId = result?.brandId;
            saveOnboarding({ brandId, website: url, description: about, topics, location });
            // Signed-in onboarding (e.g. dashboard "+ New brand") skips the OTP
            // gate, so persist the selection here; the endpoint no-ops when
            // signed out (the gate saves it then).
            if (brandId) {
              try {
                await fetch("/api/ai-search/onboarding/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ brandId, topics, location }),
                });
              } catch {
                // best-effort
              }
            }
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
  const [error, setError] = useState("");
  return (
    <div className="px-[20px] py-[40px] md:px-[56px] md:py-[64px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (!v) return;
          if (!isValidWebsite(v)) {
            setError("Enter a valid website, like example.com.");
            return;
          }
          setError("");
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
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder={EXAMPLE_URL}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-[52px] w-full px-[16px] text-[17px] placeholder:text-[var(--dim)] md:h-[58px]"
            style={{
              background: "var(--panel)",
              border: `1px solid ${error ? "var(--neg)" : "var(--line)"}`,
              color: "var(--ink)",
            }}
          />
          {error && (
            <span className="text-[13.5px]" style={{ color: "var(--neg)" }}>
              {error}
            </span>
          )}
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
          disabled={!url.trim()}
          className="h-[58px] w-full text-[17px]"
          style={{
            ...primaryBtn,
            opacity: url.trim() ? 1 : 0.45,
            cursor: url.trim() ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}

// ── 2. Location ──────────────────────────────────────────────────────────────
/**
 * Optional geo scope. Worldwide (the neutral default) leaves measurement as-is;
 * otherwise a country — and optionally a city within it — steers the scan. Both
 * fields are type-to-filter comboboxes over canonical lists: the visitor types to
 * search but always lands on a real place, so a selection is valid by construction
 * and the server re-validates on persist as the source of truth.
 */
function Location({
  value,
  onChange,
  onContinue,
}: {
  value: LocationInput;
  onChange: (v: LocationInput) => void;
  onContinue: () => void;
}) {
  const specific = value.mode === "country" || value.mode === "city";
  const [citiesMod, setCitiesMod] = useState<typeof import("@/lib/geo/cities") | null>(null);
  const [citiesFailed, setCitiesFailed] = useState(false);

  // Load the ~6k-city dataset lazily, only once the visitor opts into a specific
  // place, so it never weighs down the common worldwide path. A load failure
  // degrades to country-only (and stops retrying) rather than a field stuck on
  // "Loading…".
  useEffect(() => {
    if (!specific || citiesMod || citiesFailed) return;
    let alive = true;
    void import("@/lib/geo/cities")
      .then((m) => {
        if (alive) setCitiesMod(m);
      })
      .catch(() => {
        if (alive) setCitiesFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [specific, citiesMod, citiesFailed]);

  // Memoised so typing in the city field doesn't re-map the country's whole list
  // each keystroke (the country list is hoisted once as COUNTRY_OPTIONS).
  const cityOptions = useMemo<Option[]>(
    () =>
      (citiesMod && value.country ? citiesMod.citiesForCountry(value.country) : []).map(
        (c) => ({ value: c, label: c }),
      ),
    [citiesMod, value.country],
  );
  const canContinue = value.mode === "worldwide" || !!value.country;

  return (
    <div className="px-[20px] py-[40px] md:px-[56px] md:py-[64px]">
      <div className="mx-auto flex max-w-[620px] flex-col gap-[30px]">
        <div className="flex flex-col gap-[12px]">
          <h1
            className="text-[32px] md:text-[44px]"
            style={{ lineHeight: 1.02, letterSpacing: "-0.045em" }}
          >
            Where should we measure?
          </h1>
          <p className="text-[17px]" style={{ color: "var(--mut)", lineHeight: 1.5 }}>
            AI answers change by location. Track your brand everywhere, or focus on the
            market you actually sell in.
          </p>
        </div>

        <div className="flex flex-col gap-[14px]">
          {/* Worldwide */}
          <button
            type="button"
            onClick={() => onChange({ mode: "worldwide", country: null, city: null })}
            className="flex items-center gap-[14px] text-left"
            style={{
              border: `1px solid ${!specific ? "var(--ink)" : "var(--line)"}`,
              background: "var(--panel)",
              padding: "18px",
            }}
          >
            <Radio on={!specific} />
            <span className="flex flex-col gap-[3px]">
              <span className="text-[16px] font-bold">🌍 Worldwide</span>
              <span className="text-[13.5px]" style={{ color: "var(--mut)" }}>
                Measure AI visibility across all regions.
              </span>
            </span>
          </button>

          {/* Specific country / city */}
          <div
            style={{
              border: `1px solid ${specific ? "var(--ink)" : "var(--line)"}`,
              background: "var(--panel)",
            }}
          >
            <button
              type="button"
              onClick={() =>
                onChange({ mode: "country", country: value.country ?? null, city: null })
              }
              className="flex w-full items-center gap-[14px] text-left"
              style={{ padding: "18px" }}
            >
              <Radio on={specific} />
              <span className="flex flex-col gap-[3px]">
                <span className="text-[16px] font-bold">A specific country or city</span>
                <span className="text-[13.5px]" style={{ color: "var(--mut)" }}>
                  Focus the measurement on one market.
                </span>
              </span>
            </button>

            {specific && (
              <div
                className="flex flex-col gap-[16px]"
                style={{ padding: "16px 18px 20px", borderTop: "1px solid var(--line)" }}
              >
                <label className="flex flex-col gap-[8px]">
                  <FieldLabel>Country</FieldLabel>
                  <Combobox
                    options={COUNTRY_OPTIONS}
                    value={value.country}
                    onSelect={(country) => {
                      // A country change is a natural retry point for the city
                      // dataset, so a prior transient load failure doesn't stay
                      // stuck for the rest of the session.
                      setCitiesFailed(false);
                      // Changing country resets any city — it belongs to the old one.
                      onChange({ mode: "country", country, city: null });
                    }}
                    placeholder="Type to search countries…"
                    emptyLabel="No matching country"
                  />
                </label>

                <label className="flex flex-col gap-[8px]">
                  <FieldLabel>City (optional)</FieldLabel>
                  <Combobox
                    options={cityOptions}
                    value={value.city}
                    onSelect={(city) =>
                      onChange({
                        mode: city ? "city" : "country",
                        country: value.country ?? null,
                        city,
                      })
                    }
                    disabled={!value.country || !citiesMod}
                    placeholder={
                      !value.country
                        ? "Pick a country first"
                        : citiesFailed
                          ? "City list unavailable — using whole country"
                          : !citiesMod
                            ? "Loading cities…"
                            : "Whole country — or type a city"
                    }
                    emptyLabel="No matching city (the whole country will be used)"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="h-[58px] w-full text-[17px]"
          style={{
            ...primaryBtn,
            opacity: canContinue ? 1 : 0.45,
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: "none",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        border: `1px solid ${on ? "var(--ink)" : "var(--dim)"}`,
      }}
    >
      {on && (
        <span
          style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--ink)" }}
        />
      )}
    </span>
  );
}

type Option = { value: string; label: string };
const COUNTRY_OPTIONS: Option[] = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/**
 * A type-to-filter select. The visitor types to narrow a canonical list and picks
 * a match — so the stored value is always a real option, never free text. Typing
 * over a chosen value clears it until a new match is picked, keeping the field and
 * the parent's value honest.
 */
function Combobox({
  options,
  value,
  onSelect,
  placeholder,
  emptyLabel,
  disabled = false,
}: {
  options: Option[];
  value: string | null | undefined;
  onSelect: (value: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const selectedLabel = value ? options.find((o) => o.value === value)?.label ?? "" : "";
  // `query` is only what the visitor is typing while the menu is open; when closed
  // the field shows the committed selection. Deriving the shown text this way (vs
  // syncing state in an effect) keeps an external change — e.g. the country
  // changing and clearing the city — reflected for free, with no cascading renders.
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  // Filter only once the visitor types something other than the current label —
  // focusing an existing pick shows the whole list to browse, not a list of one.
  const filtering = open && q.length > 0 && query !== selectedLabel;
  const matches = (
    filtering ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  ).slice(0, 60);

  function choose(o: Option) {
    onSelect(o.value);
    setQuery(o.label);
    setOpen(false);
  }

  function clear() {
    onSelect(null);
    setQuery("");
    setActive(0);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        value={open ? query : selectedLabel}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => {
          setQuery(selectedLabel);
          setActive(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            if (open && matches[active]) {
              e.preventDefault();
              choose(matches[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-[52px] w-full pl-[14px] pr-[38px] text-[16px] placeholder:text-[var(--dim)]"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          opacity: disabled ? 0.55 : 1,
        }}
      />
      {value && !disabled && (
        <button
          type="button"
          aria-label="Clear"
          onMouseDown={(e) => {
            e.preventDefault(); // keep focus; menu stays open to pick another
            clear();
          }}
          className="absolute right-[10px] top-1/2 text-[18px]"
          style={{
            transform: "translateY(-50%)",
            color: "var(--dim)",
            lineHeight: 1,
            padding: "4px",
          }}
        >
          ×
        </button>
      )}
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: "auto",
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "var(--panel)",
            border: "1px solid var(--line)",
          }}
        >
          {matches.length === 0 ? (
            <li style={{ padding: "12px 14px", color: "var(--dim)", fontSize: 14 }}>
              {emptyLabel ?? "No matches"}
            </li>
          ) : (
            matches.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus so the pick registers before blur
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className="block w-full text-left text-[15px]"
                  style={{
                    padding: "10px 14px",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ink)",
                    background: i === active ? "var(--bg)" : "transparent",
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── 3. Scan ──────────────────────────────────────────────────────────────────
/**
 * The scan log, built from the actual domain and (once it resolves) the real
 * enrichment result — never hardcoded to a demo brand. Result-dependent lines
 * are appended when the pre-scan returns.
 */
function buildScanLog(
  domain: string,
  result: PrescanResult | null,
): [glyph: string, text: string, color: LogColor][] {
  const host =
    domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .trim() || "your site";
  const lines: [string, string, LogColor][] = [
    ["→", `fetching ${host}`, "mut"],
    ["✓", "reading site content", "pos"],
    ["→", "analyzing positioning and offers", "mut"],
    ["→", "clustering topics", "mut"],
  ];
  if (result) {
    const name = result.brand.name?.trim();
    if (name) lines.push(["✓", `brand detected — ${name}`, "pos"]);
    const n = result.topics.length;
    lines.push([
      "✓",
      n > 0 ? `${n} topics suggested` : "site read — add your topics next",
      "pos",
    ]);
  }
  return lines;
}

function Scan({
  domain,
  result,
  ready,
  onDone,
}: {
  domain: string;
  result: PrescanResult | null;
  ready: boolean;
  onDone: () => void;
}) {
  const lines = buildScanLog(domain, result);
  const [revealed, setRevealed] = useState(0);
  const firedRef = useRef(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  // Re-created when the log grows (result lines land) so it reveals them too.
  useEffect(() => {
    const iv = setInterval(() => {
      setRevealed((n) => (n >= lines.length ? n : n + 1));
    }, 700);
    return () => clearInterval(iv);
  }, [lines.length]);

  // Advance once every line has revealed AND the real pre-scan has resolved (or
  // failed). Result lines are appended as they arrive, so we wait for both the
  // animation and the data.
  useEffect(() => {
    if (revealed >= lines.length && ready && !firedRef.current) {
      firedRef.current = true;
      const t = setTimeout(() => doneRef.current(), 700);
      return () => clearTimeout(t);
    }
  }, [revealed, ready, lines.length]);

  // Only hit 100% once the real scan has actually resolved; while it's still in
  // flight (revealed can outrun the data), hold below full.
  const raw = Math.round((revealed / lines.length) * 100);
  const pct = ready ? Math.min(100, raw) : Math.min(90, raw);

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
              {lines.slice(0, revealed).map(([glyph, text, color], i) => (
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

// ── 4. Topics ────────────────────────────────────────────────────────────────
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

  const brandUrl = result?.brand.domain || fallbackUrl;
  // When detection couldn't read the site, show the domain — never a hardcoded
  // brand name.
  const brandName = result?.brand.name?.trim() || brandUrl;
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
