/**
 * Progression helpers bound onto GameEngine at runtime.
 * Unlocks daily gift + level select even if engine.ts on remote is older.
 */
import type { GameEngine } from "./engine";
import { LEVELS } from "./levels";
import { DAILY_BONUS_COINS, todayKey } from "./progression";
import { writeSave } from "./save";
import { gameAudio } from "./audio";

export function installProgression(eng: GameEngine) {
  const e = eng as any;
  if (e.__progressionInstalled) return;
  e.__progressionInstalled = true;

  e.startLevel = function (levelIndex: number) {
    const maxIdx = Math.max(0, (this.save.highestLevel || 1) - 1);
    const idx = Math.max(0, Math.min(LEVELS.length - 1, Math.min(levelIndex, maxIdx)));
    this.startGame(idx);
  };

  e.claimDaily = function (): boolean {
    const key = todayKey();
    if (this.save.lastDailyClaim === key) {
      if (typeof this.flashMessage === "function") this.flashMessage("Already claimed today");
      if (typeof this.emitHud === "function") this.emitHud(true);
      return false;
    }
    this.save.lastDailyClaim = key;
    this.save.coins += DAILY_BONUS_COINS;
    writeSave(this.save);
    gameAudio.play("thanks");
    if (typeof this.flashMessage === "function") this.flashMessage(`Daily +${DAILY_BONUS_COINS}c`);
    if (typeof this.emitHud === "function") this.emitHud(true);
    return true;
  };

  e.isDailyAvailable = function (): boolean {
    return this.save.lastDailyClaim !== todayKey();
  };

  e.getHighestLevel = function (): number {
    return this.save.highestLevel || 1;
  };

  // Ensure HUD always carries progression fields for title UI
  const cbs = e.cbs;
  if (cbs?.onHud) {
    const prev = cbs.onHud.bind(cbs);
    cbs.onHud = (snap: any) => {
      prev({
        ...snap,
        highestLevel: e.save?.highestLevel ?? snap.highestLevel ?? 1,
        actTitle: snap.actTitle ?? "",
        dailyAvailable:
          typeof snap.dailyAvailable === "boolean"
            ? snap.dailyAvailable
            : e.save?.lastDailyClaim !== todayKey(),
      });
    };
  }
}
