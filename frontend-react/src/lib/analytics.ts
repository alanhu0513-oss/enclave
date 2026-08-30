const UMAMI_ENDPOINT = import.meta.env.VITE_UMAMI_ENDPOINT as string | undefined;
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const ENABLED = Boolean(UMAMI_ENDPOINT && UMAMI_WEBSITE_ID);

type FunnelEvent =
  | "signup"
  | "first_scan"
  | "plan_view"
  | "checkout_started"
  | "activation"
  | "onboarding_skip"
  | "onboarding_complete"
  | "referral_shared";

export function track(event: FunnelEvent, data?: Record<string, string>) {
  if (!ENABLED) return;
  try {
    fetch(`${UMAMI_ENDPOINT}/api/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: UMAMI_WEBSITE_ID,
          name: event,
          data: data ?? {},
          url: window.location.href,
          referrer: document.referrer || undefined,
          timestamp: Date.now(),
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* no-op on network failure */
  }
}

export const isAnalyticsEnabled = ENABLED;
