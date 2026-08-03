import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { CHARACTERS } from "./data";
import { gameAudio } from "./audio";
import { GameEngine } from "./engine";
import type { CharacterId, HudSnapshot } from "./types";

const emptyHud: HudSnapshot = {
  screen: "title",
  level: 1,
  levelName: "Booloobee",
  health: 100,
  maxHealth: 100,
  coins: 40,
  raw: 0,
  washed: 0,
  glitter: 0,
  boxed: 0,
  sold: 0,
  quota: 0,
  timeLeft: 0,
  gunName: "Sparkle Sprinkler",
  gunTier: 0,
  interactHint: null,
  message: null,
  chain: { harvestRate: 1, processRate: 1, sellRate: 1, cropYield: 1 },
  upgrades: {},
  killCount: 0,
  isMobile: true,
  crew: { farmers: 0, grinders: 0, vendors: 0 },
  floats: [],
  nextStep: 1,
  character: "rancher",
  worldOffers: [],
  actionLabel: "USE",
};

type Action =
  | "start"
  | "continue"
  | "resume"
  | "pause"
  | "title"
  | "next"
  | "retry"
  | "buy"
  | "shootDown"
  | "shootUp"
  | "useDown"
  | "useUp";

export function GameApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(emptyHud);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [character, setCharacter] = useState<CharacterId>("rancher");
  const [landscapeHint, setLandscapeHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const lastTap = useRef(0);
  const stickId = useRef<number | null>(null);
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    gameAudio.loadMutePref();
    setMuted(gameAudio.isMuted);
    const unlock = () => gameAudio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const check = () => {
      // Soft tip only — never block the game
      const portrait = window.innerHeight > window.innerWidth * 1.05;
      const coarse =
        typeof window !== "undefined" &&
        (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
      setLandscapeHint(portrait && coarse && !hintDismissed);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [hintDismissed]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const eng = new GameEngine(el, { onHud: (h) => setHud({ ...h }) });
    engineRef.current = eng;
    eng.setMobile(true);
    setCharacter(eng.getCharacter());
    setReady(true);
    const onResize = () => eng.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      eng.dispose();
      engineRef.current = null;
    };
  }, []);

  const runAction = useCallback((action: Action, arg?: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    switch (action) {
      case "start":
        gameAudio.unlock();
        gameAudio.play("ui");
        eng.setCharacter(character);
        eng.startGame(0);
        break;
      case "continue":
        gameAudio.unlock();
        gameAudio.play("ui");
        eng.setCharacter(character);
        eng.continueGame();
        break;
      case "resume":
        gameAudio.play("ui");
        eng.resume();
        break;
      case "pause":
        eng.pause();
        break;
      case "title":
        eng.goTitle();
        break;
      case "next":
        eng.nextLevel();
        break;
      case "retry":
        eng.retryLevel();
        break;
      case "buy":
        gameAudio.unlock();
        if (arg) eng.buyUpgrade(arg);
        break;
      case "shootDown":
        eng.setTouchShoot(true);
        break;
      case "shootUp":
        eng.setTouchShoot(false);
        break;
      case "useDown":
        eng.setTouchInteract(true);
        break;
      case "useUp":
        eng.setTouchInteract(false);
        break;
    }
  }, [character]);

  // Native capture for reliability on phone preview
  useEffect(() => {
    const fire = (action: Action, arg?: string) => {
      const now = performance.now();
      if (now - lastTap.current < 40 && action !== "shootDown" && action !== "useDown") return;
      lastTap.current = now;
      runAction(action, arg);
    };
    const onEnd = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const el = t?.closest?.("[data-action]") as HTMLElement | null;
      if (!el) return;
      const action = el.dataset.action as Action | undefined;
      if (!action) return;
      if (action === "shootDown" || action === "useDown") return;
      e.preventDefault();
      e.stopPropagation();
      fire(action, el.dataset.arg);
    };
    document.addEventListener("touchend", onEnd, { capture: true, passive: false });
    document.addEventListener("click", onEnd, { capture: true });
    return () => {
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("click", onEnd, true);
    };
  }, [runAction]);

  const onStickStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t || stickId.current != null) return;
    stickId.current = t.identifier;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.38;
    const nx = Math.max(-1, Math.min(1, (t.clientX - cx) / max));
    const ny = Math.max(-1, Math.min(1, (cy - t.clientY) / max));
    engineRef.current?.setTouchMove(nx, ny);
    setStickKnob({ x: nx, y: ny });
  };
  const onStickMove = (e: React.TouchEvent) => {
    const t = Array.from(e.changedTouches).find((x) => x.identifier === stickId.current);
    if (!t) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.38;
    const nx = Math.max(-1, Math.min(1, (t.clientX - cx) / max));
    const ny = Math.max(-1, Math.min(1, (cy - t.clientY) / max));
    engineRef.current?.setTouchMove(nx, ny);
    setStickKnob({ x: nx, y: ny });
  };
  const onStickEnd = (e: React.TouchEvent) => {
    const t = Array.from(e.changedTouches).find((x) => x.identifier === stickId.current);
    if (!t) return;
    stickId.current = null;
    engineRef.current?.setTouchMove(0, 0);
    setStickKnob({ x: 0, y: 0 });
  };

  // Look: drag right half of screen
  useEffect(() => {
    if (hud.screen !== "playing") return;
    let id: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      if (t.clientX < window.innerWidth * 0.45) return;
      if ((e.target as HTMLElement)?.closest?.("[data-action], .stick-zone, .world-buy")) return;
      id = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      const t = Array.from(e.changedTouches).find((x) => x.identifier === id);
      if (!t) return;
      engineRef.current?.nudgeLook(t.clientX - lastX, t.clientY - lastY);
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some((x) => x.identifier === id)) id = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [hud.screen]);

  const playing = hud.screen === "playing";
  const hpPct = Math.max(0, (hud.health / Math.max(1, hud.maxHealth)) * 100);
  const quotaPct = Math.min(100, (hud.sold / Math.max(1, hud.quota)) * 100);
  const action = hud.actionLabel || "USE";
  const canUse = !!hud.interactHint && hud.interactHint !== "…" && hud.interactHint !== null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#1a1028] select-none">
      {/* 3D canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Soft landscape tip — does NOT block Play */}
      {landscapeHint && hud.screen === "title" && (
        <div className="absolute top-2 inset-x-2 z-[70] flex justify-center pointer-events-auto">
          <div className="flex items-center gap-2 rounded-full bg-bg/90 border border-border px-3 py-2 shadow-lg max-w-md">
            <span className="text-sm">↻ Landscape is easier</span>
            <button
              type="button"
              className="rounded-full bg-accent text-accent-fg text-xs font-bold px-3 py-1.5 min-h-9"
              style={{ touchAction: "manipulation" }}
              onClick={() => setHintDismissed(true)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Float texts only */}
      {playing &&
        hud.floats.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute z-30 font-bold text-sm drop-shadow-md"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              color: f.color,
              opacity: Math.min(1, f.life * 1.4),
              transform: "translate(-50%, -50%)",
            }}
          >
            {f.text}
          </div>
        ))}

      {/* In-world hire / buy buttons above shop */}
      {playing &&
        hud.worldOffers
          .filter((o) => o.visible)
          .map((o) => (
            <button
              key={o.id}
              type="button"
              data-action="buy"
              data-arg={o.id}
              className={`world-buy absolute z-40 pointer-events-auto rounded-xl px-3 py-2 text-xs font-bold shadow-lg border min-h-11 active:scale-95 transition-transform ${
                o.canAfford
                  ? "bg-accent text-accent-fg border-white/40 shadow-accent/30"
                  : "bg-surface-2/95 text-muted border-border opacity-80"
              }`}
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                transform: "translate(-50%, -50%)",
                touchAction: "manipulation",
              }}
            >
              <span className="block leading-tight">{o.label}</span>
              <span className="tabular opacity-90 text-[10px]">
                {o.cost}c · {o.level}/{o.maxLevel}
              </span>
            </button>
          ))}

      {/* Minimal top bar */}
      {playing && (
        <div className="absolute top-0 inset-x-0 z-20 pointer-events-none p-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="hud-chip !py-1.5 !px-2.5 tabular text-sm font-bold text-gold">
              {hud.coins}c
            </div>
            <div className="w-24 h-2 rounded-full bg-bg/80 overflow-hidden border border-border">
              <div className="h-full bg-accent" style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            {/* Pipeline counters — color dots, no emoji */}
            <div className="flex gap-1 items-end">
              {[
                { v: hud.raw, color: "bg-pink-400", hot: hud.nextStep === 1 },
                { v: hud.washed, color: "bg-sky-400", hot: hud.nextStep === 2 },
                { v: hud.glitter, color: "bg-violet-400", hot: hud.nextStep === 3 },
                { v: hud.boxed, color: "bg-amber-400", hot: hud.nextStep === 4 },
                { v: hud.sold, color: "bg-yellow-300", hot: hud.nextStep === 5 },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg min-w-9 px-1.5 py-1 text-center border ${
                    s.hot ? "border-accent bg-accent/25 scale-110" : "border-border bg-bg/70"
                  }`}
                >
                  <div className={`mx-auto h-1.5 w-1.5 rounded-full ${s.color}`} />
                  <div className="text-[10px] tabular font-bold text-fg mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="w-32 h-1.5 rounded-full bg-bg/80 overflow-hidden">
              <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${quotaPct}%` }} />
            </div>
          </div>
          <div className="flex gap-1.5 pointer-events-auto">
            <button
              type="button"
              className="hud-chip !p-2.5 min-h-11 min-w-11"
              style={{ touchAction: "manipulation" }}
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={(e) => {
                e.preventDefault();
                gameAudio.unlock();
                setMuted(gameAudio.toggleMute());
              }}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              data-action="pause"
              className="hud-chip !p-2.5 min-h-11 min-w-11"
              style={{ touchAction: "manipulation" }}
              aria-label="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tiny contextual chip near action (only when near something) */}
      {playing && canUse && (
        <div className="absolute bottom-[22%] right-[18%] z-20 pointer-events-none">
          <div className="rounded-full bg-accent text-accent-fg text-xs font-bold px-3 py-1 shadow-md">
            {action}
          </div>
        </div>
      )}

      {/* Short toast only */}
      {playing && hud.message && (
        <div className="absolute top-[14%] inset-x-0 z-20 flex justify-center pointer-events-none px-4">
          <div className="rounded-full bg-bg/85 text-fg text-sm font-semibold px-4 py-1.5 shadow border border-border">
            {hud.message}
          </div>
        </div>
      )}

      {/* Controls — landscape: stick left, 2 big buttons right */}
      {playing && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <div
            className="stick-zone absolute bottom-4 left-4 w-[28vmin] h-[28vmin] max-w-36 max-h-36 pointer-events-auto rounded-full border-2 border-white/25 bg-black/25"
            style={{ touchAction: "none" }}
            onTouchStart={onStickStart}
            onTouchMove={onStickMove}
            onTouchEnd={onStickEnd}
            onTouchCancel={onStickEnd}
          >
            <div
              className="absolute w-[36%] h-[36%] rounded-full bg-white/50 border border-white/40 shadow-md"
              style={{
                left: `calc(50% + ${stickKnob.x * 28}% - 18%)`,
                top: `calc(50% - ${stickKnob.y * 28}% - 18%)`,
              }}
            />
          </div>
          <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
            <button
              type="button"
              className={`rounded-2xl font-black text-sm shadow-xl min-h-[16vmin] min-w-[16vmin] max-h-24 max-w-24 active:scale-95 ${
                canUse ? "bg-accent text-accent-fg ring-2 ring-white/50 animate-pulse" : "bg-surface-2/90 text-muted"
              }`}
              style={{ touchAction: "none" }}
              onTouchStart={(e) => {
                e.preventDefault();
                runAction("useDown");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                runAction("useUp");
              }}
              onMouseDown={() => runAction("useDown")}
              onMouseUp={() => runAction("useUp")}
              onMouseLeave={() => runAction("useUp")}
            >
              {action}
            </button>
            <button
              type="button"
              className="rounded-2xl bg-pink-500 text-white font-black text-sm shadow-xl min-h-[16vmin] min-w-[16vmin] max-h-24 max-w-24 active:scale-95 border-2 border-white/30"
              style={{ touchAction: "none" }}
              onTouchStart={(e) => {
                e.preventDefault();
                runAction("shootDown");
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                runAction("shootUp");
              }}
              onMouseDown={() => runAction("shootDown")}
              onMouseUp={() => runAction("shootUp")}
              onMouseLeave={() => runAction("shootUp")}
            >
              FIRE
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      {hud.screen === "title" && (
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
                      engineRef.current?.setCharacter(c.id);
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

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                data-action="start"
                disabled={!ready}
                className="w-full rounded-xl bg-accent text-accent-fg px-4 py-3.5 text-sm font-bold min-h-12 disabled:opacity-50"
                style={{ touchAction: "manipulation", pointerEvents: "auto" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!ready) return;
                  gameAudio.unlock();
                  runAction("start");
                }}
              >
                {ready ? "Play" : "Loading…"}
              </button>
              <button
                type="button"
                data-action="continue"
                className="w-full rounded-xl border border-border bg-surface-2 text-fg px-4 py-3 text-sm font-semibold min-h-12"
                style={{ touchAction: "manipulation", pointerEvents: "auto" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  gameAudio.unlock();
                  runAction("continue");
                }}
              >
                Continue
              </button>
            </div>
            <p className="text-center text-[11px] text-muted mt-3">
              Walk to pink piles · green button works the chain
            </p>
          </div>
        </div>
      )}

      {/* Pause / end screens — keep tiny */}
      {hud.screen === "paused" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-auto p-4">
          <div className="w-full max-w-xs rounded-2xl bg-surface border border-border p-5 flex flex-col gap-2">
            <button type="button" data-action="resume" className="w-full rounded-xl bg-accent text-accent-fg py-3 font-bold min-h-12 inline-flex items-center justify-center gap-2">
              <Play className="h-4 w-4" /> Resume
            </button>
            <button type="button" data-action="title" className="w-full rounded-xl border border-border py-3 font-semibold min-h-12">
              Home
            </button>
          </div>
        </div>
      )}

      {hud.screen === "levelComplete" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-auto p-4">
          <div className="w-full max-w-xs rounded-2xl bg-surface border border-border p-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <div className="font-bold text-fg text-lg">Done!</div>
            <div className="text-gold font-bold mt-1">{hud.coins}c</div>
            <button type="button" data-action="next" className="mt-4 w-full rounded-xl bg-accent text-accent-fg py-3 font-bold min-h-12">
              Next
            </button>
          </div>
        </div>
      )}

      {(hud.screen === "gameOver" || hud.screen === "victory") && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-auto p-4">
          <div className="w-full max-w-xs rounded-2xl bg-surface border border-border p-5 text-center">
            <div className="font-bold text-fg text-lg">
              {hud.screen === "victory" ? "You win!" : "Time up"}
            </div>
            <button type="button" data-action="retry" className="mt-4 w-full rounded-xl bg-accent text-accent-fg py-3 font-bold min-h-12">
              Retry
            </button>
            <button type="button" data-action="title" className="mt-2 w-full rounded-xl border border-border py-3 font-semibold min-h-12">
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
