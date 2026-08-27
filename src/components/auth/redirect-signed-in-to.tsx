"use client";

import { useRouter } from "next/navigation";

import { useWhenSignedIn } from "./use-when-signed-in";

/**
 * Sends signed-in visitors to `to`; anonymous visitors (and crawlers) stay put,
 * so the host page still renders statically and stays indexable. A
 * single-destination sibling of RedirectSignedIn (which additionally forks on
 * whether the user has scanned). Used by the comparison landing to route an
 * already-signed-in visitor straight to the public table with no email step.
 */
export function RedirectSignedInTo({ to }: { to: string }) {
  const router = useRouter();
  useWhenSignedIn((isActive) => {
    if (isActive()) router.replace(to);
  });
  return null;
}
