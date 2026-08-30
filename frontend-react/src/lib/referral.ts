const KEY = "enclave_referral_code";

export function captureReferralCode(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && code.trim()) {
      localStorage.setItem(KEY, code.trim());
      window.history.replaceState(
        {},
        "",
        window.location.pathname + window.location.hash
      );
      return code.trim();
    }
  } catch {
    /* ignore */
  }
  return getStoredReferralCode();
}

export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReferralCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
