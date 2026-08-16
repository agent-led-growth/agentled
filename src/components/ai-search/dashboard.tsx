"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { capture, identifyUser } from "@/lib/analytics";
import type { BrandMetrics, PromptAnswer } from "@/lib/laurel/metrics";
import { brandLimit, isDaily, isPaid, planLabel } from "@/lib/plan";
import { createClient } from "@/lib/supabase/client";

import { AnswerMarkdown } from "./answer-markdown";
import { Mark, Wordmark } from "./brand";
import {
  BRAND,
  PLATFORMS,
  tone,
  type ChartInput,
  type CitationDomain,
  type Group,
  type Platform,
  type Prompt,
} from "./fixtures";
import { DASH, formatMetrics, shortDate, type DashboardData } from "./format";
import { AI_MODELS, MODEL_COLOR } from "./model-marks";
import { clearOnboarding, readOnboarding } from "./onboarding-store";
import { PromptsManager } from "./prompts-manager";
import { MONO, SANS, appTokens, toneVar } from "./tokens";

type Tab = "overview" | "settings" | "account";
const TABS: Tab[] = ["overview", "settings", "account"];
// Sections within the combined main view — the left-nav jump targets.
type Section = "visibility" | "citations" | "prompts";
const SECTIONS: Section[] = ["visibility", "citations", "prompts"];

/** Single source of truth for dashboard URLs (encoding handled by URLSearchParams). */
function dashHref(opts: {
  tab?: Tab;
  platform: Platform;
  brandId: string | null;
  prompt?: string;
  citation?: string;
}): string {
  const p = new URLSearchParams();
  p.set("tab", opts.tab ?? "overview");
  p.set("platform", opts.platform);
  if (opts.brandId) p.set("brand", opts.brandId);
  if (opts.prompt) p.set("prompt", opts.prompt);
  if (opts.citation) p.set("citation", opts.citation);
  return `/ai-search/dashboard?${p.toString()}`;
}

/** Scroll to a section. Visibility goes to the very top so the header bars stay
 *  visible; other sections align to the top. Works desktop (scroll container)
 *  and mobile (window). */
function scrollToSection(section: Section, container: HTMLElement | null) {
  if (section === "visibility") {
    container?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
const PLATFORM_IDS: Platform[] = ["chatgpt"];

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
  const [plan, setPlan] = useState<string>("free");
  const [email, setEmail] = useState<string | null>(null); // for the Account view
  const [hasBilling, setHasBilling] = useState(false); // account has a Stripe customer
  const [planReady, setPlanReady] = useState(false); // brands/plan/email loaded
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<Range>("7d"); // trend date window
  // Bumped by the "try again" action on a failed scan to re-run the effect.
  const [retryNonce, setRetryNonce] = useState(0);
  // Left nav is a jump-nav over the combined view: the section in view
  // (scroll-spy) and a one-shot scroll target after navigating back to it.
  const [activeSection, setActiveSection] = useState<Section>("visibility");
  const [pendingScroll, setPendingScroll] = useState<Section | null>(null);
  const [showBrandLimit, setShowBrandLimit] = useState(false); // "+ New brand" over the cap
  const scrollRef = useRef<HTMLDivElement>(null); // the desktop scroll container
  const jumpingRef = useRef(false); // suppress scroll-spy during a programmatic jump

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
      .then(
        (d: {
          brands?: BrandLite[];
          plan?: string;
          email?: string | null;
          hasBilling?: boolean;
        }) => {
          setBrands(d.brands ?? []);
          setPlan(d.plan ?? "free");
          setEmail(d.email ?? null);
          setHasBilling(Boolean(d.hasBilling));
          setPlanReady(true);
        },
      )
      .catch(() => setPlanReady(true));
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
        let payload = await fetchMetrics(currentBrandId, range);
        if (!active) return;
        // A previously-failed scan shows an error and waits for a manual retry —
        // never auto-re-fires (that would loop on a brand that can't scan).
        if (!payload.scannedAt && !payload.failed) {
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
          payload = await pollUntilScanned(currentBrandId, () => active, range);
          if (!active) return;
        }
        if (payload.scannedAt && payload.metrics && payload.metrics.answers > 0) {
          setData(formatMetrics(payload.metrics));
          setScanState("ready");
        } else if (payload.scannedAt) {
          setScanState("empty"); // scan finished, nothing to report
        } else if (payload.failed) {
          setScanState("error"); // the run gave up (recorded in the DB)
        } else {
          setScanState("slow"); // still running past the poll window
        }
      } catch {
        if (active) setScanState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [checked, gated, currentBrandId, retryNonce, range]);

  // Opening a detail view (a prompt's answer or a citation's pages) should start
  // at the top. It's a client transition over a scrolled list, so the scroll
  // position otherwise carries over and the new view opens part-way down.
  const detailKey = params.get("prompt") ?? params.get("citation");
  useEffect(() => {
    if (!detailKey) return;
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [detailKey]);

  // "Try again" on a failed scan: re-run scan/run (claiming clears the failure
  // and re-enqueues), then re-run the effect to poll the fresh attempt.
  const retryScan = () => {
    if (!currentBrandId) return;
    void fetch("/api/ai-search/scan/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: currentBrandId }),
    })
      .catch(() => {})
      .finally(() => setRetryNonce((n) => n + 1));
  };

  // Both tab and platform live in the URL, so a reload keeps the view and a
  // link is shareable. Each setter preserves the other's value.
  const go = (next: { tab?: Tab; platform?: Platform; brand?: string }) => {
    router.replace(
      dashHref({
        tab: next.tab ?? tab,
        platform: next.platform ?? platform,
        brandId: next.brand ?? brandId,
      }),
      { scroll: false },
    );
  };
  const setTab = (t: Tab) => go({ tab: t });
  const setBrand = (id: string) => go({ brand: id });
  // Adding a brand is gated by the plan's brand allowance: room left → onboard a
  // new brand; at the limit → show the upgrade modal (only Business, with 3
  // brands, can hold more than one).
  const goNewBrand = () =>
    brands.length < brandLimit(plan)
      ? router.push("/ai-search/onboarding")
      : setShowBrandLimit(true);
  // Real sign-out: clear the Supabase session first, then leave the (gated)
  // dashboard. Previously this only navigated, so the user stayed signed in.
  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/ai-search");
    router.refresh();
  };

  // ── Combined-view jump navigation ─────────────────────────────────────────
  // The section anchors only exist when the combined view is showing them (not
  // Settings, a detail page, or the scan notice).
  const showSections =
    tab === "overview" &&
    scanState === "ready" &&
    !!data &&
    !params.get("prompt") &&
    !params.get("citation");

  // Jump to a section; if a detail page or Settings is open, return to the
  // combined view first and finish the scroll once it renders (pendingScroll).
  const jumpTo = (section: Section) => {
    setActiveSection(section);
    // Suppress scroll-spy while the programmatic scroll animates so the
    // highlight doesn't flicker through the sections we pass.
    jumpingRef.current = true;
    window.setTimeout(() => {
      jumpingRef.current = false;
    }, 700);
    if (showSections) {
      scrollToSection(section, scrollRef.current);
    } else {
      // A detail page or Settings is open — return to a clean combined view
      // (explicitly, not via go()), then finish the scroll once it paints.
      setPendingScroll(section);
      router.replace(dashHref({ platform, brandId }), { scroll: false });
    }
  };

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    if (gated || !showSections) return;
    const els = SECTIONS.map((s) => document.getElementById(s)).filter(
      (e): e is HTMLElement => e != null,
    );
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (jumpingRef.current) return; // ignore while a jump animates
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (inView[0]) setActiveSection(inView[0].target.id as Section);
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [gated, showSections]);

  // Finish a jump that had to navigate back to the combined view first. Wait a
  // frame so the sections have painted, then scroll and clear the target.
  useEffect(() => {
    if (!pendingScroll || !showSections) return;
    const target = pendingScroll;
    const raf = requestAnimationFrame(() => {
      scrollToSection(target, scrollRef.current);
      setPendingScroll(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingScroll, showSections]);

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
        <Header onSignOut={signOut} onNew={goNewBrand} onAccount={() => setTab("account")} />
        <div className="flex md:min-h-0 md:flex-1">
          <Sidebar
            tab={tab}
            activeSection={activeSection}
            onJump={jumpTo}
            onSettings={() => setTab("settings")}
          />
          <div ref={scrollRef} className="min-w-0 flex-1 pb-[84px] md:overflow-y-auto md:pb-0">
            {/* Brand switcher + range controls are metrics-specific — hide on Account. */}
            {tab !== "account" && (
              <>
                <TitleRow current={currentBrand} brands={brands} onSwitch={setBrand} />
                <FilterBar tab={tab} plan={plan} range={range} onRange={setRange} />
              </>
            )}
            <div className="px-[20px] py-[24px] md:px-[28px]">
              {tab === "account" ? (
                <AccountView
                  email={email}
                  plan={plan}
                  ready={planReady}
                  hasBilling={hasBilling}
                  justCheckedOut={params.get("checkout") === "success"}
                />
              ) : scanState !== "ready" || !data ? (
                <ScanNotice
                  kind={scanState === "ready" ? "loading" : scanState}
                  brand={currentBrand}
                  onRetry={retryScan}
                />
              ) : tab === "settings" ? (
                <Settings brand={currentBrand} plan={plan} />
              ) : (
                <MainView
                  data={data}
                  brand={currentBrand}
                  platform={platform}
                  brandId={currentBrandId}
                  onBackToSection={jumpTo}
                />
              )}
            </div>
          </div>
        </div>
        <TabBar
          tab={tab}
          activeSection={activeSection}
          onJump={jumpTo}
          onSettings={() => setTab("settings")}
        />
      </div>

      {gated && checked && <Gate onEnter={() => setGated(false)} />}
      {showBrandLimit && (
        <UpgradeModal
          label="Brand limit reached"
          title="You've reached your plan's brand limit"
          body="Upgrade your plan to monitor more brands."
          closeLabel="Not now"
          onClose={() => setShowBrandLimit(false)}
        />
      )}
    </main>
  );
}

type ScanState = "loading" | "scanning" | "slow" | "ready" | "empty" | "error";

/** Trend date window (the dashboard filter). Bounds the chart only. */
type Range = "7d" | "30d" | "90d";
const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

type MetricsPayload = {
  scannedAt: string | null;
  scanning: boolean;
  failed: boolean;
  metrics: BrandMetrics | null;
};

async function fetchMetrics(brandId: string, range: Range): Promise<MetricsPayload> {
  const res = await fetch(`/api/ai-search/metrics?brand=${brandId}&range=${range}`);
  if (!res.ok) throw new Error("metrics fetch failed");
  return res.json();
}

/** Poll /metrics until the scan finishes (or we time out), while still mounted. */
async function pollUntilScanned(
  brandId: string,
  active: () => boolean,
  range: Range,
): Promise<MetricsPayload> {
  const deadline = Date.now() + 3 * 60_000;
  let payload = await fetchMetrics(brandId, range);
  while (!payload.scannedAt && !payload.failed && active() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    if (!active()) break;
    payload = await fetchMetrics(brandId, range);
  }
  return payload;
}

/** Full-body notice for the non-ready states (loading / running / slow / empty / error). */
function ScanNotice({
  kind,
  brand,
  onRetry,
}: {
  kind: Exclude<ScanState, "ready">;
  brand: BrandLite | null;
  onRetry?: () => void;
}) {
  const name = brand?.name?.trim() || brand?.domain || "your brand";
  const copy: Record<Exclude<ScanState, "ready">, { title: string; body: string; note?: string }> = {
    loading: { title: "Loading…", body: "Fetching your latest scan." },
    scanning: {
      title: "Running your scan…",
      body: `This can take several minutes. We're asking ChatGPT the questions your buyers ask about ${name}.`,
      note: "No need to wait here. If you need to step away, we'll email you the moment your free scan is ready.",
    },
    slow: {
      title: "Still working…",
      body: "Your scan is taking longer than usual — it's still running in the background. Refresh in a moment to check again.",
    },
    empty: {
      title: "No results yet",
      body: "The scan finished but didn't return anything to report. Try again shortly.",
    },
    error: {
      title: "Scan didn't complete",
      body: "Something went wrong running your scan. You can try again.",
    },
  };
  const { title, body, note } = copy[kind];
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-[10px] text-center">
      {(kind === "scanning" || kind === "loading" || kind === "slow") && (
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
      {note && (
        <span
          className="max-w-[430px] text-[13px]"
          style={{ color: "var(--mut)", lineHeight: 1.5 }}
        >
          {note}
        </span>
      )}
      {kind === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-[10px] px-[16px] py-[9px] text-[14px]"
          style={{ background: "var(--ink)", color: "var(--panel)", fontWeight: 600 }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Header({
  onSignOut,
  onNew,
  onAccount,
}: {
  onSignOut: () => void;
  onNew: () => void;
  onAccount: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between px-[20px] py-[14px] md:px-[28px] md:py-[16px]"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
    >
      <span className="inline-flex items-center gap-[12px]">
        <Mark size={34} />
        {/* Wordmark hidden on mobile so the header buttons never overflow. */}
        <span className="hidden md:inline-flex">
          <Wordmark size={16} />
        </span>
      </span>
      <div className="flex items-center gap-[10px]">
        {/* Mobile shows compact glyphs so the header never overflows; desktop
            keeps the labels. */}
        <HeaderButton
          onClick={onNew}
          ariaLabel="Add a new brand"
          variant="primary"
          mobile={
            <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
              +
            </span>
          }
        >
          + New
        </HeaderButton>
        <HeaderButton onClick={onAccount} ariaLabel="Account" mobile={<AccountIcon />}>
          Account
        </HeaderButton>
        <HeaderButton onClick={onSignOut} ariaLabel="Sign out" mobile={<SignOutIcon />}>
          Sign out
        </HeaderButton>
      </div>
    </header>
  );
}

/** Header control: a compact glyph on mobile, a full label on desktop. */
function HeaderButton({
  onClick,
  ariaLabel,
  variant = "secondary",
  mobile,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  variant?: "primary" | "secondary";
  mobile: React.ReactNode;
  children: React.ReactNode;
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-[11px] py-[9px] text-[14px] md:min-h-0 md:min-w-0 md:px-[16px]"
      style={{
        background: primary ? "var(--ink)" : undefined,
        color: primary ? "var(--panel)" : "var(--ink)",
        border: primary ? undefined : "1px solid var(--line)",
        fontWeight: primary ? 600 : undefined,
        flex: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span className="md:hidden">{mobile}</span>
      <span className="hidden md:inline">{children}</span>
    </button>
  );
}

function Sidebar({
  tab,
  activeSection,
  onJump,
  onSettings,
}: {
  tab: Tab;
  activeSection: Section;
  onJump: (s: Section) => void;
  onSettings: () => void;
}) {
  const secActive = (s: Section) => tab === "overview" && activeSection === s;
  return (
    <nav
      className="hidden w-[165px] shrink-0 flex-col p-[14px_12px] md:flex"
      style={{
        background: "var(--panel2)",
        borderRight: "1px solid var(--line)",
      }}
    >
      <NavItem active={secActive("visibility")} onClick={() => onJump("visibility")}>
        Visibility
      </NavItem>
      <NavItem active={secActive("citations")} onClick={() => onJump("citations")}>
        Citations
      </NavItem>
      <NavItem active={secActive("prompts")} onClick={() => onJump("prompts")}>
        Prompts
      </NavItem>

      <div className="mt-auto">
        <NavItem active={tab === "settings"} onClick={onSettings}>
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
  plan,
  range,
  onRange,
}: {
  tab: Tab;
  plan: string;
  range: Range;
  onRange: (r: Range) => void;
}) {
  // The date range bounds the trend window; the cadence indicator only belongs
  // on Overview. Phase 1 is ChatGPT-only, so there is no platform selector.
  const showDates = tab !== "settings";
  const showCadence = tab === "overview";
  return (
    <div
      className="flex flex-wrap items-center gap-[8px] px-[20px] py-[14px] md:px-[28px]"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      {showDates && (
        <select
          aria-label="Date range"
          value={range}
          onChange={(e) => onRange(e.target.value as Range)}
          className="cursor-pointer text-[13px]"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px", color: "var(--mut)" }}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      )}
      {showCadence && (
        <div className="ml-auto flex items-center gap-[8px]">
          <CadenceIndicator plan={plan} />
          {!isDaily(plan) && <UpgradeLink />}
        </div>
      )}
    </div>
  );
}

/** Real scan cadence for the current plan: paid runs daily, free is one-time. */
function CadenceIndicator({ plan }: { plan: string }) {
  return (
    <span
      className="inline-flex items-center gap-[8px] whitespace-nowrap text-[13px]"
      style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px", color: "var(--mut)" }}
    >
      <span style={{ color: "var(--dim)" }}>Cadence</span>
      <span style={{ color: "var(--ink)", fontWeight: 600 }}>
        {isDaily(plan) ? "Daily" : "One-time"}
      </span>
    </span>
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

/** Person glyph — mobile Account control. CSS geometry (currentColor shapes,
 *  not SVG) to match the TabBar icon family. */
function AccountIcon() {
  return (
    <span style={{ position: "relative", width: 18, height: 18, display: "block" }}>
      {/* Head. */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 8,
          height: 8,
          borderRadius: "9999px",
          border: "2px solid currentColor",
        }}
      />
      {/* Shoulders. */}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 15,
          height: 9,
          borderRadius: "9999px 9999px 0 0",
          border: "2px solid currentColor",
          borderBottom: "none",
        }}
      />
    </span>
  );
}

/** Sign-out glyph (door + arrow) — mobile Sign out control. CSS geometry to
 *  match the TabBar icon family. */
function SignOutIcon() {
  return (
    <span style={{ position: "relative", width: 18, height: 18, display: "block" }}>
      {/* Door frame, open toward the arrow. */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 1,
          width: 8,
          height: 16,
          border: "2px solid currentColor",
          borderRight: "none",
        }}
      />
      {/* Arrow shaft. */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          right: 0,
          width: 10,
          height: 2,
          background: "currentColor",
          transform: "translateY(-50%)",
        }}
      />
      {/* Arrow head. */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          right: 1,
          width: 7,
          height: 7,
          borderTop: "2px solid currentColor",
          borderRight: "2px solid currentColor",
          transform: "translateY(-50%) rotate(45deg)",
        }}
      />
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
        fontSize: 15,
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

// ── Overview ─────────────────────────────────────────────────────────────────
/**
 * The combined main view: Visibility, Citations and Prompts stacked in one
 * scrollable page (the left nav jumps between them). Click-through detail pages
 * (a prompt's answer, a domain's pages) replace it and return via onBackToSection.
 */
function MainView({
  data,
  brand,
  platform,
  brandId,
  onBackToSection,
}: {
  data: DashboardData;
  brand: BrandLite | null;
  platform: Platform;
  brandId: string | null;
  onBackToSection: (s: Section) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [openGroups, setOpenGroups] = useState<number[]>([0]);
  const toggleGroup = (gi: number) =>
    setOpenGroups((g) => (g.includes(gi) ? g.filter((x) => x !== gi) : [...g, gi]));

  const settingsHref = dashHref({ tab: "settings", platform, brandId });
  const brandName = brand?.name?.trim() || brand?.domain || "Your brand";

  // Click-through detail pages (kept in the URL); back returns to the combined
  // view scrolled to that section.
  const selectedPrompt = resolvePrompt(params.get("prompt"), data.groups);
  if (selectedPrompt) {
    return (
      <PromptDetailView
        // Remount per prompt so answer-history state starts fresh (no stale flash).
        key={selectedPrompt.p.promptId || params.get("prompt")}
        p={selectedPrompt.p}
        groupName={selectedPrompt.groupName}
        brandName={brandName}
        onBack={() => onBackToSection("prompts")}
      />
    );
  }
  const citation = resolveCitation(params.get("citation"), data.citationRank.rows);
  if (citation) {
    return <CitationDetailView d={citation} onBack={() => onBackToSection("citations")} />;
  }

  const openPrompt = (id: string) =>
    router.replace(dashHref({ platform, brandId, prompt: id }), { scroll: false });
  const openCitation = (domain: string) =>
    router.replace(dashHref({ platform, brandId, citation: domain }), { scroll: false });

  return (
    <div className="flex flex-col gap-[30px]">
      <section id="visibility" className="flex scroll-mt-[16px] flex-col gap-[14px]">
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
              <Legend color="var(--pos)" label="Trend" />
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
              className="flex items-center gap-[12px] pb-[8px]"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 14, color: "var(--dim)" }}
            >
              <span style={{ width: 14 }} />
              <span className="flex-1">Brand</span>
              <span>Visibility</span>
              <span style={{ width: 46 }} />
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

      <CitationSection data={data} brand={brand} onOpen={openCitation} />

      <section id="prompts" className="flex scroll-mt-[16px] flex-col gap-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Monitored prompts</h2>
          <button
            type="button"
            onClick={() => router.replace(settingsHref, { scroll: false })}
            className="inline-flex items-center whitespace-nowrap text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px" }}
          >
            Edit your prompts →
          </button>
        </div>
        <Card>
          <div
            className={`hidden px-[24px] py-[12px] md:grid ${COLS}`}
            style={{ background: "var(--panel2)", borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 14, color: "var(--dim)" }}
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
      </section>
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
            <span key={i} className={i === 1 || i === 4 ? "hidden md:inline" : ""}>
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
  onOpen,
}: {
  data: DashboardData;
  brand: BrandLite | null;
  onOpen: (domain: string) => void;
}) {
  const brandUrl = brand?.domain || BRAND.url;
  return (
    <section id="citations" className="flex scroll-mt-[16px] flex-col gap-[14px]">
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
              <Legend color="var(--pos)" label="Trend" />
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
              className="flex items-center gap-[12px] pb-[8px]"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 14, color: "var(--dim)" }}
            >
              <span style={{ width: 16 }} />
              <span className="flex-1">Domain</span>
              <span>Share</span>
              <span style={{ width: 46 }} />
              <span style={{ width: 10 }} />
            </div>
            <div className="flex flex-col">
              {data.citationRank.rows.map((d) => (
                <CitationRow key={d.domain} d={d} onOpen={() => onOpen(d.domain)} />
              ))}
            </div>
          </div>
        </Card>
    </section>
  );
}

function CitationRow({ d, onOpen }: { d: CitationDomain; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-[12px] py-[10px] text-left"
      style={{ borderBottom: "1px solid var(--line)" }}
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
      <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)", width: 10 }}>›</span>
    </button>
  );
}

/** Resolve the `?citation=<domain>` URL param to its citation row. */
function resolveCitation(id: string | null, rows: CitationDomain[]): CitationDomain | null {
  if (!id) return null;
  return rows.find((r) => r.domain === id) ?? null;
}

/**
 * Full-page detail for one cited domain — its pages, each an external link that
 * opens in a new tab. Mirrors the prompt detail view (back button, roomy layout)
 * so citations get their own space instead of cramping the overview.
 */
function CitationDetailView({ d, onBack }: { d: CitationDomain; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-[22px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-[7px] self-start text-[13px]"
        style={{ color: "var(--mut)" }}
      >
        ← Back to overview
      </button>

      <div className="flex flex-col gap-[8px]">
        <MonoLabel>Cited domain</MonoLabel>
        <h2
          className="flex flex-wrap items-center gap-[10px]"
          style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}
        >
          <a
            href={`https://${d.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ink)", textDecoration: "underline" }}
          >
            {d.domain}
          </a>
          {d.owned && (
            <span
              style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, background: "var(--grn)", color: "#14170f", padding: "3px 7px" }}
            >
              Monitored
            </span>
          )}
        </h2>
        <span style={{ fontSize: 13.5, color: "var(--mut)" }}>
          {d.share} of all citations in this scan
        </span>
      </div>

      <Card className="p-[22px_24px_26px]">
        <div
          className="flex items-center justify-between pb-[10px]"
          style={{ borderBottom: "1px solid var(--line)", fontFamily: SANS, fontSize: 14, color: "var(--dim)" }}
        >
          <span>Cited page</span>
          <span>Share</span>
        </div>
        <div className="flex flex-col">
          {d.pages.map((pg, i) => (
            <div
              key={pg.url}
              className="flex items-center justify-between gap-[16px] py-[11px]"
              style={{ borderBottom: i < d.pages.length - 1 ? "1px solid var(--line)" : undefined }}
            >
              <a
                href={pg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[14px]"
                style={{ color: "var(--ink)", textDecoration: "underline" }}
                title={pg.url}
              >
                {pg.url}
              </a>
              <span className="whitespace-nowrap" style={{ fontFamily: MONO, fontSize: 13 }}>
                {pg.share}
              </span>
            </div>
          ))}
        </div>
      </Card>
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
 * stays selected. Leads with the ChatGPT score, then the verbatim answer with
 * the brand mention highlighted.
 */
function PromptDetailView({
  p,
  groupName,
  brandName,
  onBack,
}: {
  p: Prompt;
  groupName: string;
  brandName: string;
  onBack: () => void;
}) {
  // The prompt's answer history (newest run first). null while loading; on a
  // one-run brand it comes back with a single entry and the navigator hides.
  const [answers, setAnswers] = useState<PromptAnswer[] | null>(null);
  const [sel, setSel] = useState(0);

  // The component is remounted per prompt (keyed by id), so state starts fresh —
  // this effect only fetches and fills it, never resets synchronously.
  useEffect(() => {
    if (!p.promptId) return;
    let active = true;
    fetch(`/api/ai-search/prompt-answers?prompt=${encodeURIComponent(p.promptId)}`)
      .then((r) => (r.ok ? r.json() : { answers: [] }))
      .then((d: { answers?: PromptAnswer[] }) => {
        if (active) setAnswers(d.answers ?? []);
      })
      .catch(() => {
        if (active) setAnswers([]);
      });
    return () => {
      active = false;
    };
  }, [p.promptId]);

  const hasHistory = Boolean(answers && answers.length > 1);
  // The run in view: the selected historical answer once loaded, otherwise the
  // latest-run data the metrics layer already gave us (so there's no blank flash).
  const nav = answers && answers.length > 0 ? answers[Math.min(sel, answers.length - 1)] : null;
  const view = nav
    ? {
        answer: nav.answer ?? "",
        highlight: nav.highlight ?? undefined,
        brands: nav.brands.join(" · "),
        cites: nav.cites.join(" · "),
        promptText: nav.promptText,
        latest: sel === 0,
      }
    : { answer: p.answer, highlight: p.highlight, brands: p.brands, cites: p.cites, promptText: null, latest: true };
  // Reset-on-edit transparency: the question text may have been edited since this
  // run, so surface what was actually asked when it differs from the current text.
  const askedAs = view.promptText && view.promptText.trim() !== p.q.trim() ? view.promptText : null;

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

      {/* Topic + prompt on the left, ChatGPT score on the right — side by side on
          desktop so the answer/history/brands sections sit higher up the page. */}
      <div className="grid gap-[20px] md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <PromptHeading topic={groupName} prompt={p.q} />
        {/* ChatGPT score — the only live platform in Phase 1. Always the latest run. */}
        <div>
          <MonoLabel>Score by platform</MonoLabel>
          <div className="mt-[10px] w-[280px] max-w-full">
            <PlatformScoreCard p={p} />
          </div>
        </div>
      </div>

      <Card className="p-[22px_24px_26px]">
        <div className={hasHistory ? "grid gap-[24px] md:grid-cols-[190px_minmax(0,1fr)]" : ""}>
          {hasHistory && (
            <div
              className="flex flex-col gap-[10px] md:border-r md:pr-[18px]"
              style={{ borderColor: "var(--line)" }}
            >
              <MonoLabel>History</MonoLabel>
              <RunNavigator answers={answers!} sel={sel} onSelect={setSel} />
            </div>
          )}
          <div className="grid min-w-0 gap-[30px] md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex min-w-0 flex-col gap-[10px]">
              <MonoLabel>Answer · {p.platform}</MonoLabel>
              {askedAs && (
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>
                  Asked as: “{askedAs}”
                </span>
              )}
              <AnswerBlock key={nav?.runId ?? "current"} text={view.answer} highlight={view.highlight} />
              {view.answer.trim() === "" ? (
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>
                  This prompt didn’t return an answer in {hasHistory && !view.latest ? "this scan" : "the last scan"}.
                </span>
              ) : !view.highlight ? (
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--dim)" }}>
                  {brandName} was not named in this answer.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-[6px]">
                <MonoLabel>Brands mentioned</MonoLabel>
                <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--mut)" }}>{view.brands || DASH}</span>
              </div>
              <div className="flex flex-col gap-[6px]">
                <MonoLabel>Cited sources</MonoLabel>
                <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--mut)" }}>{view.cites || DASH}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** A run timestamp's UTC time as "14:30". */
function utcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** A run's label for the history rail: date + UTC time, e.g. "14 Aug, 14:30". */
function runLabel(iso: string): string {
  return `${shortDate(iso)}, ${utcTime(iso)}`;
}

/**
 * Vertical history rail for a prompt's answers — one row per completed run, newest
 * first, showing date + time. A left accent bar marks the selected run, and the
 * list scrolls when a prompt has many runs. Only rendered when there's more than one.
 */
function RunNavigator({
  answers,
  sel,
  onSelect,
}: {
  answers: PromptAnswer[];
  sel: number;
  onSelect: (i: number) => void;
}) {
  const active = Math.min(sel, answers.length - 1);
  return (
    <div className="flex flex-col gap-[1px] max-h-[220px] overflow-y-auto md:max-h-[440px]">
      {answers.map((a, i) => {
        const on = i === active;
        return (
          <button
            key={a.runId}
            type="button"
            onClick={() => onSelect(i)}
            className="w-full px-[10px] py-[7px] text-left text-[12px]"
            style={{
              fontFamily: MONO,
              borderLeft: `2px solid ${on ? "var(--ink)" : "var(--line)"}`,
              background: on ? "var(--panel2)" : "transparent",
              color: on ? "var(--ink)" : "var(--mut)",
              fontWeight: on ? 700 : 400,
            }}
          >
            {runLabel(a.at)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The verbatim answer, capped to a preview with a "Show all" toggle when it runs
 * long. The height cap is applied from the first render (no content flash); a
 * measurement only decides whether the fade + button appear. Remounted per run
 * (keyed by runId) so switching answers re-collapses.
 */
function AnswerBlock({ text, highlight }: { text: string; highlight?: string }) {
  const COLLAPSED = 240; // px preview height (~a third of a long answer)
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // Threshold == the cap height (no buffer): whenever the content is taller than
  // the cap it gets both the visual clip AND the "Show all" affordance, so nothing
  // is ever silently truncated.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el) setOverflows(el.scrollHeight > COLLAPSED);
  }, []);
  const capped = !expanded;
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="relative">
        <div
          ref={measure}
          className="max-w-[80ch] text-[14.5px]"
          style={{
            lineHeight: 1.65,
            color: "var(--ink)",
            maxHeight: capped ? COLLAPSED : undefined,
            overflow: capped ? "hidden" : undefined,
          }}
        >
          <AnswerMarkdown text={text} highlight={highlight} />
        </div>
        {capped && overflows && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{ height: 72, background: "linear-gradient(to bottom, transparent, var(--panel))" }}
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[12.5px]"
          style={{ fontFamily: MONO, color: "var(--mut)", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

/** Prompt-detail heading: the topic it belongs to, then the question itself (smaller). */
function PromptHeading({ topic, prompt }: { topic: string; prompt: string }) {
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[4px]">
        <MonoLabel>Topic</MonoLabel>
        <span className="text-[13.5px]" style={{ color: "var(--mut)" }}>{topic}</span>
      </div>
      <div className="flex flex-col gap-[4px]">
        <MonoLabel>Prompt</MonoLabel>
        <h2
          className="max-w-[52ch]"
          style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.3 }}
        >
          {prompt}
        </h2>
      </div>
    </div>
  );
}

/** ChatGPT's per-prompt metrics — the live, unlocked platform. */
function PlatformScoreCard({ p }: { p: Prompt }) {
  // A one-time scan has no per-prompt rank, and Pos is empty when the brand isn't
  // named — show a word, not a bare dash. Compare against the shared DASH marker.
  const orLabel = (v: string, fallback: string) => (v === DASH ? fallback : v);
  const cells: [string, React.ReactNode][] = [
    ["Rank", <span key="r" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{orLabel(p.rank, "Not ranked")}</span>],
    ["Score", <span key="s"><span style={{ fontFamily: MONO, fontSize: 13 }}>{orLabel(p.score, "N/A")}</span> <Delta v={p.dScore} size={11} /></span>],
    ["Pos", <span key="p"><span style={{ fontFamily: MONO, fontSize: 13 }}>{orLabel(p.pos, "N/A")}</span> <Delta v={p.dPos} size={11} /></span>],
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

// ── Account ──────────────────────────────────────────────────────────────────
/**
 * The Account view — reached from the header, rendered inside the dashboard shell
 * (same header + nav panel, light theme). Shows the signed-in email and the
 * account's AI Search Monitor plan. `ready` gates the values so a paid user never
 * sees a "Free" flash before the account data loads.
 */
function AccountView({
  email,
  plan,
  ready,
  hasBilling,
  justCheckedOut = false,
}: {
  email: string | null;
  plan: string;
  ready: boolean;
  hasBilling: boolean;
  justCheckedOut?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-[8px]">
        <MonoLabel>Account</MonoLabel>
        <h2 style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Your account
        </h2>
      </div>

      {justCheckedOut ? (
        <div
          role="status"
          className="text-[14px] leading-[1.5]"
          style={{ border: "1px solid var(--line)", background: "var(--panel)", padding: "12px 16px", color: "var(--ink)" }}
        >
          Payment received. Your plan updates within a few seconds. Refresh this page if it still shows Free.
        </div>
      ) : null}

      <div className="grid gap-[16px] md:max-w-[680px] md:grid-cols-2">
        <Card className="flex flex-col gap-[8px] p-[20px_22px]">
          <MonoLabel>Your email</MonoLabel>
          <span className="text-[15px]" style={{ color: ready ? "var(--ink)" : "var(--dim)", wordBreak: "break-word" }}>
            {ready ? email ?? "—" : "Loading…"}
          </span>
        </Card>
        <Card className="flex flex-col gap-[8px] p-[20px_22px]">
          <MonoLabel>Your AI-Search Monitor plan</MonoLabel>
          <span className="text-[15px]" style={{ color: ready ? "var(--ink)" : "var(--dim)", fontWeight: ready ? 600 : 400 }}>
            {ready ? planLabel(plan) : "Loading…"}
          </span>
        </Card>
      </div>

      <BillingCard plan={plan} ready={ready} hasBilling={hasBilling} />
    </div>
  );
}

/**
 * Billing management in the Account view. The control is gated on whether the
 * account has a Stripe customer, NOT on whether the plan is paid:
 * - Has a Stripe customer → "Manage billing" (the Stripe portal: card, switch, cancel).
 * - No customer + Free → "Upgrade" link to pricing.
 * - No customer + paid (a manually-set or legacy plan) → a neutral note; the portal
 *   would 400, and "Upgrade" would be wrong since they already have a paid plan.
 * Rendered only once the account is loaded, to avoid flashing the wrong control.
 */
function BillingCard({
  plan,
  ready,
  hasBilling,
}: {
  plan: string;
  ready: boolean;
  hasBilling: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Could not open billing. Please try again.");
    } catch {
      setError("Could not open billing. Please try again.");
    }
    setBusy(false);
  }

  const buttonStyle = {
    background: "var(--ink)",
    color: "var(--panel)",
    fontWeight: 600,
    borderColor: "var(--ink)",
  } as const;
  return (
    <Card className="flex flex-col gap-[12px] p-[20px_22px] md:max-w-[680px]">
      <MonoLabel>Billing</MonoLabel>
      {!ready ? (
        <span className="text-[15px]" style={{ color: "var(--dim)" }}>
          Loading…
        </span>
      ) : hasBilling ? (
        <>
          <p className="text-[14px] leading-[1.5]" style={{ color: "var(--dim)" }}>
            Update your payment method, switch plan or cancel in the secure Stripe portal.
          </p>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="self-start border px-[16px] py-[9px] text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-70"
            style={buttonStyle}
          >
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : isPaid(plan) ? (
        <p className="text-[14px] leading-[1.5]" style={{ color: "var(--dim)" }}>
          Your plan is managed manually. Contact us if you need to make a change.
        </p>
      ) : (
        <>
          <p className="text-[14px] leading-[1.5]" style={{ color: "var(--dim)" }}>
            You are on the Free plan. Upgrade for daily scans, more prompts and more brands.
          </p>
          <Link
            href="/ai-search/pricing"
            className="self-start border px-[16px] py-[9px] text-[14px] font-medium no-underline transition-opacity hover:opacity-90"
            style={buttonStyle}
          >
            Upgrade
          </Link>
        </>
      )}
      {error ? (
        <p role="alert" className="font-mono text-[12px]" style={{ color: "#e0603f" }}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function Settings({
  brand,
  plan,
}: {
  brand: BrandLite | null;
  plan: string;
}) {
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
                  color: pl.dim ? "var(--dim)" : "var(--ink)",
                }}
              >
                <span className="flex items-center gap-[9px] text-[14px]">
                  {!pl.dim && <PlatformLogo name={pl.name} size={15} />}
                  {pl.name}
                </span>
                <StatusChip>{pl.status}</StatusChip>
              </div>
            ))}
            <div className="flex items-center justify-between gap-[12px] py-[12px]">
              <span className="text-[14px]">Scan cadence</span>
              {isDaily(plan) ? (
                <StatusChip>Daily</StatusChip>
              ) : (
                <span className="inline-flex items-center gap-[8px]">
                  <StatusChip>One-time</StatusChip>
                  <UpgradeLink />
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-[16px] p-[22px_24px]">
        <SectionHead title="Monitored prompts" sub="Add, remove or edit the prompts we monitor." />
        <PromptsManager brandId={brand?.id ?? null} />
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

/** Upgrade CTA → pricing, shared by the cadence indicator and Settings rows. */
function UpgradeLink() {
  return (
    <Link
      href="/ai-search/pricing"
      className="inline-flex items-center gap-[6px] whitespace-nowrap no-underline"
      style={{ fontFamily: MONO, fontSize: 11, background: "var(--ink)", color: "var(--panel)", padding: "5px 10px" }}
    >
      <Lock size={11} color="var(--panel)" />
      Upgrade
    </Link>
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
function TabBar({
  tab,
  activeSection,
  onJump,
  onSettings,
}: {
  tab: Tab;
  activeSection: Section;
  onJump: (s: Section) => void;
  onSettings: () => void;
}) {
  const item = (label: string, icon: React.ReactNode, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-[6px] pt-[12px] pb-[16px]"
      style={{ color: active ? "var(--ink)" : "var(--mut)" }}
    >
      <span style={{ width: 18, height: 18, display: "grid", placeItems: "center" }}>{icon}</span>
      <span className="text-[12px]">{label}</span>
    </button>
  );
  const secActive = (s: Section) => tab === "overview" && activeSection === s;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex md:hidden"
      style={{ background: "var(--panel)", borderTop: "1px solid var(--line)" }}
    >
      {item("Visibility", <OverviewIcon />, secActive("visibility"), () => onJump("visibility"))}
      {item("Citations", <CitationsIcon />, secActive("citations"), () => onJump("citations"))}
      {item("Prompts", <PromptsIcon />, secActive("prompts"), () => onJump("prompts"))}
      {item("Settings", <SettingsIcon />, tab === "settings", onSettings)}
    </nav>
  );
}

function CitationsIcon() {
  return (
    <span
      style={{ width: 15, height: 15, borderRadius: "9999px", border: "2px solid currentColor", display: "block" }}
    />
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

// ── Upgrade / plan-limit modal ───────────────────────────────────────────────
/**
 * Shown when an action hits a plan limit — a second free scan (the account is at
 * its brand cap after OTP) or "+ New brand" over the cap. Primary action goes to
 * pricing; the secondary closes back to wherever the user was.
 */
function UpgradeModal({
  label,
  title,
  body,
  closeLabel,
  onClose,
}: {
  label: string;
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-[16px] md:p-[60px]"
      style={{ background: "rgba(8,10,9,0.62)" }}
    >
      <div
        className="w-full max-w-[520px]"
        style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
      >
        <div className="flex flex-col gap-[12px] p-[28px_32px_26px]">
          <MonoLabel>{label}</MonoLabel>
          <h3 style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em" }}>
            {title}
          </h3>
          <p className="text-[15px]" style={{ color: "var(--mut)", lineHeight: 1.55 }}>
            {body}
          </p>
          <div className="mt-[8px] flex items-center gap-[16px]">
            <button
              type="button"
              onClick={() => router.push("/ai-search/pricing")}
              className="px-[18px] py-[10px] text-[14px] font-semibold"
              style={{ background: "var(--ink)", color: "var(--panel)" }}
            >
              Show plans
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[14px]"
              style={{ color: "var(--mut)" }}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const [atLimit, setAtLimit] = useState(false); // account already used its free scan

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
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        atBrandLimit?: boolean;
      };
      if (!res.ok) return fail(data.error ?? "Something went wrong. Try again.");

      // Account already used its free scan (at the brand cap): the server made no
      // brand and ran no scan — show the upgrade modal instead of entering.
      if (data.atBrandLimit) {
        clearOnboarding();
        setAtLimit(true);
        return;
      }

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

  if (atLimit) {
    return (
      <UpgradeModal
        label="Free scan used"
        title="You've already used your free scan"
        body="Convert to a paid plan to monitor more brands and get daily scans."
        closeLabel="Go to my dashboard"
        onClose={onEnter}
      />
    );
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
