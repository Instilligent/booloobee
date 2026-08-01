import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Home,
  Pause,
  Play,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { LEVELS, UPGRADES, upgradeCost } from "./data";
import { GameEngine } from "./engine";
import type { HudSnapshot } from "./types";

const emptyHud: HudSnapshot = {
  screen: "title",
  level: 1,
  levelName: "Booloobee",
  health: 100,
  maxHealth: 100,
  coins: 0,
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
};

function formatTime(t: number) {
  const s = Math.max(0, Math.ceil(t));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const btnPrimary =
  "w-full rounded-xl bg-accent text-accent-fg px-4 py-3.5 text-sm font-bold min-h-12 shadow-lg active:opacity-90";
const btnMenu =
  "w-full rounded-xl border border-border bg-surface-2 text-fg px-4 py-3.5 text-sm font-semibold min-h-12 inline-flex items-center justify-center gap-2";

type Action =
  | "start"
  | "continue"
  | "resume"
  | "pause"
  | "upgrades"
  | "closeUpgrades"
  | "title"
  | "next"
  | "retry"
  | "buy"
  | "shootDown"
  | "shootUp"
  | "useDown"
  | "useUp"
  | "jump";

export function GameApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(emptyHud);
  const [ready, setReady] = useState(false);
  const [isTouch, setIsTouch] = useState(true);
  const lastTap = useRef(0);

  // sticks
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const coarse =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    setIsTouch(coarse);
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const eng = new GameEngine(el, {
      onHud: (h) => setHud({ ...h }),
    });
    engineRef.current = eng;
    eng.setMobile(true);
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

  useEffect(() => {
    engineRef.current?.setMobile(isTouch || hud.isMobile);
  }, [isTouch, hud.isMobile]);

  const runAction = useCallback((action: Action, arg?: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    switch (action) {
      case "start":
        eng.startGame(0);
        break;
      case "continue":
        eng.continueGame();
        break;
      case "resume":
        eng.resume();
        break;
      case "pause":
        eng.pause();
        break;
      case "upgrades":
        eng.openUpgrades();
        break;
      case "closeUpgrades":
        eng.closeUpgrades();
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
      case "jump":
        eng.setTouchJump(true);
        break;
    }
  }, []);

  // Document-level touch delegation (iframe / mobile reliable)
  useEffect(() => {
    const resolve = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return null;
      const el = t.closest("[data-action]") as HTMLElement | null;
      if (!el || el.hasAttribute("disabled")) return null;
      return {
        action: el.getAttribute("data-action") as Action,
        arg: el.getAttribute("data-arg") || undefined,
        el,
      };
    };

    const onStart = (e: TouchEvent | PointerEvent) => {
      const hit = resolve(e);
      if (!hit) return;
      if (hit.action === "shootDown" || hit.action === "useDown" || hit.action === "jump") {
        e.preventDefault();
        runAction(hit.action);
      }
    };

    const onEnd = (e: TouchEvent | PointerEvent) => {
      const hit = resolve(e);
      if (hit?.action === "shootDown") {
        runAction("shootUp");
        return;
      }
      if (hit?.action === "useDown") {
        runAction("useUp");
        return;
      }
      // release holds if finger lifts anywhere
      if (!hit) {
        engineRef.current?.setTouchShoot(false);
        engineRef.current?.setTouchInteract(false);
      }
    };

    const onClick = (e: MouseEvent) => {
      const hit = resolve(e);
      if (!hit) return;
      if (hit.action === "shootDown" || hit.action === "useDown" || hit.action === "jump") return;
      const now = Date.now();
      if (now - lastTap.current < 350) return;
      lastTap.current = now;
      e.preventDefault();
      runAction(hit.action, hit.arg);
    };

    document.addEventListener("touchstart", onStart, { passive: false, capture: true });
    document.addEventListener("touchend", onEnd, { passive: false, capture: true });
    document.addEventListener("pointerdown", onStart, { capture: true });
    document.addEventListener("pointerup", onEnd, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("pointerdown", onStart, true);
      document.removeEventListener("pointerup", onEnd, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [runAction]);

  // Move stick
  const onStickStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stickId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    updateStick(e);
  };
  const onStickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    updateStick(e);
  };
  const onStickEnd = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    engineRef.current?.setTouchMove(0, 0);
  };
  const updateStick = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (e.clientX - cx) / (rect.width * 0.42);
    let y = (cy - e.clientY) / (rect.height * 0.42);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    engineRef.current?.setTouchMove(x, y);
  };

  // Look drag on open space
  const onLookStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-action],[data-stick]")) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    engineRef.current?.nudgeLook(dx, dy);
  };
  const onLookEnd = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    lookId.current = null;
  };

  const healthPct = Math.max(0, (hud.health / Math.max(1, hud.maxHealth)) * 100);
  const quotaPct = Math.max(0, Math.min(100, (hud.sold / Math.max(1, hud.quota)) * 100));
  const playing = hud.screen === "playing";
  const showTouch = isTouch || hud.isMobile;

  const useLabel = (() => {
    const h = (hud.interactHint || "").toLowerCase();
    if (h.includes("scoop")) return { title: "SCOOP", sub: "① hold", hot: true };
    if (h.includes("spa") || h.includes("bubble") || h.includes("wash"))
      return { title: "SPA", sub: "② hold", hot: true };
    if (h.includes("grind") || h.includes("feed")) return { title: "GRIND", sub: "③ hold", hot: true };
    if (h.includes("box") || h.includes("bow") || h.includes("fancy"))
      return { title: "BOX", sub: "④ hold", hot: true };
    if (h.includes("sell")) return { title: "SELL", sub: "⑤ hold", hot: true };
    if (h.includes("bubbling") || h.includes("grinding") || h.includes("boxing"))
      return { title: "…", sub: "working", hot: false };
    return { title: "USE", sub: "near stop", hot: false };
  })();

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-bg text-fg select-none"
      style={{ touchAction: "manipulation" }}
    >
      <div ref={mountRef} className="absolute inset-0" style={{ pointerEvents: "none" }} />

      {!ready && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg">
          <p className="text-muted text-sm">Loading ranch…</p>
        </div>
      )}

      {/* TITLE */}
      {hud.screen === "title" && ready && (
        <div
          className="absolute inset-0 z-40 flex items-end sm:items-center justify-center px-4 pb-8 pt-16"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div
            className="panel w-full max-w-md p-6"
            data-action="start"
            role="button"
            tabIndex={0}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">
              Booloobee Ranch
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">Sparkle supply chain</h1>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              Scoop sparkle-poop → bubble spa → glitter grinder → fancy boxer → pink market. Hire crew
              to automate. Unicorns are optional pests.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" data-action="start" className={btnPrimary}>
                Start Level 1
              </button>
              <button type="button" data-action="continue" className={btnMenu}>
                Continue
              </button>
            </div>
            <p className="mt-4 text-[11px] text-subtle leading-relaxed text-center">
              Phone: follow Scoop → Spa → Grind → Box → Sell. One green button at each stop.
            </p>
          </div>
        </div>
      )}

      {/* PLAYING HUD */}
      {playing && (
        <>
          {showTouch && (
            <div
              className="absolute inset-0 z-10"
              style={{ pointerEvents: "auto", touchAction: "none" }}
              onPointerDown={onLookStart}
              onPointerMove={onLookMove}
              onPointerUp={onLookEnd}
              onPointerCancel={onLookEnd}
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3">
            <div className="flex flex-col gap-2 min-w-[160px] max-w-[58%]">
              <div className="hud-chip">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="truncate">
                    Lv {hud.level} · {hud.levelName}
                  </span>
                  <span className="tabular text-fg font-medium">{formatTime(hud.timeLeft)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-bg overflow-hidden">
                  <div className="h-full rounded-full bg-danger" style={{ width: `${healthPct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-subtle">
                  <span>
                    HP {Math.ceil(hud.health)}/{hud.maxHealth}
                  </span>
                  <span className="text-gold tabular">{hud.coins}c</span>
                </div>
              </div>

              <div className="hud-chip text-[11px]">
                <div className="text-[10px] uppercase tracking-wider text-subtle mb-1.5">
                  Ranch pipeline
                </div>
                <div className="grid grid-cols-5 gap-0.5 text-center">
                  {(
                    [
                      ["①", "Scoop", hud.raw, hud.nextStep === 1],
                      ["②", "Spa", hud.washed, hud.nextStep === 2],
                      ["③", "Grind", hud.glitter, hud.nextStep === 3],
                      ["④", "Box", hud.boxed, hud.nextStep === 4],
                      ["⑤", "Sell", `${hud.sold}/${hud.quota}`, hud.nextStep === 5],
                    ] as const
                  ).map(([n, label, val, hot]) => (
                    <div
                      key={label}
                      className={
                        hot
                          ? "rounded-lg bg-accent/25 border border-accent px-0.5 py-1"
                          : "rounded-lg bg-bg/80 border border-border px-0.5 py-1"
                      }
                    >
                      <div className="text-[8px] text-subtle leading-none">{n}</div>
                      <div className="tabular text-xs font-bold text-fg leading-tight mt-0.5">
                        {val}
                      </div>
                      <div className="text-[8px] text-muted leading-none">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-bg overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${quotaPct}%` }} />
                </div>
                {(hud.crew.farmers > 0 || hud.crew.grinders > 0 || hud.crew.vendors > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                    {hud.crew.farmers > 0 && (
                      <span className="rounded-full bg-accent/20 text-accent px-2 py-0.5">
                        {hud.crew.farmers} farmer
                      </span>
                    )}
                    {hud.crew.grinders > 0 && (
                      <span className="rounded-full bg-info/20 text-info px-2 py-0.5">spa crew</span>
                    )}
                    {hud.crew.vendors > 0 && (
                      <span className="rounded-full bg-gold/20 text-gold px-2 py-0.5">pack crew</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="hud-chip text-xs text-right">
                <div className="text-subtle">Gun</div>
                <div className="font-medium text-fg">{hud.gunName}</div>
              </div>
              {showTouch && (
                <div className="flex gap-2 pointer-events-auto">
                  <button
                    type="button"
                    data-action="upgrades"
                    className="hud-chip !py-3 !px-4 text-fg min-h-12 min-w-12"
                    style={{ touchAction: "manipulation", pointerEvents: "auto" }}
                    aria-label="Shop"
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    data-action="pause"
                    className="hud-chip !py-3 !px-4 text-fg min-h-12 min-w-12"
                    style={{ touchAction: "manipulation", pointerEvents: "auto" }}
                    aria-label="Pause"
                  >
                    <Pause className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {hud.interactHint && (
            <div className="pointer-events-none absolute bottom-44 left-1/2 z-20 -translate-x-1/2 max-w-[90%]">
              <div className="hud-chip text-sm text-fg font-medium px-4 text-center">
                {hud.interactHint}
              </div>
            </div>
          )}

          {hud.message && (
            <div className="pointer-events-none absolute top-[26%] left-1/2 z-20 -translate-x-1/2 max-w-[90%]">
              <div className="rounded-md border border-border bg-surface/90 px-4 py-2 text-sm text-fg text-center">
                {hud.message}
              </div>
            </div>
          )}

          {hud.floats.map((f) => (
            <div
              key={f.id}
              className="pointer-events-none absolute z-25 font-bold text-sm"
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                color: f.color,
                opacity: Math.min(1, f.life * 1.4),
                transform: `translate(-50%, -50%) scale(${0.9 + f.life * 0.2})`,
                textShadow: "0 1px 2px rgba(0,0,0,0.7)",
              }}
            >
              {f.text}
            </div>
          ))}

          {!showTouch && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 opacity-60">
              <Crosshair className="h-5 w-5" strokeWidth={1.5} />
            </div>
          )}

          {showTouch && (
            <div className="absolute inset-0 z-30 pointer-events-none">
              <div className="pointer-events-none absolute bottom-[13.5rem] left-3 right-3 flex justify-center">
                <div className="rounded-full border border-border bg-surface/85 px-3 py-1.5 text-[10px] text-muted text-center max-w-[22rem] leading-snug">
                  Scoop → Spa → Grind → Box → Sell · hold{" "}
                  <span className="text-accent font-semibold">green</span> at each stop
                </div>
              </div>

              <div
                data-stick="move"
                className="pointer-events-auto absolute bottom-5 left-3 h-32 w-32 rounded-full border-2 border-white/40 bg-black/50 shadow-xl"
                style={{ touchAction: "none", pointerEvents: "auto" }}
                onPointerDown={onStickStart}
                onPointerMove={onStickMove}
                onPointerUp={onStickEnd}
                onPointerCancel={onStickEnd}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/90">
                  MOVE
                </div>
              </div>

              <div
                className="pointer-events-auto absolute bottom-5 right-3 flex flex-col items-end gap-2.5"
                style={{ pointerEvents: "auto" }}
              >
                <button
                  type="button"
                  data-action="shootDown"
                  className="h-14 w-14 rounded-full border-2 border-white/50 bg-pink-500/80 text-[10px] font-bold text-white shadow-xl"
                  style={{ touchAction: "none", pointerEvents: "auto" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engineRef.current?.setTouchShoot(true);
                  }}
                  onPointerUp={() => engineRef.current?.setTouchShoot(false)}
                  onPointerCancel={() => engineRef.current?.setTouchShoot(false)}
                >
                  FIRE
                  <span className="block text-[8px] opacity-90">pests</span>
                </button>
                <button
                  type="button"
                  data-action="jump"
                  className="h-12 w-12 rounded-full border-2 border-white/30 bg-black/55 text-[11px] font-bold text-white"
                  style={{ touchAction: "none", pointerEvents: "auto" }}
                >
                  JUMP
                </button>
                <button
                  type="button"
                  data-action="useDown"
                  className={
                    useLabel.hot
                      ? "h-[4.75rem] w-[4.75rem] rounded-full border-2 border-white bg-accent text-accent-fg shadow-2xl"
                      : "h-[4.75rem] w-[4.75rem] rounded-full border-2 border-white/40 bg-emerald-900/80 text-white shadow-xl"
                  }
                  style={{ touchAction: "none", pointerEvents: "auto" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engineRef.current?.setTouchInteract(true);
                  }}
                  onPointerUp={() => engineRef.current?.setTouchInteract(false)}
                  onPointerCancel={() => engineRef.current?.setTouchInteract(false)}
                >
                  <span className="block text-sm font-black leading-tight">{useLabel.title}</span>
                  <span className="block text-[9px] font-semibold opacity-90">{useLabel.sub}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* PAUSED */}
      {hud.screen === "paused" && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/75 px-4 backdrop-blur-sm"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div className="panel w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold">Paused</h2>
            <p className="mt-1 text-sm text-muted">
              Level {hud.level} · {hud.levelName}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" data-action="resume" className={btnPrimary}>
                <span className="inline-flex items-center justify-center gap-2">
                  <Play className="h-4 w-4" /> Resume
                </span>
              </button>
              <button type="button" data-action="upgrades" className={btnMenu}>
                <ShoppingBag className="h-4 w-4" /> Shop
              </button>
              <button type="button" data-action="title" className={btnMenu}>
                <Home className="h-4 w-4" /> Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHOP */}
      {hud.screen === "upgrade" && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 px-3 py-4 backdrop-blur-sm"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div className="panel w-full max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Booloobee Shop</h2>
                <p className="text-sm text-muted mt-0.5">
                  <span className="text-gold tabular font-medium">{hud.coins} coins</span>
                </p>
              </div>
              <button
                type="button"
                data-action="closeUpgrades"
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold min-h-12"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1" style={{ touchAction: "pan-y" }}>
              {(
                [
                  ["chain", "Ranch chain"],
                  ["crew", "Hire crew"],
                  ["player", "Runner"],
                  ["gun", "Optional combat"],
                ] as const
              ).map(([cat, label]) => (
                <div key={cat}>
                  <h3 className="text-[11px] uppercase tracking-wider text-subtle mb-1.5 mt-2">
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {UPGRADES.filter((u) => u.category === cat).map((u) => {
                      const level = hud.upgrades[u.id] ?? 0;
                      const maxed = level >= u.maxLevel;
                      const cost = upgradeCost(u, level);
                      const can = !maxed && hud.coins >= cost;
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-fg">{u.name}</span>
                              <span className="text-[11px] text-subtle tabular">
                                {level}/{u.maxLevel}
                              </span>
                            </div>
                            <p className="text-xs text-muted line-clamp-2">{u.description}</p>
                          </div>
                          <button
                            type="button"
                            data-action="buy"
                            data-arg={u.id}
                            disabled={!can}
                            className="shrink-0 rounded-xl bg-fg text-bg px-4 py-3 text-sm font-bold disabled:bg-border disabled:text-subtle min-h-12 min-w-[5rem]"
                          >
                            {maxed ? "Max" : cat === "crew" && level === 0 ? `Hire ${cost}c` : `${cost}c`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" data-action="closeUpgrades" className={`${btnMenu} mt-4`}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* LEVEL COMPLETE */}
      {hud.screen === "levelComplete" && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/75 px-4 backdrop-blur-sm"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div className="panel w-full max-w-md p-6">
            <div className="flex items-center gap-2 text-accent">
              <Trophy className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider font-medium">Quota met</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold">Ranch shipment sent!</h2>
            <p className="mt-2 text-sm text-muted">
              Sold {hud.sold} crates · {hud.coins}c in the bank
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {hud.level < LEVELS.length ? (
                <button type="button" data-action="next" className={btnPrimary}>
                  Next paddock
                </button>
              ) : (
                <button type="button" data-action="title" className={btnPrimary}>
                  Victory lap
                </button>
              )}
              <button type="button" data-action="upgrades" className={btnMenu}>
                Shop upgrades
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {hud.screen === "gameOver" && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 px-4 backdrop-blur-sm"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div className="panel w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold">Ranch wiped out</h2>
            <p className="mt-2 text-sm text-muted">Time up or too many nips. Try again — keep the chain moving.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" data-action="retry" className={btnPrimary}>
                Retry
              </button>
              <button type="button" data-action="title" className={btnMenu}>
                Title
              </button>
            </div>
          </div>
        </div>
      )}

      {hud.screen === "victory" && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 px-4 backdrop-blur-sm"
          style={{ pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <div className="panel w-full max-w-md p-6 text-center">
            <h2 className="text-2xl font-bold">Booloobee tycoon!</h2>
            <p className="mt-2 text-sm text-muted">You ran the whole glitter pipeline. Absolute legend.</p>
            <button type="button" data-action="title" className={`${btnPrimary} mt-5`}>
              Back to title
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
