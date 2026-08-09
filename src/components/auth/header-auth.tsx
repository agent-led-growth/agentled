"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Lockup } from "@/components/hero/lockup";
import { SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

import { OtpForm } from "./otp-form";

const chipClass =
  "shrink-0 border border-[var(--border-hairline)] px-[16px] py-[9px] text-[14px] whitespace-nowrap text-[var(--text-muted)] no-underline transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text-primary)] md:px-[20px] md:text-[15px]";

/**
 * Header auth control. Client-side so the landing stays statically rendered:
 * it shows "Sign up / Sign in" (opening the auth modal) by default, and flips
 * to "Account / Sign out" once the browser session is detected. It reacts to
 * sign-out live via onAuthStateChange; sign-in comes through our route handler
 * (not the browser client), so the modal's onSuccess re-reads the session.
 */
export function HeaderAuth() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function refreshUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  return (
    <>
      {user ? (
        <div className="flex items-center gap-[8px] md:gap-[10px]">
          <Link href="/account" className={chipClass}>
            Account
          </Link>
          <button type="button" onClick={signOut} className={chipClass}>
            Sign out
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={chipClass}>
          Sign up / Sign in
        </button>
      )}

      {open && (
        <AuthModal onSuccess={refreshUser} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AuthModal({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const restoreFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => cardRef.current?.querySelector("input")?.focus(),
      0,
    );

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      restoreFocus?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-[16px] md:p-[40px]"
      style={{ background: "rgba(4,6,5,0.72)" }}
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-[520px] bg-[var(--surface)] p-[28px] md:p-[40px]"
        style={{ border: "1px solid var(--border-hairline)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-[14px] right-[14px] grid size-[34px] place-items-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[16px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>

        <div className="flex flex-col gap-[16px] md:gap-[20px]">
          <div className="flex justify-center pt-[4px]">
            <Lockup />
          </div>
          <h2
            id={titleId}
            className="max-w-[16ch] text-[32px] leading-[0.98] font-bold tracking-[-0.045em] text-[var(--text-primary)] md:text-[40px]"
          >
            {SITE.tagline}
          </h2>
          <p className="text-[16px] leading-[1.5] text-[var(--text-muted)] md:text-[17px]">
            {SITE.shortDescription}
          </p>
          <OtpForm
            submitLabel="Subscribe"
            onSuccess={onSuccess}
            redirectTo="/home"
            source="header"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
