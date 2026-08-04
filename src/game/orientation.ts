/** Landscape helpers — web best-effort + Cap native when available. */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: any };
  }
}

export async function tryLockLandscape() {
  try {
    const Cap = window.Capacitor;
    if (Cap?.isNativePlatform?.()) {
      const SO = Cap.Plugins?.ScreenOrientation;
      if (SO?.lock) {
        await SO.lock({ orientation: "landscape" });
        return;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const anyScreen = screen as any;
    const orient = anyScreen.orientation || (window as any).orientation;
    if (orient?.lock) {
      await orient.lock("landscape").catch(() =>
        orient.lock("landscape-primary").catch(() => {}),
      );
    }
  } catch {
    /* browsers often block unless fullscreen / installed */
  }

  try {
    const el = document.documentElement as any;
    if (el.requestFullscreen) await el.requestFullscreen().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function isPortraitPhone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return false;
  } catch {
    /* ignore */
  }
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  const coarse =
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  return portrait && coarse;
}
