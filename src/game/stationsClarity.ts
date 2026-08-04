/**
 * Clearer station stand pads + slower enemy wave cadence (runtime patch).
 */
import * as THREE from "three";

const STATION_USE_RANGE = 3.4;
const STATION_PAD_OFFSET = 2.35;

export function installStationsClarity(eng: any) {
  if (eng.__stationsClarity) return;
  eng.__stationsClarity = true;

  const stationPad = (pos: THREE.Vector3) => {
    const spawnZ = eng.level?.spawn?.z ?? 12;
    const towardSpawn = pos.z < spawnZ - 1 ? 1 : pos.z > spawnZ + 1 ? -1 : 1;
    return new THREE.Vector3(pos.x, 0, pos.z + towardSpawn * STATION_PAD_OFFSET);
  };
  eng.stationPad = stationPad;

  const nearStation = (buildingPos: THREE.Vector3) => {
    if (!buildingPos || !eng.playerPos) return false;
    const pad = stationPad(buildingPos);
    return Math.hypot(pad.x - eng.playerPos.x, pad.z - eng.playerPos.z) < STATION_USE_RANGE;
  };
  eng.nearStation = nearStation;

  eng.updateWaves = function () {
    if (!this.level?.enemyWaves) return;
    while (this.waveIndex < this.level.enemyWaves.length) {
      const wave = this.level.enemyWaves[this.waveIndex];
      const delay = (wave.delay || 0) * 1.55;
      if (this.elapsed < delay) break;
      for (let i = 0; i < wave.count; i++) this.spawnEnemy(wave.kind);
      if (wave.kind === "brute" || (wave.count >= 4 && this.level.id >= 14)) {
        this.flashMessage?.(wave.kind === "brute" ? "Brute wave!" : "Stampede!");
        this.addTrauma?.(0.35);
      }
      this.waveIndex++;
    }
  };

  const paintPad = (pos: THREE.Vector3, color: number, step: number) => {
    if (!eng.scene) return;
    const padR = STATION_USE_RANGE * 0.72;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(padR, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pos.x, 0.035, pos.z);
    disc.userData.step = step;
    disc.userData.pulse = Math.random() * Math.PI * 2;
    eng.scene.add(disc);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(padR * 0.9, padR * 1.12, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.055, pos.z);
    ring.userData.step = step;
    ring.userData.pulse = Math.random() * Math.PI * 2;
    eng.scene.add(ring);

    if (Array.isArray(eng.decorRings)) eng.decorRings.push(disc, ring);
  };

  const paintAllPads = () => {
    if (!eng.spa?.pos || !eng.processor?.pos || !eng.packer?.pos || !eng.market?.pos) return;
    paintPad(stationPad(eng.spa.pos), 0x4ec8ff, 2);
    paintPad(stationPad(eng.processor.pos), 0x7b5cff, 3);
    paintPad(stationPad(eng.packer.pos), 0xffc84a, 4);
    paintPad(stationPad(eng.market.pos), 0xff8ec8, 5);
  };

  const origHI = eng.handleInteract?.bind(eng);
  if (origHI) {
    eng.handleInteract = function (dt: number) {
      origHI(dt);
      if (this.screen !== "playing" || !this.spa) return;

      if (nearStation(this.market.pos) && this.boxed > 0) {
        this.interactHint = "Sell";
      } else if (nearStation(this.packer.pos) && this.glitter > 0) {
        this.interactHint = "Box";
      } else if (nearStation(this.processor.pos) && this.washed > 0) {
        this.interactHint = "Grind";
      } else if (nearStation(this.spa.pos) && this.raw > 0) {
        this.interactHint = "Wash";
      }
    };
  }

  const afterLevel = () => {
    try {
      setTimeout(paintAllPads, 80);
    } catch {
      /* ignore */
    }
  };
  for (const name of ["startLevel", "startGame", "retryLevel", "nextLevel", "continueGame"]) {
    const orig = eng[name]?.bind(eng);
    if (!orig) continue;
    eng[name] = function (...args: any[]) {
      const r = orig(...args);
      afterLevel();
      return r;
    };
  }
}
