import type { LevelDef } from "./types";
import { LEVELS } from "./levels";

/** Act grouping for the 18-stage campaign */
export function actForLevel(id: number): { act: number; title: string } {
  if (id <= 3) return { act: 1, title: "Learn the loop" };
  if (id <= 6) return { act: 2, title: "Automate" };
  if (id <= 9) return { act: 3, title: "Carnival chaos" };
  if (id <= 12) return { act: 4, title: "Factory row" };
  return { act: 5, title: "VIP & Boss" };
}

export function levelById(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Quota-clear bonus scales gently with act */
export function quotaBonus(levelId: number, sold: number): number {
  const { act } = actForLevel(levelId);
  return Math.floor(18 + sold * 2 + act * 8);
}

/** NZ-local calendar day key for daily claim */
export function todayKey(tz = "Pacific/Auckland"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const DAILY_BONUS_COINS = 25;
