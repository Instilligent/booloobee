import type { GunTier, SaveData } from "./types";

const KEY = "booloobee-save-v1";

export function defaultSave(): SaveData {
  return {
    version: 1,
    coins: 0,
    gunTier: 0,
    upgrades: {},
    highestLevel: 1,
    totalSold: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed?.version !== 1) return defaultSave();
    return {
      ...defaultSave(),
      ...parsed,
      upgrades: parsed.upgrades ?? {},
      gunTier: Math.min(4, Math.max(0, parsed.gunTier ?? 0)) as GunTier,
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
