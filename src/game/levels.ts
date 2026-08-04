import type { LevelDef } from "./types";
import { LEVELS_ACT12 } from "./levels_act12";
import { LEVELS_ACT345 } from "./levels_act345";
import { applyQuotaOverrides } from "./quotaOverrides";

export const LEVELS: LevelDef[] = applyQuotaOverrides([...LEVELS_ACT12, ...LEVELS_ACT345]);
