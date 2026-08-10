"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { capture, identifyUser } from "@/lib/analytics";
import type { BrandMetrics } from "@/lib/laurel/metrics";
import { createClient } from "@/lib/supabase/client";

import { AnswerMarkdown } from "./answer-markdown";
import { Mark, Wordmark } from "./brand";
import {
  BRAND,
  isLocked,
  PLATFORM_OPTIONS,
  PLATFORMS,
  tone,
  type ChartInput,
  type CitationDomain,
  type CitationPage,
  type Group,
  type Platform,
  type Prompt,
} from "./fixtures";
import { DASH, formatMetrics, type DashboardData } from "./format";
import { AI_MODELS, MODEL_COLOR } from "./model-marks";
import { clearOnboarding, readOnboarding } from "./onboarding-store";
import { MONO, SANS, appTokens, toneVar } from "./tokens";

type Tab = "overview" | "prompts" | "settings";
const TABS: Tab[] = ["overview", "prompts", "settings"];
const PLATFORM_IDS = PLATFORM_OPTIONS.map((p) => p.id);

/** A brand on the current account, as the header switcher needs it. */
type BrandLite = { id: string; domain: string; name: string | null };

const COLS =
  "md:grid md:grid-cols-[1fr_130px_170px_160px_130px] md:items-center md:gap-[16px]";

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "overview";
  const rawPlat = params.get("platform") as Platform | null;
  const platform: Platform =
    rawPlat && PLATFORM_IDS.includes(rawPlat) ? rawPlat : "chatgpt";
  const brandId = params.get("brand");
  // The gate is only for first-time account creation. Already-signed-in users
  // skip it. `checked` avoids flashing the modal before the session resolves.
  const [gated, setGated] = useState(true);
  const [checked, setChecked] = useState(false);
  const [brands, setBrands] = useState<BrandLite[]>([]);
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setGated(false);
        setChecked(true);
      });
  }, []);

  // Once signed in, load the account's brands for the header switcher.
  useEffect(() => {
    if (!checked || gated) return;
    fetch("/api/ai-search/brands")
      .then((r) => r.json())
      .then((d: { brands?: BrandLite[] }) => setBrands(d.brands ?? []))
      .catch(() => {});
  }, [checked, gated]);

  const currentBrand = brands.find((b) => b.id === brandId) ?? brands[0] ?? null;
  const currentBrandId = currentBrand?.id ?? null;

  // Load metrics for the current brand; kick off the one-time scan first if it
  // hasn't run yet, then show the results.
  useEffect(() => {
    if (!checked || gated || !currentBrandId) return;
    let active = true;
    (async () => {
      setScanState("loading");
      setData(null);
      try {
        let payload = await fetchMetrics(currentBrandId);
        if (!active) return;
        if (!payload.scannedAt) {
          setScanState("scanning");
          // Start the scan only if one isn't already running (the lock keeps a
          // race from double-firing); then poll for whoever runs it to finish.
          if (!payload.scanning) {
            void fetch("/api/ai-search/scan/run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brandId: currentBrandId }),
            }).catch(() => {});
          }
          payload = await pollUntilScanned(currentBrandId, () => active);
          if (!active) return;
        }
        if (payload.metrics && payload.metrics.answers > 0) {
          setData(formatMetrics(payload.metrics));
          setScanState("ready");
        } else {
          setScanState("empty");
        }
      } catch {
        if (active) setScanState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [checked, gated, currentBrandId]);

  // Both tab and platform live in the URL, so a reload keeps the view and a
  // link is shareable. Each setter preserves the other's value.
  const go = (next: { tab?: Tab; platform?: Platform; brand?: string }) => {
    const b = next.brand ?? brandId;
    router.replace(
      `/ai-search/dashboard?tab=${next.tab ?? tab}&platform=${
        next.platform ?? platform
      }${b ? `&brand=${b}` : ""}`,
      { scroll: false },
    );
  };
  const setTab = (t: Tab) => go({ tab: t });
  const setPlatform = (p: Platform) => go({ platform: p });
  const setBrand = (id: string) => go({ brand: id });
  const goNewBrand = () => router.push("/ai-search/onboarding");
  // Real sign-out: clear the Supabase session first, then leave the (gated)
  // dashboard. Previously this only navigated, so the user stayed signed in.
  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/ai-search");
    router.refresh();
  };

  return (
    <main
      style={appTokens}
      className="relative min-h-[100svh] md:h-[100svh] md:overflow-hidden"
    >
      <div
        className="md:flex md:h-full md:flex-col md:overflow-hidden"
        style={{
          filter: gated ? "blur(7px)" : "none",
          pointerEvents: gated ? "none" : "auto",
          userSelect: gated ? "none" : "auto",
        }}
        aria-hidden={gated}
      >
        <Header onSignOut={signOut} onNew={goNewBrand} />
        <div className="flex md:min-h-0 md:flex-1">
          <Sidebar tab={tab} setTab={setTab} />
          <div className="min-w-0 flex-1 pb-[84px] md:overflow-y-auto md:pb-0">
            <TitleRow current={currentBrand} brands={brands} onSwitch={setBrand} />
            <FilterBar tab={tab} platform={platform} setPlatform={setPlatform} />
            <div className="px-[20px] py-[24px] md:px-[28px]">
              {scanState !== "ready" || !data ? (
                <ScanNotice kind={scanState === "ready" ? "loading" : scanState} brand={currentBrand} />
              ) : (
                <>
                  {tab === "overview" && (
                    <Overview data={data} brand={currentBrand} platform={platform} />
                  )}
                  {tab === "prompts" && (
                    <Prompts
                      data={data}
                      platform={platform}
                      brandId={currentBrandId}
                      brandName={currentBrand?.name?.trim() || currentBrand?.domain || "Your brand"}
                      onUpgrade={() => setPlatform("claude")}
                    />
                  )}
                  {tab === "settings" && (
                    <Settings
                      brand={currentBrand}
                      data={data}
                      platform={platform}
                      onUpgrade={() => setPlatform("claude")}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>

      {gated && checked && <Gate onEnter={() => setGated(false)} />}
    </main>
  );
}

type ScanState = "loading" | "scanning" | "ready" | "empty" | "error";

type MetricsPayload = {
  scannedAt: string | null;
  scanning: boolean;
  metrics: BrandMetrics | null;
};

async function fetchMetrics(brandId: string): Promise<MetricsPayload> {
  const res = await fetch(`/api/ai-search/metrics?brand=${brandId}`);
  if (!res.ok) throw new Error("metrics fetch failed");
  return res.json();
}

/** Poll /metrics until the scan finishes (or we time out), while still mounted. */
async function pollUntilScanned(
  brandId: string,
  active: () => boolean,
): Promise<MetricsPayload> {
  const deadline = Date.now() + 3 * 60_000;
  let payload = await fetchMetrics(brandId);
  while (!payload.scannedAt && active() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    if (!active()) break;
    payload = await fetchMetrics(brandId);
  }
  return payload;
}

/** Full-body notice for the non-ready states (loading / running / empty / error). */
function ScanNotice({
  kind,
  brand,
}: {
  kind: Exclude<ScanState, "ready">;
  brand: BrandLite | null;
}) {
  const name = brand?.name?.trim() || brand?.domain || "your brand";
  const copy: Record<Exclude<ScanState, "ready">, { title: string; body: string }> = {
    loading: { title: "Loading…", body: "Fetching your latest scan." },
    scanning: {
      title: "Running your scan…",
      body: `This can take several minutes. We're asking ChatGPT the questions your buyers ask about ${name}.`,
    },
    empty: {
      title: "No results yet",
      body: "The scan finished but didn't return anything to report. Try again shortly.",
    },
    error: {
      title: "Something went wrong",
      body: "We couldn't load your scan. Refresh to try again.",
    },
  };
  const { title, body } = copy[kind];
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-[10px] text-center">
      {(kind === "scanning" || kind === "loading") && (
        <span
          aria-hidden="true"
          className="mb-[6px] inline-block h-[26px] w-[26px] animate-spin"
          style={{
            border: "2px solid var(--line)",
            borderTopColor: "var(--ink)",
            borderRadius: "9999px",
          }}
        />
      )}
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</span>
      <span
        className="max-w-[430px] text-[14px]"
        style={{ color: "var(--mut)", lineHeight: 1.5 }}
      >
        {body}
      </span>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Header({ onSignOut, onNew }: { onSignOut: () => void; onNew: () => void }) {
  return (
    <header
      className="flex items-center justify-between px-[20px] py-[14px] md:px-[28px] md:py-[16px]"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
    >
      <span className="inline-flex items-center gap-[12px]">
        <Mark size={34} />
        <Wordmark size={16} />
      </span>
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={onNew}
          title="Add a new brand"
          className="px-[16px] py-[9px] text-[14px]"
          style={{
            background: "var(--ink)",
            color: "var(--panel)",
            fontWeight: 600,
            flex: "none",
            whiteSpace: "nowrap",
          }}
        >
          + New
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="px-[16px] py-[9px] text-[14px]"
          style={{
            border: "1px solid var(--line)",
            color: "var(--ink)",
            flex: "none",
            whiteSpace: "nowrap",
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav
      className="hidden w-[165px] shrink-0 flex-col p-[14px_12px] md:flex"
      style={{
        background: "var(--panel2)",
        borderRight: "1px solid var(--line)",
      }}
    >
      <NavItem active={tab === "overview"} onClick={() => setTab("overview")}>
        Overview
      </NavItem>
      <NavItem active={tab === "prompts"} onClick={() => setTab("prompts")}>
        Prompts
      </NavItem>

      <div className="mt-auto">
        <NavItem active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left text-[14px]"
      style={{
        padding: 10,
        background: active ? "var(--hov)" : "transparent",
        color: active ? "var(--ink)" : "var(--mut)",
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

function TitleRow({
  current,
  brands,
  onSwitch,
}: {
  current: BrandLite | null;
  brands: BrandLite[];
  onSwitch: (id: string) => void;
}) {
  const name = current?.name?.trim() || current?.domain || BRAND.name;
  const url = current?.domain || BRAND.url;
  return (
    <div className="flex items-center gap-[12px] px-[20px] pt-[18px] md:px-[28px]">
      {brands.length > 1 && current ? (
        <BrandSwitcher current={current} brands={brands} onSwitch={onSwitch} />
      ) : (
        <>
          <h1 className="text-[22px]" style={{ letterSpacing: "-0.035em" }}>
            {name}
          </h1>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
            {url}
          </span>
        </>
      )}
    </div>
  );
}

/** Header brand name/URL as a dropdown when the account has more than one brand. */
function BrandSwitcher({
  current,
  brands,
  onSwitch,
}: {
  current: BrandLite;
  brands: BrandLite[];
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = (b: BrandLite) => b.name?.trim() || b.domain;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch brand"
        className="flex items-center gap-[12px] transition-opacity hover:opacity-80"
        style={{ color: "var(--ink)" }}
      >
        <h1 className="text-[22px]" style={{ letterSpacing: "-0.035em" }}>
          {label(current)}
        </h1>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
          {current.domain}
        </span>
        <span
          aria-hidden="true"
          className="grid place-items-center"
          style={{
            width: 28,
            height: 28,
            flex: "none",
            border: "1px solid var(--line)",
            background: open ? "var(--hov)" : "var(--panel2)",
            color: "var(--ink)",
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10"
            style={{ background: "transparent", cursor: "default" }}
          />
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[260px]"
            style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
          >
            {brands.map((b) => {
              const active = b.id === current.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onSwitch(b.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-[12px] px-[14px] py-[10px] text-left"
                  style={{
                    background: active ? "var(--hov)" : "transparent",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-[2px]">
                    <span
                      className="truncate text-[14px]"
                      style={{ fontWeight: active ? 600 : 400 }}
                    >
                      {label(b)}
                    </span>
                    <span
                      className="truncate"
                      style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}
                    >
                      {b.domain}
                    </span>
                  </span>
                  {active && <span style={{ color: "var(--ink)", fontSize: 13 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterBar({
  tab,
  platform,
  setPlatform,
}: {
  tab: Tab;
  platform: Platform;
  setPlatform: (p: Platform) => void;
}) {
  // Date range rides on the analytics tabs; the frequency lock (pro-only)
  // only belongs on Overview. The platform selector is global — it redefines
  // what every headline number means, so it shows on Settings too.
  const showDates = tab !== "settings";
  const showFrequency = tab === "overview";
  return (
    <div
      className="flex flex-wrap items-center gap-[8px] px-[20px] py-[14px] md:px-[28px]"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      {showDates && (
        <>
          <Chip>Last 7 days ⌄</Chip>
          <span style={{ fontSize: 13, color: "var(--dim)" }}>vs.</span>
          <Chip>Previous period ⌄</Chip>
        </>
      )}
      <div className="ml-auto flex items-center gap-[8px]">
        {showFrequency && <FrequencyLock />}
        <PlatformSegmented platform={platform} setPlatform={setPlatform} />
      </div>
    </div>
  );
}

/** Recurring scans are a pro feature — a locked indicator, no cadence shown yet. */
function FrequencyLock() {
  return (
    <span
      className="inline-flex items-center gap-[7px] whitespace-nowrap text-[13px]"
      style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px", color: "var(--mut)" }}
    >
      Frequency
      <Lock size={11} color="var(--dim)" />
    </span>
  );
}

/**
 * Single-select platform control. This is not a filter — the active choice
 * redefines the headline numbers on every tab. `All` blends the live platforms;
 * `ChatGPT`/`Claude` recompute for one model. Claude (and the blend that needs
 * it) are upgrade-gated on the free tier, so those views render a paywall.
 */
function PlatformSegmented({
  platform,
  setPlatform,
}: {
  platform: Platform;
  setPlatform: (p: Platform) => void;
}) {
  return (
    <div className="inline-flex items-center gap-[8px]">
      <span
        className="hidden sm:inline"
        style={{ fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
      >
        Platform
      </span>
      <div
        className="inline-flex"
        style={{ border: "1px solid var(--line)", background: "var(--panel)" }}
      >
        {PLATFORM_OPTIONS.map((opt, i) => {
          const active = platform === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPlatform(opt.id)}
              aria-pressed={active}
              className="inline-flex items-center gap-[6px] whitespace-nowrap text-[13px]"
              style={{
                padding: "7px 12px",
                borderLeft: i > 0 ? "1px solid var(--line)" : undefined,
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--panel)" : "var(--mut)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {opt.id !== "all" && (
                <PlatformLogo name={opt.label} color={active ? "var(--panel)" : undefined} />
              )}
              {opt.label}
              {opt.lockGlyph && (
                <Lock size={11} color={active ? "var(--panel)" : "var(--dim)"} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlatformLogo({
  name,
  color,
  size = 16,
}: {
  name: string;
  /** Override the brand colour — e.g. to stay legible on an active segment. */
  color?: string;
  size?: number;
}) {
  const m = AI_MODELS.find((x) => x.name === name);
  if (!m) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color ?? MODEL_COLOR[name] ?? "var(--ink)"}
      style={{ flex: "none" }}
      aria-hidden="true"
    >
      <path d={m.path} />
    </svg>
  );
}

/** Padlock glyph, tinted with the given colour. Used on gated affordances. */
function Lock({ size = 12, color = "var(--dim)" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      style={{ flex: "none" }}
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap text-[13px]"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        padding: "7px 12px",
      }}
    >
      {children}
    </span>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Delta({ v, size = 12 }: { v: string; size?: number }) {
  // A one-time scan has no history, so there's no % change to show (the format
  // layer emits DASH). Deltas reappear on their own once recurring scans exist.
  if (v === DASH) return null;
  return (
    <span style={{ fontFamily: MONO, fontSize: size, color: toneVar(tone(v)) }}>
      {v}
    </span>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: SANS,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--dim)",
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {sub && <span style={{ fontSize: 13.5, color: "var(--mut)" }}>{sub}</span>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{ border: "1px solid var(--line)", background: "var(--panel)" }}
    >
      {children}
    </div>
  );
}

// ── Paywall ──────────────────────────────────────────────────────────────────
/**
 * Free tier ships ChatGPT live. Selecting Claude (or the blended All view that
 * would average it in) swaps the whole section for this panel — the paywall is
 * meant to be obvious, never a silently-blended number. Copy differs by intent:
 * `claude` sells the second platform, `blend` sells the cross-platform view.
 */
const UPGRADE_COPY = {
  claude: {
    label: "Claude · locked",
    title: "See how you show up in Claude",
    body: "ChatGPT is live on your free plan. Unlock Claude for its own visibility score, competitor rank and citation share — plus the exact prompts where Claude names you or leaves you out.",
    cta: "Upgrade to unlock Claude",
    bullets: [
      "Claude visibility score, rank and citations",
      "Per-prompt answers, straight from Claude",
      "See where ChatGPT and Claude disagree",
    ],
  },
  blend: {
    label: "Blended view · locked",
    title: "Blend every platform into one score",
    body: "The All view averages your live platforms into a single cross-platform visibility score. Add Claude to blend it with ChatGPT — and watch where the two diverge over time.",
    cta: "Upgrade to add Claude",
    bullets: [
      "One blended score across ChatGPT + Claude",
      "Competitor ranks that combine both platforms",
      "Divergence over time, ChatGPT vs Claude",
    ],
  },
} as const;

const tileStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--line)",
  background: "var(--panel2)",
};

function PlatformPair() {
  return (
    <span className="inline-flex items-center gap-[14px]">
      <span style={tileStyle}>
        <PlatformLogo name="ChatGPT" size={22} />
      </span>
      <span style={{ fontFamily: MONO, fontSize: 16, color: "var(--dim)" }}>+</span>
      <span style={{ ...tileStyle, position: "relative" }}>
        <PlatformLogo name="Claude" size={22} />
        <span
          style={{
            position: "absolute",
            right: -7,
            bottom: -7,
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: 3,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Lock size={10} color="var(--ink)" />
        </span>
      </span>
    </span>
  );
}

function UpgradePanel({ variant }: { variant: "claude" | "blend" }) {
  const c = UPGRADE_COPY[variant];
  return (
    <Card className="mx-auto flex max-w-[640px] flex-col items-center gap-[22px] p-[40px_28px_44px] text-center md:p-[56px_48px]">
      <PlatformPair />
      <div className="flex flex-col items-center gap-[10px]">
        <span className="inline-flex items-center gap-[7px]">
          <Lock size={11} color="var(--dim)" />
          <MonoLabel>{c.label}</MonoLabel>
        </span>
        <h2
          className="max-w-[18ch]"
          style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.12 }}
        >
          {c.title}
        </h2>
        <p className="max-w-[46ch] text-[15px]" style={{ color: "var(--mut)", lineHeight: 1.55 }}>
          {c.body}
        </p>
      </div>
      <ul className="flex flex-col gap-[9px] text-left">
        {c.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-[10px] text-[14px]"
            style={{ color: "var(--ink)" }}
          >
            <span aria-hidden="true" style={{ color: "var(--pos)", flex: "none", fontWeight: 700 }}>
              ✓
            </span>
            {b}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-[4px] h-[50px] px-[28px] text-[15px]"
        style={{ background: "var(--ink)", color: "var(--panel)", fontWeight: 700 }}
      >
        {c.cta}
      </button>
    </Card>
  );
}

/**
 * Compact inline lock used where a Claude row/column/line would otherwise sit
 * inside an otherwise-live ChatGPT view. Clicking it jumps to the Claude view,
 * i.e. the full upgrade panel.
 */
// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({
  data,
  brand,
  platform,
}: {
  data: DashboardData;
  brand: BrandLite | null;
  platform: Platform;
}) {
  // The blended `all` view and the Claude view both need paid Claude data.
  if (isLocked(platform)) {
    return <UpgradePanel variant={platform === "all" ? "blend" : "claude"} />;
  }
  const brandName = brand?.name?.trim() || brand?.domain || BRAND.name;
  return (
    <div className="flex flex-col gap-[30px]">
      <section className="flex flex-col gap-[14px]">
        <SectionHead
          title="Visibility score"
          sub={`How often ${brandName} appears in AI-generated answers`}
        />
        <Card className="grid md:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-[16px] p-[22px_24px]" style={{ borderBottom: "1px solid var(--line)" }}>
            <MonoLabel>Visibility score</MonoLabel>
            <div className="flex flex-wrap items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {data.visibility.score}
              </span>
              <Delta v={data.visibility.delta} size={14} />
              <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{data.visibility.detail}</span>
            </div>
            <Chart v={data.visibility} />
            <div className="flex items-center gap-[22px] pt-[4px]">
              <Legend color="var(--pos)" label="Current period" />
              <Legend color="var(--dim)" label="Previous period" dashed />
            </div>
          </div>
          <div className="flex flex-col gap-[16px] p-[22px_24px] md:border-l" style={{ borderColor: "var(--line)" }}>
            <MonoLabel>Visibility rank</MonoLabel>
            <div className="flex items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {data.rank.value}
              </span>
              <Delta v={data.rank.delta} size={14} />
            </div>
            <div
              className="flex items-center justify-between pb-[8px]"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
            >
              <span>Brand</span>
              <span>Visibility</span>
            </div>
            <div className="flex flex-col">
              {data.rank.rows.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-[12px] py-[10px]"
                  style={{ borderBottom: "1px solid var(--line)", fontWeight: r.you ? 700 : 400 }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", width: 14 }}>{r.i}.</span>
                  <span className="flex flex-1 items-center gap-[8px] text-[14px]">
                    {r.name}
                    {r.you && (
                      <span
                        style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, background: "var(--grn)", color: "#14170f", padding: "3px 7px" }}
                      >
                        Monitored
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 13.5 }}>{r.vis}</span>
                  <span className="text-right" style={{ width: 46 }}>
                    <Delta v={r.delta} size={12} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <CitationSection data={data} brand={brand} />
    </div>
  );
}

function Legend({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  /** Match the chart: the previous-period line is drawn dashed. */
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-[8px]" style={{ fontSize: 12.5, color: "var(--mut)" }}>
      <span
        style={
          dashed
            ? { width: 14, height: 0, borderTop: `2px dashed ${color}`, display: "block" }
            : { width: 14, height: 2, background: color, display: "block" }
        }
      />
      {label}
    </span>
  );
}

function Chart({ v }: { v: ChartInput }) {
  const V = v;
  return (
    <div className="flex gap-[12px]">
      <div className="flex flex-col justify-between py-[2px]" style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
        {V.yLabels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox="0 0 620 190" preserveAspectRatio="none" className="block h-[130px] w-full md:h-[190px]">
          {V.gridlines.map((y) => (
            <line key={y} x1="0" y1={y} x2="620" y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
          ))}
          <line x1="0" y1={V.baseline} x2="620" y2={V.baseline} stroke="var(--line)" strokeWidth="1" />
          <polyline points={V.current} fill="none" stroke="var(--pos)" strokeWidth="2" />
          <polyline points={V.previous} fill="none" stroke="var(--dim)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx={V.endDot.cx} cy={V.endDot.cy} r="3.5" fill="var(--pos)" />
        </svg>
        <div className="flex justify-between pt-[8px]" style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
          {V.xLabels.map((l, i) => (
            <span key={l} className={i === 1 || i === 4 ? "hidden md:inline" : ""}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Citations ────────────────────────────────────────────────────────────────
function CitationSection({
  data,
  brand,
}: {
  data: DashboardData;
  brand: BrandLite | null;
}) {
  const [open, setOpen] = useState<number>(-1);
  const brandUrl = brand?.domain || BRAND.url;
  return (
    <section className="flex flex-col gap-[14px]">
      <SectionHead
        title="Citation share"
        sub={`How often ${brandUrl} is cited by AI-generated answers`}
      />
        <Card className="grid md:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-[16px] p-[22px_24px]" style={{ borderBottom: "1px solid var(--line)" }}>
            <MonoLabel>Citation share</MonoLabel>
            <div className="flex flex-wrap items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {data.citation.score}
              </span>
              <Delta v={data.citation.delta} size={14} />
              <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{data.citation.detail}</span>
            </div>
            <Chart v={data.citation} />
            <div className="flex items-center gap-[22px] pt-[4px]">
              <Legend color="var(--pos)" label="Current period" />
              <Legend color="var(--dim)" label="Previous period" dashed />
            </div>
          </div>

          <div className="flex flex-col gap-[16px] p-[22px_24px] md:border-l" style={{ borderColor: "var(--line)" }}>
            <MonoLabel>Citation rank</MonoLabel>
            <div className="flex items-baseline gap-[12px]">
              <span
                style={{
                  fontSize: data.citationRank.ranked ? 40 : 22,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                }}
              >
                {data.citationRank.value}
              </span>
              <Delta v={data.citationRank.delta} size={14} />
            </div>
            <div
              className="flex items-center justify-between pb-[8px]"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
            >
              <span>Domain</span>
              <span>Share</span>
            </div>
            <div className="flex flex-col">
              {data.citationRank.rows.map((d) => (
                <CitationRow
                  key={d.domain}
                  d={d}
                  open={open === d.i}
                  onToggle={() => setOpen(open === d.i ? -1 : d.i)}
                />
              ))}
            </div>
          </div>
        </Card>
    </section>
  );
}

function CitationRow({
  d,
  open,
  onToggle,
}: {
  d: CitationDomain;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-[12px] py-[10px] text-left"
      >
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", width: 16 }}>{d.i}.</span>
        <span className="flex flex-1 items-center gap-[8px] text-[14px]" style={{ fontWeight: d.owned ? 700 : 400 }}>
          <span className="truncate">{d.domain}</span>
          {d.owned && (
            <span
              style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, background: "var(--grn)", color: "#14170f", padding: "3px 7px", flex: "none" }}
            >
              Monitored
            </span>
          )}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 13.5 }}>{d.share}</span>
        <span className="text-right" style={{ width: 46 }}>
          <Delta v={d.delta} size={12} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", width: 10 }}>
          {open ? "⌄" : "›"}
        </span>
      </button>
      {open && <DomainPages pages={d.pages} />}
    </div>
  );
}

function DomainPages({ pages }: { pages: CitationPage[] }) {
  return (
    <div className="mb-[10px] flex flex-col" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
      <div
        className="grid grid-cols-[1fr_100px] gap-[10px] px-[14px] py-[8px]"
        style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
      >
        <span>Page</span>
        <span className="text-right">Share</span>
      </div>
      {pages.map((p, i) => (
        <div
          key={p.url}
          className="grid grid-cols-[1fr_100px] items-baseline gap-[10px] px-[14px] py-[10px]"
          style={{ borderBottom: i < pages.length - 1 ? "1px solid var(--line)" : undefined }}
        >
          <span className="min-w-0 truncate text-[13px]" title={p.url}>{p.url}</span>
          <span className="whitespace-nowrap text-right">
            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{p.share}</span>{" "}
            <Delta v={p.dShare} size={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Prompts ──────────────────────────────────────────────────────────────────
/** Resolve a `gi:pi` prompt id from the URL to its prompt + owning topic. */
function resolvePrompt(
  id: string | null,
  groups: Group[],
): { p: Prompt; groupName: string } | null {
  if (!id) return null;
  const [gi, pi] = id.split(":").map(Number);
  const g = groups[gi];
  const p = g?.items[pi];
  if (!g || !p) return null;
  return { p, groupName: g.name };
}

function Prompts({
  data,
  platform,
  brandId,
  brandName,
  onUpgrade,
}: {
  data: DashboardData;
  platform: Platform;
  brandId: string | null;
  brandName: string;
  onUpgrade: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [openGroups, setOpenGroups] = useState<number[]>([0]);

  const toggleGroup = (gi: number) =>
    setOpenGroups((g) => (g.includes(gi) ? g.filter((x) => x !== gi) : [...g, gi]));

  // Claude / blended views are gated; the per-platform side-by-side lives in the
  // (unlocked) ChatGPT view, where a prompt opens its own detail page.
  if (isLocked(platform)) {
    return <UpgradePanel variant={platform === "all" ? "blend" : "claude"} />;
  }

  // The selected prompt lives in the URL (`&prompt=gi:pi`) so the Prompts tab
  // stays highlighted and the detail view is shareable / survives reload.
  // Keep the current brand in the URL — otherwise navigating to a prompt drops
  // ?brand= and the dashboard falls back to the newest brand (showing the wrong
  // brand's prompt). See the brand resolution in Dashboard().
  const base = `/ai-search/dashboard?tab=prompts&platform=${platform}${
    brandId ? `&brand=${brandId}` : ""
  }`;
  const selected = resolvePrompt(params.get("prompt"), data.groups);
  const openPrompt = (id: string) =>
    router.replace(`${base}&prompt=${id}`, { scroll: false });
  const backToList = () => router.replace(base, { scroll: false });

  if (selected) {
    return (
      <PromptDetailView
        p={selected.p}
        groupName={selected.groupName}
        brandName={brandName}
        onBack={backToList}
        onUpgrade={onUpgrade}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Monitored prompts</h2>
      <Card>
        <div
          className={`hidden px-[24px] py-[12px] md:grid ${COLS}`}
          style={{ background: "var(--panel2)", borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
        >
          <span>Topic</span>
          <span>Visibility rank</span>
          <span>Visibility score</span>
          <span>Average position</span>
          <span>Citation share</span>
        </div>

        {data.groups.map((g, gi) => (
          <GroupBlock
            key={g.name}
            g={g}
            gi={gi}
            openGroup={openGroups.includes(gi)}
            toggleGroup={() => toggleGroup(gi)}
            onSelectPrompt={openPrompt}
          />
        ))}
      </Card>
    </div>
  );
}

function GroupBlock({
  g,
  gi,
  openGroup,
  toggleGroup,
  onSelectPrompt,
}: {
  g: Group;
  gi: number;
  openGroup: boolean;
  toggleGroup: () => void;
  onSelectPrompt: (id: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={toggleGroup}
        className={`w-full px-[24px] py-[14px] text-left ${COLS}`}
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="flex items-center gap-[10px]">
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", width: 10 }}>{openGroup ? "⌄" : "›"}</span>
          <span className="flex flex-col">
            <span style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{g.count}</span>
          </span>
        </span>
        <MetricCells rank={g.rank} score={g.score} dScore={g.dScore} pos={g.pos} dPos={g.dPos} cite={g.cite} dCite={g.dCite} strong />
      </button>

      {openGroup &&
        g.items.map((p, pi) => {
          const id = `${gi}:${pi}`;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectPrompt(id)}
              className={`w-full px-[24px] py-[14px] text-left md:pl-[58px] ${COLS}`}
              style={{ background: "var(--panel2)", borderBottom: "1px solid var(--line)" }}
            >
              <span className="flex items-center gap-[8px] text-[14px]">
                {p.q}
                <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--dim)" }} aria-hidden="true">›</span>
              </span>
              <MetricCells rank={p.rank} score={p.score} dScore={p.dScore} pos={p.pos} dPos={p.dPos} cite={p.cite} dCite={p.dCite} />
            </button>
          );
        })}
    </div>
  );
}

function MetricCells({
  rank,
  score,
  dScore,
  pos,
  dPos,
  cite,
  dCite,
  strong = false,
}: {
  rank: string;
  score: string;
  dScore: string;
  pos: string;
  dPos: string;
  cite: string;
  dCite: string;
  strong?: boolean;
}) {
  return (
    <div className="mt-[10px] grid grid-cols-2 gap-[10px] md:mt-0 md:contents">
      <Cell label="Rank">
        <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: strong ? 700 : 400 }}>{rank}</span>
      </Cell>
      <Cell label="Score">
        <span style={{ fontFamily: MONO, fontSize: 13 }}>{score}</span> <Delta v={dScore} size={11.5} />
      </Cell>
      <Cell label="Pos">
        <span style={{ fontFamily: MONO, fontSize: 13 }}>{pos}</span> <Delta v={dPos} size={11.5} />
      </Cell>
      <Cell label="Cites">
        <span style={{ fontFamily: MONO, fontSize: 13 }}>{cite}</span> <Delta v={dCite} size={11.5} />
      </Cell>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-[2px] md:block">
      <span
        className="md:hidden"
        style={{ fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}
      >
        {label}
      </span>
      <span>{children}</span>
    </span>
  );
}

/**
 * Full detail page for one prompt — replaces the list while the Prompts tab
 * stays selected. Leads with the per-platform scores (ChatGPT live, Claude
 * locked), then the verbatim answer with the brand mention highlighted.
 */
function PromptDetailView({
  p,
  groupName,
  brandName,
  onBack,
  onUpgrade,
}: {
  p: Prompt;
  groupName: string;
  brandName: string;
  onBack: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div className="flex flex-col gap-[22px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-[7px] self-start text-[13px]"
        style={{ color: "var(--mut)" }}
      >
        ← Back to prompts
      </button>

      <div className="flex flex-col gap-[8px]">
        <MonoLabel>{groupName}</MonoLabel>
        <h2
          className="max-w-[40ch]"
          style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}
        >
          {p.q}
        </h2>
      </div>

      {/* Per-platform scores, side by side — not just the combined figure. */}
      <div>
        <MonoLabel>Score by platform</MonoLabel>
        <div className="mt-[10px] grid gap-[12px] sm:grid-cols-2 lg:max-w-[560px]">
          <PlatformScoreCard p={p} />
          <ClaudeScoreLock onUpgrade={onUpgrade} />
        </div>
      </div>

      <Card className="grid gap-[30px] p-[22px_24px_26px] md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-[10px]">
          <MonoLabel>Answer · {p.platform}</MonoLabel>
          <div className="max-w-[80ch] text-[14.5px]" style={{ lineHeight: 1.65, color: "var(--ink)" }}>
            <AnswerMarkdown text={p.answer} highlight={p.highlight} />
          </div>
          {p.answer.trim() === "" ? (
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>
              This prompt didn’t return an answer in the last scan.
            </span>
          ) : !p.highlight ? (
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>
              {brandName} was not named in this answer.
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-[6px]">
            <MonoLabel>Brands mentioned</MonoLabel>
            <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--mut)" }}>{p.brands}</span>
          </div>
          <div className="flex flex-col gap-[6px]">
            <MonoLabel>Cited sources</MonoLabel>
            <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--mut)" }}>{p.cites}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** ChatGPT's per-prompt metrics — the live, unlocked platform. */
function PlatformScoreCard({ p }: { p: Prompt }) {
  const cells: [string, React.ReactNode][] = [
    ["Rank", <span key="r" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{p.rank}</span>],
    ["Score", <span key="s"><span style={{ fontFamily: MONO, fontSize: 13 }}>{p.score}</span> <Delta v={p.dScore} size={11} /></span>],
    ["Pos", <span key="p"><span style={{ fontFamily: MONO, fontSize: 13 }}>{p.pos}</span> <Delta v={p.dPos} size={11} /></span>],
    ["Cites", <span key="c"><span style={{ fontFamily: MONO, fontSize: 13 }}>{p.cite}</span> <Delta v={p.dCite} size={11} /></span>],
  ];
  return (
    <div style={{ border: "1px solid var(--line)", background: "var(--panel2)" }}>
      <div
        className="flex items-center gap-[8px] px-[14px] py-[10px]"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <PlatformLogo name="ChatGPT" size={15} />
        <span className="text-[13px] font-bold">ChatGPT</span>
      </div>
      <div className="grid grid-cols-2 gap-[10px] p-[12px_14px]">
        {cells.map(([label, node]) => (
          <span key={label} className="flex flex-col gap-[3px]">
            <span style={{ fontFamily: SANS, fontSize: 11, color: "var(--dim)" }}>
              {label}
            </span>
            {node}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Locked Claude column — the paywall, in-context next to ChatGPT's scores. */
function ClaudeScoreLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ border: "1px solid var(--line)", background: "var(--panel2)" }}>
      <div
        className="flex items-center gap-[8px] px-[14px] py-[10px]"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <PlatformLogo name="Claude" size={15} />
        <span className="text-[13px] font-bold" style={{ color: "var(--mut)" }}>Claude</span>
        <Lock size={12} color="var(--dim)" />
      </div>
      <div className="flex flex-col items-start gap-[8px] p-[12px_14px]">
        <span className="text-[12.5px]" style={{ color: "var(--mut)", lineHeight: 1.5 }}>
          Unlock Claude to see its answer to this prompt and how it scores you.
        </span>
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex items-center gap-[6px] text-[12px]"
          style={{ fontFamily: MONO, color: "var(--ink)", borderBottom: "1px solid var(--ink)", paddingBottom: 1 }}
        >
          Unlock Claude →
        </button>
      </div>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function Settings({
  brand,
  data,
  onUpgrade,
}: {
  brand: BrandLite | null;
  data: DashboardData;
  platform: Platform;
  onUpgrade: () => void;
}) {
  const allPrompts = data.groups.flatMap((g) => g.items.map((p) => p.q));
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="grid gap-[20px] md:grid-cols-2">
        <Card className="flex flex-col gap-[16px] p-[22px_24px]">
          <SectionHead title="Brand" />
          <ReadonlyField label="Name" value={brand?.name?.trim() || brand?.domain || BRAND.name} />
          <ReadonlyField label="Website" value={brand?.domain || BRAND.url} />
        </Card>

        <Card className="flex flex-col p-[22px_24px]">
          <SectionHead title="Platforms & schedule" />
          <div className="mt-[16px] flex flex-col">
            {PLATFORMS.map((pl) => (
              <div
                key={pl.name}
                className="flex items-center justify-between gap-[12px] py-[12px]"
                style={{
                  borderBottom: "1px solid var(--line)",
                  color: pl.dim ? "var(--dim)" : pl.locked ? "var(--mut)" : "var(--ink)",
                }}
              >
                <span className="flex items-center gap-[9px] text-[14px]">
                  {!pl.dim && <PlatformLogo name={pl.name} size={15} />}
                  {pl.name}
                </span>
                {pl.locked ? (
                  <UpgradeButton onUpgrade={onUpgrade} />
                ) : (
                  <StatusChip>{pl.status}</StatusChip>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between gap-[12px] py-[12px]">
              <span className="text-[14px]">Scan cadence</span>
              <UpgradeButton onUpgrade={onUpgrade} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-[16px] p-[22px_24px]">
        <div className="flex flex-wrap items-start justify-between gap-[12px]">
          <SectionHead title="Monitored prompts" sub="Add, remove or edit your prompts." />
          <span
            className="inline-flex items-center whitespace-nowrap text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px" }}
          >
            + Add prompt
          </span>
        </div>
        <div className="grid gap-x-[24px] gap-y-[13px] md:grid-cols-3">
          {allPrompts.map((q, i) => (
            <span key={i} className="text-[14px]" style={{ color: "var(--mut)" }}>
              {q}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <MonoLabel>{label}</MonoLabel>
      <div
        className="flex h-[44px] items-center px-[14px] text-[14px]"
        style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Pro-only upgrade CTA — shared by the Claude and scan-cadence rows. */
function UpgradeButton({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="inline-flex items-center gap-[6px] whitespace-nowrap"
      style={{ fontFamily: MONO, fontSize: 11, background: "var(--ink)", color: "var(--panel)", padding: "5px 10px" }}
    >
      <Lock size={11} color="var(--panel)" />
      Upgrade
    </button>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{ fontFamily: MONO, fontSize: 11, border: "1px solid var(--line)", padding: "5px 9px" }}
    >
      {children}
    </span>
  );
}

// ── Mobile tab bar ───────────────────────────────────────────────────────────
function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const item = (t: Tab, label: string, icon: React.ReactNode) => {
    const active = tab === t;
    return (
      <button
        type="button"
        onClick={() => setTab(t)}
        className="flex flex-1 flex-col items-center gap-[6px] pt-[12px] pb-[16px]"
        style={{ color: active ? "var(--ink)" : "var(--mut)" }}
      >
        <span style={{ width: 18, height: 18, display: "grid", placeItems: "center" }}>{icon}</span>
        <span className="text-[12px]">{label}</span>
      </button>
    );
  };
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex md:hidden"
      style={{ background: "var(--panel)", borderTop: "1px solid var(--line)" }}
    >
      {item("overview", "Overview", <OverviewIcon />)}
      {item("prompts", "Prompts", <PromptsIcon />)}
      {item("settings", "Settings", <SettingsIcon />)}
    </nav>
  );
}

function OverviewIcon() {
  return (
    <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 18, height: 18 }}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ background: "currentColor" }} />
      ))}
    </span>
  );
}

function PromptsIcon() {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 3, width: 18 }}>
      {[18, 13, 16].map((w, i) => (
        <span key={i} style={{ height: 3, width: w, background: "currentColor" }} />
      ))}
    </span>
  );
}

function SettingsIcon() {
  return (
    <span style={{ position: "relative", width: 18, height: 18, display: "block" }}>
      {[0, 45, 90, 135].map((deg) => (
        <span
          key={deg}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 18,
            height: 6,
            background: "currentColor",
            transform: `translate(-50%,-50%) rotate(${deg}deg)`,
          }}
        />
      ))}
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "currentColor",
          transform: "translate(-50%,-50%)",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "var(--panel)",
          transform: "translate(-50%,-50%)",
        }}
      />
    </span>
  );
}

// ── Subscribe gate ───────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const gateField =
  "h-[52px] w-full px-[16px] text-[17px] placeholder:text-[var(--dim)] md:h-[58px] md:flex-1";
const gateBtn = "h-[52px] shrink-0 px-[26px] text-[17px] md:h-[58px]";
const gateInputStyle: React.CSSProperties = {
  background: "var(--panel2)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
};
const gateBtnStyle: React.CSSProperties = {
  background: "#14170f",
  color: "#eef1ec",
  fontWeight: 700,
};

/**
 * The gate is the AI-search sign-up: a two-step email-OTP flow. On verify it
 * posts source "ai-search" plus the site data collected during onboarding, then
 * reveals the dashboard. Real auth + Resend automation, same endpoints as the
 * rest of the site.
 */
function Gate({ onEnter }: { onEnter: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const invalid = status === "error";
  const submitting = status === "submitting";
  const fail = (m: string) => {
    setStatus("error");
    setError(m);
  };

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return fail("Enter a valid email address.");
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return fail(data.error ?? "Something went wrong. Try again.");
      capture("signin_code_requested", { source: "ai-search" });
      setEmail(value);
      setStep("code");
      setStatus("idle");
    } catch {
      fail("Network error. Please try again.");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const value = code.trim();
    if (!/^\d{6}$/.test(value))
      return fail("Enter the 6-digit code from your email.");
    setStatus("submitting");
    setError(null);
    try {
      const site = readOnboarding();
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          token: value,
          source: "ai-search",
          brandId: site.brandId,
          topics: site.topics,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return fail(data.error ?? "Something went wrong. Try again.");

      // Identify at signup, matching the landing OtpForm — this sign-in runs
      // server-side, so PostHogAuth won't catch it until the next page load.
      // Analytics must never block entry, so failures here are swallowed.
      try {
        const { data: auth } = await createClient().auth.getUser();
        if (auth.user) identifyUser(auth.user.id, auth.user.email ?? email.trim());
      } catch {
        /* ignore */
      }
      capture("signin_completed", { source: "ai-search" });

      clearOnboarding();
      onEnter();
    } catch {
      fail("Network error. Please try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-[16px] md:p-[60px]"
      style={{ background: "rgba(8,10,9,0.62)" }}
    >
      <div
        className="w-full max-w-[660px]"
        style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
      >
        <div className="flex flex-col gap-[10px] p-[28px_36px_0]">
          <MonoLabel>Almost there…</MonoLabel>
          <h3 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.035em", textWrap: "pretty" }}>
            Subscribe to Agent-led Growth and win in AI discovery.
          </h3>
        </div>

        {step === "email" ? (
          <form onSubmit={requestCode} className="flex flex-col gap-[24px] p-[18px_36px_30px]">
            <div className="flex flex-col gap-[12px] text-[15px]" style={{ lineHeight: 1.5 }}>
              <span>— Measure how often AI recommends your brand</span>
              <span>— Benchmark your visibility against competitors</span>
              <span>— Identify the prompts where you are winning or being left out</span>
            </div>
            <div style={{ height: 1, background: "var(--line)" }} />
            <div className="flex flex-col gap-[10px] md:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (invalid) setStatus("idle");
                }}
                placeholder="you@company.com"
                autoComplete="email"
                disabled={submitting}
                className={gateField}
                style={gateInputStyle}
              />
              <button type="submit" disabled={submitting} className={gateBtn} style={gateBtnStyle}>
                {submitting ? "Sending…" : "View scan"}
              </button>
            </div>
            {invalid && error ? (
              <GateError>{error}</GateError>
            ) : (
              <span style={{ fontSize: 13.5, color: "var(--mut)" }}>
                You&rsquo;ll also receive weekly insights, experiments, and tools for growing in the age of AI.
              </span>
            )}
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-[20px] p-[18px_36px_30px]">
            <span style={{ fontSize: 15, color: "var(--mut)", lineHeight: 1.5 }}>
              We sent a 6-digit code to {email}.
            </span>
            <div className="flex flex-col gap-[10px] md:flex-row">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (invalid) setStatus("idle");
                }}
                placeholder="123456"
                autoFocus
                disabled={submitting}
                className={`${gateField} font-mono tracking-[0.4em]`}
                style={gateInputStyle}
              />
              <button type="submit" disabled={submitting} className={gateBtn} style={gateBtnStyle}>
                {submitting ? "Verifying…" : "View scan"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setStatus("idle");
                setError(null);
              }}
              className="self-start text-[14px]"
              style={{ color: "var(--mut)" }}
            >
              ← Use a different email
            </button>
            {invalid && error ? <GateError>{error}</GateError> : null}
          </form>
        )}
      </div>
    </div>
  );
}

function GateError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" style={{ fontFamily: MONO, fontSize: 12, color: "var(--neg)" }}>
      {children}
    </span>
  );
}
