/**
 * Demand + variety systems — continuous customer hunger, VIP orders,
 * rush hours, spoil pressure, and random events so stages aren't one-and-done.
 */
import * as THREE from "three";

type AnyEng = any;

type Order = {
  id: number;
  need: number;
  filled: number;
  expires: number;
  vip: boolean;
  payMult: number;
};

type EventKind = "rush" | "vip_wave" | "glitter_boost" | "pest_alarm" | "tip_jar";

export function installDemandAndVariety(eng: AnyEng) {
  if (eng.__demandVariety) return;
  eng.__demandVariety = true;

  eng.demand = 0.35;
  eng.demandVel = 0.04;
  eng.orders = [] as Order[];
  eng.nextOrderId = 1;
  eng.orderCd = 12;
  eng.eventCd = 28;
  eng.activeEvent = null as { kind: EventKind; t: number } | null;
  eng.spoilTimer = 0;
  eng.sellCombo = 0;
  eng.sellComboT = 0;
  eng.rushMult = 1;
  eng.glitterBoost = 1;

  const pushOrder = (vip: boolean) => {
    const base = 2 + Math.floor((eng.level?.id ?? 1) / 3);
    const need = vip ? base + 1 + Math.floor(Math.random() * 2) : base + Math.floor(Math.random() * 2);
    const o: Order = {
      id: eng.nextOrderId++,
      need,
      filled: 0,
      expires: vip ? 35 : 50,
      vip,
      payMult: vip ? 2.4 : 1.35,
    };
    eng.orders.push(o);
    eng.flashMessage?.(vip ? `VIP wants ${need} crates!` : `Order: ${need} crates`);
  };

  const startEvent = (kind: EventKind) => {
    const dur = kind === "rush" ? 22 : kind === "vip_wave" ? 18 : kind === "glitter_boost" ? 20 : 16;
    eng.activeEvent = { kind, t: dur };
    eng.rushMult = kind === "rush" ? 1.85 : 1;
    eng.glitterBoost = kind === "glitter_boost" ? 1.6 : 1;
    const msgs: Record<EventKind, string> = {
      rush: "RUSH HOUR — sell fast!",
      vip_wave: "VIP limo arriving!",
      glitter_boost: "Glitter surge at the mill!",
      pest_alarm: "Pest alarm — defend the field!",
      tip_jar: "Tip jar is overflowing!",
    };
    eng.flashMessage?.(msgs[kind]);
    if (kind === "vip_wave") pushOrder(true);
    if (kind === "pest_alarm" && typeof eng.spawnEnemy === "function") {
      try {
        eng.spawnEnemy("pest");
        if ((eng.level?.id ?? 1) > 4) eng.spawnEnemy("beetle");
      } catch {
        /* ignore */
      }
    }
    if (kind === "tip_jar") {
      eng.save.coins += 8 + (eng.level?.id ?? 1);
      eng.spawnFloat?.(eng.market?.pos?.clone()?.setY?.(2) ?? eng.playerPos, "+tips", "#ffe08a");
    }
  };

  const origSellRate = eng.sellRate?.bind(eng);
  if (origSellRate) {
    eng.sellRate = function () {
      const base = origSellRate();
      const d = this.demand ?? 0.4;
      const demandMul = 0.55 + d * 0.9;
      const rush = this.rushMult > 1 ? 1.35 : 1;
      return base * demandMul * rush;
    };
  }

  const origProcess = eng.processRate?.bind(eng);
  if (origProcess) {
    eng.processRate = function () {
      return origProcess() * (this.glitterBoost || 1);
    };
  }

  eng.sellPrice = function () {
    const tier = this.up("sell_price") || 0;
    const actBoost = 1 + Math.floor((this.level?.id ?? 1) / 6) * 0.08;
    const combo = 1 + Math.min(0.5, (this.sellCombo || 0) * 0.08);
    const event = this.rushMult > 1 ? 1.25 : 1;
    return Math.floor(
      12 * (1 + tier * 0.28) * actBoost * combo * event * (this.activeEvent?.kind === "vip_wave" ? 1.15 : 1),
    );
  };

  eng.ensureCustomerQueue = function () {
    if (!this.market) return;
    const orderNeed = (this.orders || []).reduce(
      (s: number, o: Order) => s + Math.max(0, o.need - o.filled),
      0,
    );
    const demandBoost = Math.floor((this.demand || 0) * 5);
    const want = Math.min(
      10,
      Math.max(2, (this.boxed > 0 ? 2 : 1) + demandBoost + Math.min(4, orderNeed)),
    );
    while (this.customers.filter((c: any) => c.state === "queue" || c.state === "buy").length < want) {
      this.spawnCustomer();
    }
  };

  const origServe = eng.serveCustomers?.bind(eng);
  eng.serveCustomers = function (n: number) {
    if (origServe) origServe(n);
    let left = n;
    for (const o of this.orders || []) {
      if (left <= 0) break;
      if (o.filled >= o.need) continue;
      const take = Math.min(left, o.need - o.filled);
      o.filled += take;
      left -= take;
      if (o.filled >= o.need) {
        const bonus = Math.floor(this.sellPrice() * o.need * (o.payMult - 1));
        this.save.coins += Math.max(6, bonus);
        this.spawnFloat?.(
          this.market.pos.clone().setY(2.4),
          o.vip ? `VIP +${bonus}c` : `Order +${bonus}c`,
          o.vip ? "#ffd76a" : "#7ad46a",
        );
        this.flashMessage?.(o.vip ? "VIP order complete!" : "Order filled!");
        this.demand = Math.min(1, (this.demand || 0) + 0.08);
      }
    }
    this.orders = (this.orders || []).filter((o: Order) => o.filled < o.need && o.expires > 0);
    this.sellCombo = (this.sellCombo || 0) + n;
    this.sellComboT = 4.5;
    this.demand = Math.max(0.15, (this.demand || 0.35) - n * 0.06);
  };

  const origFixed = eng.fixedUpdate?.bind(eng);
  eng.fixedUpdate = function (dt: number) {
    if (origFixed) origFixed(dt);
    if (this.screen !== "playing") return;

    const idle = this.boxed === 0 ? 1.25 : 0.7;
    this.demand = Math.min(
      1,
      (this.demand || 0.35) + dt * (this.demandVel || 0.04) * idle * (this.rushMult || 1),
    );
    if (this.demand > 0.85 && Math.random() < dt * 0.4) {
      this.ensureCustomerQueue?.();
      if (Math.random() < 0.15) this.flashMessage?.("Customers are waiting!");
    }

    this.orderCd = (this.orderCd ?? 12) - dt;
    if (this.orderCd <= 0) {
      this.orderCd = 22 + Math.random() * 16 - Math.min(8, (this.level?.id ?? 1));
      if ((this.orders || []).length < 2) pushOrder(Math.random() < 0.28);
    }
    for (const o of this.orders || []) o.expires -= dt;
    const expired = (this.orders || []).filter((o: Order) => o.expires <= 0 && o.filled < o.need);
    if (expired.length) {
      this.demand = Math.min(1, (this.demand || 0) + 0.12 * expired.length);
      this.flashMessage?.(expired.some((o: Order) => o.vip) ? "VIP left angry…" : "Order expired");
      this.orders = (this.orders || []).filter((o: Order) => o.expires > 0 || o.filled >= o.need);
    }

    if (this.activeEvent) {
      this.activeEvent.t -= dt;
      if (this.activeEvent.t <= 0) {
        this.activeEvent = null;
        this.rushMult = 1;
        this.glitterBoost = 1;
      }
    } else {
      this.eventCd = (this.eventCd ?? 28) - dt;
      if (this.eventCd <= 0) {
        this.eventCd = 32 + Math.random() * 24;
        const kinds: EventKind[] = ["rush", "vip_wave", "glitter_boost", "pest_alarm", "tip_jar"];
        startEvent(kinds[Math.floor(Math.random() * kinds.length)]);
      }
    }

    if (this.raw > 6) {
      this.spoilTimer = (this.spoilTimer || 0) + dt;
      if (this.spoilTimer > 14) {
        this.spoilTimer = 0;
        const lose = Math.min(2, this.raw - 4);
        if (lose > 0) {
          this.raw -= lose;
          this.spawnFloat?.(this.playerPos.clone().setY(1.4), `Spoil -${lose}`, "#ff6b7a");
        }
      }
    } else {
      this.spoilTimer = Math.max(0, (this.spoilTimer || 0) - dt);
    }

    if (this.sellComboT > 0) {
      this.sellComboT -= dt;
      if (this.sellComboT <= 0) this.sellCombo = 0;
    }

    if (this.glitterBoost > 1 && this.processor?.buffer > 0 && Math.random() < dt * 1.2) {
      this.processor.progress = (this.processor.progress || 0) + 0.15;
    }
  };

  const origHandle = eng.handleInteract?.bind(eng);
  if (origHandle) {
    eng.handleInteract = function (dt: number) {
      origHandle(dt);
      if (this.interactHint === "Sell" && (this.demand || 0) > 0.7) {
        this.interactHint = "Sell!";
      }
    };
  }

  const origCust = eng.updateCustomers?.bind(eng);
  if (origCust) {
    eng.updateCustomers = function (dt: number) {
      if ((this.demand || 0) > 0.55 || (this.orders || []).length) {
        if (Math.random() < dt * (0.5 + (this.demand || 0))) this.ensureCustomerQueue?.();
      }
      origCust(dt);
    };
  }
}
