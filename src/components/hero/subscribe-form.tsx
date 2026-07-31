"use client";

import { useId, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

// Deliberately permissive: real validation happens server-side. This only
// catches obvious typos before we spend a round-trip on them.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <p
        role="status"
        className="max-w-[580px] text-[17px] leading-[1.45] text-[var(--text-primary)] md:text-[18px]"
      >
        <span className="mr-[10px] text-[var(--accent)]" aria-hidden="true">
          ✓
        </span>
        You&rsquo;re on the list. Check your inbox to confirm.
      </p>
    );
  }

  const invalid = status === "error";

  return (
    <form
      onSubmit={onSubmit}
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
            if (status === "error") {
              setStatus("idle");
              setErrorMessage(null);
            }
          }}
          placeholder="you@company.com"
          autoComplete="email"
          aria-label="Email address"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          disabled={status === "submitting"}
          className="h-[54px] flex-1 border border-[var(--border-hairline)] bg-[var(--field-bg)] px-[18px] text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] disabled:opacity-60 md:h-[62px] md:px-[20px] md:text-[18px]"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="grid h-[54px] shrink-0 place-items-center bg-[var(--btn-bg)] px-[34px] text-[17px] font-bold text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-70 md:h-[62px] md:text-[18px]"
        >
          {status === "submitting" ? (
            <span className="flex items-center gap-[10px]">
              <span
                aria-hidden="true"
                className="size-[14px] animate-spin border-2 border-current border-t-transparent"
              />
              Subscribing
            </span>
          ) : (
            "Subscribe"
          )}
        </button>
      </div>

      {invalid && errorMessage ? (
        <p id={errorId} role="alert" className="font-mono text-[12px] text-[#e0603f]">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
