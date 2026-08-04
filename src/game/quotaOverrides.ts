/** Runtime quota/time overrides so balance ships even if level files lag. */
import type { LevelDef } from "./types";

const QUOTAS: Record<number, { quota: number; timeLimit: number; cropCount: number }> = {
  1: { quota: 12, timeLimit: 300, cropCount: 18 },
  2: { quota: 16, timeLimit: 310, cropCount: 20 },
  3: { quota: 22, timeLimit: 320, cropCount: 22 },
  4: { quota: 28, timeLimit: 330, cropCount: 24 },
  5: { quota: 34, timeLimit: 340, cropCount: 26 },
  6: { quota: 40, timeLimit: 350, cropCount: 28 },
  7: { quota: 46, timeLimit: 360, cropCount: 30 },
  8: { quota: 52, timeLimit: 360, cropCount: 32 },
  9: { quota: 58, timeLimit: 370, cropCount: 34 },
  10: { quota: 64, timeLimit: 380, cropCount: 36 },
  11: { quota: 72, timeLimit: 390, cropCount: 38 },
  12: { quota: 80, timeLimit: 400, cropCount: 40 },
  13: { quota: 88, timeLimit: 410, cropCount: 42 },
  14: { quota: 96, timeLimit: 420, cropCount: 44 },
  15: { quota: 104, timeLimit: 430, cropCount: 46 },
  16: { quota: 112, timeLimit: 440, cropCount: 48 },
  17: { quota: 120, timeLimit: 450, cropCount: 50 },
  18: { quota: 140, timeLimit: 480, cropCount: 54 },
};

export function applyQuotaOverrides(levels: LevelDef[]) {
  for (const l of levels) {
    const o = QUOTAS[l.id];
    if (!o) continue;
    l.quota = o.quota;
    l.timeLimit = o.timeLimit;
    l.cropCount = o.cropCount;
  }
  return levels;
}
