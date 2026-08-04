"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Step = "email" | "code" | "done";
type Status = "idle" | "submitting" | "error";

// Permissive on purpose; the real check is server-side. Catches obvious typos
// before we spend a round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass =
  "h-[54px] w-full border border-[var(--border-hairline)] bg-[var(--field-bg)] px-[18px] text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] disabled:opacity-60 md:h-[62px] md:flex-1 md:px-[20px] md:text-[18px]";
const buttonClass =
  "grid h-[54px] shrink-0 place-items-center bg-[var(--btn-bg)] px-[34px] text-[17px] font-bold text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-70 md:h-[62px] md:text-[18px]";

/**
 * Two-step email-OTP sign-in: enter email → receive a 6-digit code → verify.
 * On success the verify route has already set the session cookies.
 *
 * - `redirectTo` set: refresh + navigate there.
 * - `redirectTo` omitted (the hero and the auth modal): show an inline success
 *   state and refresh in place, so the page isn't yanked away.
 */
export function OtpForm({
  redirectTo,
  submitLabel = "Send code",
  onSuccess,
}: {
  redirectTo?: string;
  submitLabel?: string;
  /** Fired after a successful verify (session cookies are set by then). */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const errorId = useId();

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) return fail("Enter a valid email address.");

    setStatus("submitting");
    setError(null);
    setNotice(null);
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
      setNotice(`We sent a 6-digit code to ${value}.`);
    } catch {
      fail("Network error. Please try again.");
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const value = code.trim();
    if (!/^\d{6}$/.test(value))
      return fail("Enter the 6-digit code from your email.");

    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return fail(data.error ?? "Something went wrong. Try again.");

      // Cookies are set on the response above; make the server re-read them.
      onSuccess?.();
      router.refresh();
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        setStep("done");
        setStatus("idle");
      }
    } catch {
      fail("Network error. Please try again.");
    }
  }

  const invalid = status === "error";
  const submitting = status === "submitting";

  if (step === "done") {
    return (
      <p
        role="status"
        className="max-w-[580px] text-[17px] leading-[1.45] text-[var(--text-primary)] md:text-[18px]"
      >
        <span className="mr-[10px] text-[var(--accent)]" aria-hidden="true">
          ✓
        </span>
        You&rsquo;re verified and signed in. Check your inbox for a welcome.
      </p>
    );
  }

  if (step === "email") {
    return (
      <form
        onSubmit={requestCode}
        noValidate
        className="flex w-full max-w-[580px] flex-col gap-[10px]"
      >
        <div className="flex flex-col gap-[10px] md:flex-row">
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (invalid) setStatus("idle");
            }}
            placeholder="you@company.com"
            autoComplete="email"
            aria-label="Email address"
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            disabled={submitting}
            className={fieldClass}
          />
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? <Spinner label="Sending" /> : submitLabel}
          </button>
        </div>
        {invalid && error ? <ErrorLine id={errorId}>{error}</ErrorLine> : null}
      </form>
    );
  }

  return (
    <form
      onSubmit={verifyCode}
      noValidate
      className="flex w-full max-w-[580px] flex-col gap-[10px]"
    >
      {notice ? (
        <p
          role="status"
          className="text-[15px] leading-[1.5] text-[var(--text-muted)] md:text-[16px]"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex flex-col gap-[10px] md:flex-row">
        <input
          type="text"
          name="code"
          value={code}
          onChange={(e) => {
            // Keep only digits so paste of "123 456" or "code: 123456" works.
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            if (invalid) setStatus("idle");
          }}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="6-digit code"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          disabled={submitting}
          autoFocus
          className={`${fieldClass} font-mono tracking-[0.4em]`}
        />
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? <Spinner label="Verifying" /> : "Verify"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setCode("");
          setStatus("idle");
          setError(null);
          setNotice(null);
        }}
        className="self-start text-[14px] text-[var(--text-muted)] underline-offset-4 hover:underline"
      >
        ← Use a different email
      </button>
      {invalid && error ? <ErrorLine id={errorId}>{error}</ErrorLine> : null}
    </form>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-[10px]">
      <span
        aria-hidden="true"
        className="size-[14px] animate-spin border-2 border-current border-t-transparent"
      />
      {label}
    </span>
  );
}

function ErrorLine({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="font-mono text-[12px] text-[#e0603f]">
      {children}
    </p>
  );
}
