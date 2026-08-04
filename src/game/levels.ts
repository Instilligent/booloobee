import type { LevelDef } from "./types";
import { LEVELS_ACT12 } from "./levels_act12";
import { LEVELS_ACT345 } from "./levels_act345";

export const LEVELS: LevelDef[] = [...LEVELS_ACT12, ...LEVELS_ACT345];
