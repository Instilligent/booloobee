/**
 * StoreKit / IAP bridge stub for Booloobee.
 * Web pilot: no-ops with friendly messages.
 * iOS Capacitor: native plugin posts messages to window.__booloobeeIap.
 *
 * Product IDs match docs/IOS_APP_STORE.md
 */

export const IAP_PRODUCTS = {
  coins_small: { id: "com.instilligent.booloobee.coins_small", coins: 200, label: "Coin Pouch" },
  coins_med: { id: "com.instilligent.booloobee.coins_med", coins: 600, label: "Coin Bucket" },
  coins_large: { id: "com.instilligent.booloobee.coins_large", coins: 1500, label: "Coin Vault" },
  stars_pack: { id: "com.instilligent.booloobee.stars_pack", stars: 15, label: "Star Bundle" },
  remove_ads: { id: "com.instilligent.booloobee.remove_ads", flag: "removeAds" as const, label: "No Ads" },
  starter_pack: {
    id: "com.instilligent.booloobee.starter_pack",
    coins: 300,
    flag: "starterPack" as const,
    label: "Rancher Starter",
  },
} as const;

export type IapKey = keyof typeof IAP_PRODUCTS;

type IapListener = (event: { productId: string; ok: boolean; message?: string }) => void;

declare global {
  interface Window {
    __booloobeeIap?: {
      purchase?: (productId: string) => void;
      restore?: () => void;
    };
    __booloobeeOnPurchase?: (payload: { productId: string; ok: boolean; message?: string }) => void;
  }
}

const listeners = new Set<IapListener>();

export function onIapEvent(cb: IapListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(ev: { productId: string; ok: boolean; message?: string }) {
  for (const cb of listeners) cb(ev);
}

/** Call from native bridge when a purchase completes */
export function notifyPurchase(payload: { productId: string; ok: boolean; message?: string }) {
  emit(payload);
}

if (typeof window !== "undefined") {
  window.__booloobeeOnPurchase = notifyPurchase;
}

export function isNativeIapAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.__booloobeeIap?.purchase === "function";
}

export async function purchase(productKey: IapKey): Promise<{ ok: boolean; message: string }> {
  const def = IAP_PRODUCTS[productKey];
  if (!def) return { ok: false, message: "Unknown product" };

  if (isNativeIapAvailable()) {
    window.__booloobeeIap!.purchase!(def.id);
    return { ok: true, message: "Opening App Store…" };
  }

  // Web pilot: soft mock so UI can be tested without StoreKit
  if (import.meta.env.DEV) {
    emit({ productId: def.id, ok: true, message: `[dev mock] ${def.label}` });
    return { ok: true, message: `Dev mock: ${def.label}` };
  }

  return {
    ok: false,
    message: "Purchases unlock in the iOS app. Web pilot is free to play.",
  };
}

export async function restorePurchases(): Promise<{ ok: boolean; message: string }> {
  if (isNativeIapAvailable() && window.__booloobeeIap?.restore) {
    window.__booloobeeIap.restore();
    return { ok: true, message: "Restoring…" };
  }
  return { ok: false, message: "Restore is available in the iOS app." };
}
