import type { CharacterId, HudSnapshot } from "./types";
import { CHARACTERS } from "./data";
import { gameAudio } from "./audio";

type Props = {
  ready: boolean;
  character: CharacterId;
  setCharacter: (id: CharacterId) => void;
  hud: HudSnapshot;
  onStart: () => void;
  onContinue: () => void;
  onStartLevel: (n: number) => void;
  onDaily: () => void;
  setEngineCharacter: (id: CharacterId) => void;
};

export function TitleOverlay({
  ready,
  character,
  setCharacter,
  hud,
  onStart,
  onContinue,
  onStartLevel,
  onDaily,
  setEngineCharacter,
}: Props) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-gradient-to-b from-[#2a1840]/70 to-[#1a1028]/85 pointer-events-auto overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface/95 p-5 shadow-2xl">
        <h1 className="text-2xl font-black text-center text-fg tracking-tight">Booloobee</h1>
        <p className="text-center text-subtle text-sm mt-1">Ranch · glitter pipeline · rainbows</p>

        <div className="mt-4">
          <div className="text-xs text-muted mb-2 text-center">Pick a character</div>
          <div className="grid grid-cols-5 gap-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCharacter(c.id);
                  setEngineCharacter(c.id);
                  gameAudio.play("ui");
                }}
                className={`rounded-xl border p-2 text-center min-h-16 ${
                  character === c.id
                    ? "border-accent bg-accent/20 ring-2 ring-accent"
                    : "border-border bg-surface-2"
                }`}
                style={{ touchAction: "manipulation" }}
              >
                <div className="text-2xl leading-none">{c.emoji}</div>
                <div className="text-[9px] mt-1 text-fg font-semibold leading-tight">{c.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-muted mb-2 text-center">
            Stages · unlocked {hud.highestLevel}/18
          </div>
          <div className="grid grid-cols-6 gap-1.5 max-h-28 overflow-y-auto">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => {
              const unlocked = n <= hud.highestLevel;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!ready || !unlocked}
                  className={`rounded-lg border text-xs font-bold min-h-9 ${
                    unlocked
                      ? "border-accent/60 bg-accent/15 text-fg"
                      : "border-border bg-surface-2 text-muted opacity-50"
                  }`}
                  style={{ touchAction: "manipulation" }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!unlocked || !ready) return;
                    onStartLevel(n);
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={!ready}
            className="w-full rounded-xl bg-accent text-accent-fg px-4 py-3.5 text-sm font-bold min-h-12 disabled:opacity-50"
            style={{ touchAction: "manipulation", pointerEvents: "auto" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!ready) return;
              gameAudio.unlock();
              onContinue();
            }}
          >
            {ready ? `Continue · stage ${hud.highestLevel}` : "Loading…"}
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-border bg-surface-2 text-fg px-4 py-3 text-sm font-semibold min-h-12"
            style={{ touchAction: "manipulation", pointerEvents: "auto" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              gameAudio.unlock();
              onStart();
            }}
          >
            New run (stage 1)
          </button>
          {hud.dailyAvailable && (
            <button
              type="button"
              className="w-full rounded-xl border border-gold/40 bg-gold/10 text-gold px-4 py-2.5 text-sm font-semibold min-h-11"
              style={{ touchAction: "manipulation" }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDaily();
              }}
            >
              Daily gift +25c
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-muted mt-3">
          Scoop → spa → grind → box → sell · landscape is best
        </p>
      </div>
    </div>
  );
}
