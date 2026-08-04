/**
 * The AI Search onboarding (landing URL → brief → topics) and the gated
 * dashboard live on different routes, so the collected site data is handed off
 * through sessionStorage. The gate reads it at verify time to store the site.
 */
const KEY = "ai-search-onboarding";

export type OnboardingData = {
  website: string;
  description: string;
  topics: string[];
};

export function saveOnboarding(data: OnboardingData) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage disabled / private mode — the gate just won't have site data.
  }
}

export function readOnboarding(): Partial<OnboardingData> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingData) : {};
  } catch {
    return {};
  }
}

export function clearOnboarding() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
