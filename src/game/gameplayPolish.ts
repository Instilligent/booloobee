/**
 * Gameplay polish: tutorial cues, active-pad pulse, clearer next-step guidance.
 */
import * as THREE from "three";

export function installGameplayPolish(eng: any) {
  if (eng.__gameplayPolish) return;
  eng.__gameplayPolish = true;

  eng.tutorialStep = 0;
  eng.tutorialCd = 0;
  eng.polishT = 0;

  const tips = [
    "Scoop the pink glitter piles \u2460",
    "Stand on the blue pad \u2192 Wash \u2461",
    "Purple pad \u2192 Grind into glitter \u2462",
    "Gold pad \u2192 Box the gifts \u2463",
    "Pink pad \u2192 Sell to the queue \u2464",
    "Hire helpers from floating buttons",
  ];

  const flashTip = (i: number) => {
    if (i < 0 || i >= tips.length) return;
    eng.flashMessage?.(tips[i]);
  };

  const afterStart = () => {
    eng.tutorialStep = 0;
    eng.tutorialCd = 2.5;
    if ((eng.level?.id ?? 99) <= 3) {
      setTimeout(() => flashTip(0), 900);
    }
  };

  for (const name of ["startLevel", "startGame", "retryLevel", "nextLevel", "continueGame"]) {
    const orig = eng[name]?.bind(eng);
    if (!orig) continue;
    eng[name] = function (...args: any[]) {
      const r = orig(...args);
      afterStart();
      return r;
    };
  }

  const origFixed = eng.fixedUpdate?.bind(eng);
  eng.fixedUpdate = function (dt: number) {
    if (origFixed) origFixed(dt);
    if (this.screen !== "playing") return;
    this.polishT = (this.polishT || 0) + dt;

    if ((this.level?.id ?? 99) <= 3) {
      this.tutorialCd = (this.tutorialCd || 0) - dt;
      if (this.tutorialCd <= 0) {
        const sold = this.sold || 0;
        const boxed = this.boxed || 0;
        const glitter = this.glitter || 0;
        const washed = this.washed || 0;
        const raw = this.raw || 0;
        let want = 0;
        if (raw === 0 && washed === 0 && glitter === 0 && boxed === 0 && sold === 0) want = 0;
        else if (raw > 0 && washed === 0) want = 1;
        else if (washed > 0 && glitter === 0) want = 2;
        else if (glitter > 0 && boxed === 0) want = 3;
        else if (boxed > 0) want = 4;
        else want = 5;
        if (want !== this.tutorialStep) {
          this.tutorialStep = want;
          flashTip(want);
          this.tutorialCd = 8;
        } else {
          this.tutorialCd = 4;
        }
      }
    }

    const step = this.nextStep?.() ?? 0;
    if (Array.isArray(this.decorRings)) {
      for (const ring of this.decorRings) {
        if (!ring?.userData) continue;
        const isHot = ring.userData.step === step;
        if (!isHot) continue;
        const pulse = 1 + Math.sin((this.polishT || 0) * 5) * 0.22;
        ring.scale.set(pulse, pulse, pulse);
        const mat = ring.material as THREE.MeshBasicMaterial;
        if (mat && "opacity" in mat) mat.opacity = 0.55 + Math.sin((this.polishT || 0) * 5) * 0.35;
      }
    }
  };

  const origPath = eng.addChainPath?.bind(eng);
  if (origPath) {
    eng.addChainPath = function (from: THREE.Vector3, to: THREE.Vector3) {
      origPath(from, to);
      try {
        const mid = new THREE.Vector3((from.x + to.x) / 2, 0.06, (from.z + to.z) / 2);
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const len = Math.hypot(dx, dz) || 1;
        const geo = new THREE.PlaneGeometry(0.35, len * 0.9);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfff6a8,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const line = new THREE.Mesh(geo, mat);
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = Math.atan2(dx, dz);
        line.position.copy(mid);
        this.scene?.add(line);
      } catch {
        /* ignore */
      }
    };
  }
}
