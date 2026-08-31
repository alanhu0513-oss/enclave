export type Platform = "web" | "ios" | "android" | "electron";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";

  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/electron/.test(ua)) return "electron";

  return "web";
}

export function isNative(): boolean {
  const platform = detectPlatform();
  return platform === "ios" || platform === "android";
}

export function isMobileWeb(): boolean {
  return /android|iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

// Capacitor plugins (lazy loaded)
export async function getCapacitorPlugins() {
  if (!isNative()) return null;

  try {
    const [SplashScreen, StatusBar, LocalNotifications, Share] = await Promise.all([
      import("@capacitor/splash-screen").then((m) => m.SplashScreen),
      import("@capacitor/status-bar").then((m) => m.StatusBar),
      import("@capacitor/local-notifications").then((m) => m.LocalNotifications),
      import("@capacitor/share").then((m) => m.Share),
    ]);

    return { SplashScreen, StatusBar, LocalNotifications, Share };
  } catch {
    return null;
  }
}
