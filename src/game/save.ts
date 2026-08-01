import type { CharacterId, GunTier, SaveData } from "./types";

const KEY = "booloobee-save-v2";
const LEGACY = "booloobee-save-v1";

export function defaultSave(): SaveData {
  return {
    version: 2,
    coins: 40, // pilot-friendly starting coins for hires
    gunTier: 0,
    upgrades: {},
    highestLevel: 1,
    totalSold: 0,
    character: "rancher",
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData> & { version?: number };
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      version: 2,
      upgrades: parsed.upgrades ?? {},
      gunTier: Math.min(4, Math.max(0, parsed.gunTier ?? 0)) as GunTier,
      character: (parsed.character as CharacterId) || "rancher",
      coins: typeof parsed.coins === "number" ? parsed.coins : base.coins,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
