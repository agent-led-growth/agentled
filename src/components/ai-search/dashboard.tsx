"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { Mark, Wordmark } from "./brand";
import {
  ALL_PROMPTS,
  BRAND,
  CITATION,
  CITATION_RANK,
  GROUPS,
  PLATFORMS,
  RANK,
  SCHEDULE,
  VISIBILITY,
  tone,
  type ChartInput,
  type CitationDomain,
  type CitationPage,
  type Group,
  type Prompt,
} from "./fixtures";
import { AI_MODELS, MODEL_COLOR } from "./model-marks";
import { clearOnboarding, readOnboarding } from "./onboarding-store";
import { MONO, appTokens, toneVar } from "./tokens";

type Tab = "overview" | "prompts" | "settings";
const TABS: Tab[] = ["overview", "prompts", "settings"];

const COLS =
  "md:grid md:grid-cols-[1fr_130px_170px_160px_130px] md:items-center md:gap-[16px]";

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "overview";
  // The gate is only for first-time account creation. Already-signed-in users
  // skip it. `checked` avoids flashing the modal before the session resolves.
  const [gated, setGated] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setGated(false);
        setChecked(true);
      });
  }, []);

  const setTab = (t: Tab) =>
    router.replace(`/ai-search/dashboard?tab=${t}`, { scroll: false });
  const reset = () => router.push("/ai-search");

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
        <Header onReset={reset} />
        <div className="flex md:min-h-0 md:flex-1">
          <Sidebar tab={tab} setTab={setTab} />
          <div className="min-w-0 flex-1 pb-[84px] md:overflow-y-auto md:pb-0">
            <TitleRow />
            <FilterBar />
            <div className="px-[20px] py-[24px] md:px-[28px]">
              {tab === "overview" && <Overview />}
              {tab === "prompts" && <Prompts />}
              {tab === "settings" && <Settings />}
            </div>
          </div>
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>

      {gated && checked && <Gate onEnter={() => setGated(false)} />}
    </main>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Header({ onReset }: { onReset: () => void }) {
  return (
    <header
      className="flex items-center justify-between px-[20px] py-[14px] md:px-[28px] md:py-[16px]"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
    >
      <span className="inline-flex items-center gap-[12px]">
        <Mark size={34} />
        <Wordmark size={16} />
      </span>
      <button
        type="button"
        onClick={onReset}
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

function TitleRow() {
  return (
    <div className="flex items-baseline gap-[12px] px-[20px] pt-[18px] md:px-[28px]">
      <h1 className="text-[22px]" style={{ letterSpacing: "-0.035em" }}>
        {BRAND.name}
      </h1>
      <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
        {BRAND.url}
      </span>
    </div>
  );
}

function FilterBar() {
  return (
    <div
      className="flex flex-wrap items-center gap-[8px] px-[20px] py-[14px] md:px-[28px]"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <Chip>Last 7 days ⌄</Chip>
      <span style={{ fontSize: 13, color: "var(--dim)" }}>vs.</span>
      <Chip>Previous period ⌄</Chip>
      <div className="ml-auto flex items-center gap-[8px]">
        <FrequencySelect />
        <PlatformsSelect />
      </div>
    </div>
  );
}

const FREQUENCIES = ["Weekly", "72 hours", "Daily"];

/** Frequency selector — single choice, default Weekly. */
function FrequencySelect() {
  const [value, setValue] = useState("Weekly");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center whitespace-nowrap text-[13px]"
        style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px" }}
      >
        {value} ⌄
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-[6px] w-[160px]"
          style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
        >
          {FREQUENCIES.map((f, i) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setValue(f);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-[12px] py-[10px] text-left text-[13px]"
              style={{
                borderBottom: i < FREQUENCIES.length - 1 ? "1px solid var(--line)" : undefined,
                background: value === f ? "var(--panel2)" : undefined,
                color: "var(--ink)",
              }}
            >
              {f}
              {value === f && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Platforms selector. ChatGPT and Claude are live and toggleable; the rest are
 * shown as "Soon" and are not selectable.
 */
function PlatformsSelect() {
  const [selected, setSelected] = useState<string[]>(
    PLATFORMS.filter((p) => !p.dim).map((p) => p.name),
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (name: string) =>
    setSelected((s) =>
      s.includes(name) ? s.filter((n) => n !== name) : [...s, name],
    );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center whitespace-nowrap text-[13px]"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          padding: "7px 12px",
        }}
      >
        Platforms · {selected.length} ⌄
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-[6px] w-[220px]"
          style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
        >
          {PLATFORMS.map((p, i) => {
            const border =
              i < PLATFORMS.length - 1 ? "1px solid var(--line)" : undefined;
            if (p.dim) {
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-[10px] px-[12px] py-[10px]"
                  style={{ borderBottom: border }}
                >
                  <PlatformLogo name={p.name} dim />
                  <span className="flex-1 text-[13px]" style={{ color: "var(--dim)" }}>
                    {p.name}
                  </span>
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: MONO,
                      fontSize: 9.5,
                      letterSpacing: "0.1em",
                      border: "1px solid var(--line)",
                      padding: "2px 6px",
                      color: "var(--dim)",
                    }}
                  >
                    Soon
                  </span>
                </div>
              );
            }
            const on = selected.includes(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toggle(p.name)}
                className="flex w-full items-center gap-[10px] px-[12px] py-[10px] text-left"
                style={{ borderBottom: border }}
              >
                <PlatformLogo name={p.name} />
                <span className="flex-1 text-[13px]" style={{ color: "var(--ink)" }}>
                  {p.name}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 15,
                    height: 15,
                    flex: "none",
                    display: "grid",
                    placeItems: "center",
                    border: `1px solid ${on ? "var(--ink)" : "var(--dim)"}`,
                    background: on ? "var(--ink)" : "transparent",
                    color: "var(--panel)",
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  {on ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlatformLogo({ name, dim }: { name: string; dim?: boolean }) {
  const m = AI_MODELS.find((x) => x.name === name);
  if (!m) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={MODEL_COLOR[name] ?? "var(--ink)"}
      style={{ flex: "none", opacity: dim ? 0.5 : 1 }}
      aria-hidden="true"
    >
      <path d={m.path} />
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
  return (
    <span style={{ fontFamily: MONO, fontSize: size, color: toneVar(tone(v)) }}>
      {v}
    </span>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="uppercase"
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        letterSpacing: "0.16em",
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
function Overview() {
  return (
    <div className="flex flex-col gap-[30px]">
      <section className="flex flex-col gap-[14px]">
        <SectionHead
          title="Visibility score"
          sub={`How often ${BRAND.name} appears in AI-generated answers`}
        />
        <Card className="grid md:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-[16px] p-[22px_24px]" style={{ borderBottom: "1px solid var(--line)" }}>
            <MonoLabel>Visibility score</MonoLabel>
            <div className="flex flex-wrap items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {VISIBILITY.score}
              </span>
              <Delta v={VISIBILITY.delta} size={14} />
              <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{VISIBILITY.detail}</span>
            </div>
            <Chart v={VISIBILITY} />
            <div className="flex items-center gap-[22px] pt-[4px]">
              <Legend color="var(--pos)" label="Current period" />
              <Legend color="var(--dim)" label="Previous period" />
            </div>
          </div>
          <div className="flex flex-col gap-[16px] p-[22px_24px] md:border-l" style={{ borderColor: "var(--line)" }}>
            <MonoLabel>Visibility rank</MonoLabel>
            <div className="flex items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {RANK.value}
              </span>
              <Delta v={RANK.delta} size={14} />
            </div>
            <div
              className="flex items-center justify-between pb-[8px] uppercase"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}
            >
              <span>Brand</span>
              <span>Visibility</span>
            </div>
            <div className="flex flex-col">
              {RANK.rows.map((r) => (
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
                        className="uppercase"
                        style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", background: "var(--grn)", color: "#14170f", padding: "3px 7px" }}
                      >
                        You
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

      <CitationSection />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-[8px]" style={{ fontSize: 12.5, color: "var(--mut)" }}>
      <span style={{ width: 12, height: 2, background: color, display: "block" }} />
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
function CitationSection() {
  const [open, setOpen] = useState<number>(-1);
  return (
    <section className="flex flex-col gap-[14px]">
      <SectionHead
        title="Citation share"
        sub={`How often ${BRAND.url} is cited by AI-generated answers`}
      />
        <Card className="grid md:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-[16px] p-[22px_24px]" style={{ borderBottom: "1px solid var(--line)" }}>
            <MonoLabel>Citation share</MonoLabel>
            <div className="flex flex-wrap items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {CITATION.score}
              </span>
              <Delta v={CITATION.delta} size={14} />
              <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{CITATION.detail}</span>
            </div>
            <Chart v={CITATION} />
            <div className="flex items-center gap-[22px] pt-[4px]">
              <Legend color="var(--pos)" label="Current period" />
              <Legend color="var(--dim)" label="Previous period" />
            </div>
          </div>

          <div className="flex flex-col gap-[16px] p-[22px_24px] md:border-l" style={{ borderColor: "var(--line)" }}>
            <MonoLabel>Citation rank</MonoLabel>
            <div className="flex items-baseline gap-[12px]">
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {CITATION_RANK.value}
              </span>
              <Delta v={CITATION_RANK.delta} size={14} />
            </div>
            <div
              className="flex items-center justify-between pb-[8px] uppercase"
              style={{ borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}
            >
              <span>Domain</span>
              <span>Share</span>
            </div>
            <div className="flex flex-col">
              {CITATION_RANK.rows.map((d) => (
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
              className="uppercase"
              style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", background: "var(--grn)", color: "#14170f", padding: "3px 7px", flex: "none" }}
            >
              Owned
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
        className="grid grid-cols-[1fr_100px_90px] gap-[10px] px-[14px] py-[8px] uppercase"
        style={{ borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: "var(--dim)" }}
      >
        <span>Page</span>
        <span className="text-right">Share</span>
        <span className="text-right">Global</span>
      </div>
      {pages.map((p, i) => (
        <div
          key={p.url}
          className="grid grid-cols-[1fr_100px_90px] items-baseline gap-[10px] px-[14px] py-[10px]"
          style={{ borderBottom: i < pages.length - 1 ? "1px solid var(--line)" : undefined }}
        >
          <span className="min-w-0 truncate text-[13px]" title={p.url}>{p.url}</span>
          <span className="whitespace-nowrap text-right">
            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{p.share}</span>{" "}
            <Delta v={p.dShare} size={11} />
          </span>
          <span className="whitespace-nowrap text-right">
            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{p.global}</span>{" "}
            <Delta v={p.dGlobal} size={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Prompts ──────────────────────────────────────────────────────────────────
function Prompts() {
  const [openGroups, setOpenGroups] = useState<number[]>([0]);
  const [open, setOpen] = useState<string>("-1");

  const toggleGroup = (gi: number) =>
    setOpenGroups((g) => (g.includes(gi) ? g.filter((x) => x !== gi) : [...g, gi]));
  const togglePrompt = (id: string) => setOpen((o) => (o === id ? "-1" : id));

  return (
    <div className="flex flex-col gap-[16px]">
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Monitored prompts</h2>
      <Card>
        <div
          className={`hidden px-[24px] py-[12px] uppercase md:grid ${COLS}`}
          style={{ background: "var(--panel2)", borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "var(--dim)" }}
        >
          <span>Topic</span>
          <span>Visibility rank</span>
          <span>Visibility score</span>
          <span>Average position</span>
          <span>Citation share</span>
        </div>

        {GROUPS.map((g, gi) => (
          <GroupBlock
            key={g.name}
            g={g}
            gi={gi}
            openGroup={openGroups.includes(gi)}
            toggleGroup={() => toggleGroup(gi)}
            open={open}
            togglePrompt={togglePrompt}
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
  open,
  togglePrompt,
}: {
  g: Group;
  gi: number;
  openGroup: boolean;
  toggleGroup: () => void;
  open: string;
  togglePrompt: (id: string) => void;
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
          const isOpen = open === id;
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => togglePrompt(id)}
                className={`w-full px-[24px] py-[14px] text-left md:pl-[58px] ${COLS}`}
                style={{ background: "var(--panel2)", borderBottom: "1px solid var(--line)" }}
              >
                <span className="text-[14px]">{p.q}</span>
                <MetricCells rank={p.rank} score={p.score} dScore={p.dScore} pos={p.pos} dPos={p.dPos} cite={p.cite} dCite={p.dCite} />
              </button>
              {isOpen && <PromptDetail p={p} />}
            </div>
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
        className="uppercase md:hidden"
        style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: "var(--dim)" }}
      >
        {label}
      </span>
      <span>{children}</span>
    </span>
  );
}

function PromptDetail({ p }: { p: Prompt }) {
  return (
    <div
      className="grid gap-[30px] p-[22px_24px_26px] md:grid-cols-[1fr_280px] md:pl-[58px]"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
    >
      <div className="flex flex-col gap-[10px]">
        <MonoLabel>Answer · {p.platform}</MonoLabel>
        <p className="max-w-[80ch] text-[14.5px]" style={{ lineHeight: 1.65, color: "var(--ink)" }}>
          {p.answer}
        </p>
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
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function Settings() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="grid gap-[20px] md:grid-cols-2">
        <Card className="flex flex-col gap-[16px] p-[22px_24px]">
          <SectionHead title="Brand" />
          <ReadonlyField label="Name" value={BRAND.name} />
          <ReadonlyField label="Website" value={BRAND.url} />
          <ReadonlyField label="Category" value={BRAND.category} />
        </Card>

        <Card className="flex flex-col p-[22px_24px]">
          <SectionHead title="Platforms & schedule" />
          <div className="mt-[16px] flex flex-col">
            {PLATFORMS.map((pl) => (
              <div
                key={pl.name}
                className="flex items-center justify-between py-[12px]"
                style={{ borderBottom: "1px solid var(--line)", color: pl.dim ? "var(--dim)" : "var(--ink)" }}
              >
                <span className="text-[14px]">{pl.name}</span>
                <StatusChip>{pl.status}</StatusChip>
              </div>
            ))}
            <div className="flex items-center justify-between py-[12px]">
              <span className="text-[14px]">Scan schedule</span>
              <StatusChip>{SCHEDULE}</StatusChip>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-[16px] p-[22px_24px]">
        <div className="flex flex-wrap items-start justify-between gap-[12px]">
          <SectionHead title="Monitored prompts" sub="15 prompts, run on every platform each week" />
          <span
            className="inline-flex items-center whitespace-nowrap text-[13px]"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", padding: "7px 12px" }}
          >
            + Add prompt
          </span>
        </div>
        <div className="grid gap-x-[24px] gap-y-[13px] md:grid-cols-3">
          {ALL_PROMPTS.map((q, i) => (
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
          website: site.website,
          description: site.description,
          topics: site.topics,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return fail(data.error ?? "Something went wrong. Try again.");
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
