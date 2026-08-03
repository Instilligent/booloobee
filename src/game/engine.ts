import * as THREE from "three";
import {
  CHARACTERS,
  GUN_TIERS,
  LEVELS,
  RAINBOW,
  UPGRADES,
  characterDef,
  enemyStats,
  upgradeCost,
} from "./data";
import { gameAudio } from "./audio";
import { defaultSave, loadSave, writeSave } from "./save";
import type {
  CharacterId,
  EnemyKind,
  FloatText,
  GunTier,
  HudSnapshot,
  LevelDef,
  SaveData,
  Screen,
  WorldOffer,
} from "./types";

const FIXED = 1 / 60;
const PLAYER_RADIUS = 0.45;
const PLAYER_HEIGHT = 1.55;
const INTERACT_RANGE = 4.0;
const SCOOP_RADIUS = 4.6;

interface Crop {
  id: number;
  pos: THREE.Vector3;
  mesh: THREE.Group;
  ready: number;
  harvested: boolean;
  growTimer: number;
}

interface Platform {
  mesh: THREE.Mesh;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface Building {
  kind: "spa" | "processor" | "packer" | "market";
  pos: THREE.Vector3;
  mesh: THREE.Group;
  progress: number;
  buffer: number;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  height: number;
  coin: number;
  mesh: THREE.Group;
  attackCd: number;
  hitFlash: number;
  stealCd: number;
  alive: boolean;
}

interface Bullet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  mesh: THREE.Mesh;
  active: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

type WorkerRole = "farmer" | "grinder" | "vendor" | "bot";

interface Worker {
  role: WorkerRole;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  timer: number;
  workTimer: number;
  targetCrop: Crop | null;
  spinPart: THREE.Object3D | null;
}

interface FloatWorld {
  id: number;
  text: string;
  color: string;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  vy: number;
}

interface SolidBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface Customer {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  slot: number;
  state: "queue" | "buy" | "leave";
  timer: number;
  bob: number;
}

interface StarPickup {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  taken: boolean;
  spin: number;
}

interface DecorInteract {
  kind: "fountain" | "compost" | "jukebox";
  pos: THREE.Vector3;
  mesh: THREE.Group;
  cd: number;
}

export type TouchAxes = { x: number; y: number };
export type EngineCallbacks = { onHud: (hud: HudSnapshot) => void };

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class GameEngine {
  private mount: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private acc = 0;
  private disposed = false;
  private raf = 0;
  private cbs: EngineCallbacks;

  private keys = new Set<string>();
  private mouseDown = false;
  private pointerLocked = false;
  private yaw = 0;
  private pitch = 0.72;
  private touchMove: TouchAxes = { x: 0, y: 0 };
  private touchLook: TouchAxes = { x: 0, y: 0 };
  private touchShoot = false;
  private touchJump = false;
  private touchInteract = false;
  private isMobile = false;

  private screen: Screen = "title";
  private returnScreen: Screen = "paused";
  private save: SaveData = defaultSave();
  private levelIndex = 0;
  private level!: LevelDef;
  private elapsed = 0;
  private timeLeft = 0;
  private message: string | null = null;
  private messageT = 0;
  private interactHint: string | null = null;
  private killCount = 0;

  private playerPos = new THREE.Vector3();
  private playerVel = new THREE.Vector3();
  private onGround = false;
  private health = 100;
  private maxHealth = 100;
  private moveSpeed = 7.2;
  private faceYaw = 0; // body facing (for shooting)

  private raw = 0;
  private washed = 0;
  private glitter = 0;
  private boxed = 0;
  private sold = 0;

  private fireCd = 0;
  private hurtCd = 0;
  private harvestProgress = 0;
  private spaInteract = 0;
  private processInteract = 0;
  private packInteract = 0;
  private sellProgress = 0;

  private playerMesh!: THREE.Group;
  private gunMesh!: THREE.Group;
  private carryMesh: THREE.Group | null = null;
  private platforms: Platform[] = [];
  private solids: SolidBox[] = [];
  private crops: Crop[] = [];
  private spa!: Building;
  private processor!: Building;
  private packer!: Building;
  private market!: Building;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private workers: Worker[] = [];
  private customers: Customer[] = [];
  private stars: StarPickup[] = [];
  private decorInteract: DecorInteract[] = [];
  private trees: THREE.Group[] = [];
  private flowers: THREE.Mesh[] = [];
  private fairyLights: THREE.PointLight[] = [];
  private trauma = 0;
  private hitstop = 0;
  private landDustCd = 0;
  private moveDustCd = 0;
  private squash = 1;
  private combo = 0;
  private comboTimer = 0;
  private camLookAhead = new THREE.Vector3();
  private fireflies: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number }[] = [];
  private floats: FloatWorld[] = [];
  private nextFloatId = 1;
  private decorRings: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];
  private spinParts: THREE.Object3D[] = [];
  /** Visible product stacks at stations */
  private pileGroups: Record<string, THREE.Group> = {};
  private waveIndex = 0;
  private nextEnemyId = 1;
  private nextCropId = 1;
  private rainbowIdx = 0;
  private hudTimer = 0;
  private hudDirty = true;

  private geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 14, 12),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cone: new THREE.ConeGeometry(0.5, 1, 10),
  };

  private mats = {
    ground: new THREE.MeshStandardMaterial({ color: 0x4f9a5c, roughness: 0.88 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x8b6a4a, roughness: 0.95 }),
    path: new THREE.MeshStandardMaterial({ color: 0xd4c4a0, roughness: 0.9 }),
    platform: new THREE.MeshStandardMaterial({ color: 0xe8d4a8, roughness: 0.75 }),
    crop: new THREE.MeshStandardMaterial({ color: 0xff8ec8, roughness: 0.75, emissive: 0xff5aa8, emissiveIntensity: 0.15 }),
    leaf: new THREE.MeshStandardMaterial({
      color: 0xffe14a,
      emissive: 0xffaa22,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    }),
    spa: new THREE.MeshStandardMaterial({ color: 0x4ec8ff, metalness: 0.25, roughness: 0.4 }),
    processor: new THREE.MeshStandardMaterial({ color: 0x7b5cff, metalness: 0.4, roughness: 0.35 }),
    packer: new THREE.MeshStandardMaterial({ color: 0xffc84a, roughness: 0.55 }),
    market: new THREE.MeshStandardMaterial({ color: 0xff8ec8, roughness: 0.65 }),
    player: new THREE.MeshStandardMaterial({ color: 0xffe8f4, roughness: 0.6 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x4a3a6e, roughness: 0.8 }),
    hat: new THREE.MeshStandardMaterial({ color: 0xff5aa8, roughness: 0.65 }),
    bullet: new THREE.MeshStandardMaterial({
      color: 0xff5a7a,
      emissive: 0xff5a7a,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
    enemy: new THREE.MeshStandardMaterial({ color: 0xfff8fc, roughness: 0.6 }),
    fence: new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xff4d94, roughness: 0.7 }),
    crate: new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.65 }),
    horn: new THREE.MeshStandardMaterial({
      color: 0xffe14a,
      emissive: 0xffaa00,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    }),
    mane: new THREE.MeshStandardMaterial({ color: 0x5ec8ff, roughness: 0.55 }),
    washed: new THREE.MeshStandardMaterial({ color: 0xc8e8ff, roughness: 0.5 }),
    glitterMat: new THREE.MeshStandardMaterial({
      color: 0xe0a0ff,
      emissive: 0xb06bff,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    }),
  };

  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpV3 = new THREE.Vector3();

  constructor(mount: HTMLElement, cbs: EngineCallbacks) {
    this.mount = mount;
    this.cbs = cbs;
    this.save = loadSave();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.pointerEvents = "none";
    this.renderer.domElement.style.touchAction = "none";
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 160);

    this.bindInput();
    this.buildTitleScene();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud(true);

    window.__game = this;
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => Math.hypot(this.playerVel.x, this.playerVel.z),
      getPitch: () => this.pitch,
      setKeys: (codes: string[]) => {
        this.keys.clear();
        for (const c of codes) this.keys.add(c);
      },
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }

  resize() {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (w < 1 || h < 1) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setMobile(v: boolean) {
    this.isMobile = v;
    this.hudDirty = true;
  }
  setTouchMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }
  setTouchLook(x: number, y: number) {
    this.touchLook.x = x;
    this.touchLook.y = y;
  }
  setTouchShoot(v: boolean) {
    this.touchShoot = v;
  }
  setTouchJump(v: boolean) {
    this.touchJump = v;
  }
  setTouchInteract(v: boolean) {
    this.touchInteract = v;
  }
  setMouseDown(v: boolean) {
    this.mouseDown = v;
  }
  setCharacter(id: CharacterId) {
    this.save.character = id;
    writeSave(this.save);
    // rebuild player if in play
    if (this.screen === "playing" && this.playerMesh) {
      const pos = this.playerPos.clone();
      this.scene.remove(this.playerMesh);
      this.playerMesh = this.makePlayerMesh();
      this.playerMesh.position.copy(pos);
      this.playerMesh.rotation.y = this.faceYaw;
      this.scene.add(this.playerMesh);
      this.paintGun();
    }
    this.hudDirty = true;
    this.emitHud(true);
  }
  getCharacter() {
    return this.save.character;
  }
  nudgeLook(dxPx: number, dyPx: number) {
    this.yaw -= dxPx * 0.0045;
    this.pitch = clamp(this.pitch + dyPx * 0.0032, 0.35, 1.15);
  }

  startGame(levelIndex = 0) {
    gameAudio.unlock();
    const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    this.levelIndex = idx;
    this.screen = "playing";
    this.beginLevel(idx);
    this.emitHud(true);
  }
  continueGame() {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, (this.save.highestLevel || 1) - 1));
    this.startGame(idx);
  }
  pause() {
    if (this.screen !== "playing") return;
    this.screen = "paused";
    document.exitPointerLock?.();
    this.emitHud(true);
  }
  resume() {
    if (this.screen !== "paused") return;
    this.screen = "playing";
    this.emitHud(true);
  }
  openUpgrades() {
    if (this.screen === "playing" || this.screen === "paused" || this.screen === "levelComplete") {
      this.returnScreen = this.screen === "playing" ? "paused" : this.screen;
      this.screen = "upgrade";
      document.exitPointerLock?.();
      this.emitHud(true);
    }
  }
  closeUpgrades() {
    if (this.screen !== "upgrade") return;
    this.screen = this.returnScreen === "upgrade" ? "paused" : this.returnScreen;
    this.emitHud(true);
  }
  buyUpgrade(id: string) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const level = this.save.upgrades[id] ?? 0;
    if (level >= def.maxLevel) return;
    const cost = upgradeCost(def, level);
    if (this.save.coins < cost) {
      gameAudio.play("fail");
      this.flashMessage("Not enough coins");
      this.emitHud(true);
      return;
    }
    this.save.coins -= cost;
    this.save.upgrades[id] = level + 1;
    if (id === "gun_tier") this.save.gunTier = Math.min(4, level + 1) as GunTier;
    this.applyPlayerStatsFromSave();
    this.paintGun();
    writeSave(this.save);
    if (id.startsWith("hire_")) {
      this.syncWorkers();
      gameAudio.play("hire");
      this.flashMessage(
        id === "hire_farmer"
          ? "Farmer hired — they scoop for you!"
          : id === "hire_grinder"
            ? "Spa & grind staff hired!"
            : id === "hire_vendor"
              ? "Pack & sell crew hired!"
              : "Poop-O-Matic online!",
      );
      this.spawnHitParticles(this.playerPos.clone().setY(1.2), 0xffe14a, 14);
    } else {
      gameAudio.play("upgrade");
      this.flashMessage(`${def.name} upgraded`);
    }
    this.emitHud(true);
  }
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.screen = "victory";
      this.emitHud(true);
      return;
    }
    this.beginLevel(this.levelIndex + 1);
    this.screen = "playing";
    this.emitHud(true);
  }
  retryLevel() {
    this.beginLevel(this.levelIndex);
    this.screen = "playing";
    this.emitHud(true);
  }
  goTitle() {
    this.screen = "title";
    document.exitPointerLock?.();
    this.buildTitleScene();
    this.emitHud(true);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "Escape" && this.screen === "playing") this.pause();
    if (e.code === "KeyR" && this.screen === "playing") this.openUpgrades();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || this.screen !== "playing") return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch = clamp(this.pitch - e.movementY * 0.0016, 0.35, 1.15);
  };
  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };
  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }
  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
  }

  private applyPlayerStatsFromSave() {
    this.maxHealth = 100 + this.up("max_health") * 25;
    this.moveSpeed = 7.6 * (1 + this.up("move_speed") * 0.11);
    if (this.health > this.maxHealth) this.health = this.maxHealth;
  }
  private up(id: string) {
    return this.save.upgrades[id] ?? 0;
  }
  private gunStats() {
    const base = GUN_TIERS[this.save.gunTier];
    return {
      ...base,
      damage: base.damage * (1 + this.up("gun_damage") * 0.15),
      fireRate: base.fireRate * (1 + this.up("gun_rate") * 0.12),
    };
  }
  private harvestRate() {
    return 4.4 * (1 + this.up("harvest_speed") * 0.32);
  }
  private cropYield() {
    return 1 + this.up("crop_yield");
  }
  private spaRate() {
    return 3.5 * (1 + this.up("spa_speed") * 0.3);
  }
  private processRate() {
    return 2.6 * (1 + this.up("process_speed") * 0.32);
  }
  private packRate() {
    return 3.2 * (1 + this.up("pack_speed") * 0.3);
  }
  private sellRate() {
    return 3.8 * (1 + this.up("sell_speed") * 0.32);
  }
  private sellPrice() {
    return Math.floor(14 * (1 + this.up("sell_price") * 0.28));
  }
  private nextStep(): number {
    if (this.boxed > 0) return 5;
    if (this.glitter > 0 || this.packer.buffer > 0) return 4;
    if (this.washed > 0 || this.processor.buffer > 0) return 3;
    if (this.raw > 0 || this.spa.buffer > 0) return 2;
    return 1;
  }

  private clearWorld() {
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.platforms = [];
    this.solids = [];
    this.crops = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.workers = [];
    this.customers = [];
    this.stars = [];
    this.decorInteract = [];
    this.trees = [];
    this.flowers = [];
    this.fairyLights = [];
    this.fireflies = [];
    this.floats = [];
    this.decorRings = [];
    this.clouds = [];
    this.spinParts = [];
    this.pileGroups = {};
    this.carryMesh = null;
    this.waveIndex = 0;
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff0f8, 0x3d7a48, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
    sun.position.set(18, 32, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb8d8ff, 0.5);
    fill.position.set(-16, 14, -12);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9acc, 0.25);
    rim.position.set(0, 8, 20);
    this.scene.add(rim);
  }

  private addClouds(rng: () => number, spread = 40) {
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfff5ff,
        transparent: true,
        opacity: 0.72,
        roughness: 1,
      });
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(this.geo.sphere, mat);
        puff.scale.set(1.4 + rng(), 0.7 + rng() * 0.4, 1.1 + rng() * 0.5);
        puff.position.set((rng() - 0.5) * 2.5, (rng() - 0.5) * 0.4, (rng() - 0.5) * 1.2);
        g.add(puff);
      }
      g.position.set((rng() - 0.5) * spread, 10 + rng() * 4, (rng() - 0.5) * spread);
      g.userData.drift = 0.15 + rng() * 0.25;
      g.userData.baseX = g.position.x;
      this.scene.add(g);
      this.clouds.push(g);
    }
  }

  private makeTextSprite(lines: string[], bg: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(r, 16);
    ctx.arcTo(248, 16, 248, 112, r);
    ctx.arcTo(248, 112, 8, 112, r);
    ctx.arcTo(8, 112, 8, 16, r);
    ctx.arcTo(8, 16, 248, 16, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText(lines[0], 128, 48);
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(lines[1] || "", 128, 82);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(3.6, 1.8, 1);
    return sprite;
  }

  private addChainPath(from: THREE.Vector3, to: THREE.Vector3) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const mid = new THREE.Vector3((from.x + to.x) / 2, 0.03, (from.z + to.z) / 2);
    const path = new THREE.Mesh(this.geo.box, this.mats.path);
    path.scale.set(1.5, 0.06, len);
    path.position.copy(mid);
    path.rotation.y = Math.atan2(dx, dz);
    path.receiveShadow = true;
    this.scene.add(path);
    const steps = Math.max(2, Math.floor(len / 3.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const chev = new THREE.Mesh(
        this.geo.cone,
        new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffcc44, emissiveIntensity: 0.35 }),
      );
      chev.scale.set(0.28, 0.35, 0.28);
      chev.rotation.x = Math.PI / 2;
      chev.position.set(from.x + dx * t, 0.2, from.z + dz * t);
      chev.rotation.z = Math.atan2(dx, dz);
      this.scene.add(chev);
    }
  }

  private addRingMarker(pos: THREE.Vector3, color: number, step = 0) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.85, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.04, pos.z);
    ring.userData.pulse = Math.random() * Math.PI * 2;
    ring.userData.step = step;
    ring.userData.baseColor = color;
    this.scene.add(ring);
    this.decorRings.push(ring);
  }

  private buildTitleScene() {
    this.clearWorld();
    this.scene.background = new THREE.Color(0x9fd4f0);
    this.scene.fog = new THREE.Fog(0x9fd4f0, 28, 80);
    this.buildLights();
    this.addClouds(() => Math.random(), 50);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), this.mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    for (let i = 0; i < 8; i++) {
      const g = this.makeCropMesh();
      g.position.set((i - 4) * 2, 0, -4);
      this.scene.add(g);
    }
    const spa = this.makeSpaMesh();
    spa.position.set(-5, 0, -8);
    this.scene.add(spa);
    const grind = this.makeProcessorMesh();
    grind.position.set(-2, 0, -10);
    this.scene.add(grind);
    const pack = this.makePackerMesh();
    pack.position.set(2, 0, -10);
    this.scene.add(pack);
    const barn = this.makeMarketMesh();
    barn.position.set(5, 0, -8);
    this.scene.add(barn);
    const hero = this.makePlayerMesh();
    hero.position.set(0, 0, 2);
    this.scene.add(hero);
    this.playerMesh = hero;
    this.playerPos.set(0, 0, 2);
    this.camera.position.set(8, 10, 14);
    this.camera.lookAt(0, 0.5, -4);
  }

  private beginLevel(index: number) {
    this.clearWorld();
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.elapsed = 0;
    this.timeLeft = this.level.timeLimit;
    this.raw = 0;
    this.washed = 0;
    this.glitter = 0;
    this.boxed = 0;
    this.sold = 0;
    this.killCount = 0;
    this.waveIndex = 0;
    this.fireCd = 0;
    this.hurtCd = 0;
    this.harvestProgress = 0;
    this.spaInteract = 0;
    this.processInteract = 0;
    this.packInteract = 0;
    this.sellProgress = 0;
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.faceYaw = Math.PI; // face -Z (camera forward at yaw 0)
    this.pitch = 0.78;
    this.trauma = 0;
    this.hitstop = 0;
    this.squash = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.applyPlayerStatsFromSave();
    this.health = this.maxHealth;

    this.scene.background = new THREE.Color(0x8ec8e8);
    this.scene.fog = new THREE.Fog(0x8ec8e8, 45, 125);
    this.buildLights();

    const w = this.level.width;
    const d = this.level.depth;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 10, d + 10), this.mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const rng = mulberry32(this.level.seed);
    this.addClouds(rng, Math.max(w, d));
    for (let i = 0; i < 20; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1.4 + rng() * 2, 14),
        new THREE.MeshStandardMaterial({ color: rng() > 0.5 ? 0x6db86e : 0x4f8f58, roughness: 0.95 }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((rng() - 0.5) * w * 0.9, 0.015, (rng() - 0.5) * d * 0.9);
      this.scene.add(patch);
    }

    this.buildFence(w, d);

    for (const p of this.level.platforms) {
      const h = p.h ?? 0.55;
      const mesh = new THREE.Mesh(this.geo.box, this.mats.platform);
      mesh.scale.set(p.w, h, p.d);
      mesh.position.set(p.x, p.y + h / 2, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.solids.push({
        minX: p.x - p.w / 2,
        maxX: p.x + p.w / 2,
        minY: p.y,
        maxY: p.y + h,
        minZ: p.z - p.d / 2,
        maxZ: p.z + p.d / 2,
      });
    }

    this.spawnCrops(rng);
    this.placeBuildings();
    this.initPileGroups();
    this.decorateRanch(rng);
    this.spawnStars(rng);
    this.spawnExtraStations();

    this.playerMesh = this.makePlayerMesh();
    this.playerPos.set(this.level.spawn.x, 0, this.level.spawn.z);
    this.playerMesh.position.copy(this.playerPos);
    this.computeMoveBasis();
    this.playerMesh.rotation.y = this.faceYaw;
    this.scene.add(this.playerMesh);
    this.paintGun();
    this.syncWorkers();
    this.flashMessage(this.level.name);
    this.hudDirty = true;
  }

  private placeBuildings() {
    this.spa = this.makeBuilding("spa", this.level.spa, this.makeSpaMesh(), 1.3);
    this.processor = this.makeBuilding("processor", this.level.processor, this.makeProcessorMesh(), 1.2);
    this.packer = this.makeBuilding("packer", this.level.packer, this.makePackerMesh(), 1.3);
    this.market = this.makeBuilding("market", this.level.market, this.makeMarketMesh(), 1.4);

    this.addRingMarker(this.spa.pos, 0x4ec8ff, 2);
    this.addRingMarker(this.processor.pos, 0x7b5cff, 3);
    this.addRingMarker(this.packer.pos, 0xffc84a, 4);
    this.addRingMarker(this.market.pos, 0xff8ec8, 5);

    const field = new THREE.Vector3(0, 0, this.level.spawn.z * 0.5);
    this.addRingMarker(field, 0xff8ec8, 1);
    this.addChainPath(field, this.spa.pos);
    this.addChainPath(this.spa.pos, this.processor.pos);
    this.addChainPath(this.processor.pos, this.packer.pos);
    this.addChainPath(this.packer.pos, this.market.pos);

    // Minimal markers only — colored rings + single step number (no paragraphs)
    const marks: [string, string, THREE.Vector3][] = [
      ["①", "#5a3a1a", field.clone()],
      ["②", "#0a5a8a", this.spa.pos.clone()],
      ["③", "#4a2a9a", this.processor.pos.clone()],
      ["④", "#8a6010", this.packer.pos.clone()],
      ["⑤", "#9a2060", this.market.pos.clone()],
    ];
    for (const [num, color, pos] of marks) {
      const s = this.makeTextSprite([num, ""], color);
      s.scale.set(1.6, 0.9, 1);
      s.position.set(pos.x, 2.6, pos.z);
      this.scene.add(s);
    }
  }

  private makeBuilding(
    kind: Building["kind"],
    pos: { x: number; z: number },
    mesh: THREE.Group,
    r: number,
  ): Building {
    const b: Building = {
      kind,
      pos: new THREE.Vector3(pos.x, 0, pos.z),
      mesh,
      progress: 0,
      buffer: 0,
    };
    b.mesh.position.copy(b.pos);
    this.scene.add(b.mesh);
    this.solids.push({
      minX: b.pos.x - r,
      maxX: b.pos.x + r,
      minY: 0,
      maxY: 2.4,
      minZ: b.pos.z - r,
      maxZ: b.pos.z + r,
    });
    return b;
  }

  private initPileGroups() {
    const mk = (key: string, anchor: THREE.Vector3) => {
      const g = new THREE.Group();
      g.position.copy(anchor);
      this.scene.add(g);
      this.pileGroups[key] = g;
    };
    // Output pads beside each station
    mk("raw", this.spa.pos.clone().add(new THREE.Vector3(2.2, 0, 0.5)));
    mk("washed", this.spa.pos.clone().add(new THREE.Vector3(-2.2, 0, 0.5)));
    mk("washedOut", this.processor.pos.clone().add(new THREE.Vector3(2.2, 0, 0)));
    mk("glitter", this.processor.pos.clone().add(new THREE.Vector3(-2.2, 0, 0)));
    mk("glitterOut", this.packer.pos.clone().add(new THREE.Vector3(2.2, 0, 0)));
    mk("boxed", this.packer.pos.clone().add(new THREE.Vector3(-2.2, 0, 0)));
    mk("boxedSell", this.market.pos.clone().add(new THREE.Vector3(0, 0, 2.4)));
  }

  private buildFence(w: number, d: number) {
    const hw = w / 2;
    const hd = d / 2;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      for (const pos of [
        new THREE.Vector3(-hw + t * w, 0.6, -hd),
        new THREE.Vector3(-hw + t * w, 0.6, hd),
        new THREE.Vector3(-hw, 0.6, -hd + t * d),
        new THREE.Vector3(hw, 0.6, -hd + t * d),
      ]) {
        const post = new THREE.Mesh(this.geo.cyl, this.mats.fence);
        post.scale.set(0.12, 1.2, 0.12);
        post.position.copy(pos);
        post.castShadow = true;
        this.scene.add(post);
      }
    }

    // Corner flags
    for (const [fx, fz] of [[-hw + 1, -hd + 1], [hw - 1, -hd + 1], [-hw + 1, hd - 1], [hw - 1, hd - 1]] as const) {
      const pole = new THREE.Mesh(this.geo.cyl, this.mats.fence);
      pole.scale.set(0.08, 2.2, 0.08);
      pole.position.set(fx, 1.1, fz);
      this.scene.add(pole);
      const flag = new THREE.Mesh(
        this.geo.box,
        new THREE.MeshStandardMaterial({
          color: RAINBOW[Math.abs(Math.floor(fx + fz)) % RAINBOW.length],
          emissive: RAINBOW[0],
          emissiveIntensity: 0.2,
        }),
      );
      flag.scale.set(0.7, 0.4, 0.05);
      flag.position.set(fx + 0.35, 1.9, fz);
      flag.name = "spin";
      this.scene.add(flag);
      this.spinParts.push(flag);
    }
    const wallT = 0.6;
    this.solids.push(
      { minX: -hw - wallT, maxX: hw + wallT, minY: 0, maxY: 3, minZ: -hd - wallT, maxZ: -hd },
      { minX: -hw - wallT, maxX: hw + wallT, minY: 0, maxY: 3, minZ: hd, maxZ: hd + wallT },
      { minX: -hw - wallT, maxX: -hw, minY: 0, maxY: 3, minZ: -hd, maxZ: hd },
      { minX: hw, maxX: hw + wallT, minY: 0, maxY: 3, minZ: -hd, maxZ: hd },
    );
  }

  private spawnCrops(rng: () => number) {
    const fieldZ = this.level.spawn.z * 0.55;
    const halfW = this.level.width * 0.26;
    const halfD = this.level.depth * 0.16;
    let placed = 0;
    let attempts = 0;
    while (placed < this.level.cropCount && attempts < 300) {
      attempts++;
      const x = (rng() - 0.5) * halfW * 2;
      const z = fieldZ + (rng() - 0.5) * halfD * 2;
      if (Math.hypot(x - this.level.spa.x, z - this.level.spa.z) < 3.5) continue;
      if (Math.hypot(x - this.level.processor.x, z - this.level.processor.z) < 3.5) continue;
      if (Math.hypot(x - this.level.packer.x, z - this.level.packer.z) < 3.5) continue;
      if (Math.hypot(x - this.level.market.x, z - this.level.market.z) < 3.5) continue;
      if (Math.hypot(x - this.level.spawn.x, z - this.level.spawn.z) < 2.8) continue;
      let ok = true;
      for (const c of this.crops) {
        if (Math.hypot(c.pos.x - x, c.pos.z - z) < 1.8) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const mesh = this.makeCropMesh();
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.crops.push({
        id: this.nextCropId++,
        pos: new THREE.Vector3(x, 0, z),
        mesh,
        ready: 1,
        harvested: false,
        growTimer: 0,
      });
      placed++;
    }
  }

  // --- meshes ---
  private makePlayerMesh() {
    const g = new THREE.Group();
    const ch = characterDef(this.save.character ?? "rancher");
    const bodyMat = new THREE.MeshStandardMaterial({ color: ch.body, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: ch.pants, roughness: 0.8 });
    const hatMat = new THREE.MeshStandardMaterial({ color: ch.hat, roughness: 0.65 });

    if (this.save.character === "robot") {
      const legs = new THREE.Mesh(this.geo.box, pantsMat);
      legs.scale.set(0.5, 0.45, 0.35);
      legs.position.y = 0.35;
      g.add(legs);
      const body = new THREE.Mesh(this.geo.box, bodyMat);
      body.scale.set(0.65, 0.7, 0.45);
      body.position.y = 0.95;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(this.geo.box, bodyMat);
      head.scale.set(0.45, 0.4, 0.4);
      head.position.y = 1.55;
      g.add(head);
      const visor = new THREE.Mesh(
        this.geo.box,
        new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 0.6 }),
      );
      visor.scale.set(0.4, 0.12, 0.1);
      visor.position.set(0, 1.58, 0.22);
      g.add(visor);
      const ant = new THREE.Mesh(this.geo.cyl, hatMat);
      ant.scale.set(0.06, 0.25, 0.06);
      ant.position.y = 1.9;
      g.add(ant);
    } else if (this.save.character === "dino_rider") {
      const body = new THREE.Mesh(this.geo.sphere, bodyMat);
      body.scale.set(0.55, 0.4, 0.75);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(this.geo.sphere, bodyMat);
      head.scale.set(0.32, 0.28, 0.38);
      head.position.set(0, 0.85, 0.45);
      g.add(head);
      const rider = new THREE.Mesh(this.geo.cyl, pantsMat);
      rider.scale.set(0.28, 0.35, 0.22);
      rider.position.set(0, 1.05, -0.05);
      g.add(rider);
      const rhead = new THREE.Mesh(this.geo.sphere, new THREE.MeshStandardMaterial({ color: 0xffe8f4 }));
      rhead.scale.setScalar(0.2);
      rhead.position.set(0, 1.4, -0.05);
      g.add(rhead);
      const crest = new THREE.Mesh(this.geo.cone, hatMat);
      crest.scale.set(0.12, 0.3, 0.12);
      crest.position.set(0, 1.05, 0.55);
      crest.rotation.x = 0.5;
      g.add(crest);
    } else {
      const legs = new THREE.Mesh(this.geo.box, pantsMat);
      legs.scale.set(0.5, 0.55, 0.35);
      legs.position.y = 0.4;
      legs.castShadow = true;
      g.add(legs);
      const body = new THREE.Mesh(this.geo.cyl, bodyMat);
      body.scale.set(0.55, 0.7, 0.4);
      body.position.y = 1.0;
      body.castShadow = true;
      g.add(body);
      if (this.save.character === "wizard") {
        const robe = new THREE.Mesh(this.geo.cone, bodyMat);
        robe.scale.set(0.7, 0.9, 0.55);
        robe.position.y = 0.7;
        robe.rotation.x = Math.PI;
        g.add(robe);
      } else {
        const cape = new THREE.Mesh(
          this.geo.box,
          new THREE.MeshStandardMaterial({ color: ch.hat, emissive: ch.hat, emissiveIntensity: 0.2 }),
        );
        cape.scale.set(0.45, 0.55, 0.08);
        cape.position.set(0, 1.05, -0.28);
        g.add(cape);
      }
      const head = new THREE.Mesh(this.geo.sphere, bodyMat);
      head.scale.set(0.4, 0.4, 0.4);
      head.position.y = 1.6;
      head.castShadow = true;
      g.add(head);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1038 });
      const eyeL = new THREE.Mesh(this.geo.sphere, eyeMat);
      eyeL.scale.setScalar(0.06);
      eyeL.position.set(-0.12, 1.65, 0.32);
      g.add(eyeL);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.12;
      g.add(eyeR);
      if (this.save.character === "wizard") {
        const hat = new THREE.Mesh(this.geo.cone, hatMat);
        hat.scale.set(0.35, 0.7, 0.35);
        hat.position.y = 2.15;
        g.add(hat);
      } else {
        const hat = new THREE.Mesh(this.geo.cyl, hatMat);
        hat.scale.set(0.55, 0.18, 0.55);
        hat.position.y = 1.85;
        g.add(hat);
        const brim = new THREE.Mesh(this.geo.cyl, hatMat);
        brim.scale.set(0.78, 0.06, 0.78);
        brim.position.y = 1.76;
        g.add(brim);
      }
      const tip = new THREE.Mesh(this.geo.cone, this.mats.horn);
      tip.scale.set(0.1, 0.28, 0.1);
      tip.position.y = this.save.character === "wizard" ? 2.55 : 2.1;
      g.add(tip);
    }

    this.gunMesh = new THREE.Group();
    g.add(this.gunMesh);
    this.carryMesh = new THREE.Group();
    this.carryMesh.position.set(-0.45, 1.0, 0.15);
    g.add(this.carryMesh);
    return g;
  }

  private paintGun() {
    if (!this.gunMesh) return;
    while (this.gunMesh.children.length) this.gunMesh.remove(this.gunMesh.children[0]);
    const gun = GUN_TIERS[this.save.gunTier];
    const mat = new THREE.MeshStandardMaterial({
      color: gun.color,
      metalness: 0.35,
      roughness: 0.4,
      emissive: gun.color,
      emissiveIntensity: 0.2,
    });
    // Local +Z = character face direction
    const barrel = new THREE.Mesh(this.geo.box, mat);
    barrel.scale.set(0.14, 0.14, 0.65 + this.save.gunTier * 0.08);
    barrel.position.set(0.4, 1.05, 0.5);
    this.gunMesh.add(barrel);
    const tip = new THREE.Mesh(this.geo.sphere, mat);
    tip.scale.setScalar(0.1);
    tip.position.set(0.4, 1.05, 0.88 + this.save.gunTier * 0.04);
    tip.name = "muzzle";
    this.gunMesh.add(tip);
  }

  private makeCropMesh() {
    const g = new THREE.Group();
    // Pink unicorn poop
    const pink = new THREE.MeshStandardMaterial({
      color: 0xff8ec8,
      roughness: 0.75,
      emissive: 0xff5aa8,
      emissiveIntensity: 0.12,
    });
    const pink2 = new THREE.MeshStandardMaterial({
      color: 0xffb0dc,
      roughness: 0.7,
      emissive: 0xff6bb5,
      emissiveIntensity: 0.18,
    });
    const base = new THREE.Mesh(this.geo.sphere, pink);
    base.scale.set(0.58, 0.36, 0.52);
    base.position.y = 0.2;
    base.castShadow = true;
    g.add(base);
    const top = new THREE.Mesh(this.geo.sphere, pink2);
    top.scale.set(0.38, 0.3, 0.34);
    top.position.set(0.08, 0.44, 0.05);
    g.add(top);
    const peak = new THREE.Mesh(this.geo.sphere, pink);
    peak.scale.set(0.22, 0.2, 0.2);
    peak.position.set(-0.06, 0.58, -0.04);
    g.add(peak);
    // Glitter flecks in the poop
    const fleckColors = [0xffe14a, 0x4ab8ff, 0xb06bff, 0xffffff, 0x5ee07a];
    for (let i = 0; i < 7; i++) {
      const fleck = new THREE.Mesh(
        this.geo.box,
        new THREE.MeshStandardMaterial({
          color: fleckColors[i % fleckColors.length],
          emissive: fleckColors[i % fleckColors.length],
          emissiveIntensity: 0.7,
          roughness: 0.3,
        }),
      );
      fleck.scale.setScalar(0.06 + (i % 3) * 0.02);
      const a = (i / 7) * Math.PI * 2;
      fleck.position.set(Math.cos(a) * 0.28, 0.28 + (i % 3) * 0.12, Math.sin(a) * 0.22);
      fleck.rotation.set(a, a * 0.5, 0);
      fleck.name = i === 0 ? "orb" : "glitter";
      g.add(fleck);
    }
    // Sparkle orb that orbits
    const orb = new THREE.Mesh(
      this.geo.sphere,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    orb.scale.setScalar(0.06);
    orb.position.set(0.3, 0.75, 0);
    orb.name = "orb";
    g.add(orb);
    return g;
  }

  private makeSpaMesh() {
    const g = new THREE.Group();
    const tub = new THREE.Mesh(this.geo.cyl, this.mats.spa);
    tub.scale.set(1.6, 0.7, 1.6);
    tub.position.y = 0.4;
    tub.castShadow = true;
    g.add(tub);
    const water = new THREE.Mesh(
      this.geo.cyl,
      new THREE.MeshStandardMaterial({
        color: 0xa8e8ff,
        transparent: true,
        opacity: 0.7,
        emissive: 0x4ec8ff,
        emissiveIntensity: 0.3,
      }),
    );
    water.scale.set(1.35, 0.15, 1.35);
    water.position.y = 0.75;
    g.add(water);
    for (let i = 0; i < 5; i++) {
      const bubble = new THREE.Mesh(
        this.geo.sphere,
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      );
      bubble.scale.setScalar(0.12 + (i % 3) * 0.04);
      bubble.position.set(Math.cos(i) * 0.5, 0.95 + (i % 2) * 0.2, Math.sin(i) * 0.5);
      bubble.name = "spin";
      g.add(bubble);
      this.spinParts.push(bubble);
    }
    const duck = new THREE.Mesh(this.geo.sphere, this.mats.crate);
    duck.scale.set(0.25, 0.2, 0.3);
    duck.position.set(0.7, 0.9, 0.2);
    g.add(duck);
    return g;
  }

  private makeProcessorMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(this.geo.box, this.mats.processor);
    base.scale.set(2.0, 1.2, 1.9);
    base.position.y = 0.6;
    base.castShadow = true;
    g.add(base);
    const hopper = new THREE.Mesh(this.geo.cyl, this.mats.processor);
    hopper.scale.set(0.85, 0.7, 0.85);
    hopper.position.y = 1.45;
    g.add(hopper);
    const gem = new THREE.Mesh(this.geo.sphere, this.mats.leaf);
    gem.scale.setScalar(0.28);
    gem.position.set(0, 2.2, 0);
    gem.name = "spin";
    g.add(gem);
    this.spinParts.push(gem);
    const window = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 0.6 }),
    );
    window.scale.set(0.55, 0.35, 0.08);
    window.position.set(0, 0.9, 1.0);
    g.add(window);
    return g;
  }

  private makePackerMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(this.geo.box, this.mats.packer);
    base.scale.set(2.0, 1.0, 1.8);
    base.position.y = 0.5;
    base.castShadow = true;
    g.add(base);
    const belt = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.7 }),
    );
    belt.scale.set(2.2, 0.12, 0.7);
    belt.position.set(0, 1.05, 0.3);
    g.add(belt);
    const box1 = new THREE.Mesh(this.geo.box, this.mats.crate);
    box1.scale.set(0.45, 0.4, 0.45);
    box1.position.set(-0.4, 1.35, 0.2);
    g.add(box1);
    const bow = new THREE.Mesh(this.geo.sphere, this.mats.hat);
    bow.scale.set(0.18, 0.12, 0.18);
    bow.position.set(-0.4, 1.65, 0.2);
    bow.name = "spin";
    g.add(bow);
    this.spinParts.push(bow);
    return g;
  }

  private makeMarketMesh() {
    const g = new THREE.Group();
    const counter = new THREE.Mesh(this.geo.box, this.mats.market);
    counter.scale.set(2.5, 1.0, 1.5);
    counter.position.y = 0.5;
    counter.castShadow = true;
    g.add(counter);
    const roof = new THREE.Mesh(this.geo.box, this.mats.roof);
    roof.scale.set(2.9, 0.14, 1.9);
    roof.position.y = 2.0;
    g.add(roof);
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(
        this.geo.box,
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffe14a : 0xff6bb5 }),
      );
      stripe.scale.set(0.48, 0.08, 1.95);
      stripe.position.set(-1.0 + i * 0.5, 1.85, 0);
      g.add(stripe);
    }
    const sign = new THREE.Mesh(
      this.geo.sphere,
      new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcc44, emissiveIntensity: 0.45 }),
    );
    sign.scale.setScalar(0.22);
    sign.position.set(-0.8, 1.35, 0.5);
    sign.name = "spin";
    g.add(sign);
    this.spinParts.push(sign);
    return g;
  }

  private makeEnemyMesh(kind: EnemyKind, color: number, height: number) {
    const g = new THREE.Group();
    const statsForm = kind === "dino" || kind === "raptor" ? "dino" : "unicorn";
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    if (statsForm === "dino") {
      const body = new THREE.Mesh(this.geo.sphere, bodyMat);
      const s = height * 0.5;
      body.scale.set(s * 0.85, s * 0.65, s * 1.25);
      body.position.y = height * 0.38;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(this.geo.sphere, bodyMat);
      head.scale.set(s * 0.4, s * 0.35, s * 0.5);
      head.position.set(0, height * 0.7, s * 0.7);
      g.add(head);
      // snout
      const snout = new THREE.Mesh(this.geo.box, bodyMat);
      snout.scale.set(s * 0.28, s * 0.2, s * 0.35);
      snout.position.set(0, height * 0.65, s * 1.05);
      g.add(snout);
      // tail
      const tail = new THREE.Mesh(this.geo.cone, bodyMat);
      tail.scale.set(s * 0.25, s * 0.7, s * 0.25);
      tail.position.set(0, height * 0.4, -s * 0.85);
      tail.rotation.x = Math.PI / 2;
      g.add(tail);
      // plates
      for (let i = 0; i < 3; i++) {
        const plate = new THREE.Mesh(this.geo.cone, this.mats.horn);
        plate.scale.set(0.1, 0.22, 0.08);
        plate.position.set(0, height * 0.7 + i * 0.05, -0.1 + i * 0.15);
        g.add(plate);
      }
      // legs
      for (const sx of [-0.2, 0.2]) {
        const leg = new THREE.Mesh(this.geo.cyl, bodyMat);
        leg.scale.set(0.12, height * 0.35, 0.12);
        leg.position.set(sx, height * 0.15, 0.1);
        g.add(leg);
      }
      if (kind === "raptor") g.scale.setScalar(0.85);
      return g;
    }
    // Unicorn form
    const body = new THREE.Mesh(this.geo.sphere, bodyMat);
    const s = height * 0.55;
    body.scale.set(s * 0.9, s * 0.75, s * 1.1);
    body.position.y = height * 0.4;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(this.geo.sphere, bodyMat);
    head.scale.setScalar(s * 0.45);
    head.position.set(0, height * 0.85, s * 0.35);
    g.add(head);
    const horn = new THREE.Mesh(this.geo.cone, this.mats.horn);
    horn.scale.set(0.12, 0.4 * (height / 1.2), 0.12);
    horn.position.set(0, height * 1.1, s * 0.5);
    horn.rotation.x = 0.4;
    g.add(horn);
    const mane = new THREE.Mesh(this.geo.sphere, this.mats.mane);
    mane.scale.set(s * 0.35, s * 0.5, s * 0.25);
    mane.position.set(0, height * 0.75, -s * 0.2);
    g.add(mane);
    if (kind === "brute") g.scale.setScalar(1.25);
    return g;
  }

  private makeCustomerMesh(hue: number) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.7 });
    const body = new THREE.Mesh(this.geo.cyl, bodyMat);
    body.scale.set(0.35, 0.55, 0.3);
    body.position.y = 0.75;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(this.geo.sphere, this.mats.player);
    head.scale.setScalar(0.26);
    head.position.y = 1.25;
    g.add(head);
    const legs = new THREE.Mesh(this.geo.box, new THREE.MeshStandardMaterial({ color: 0x3a3050 }));
    legs.scale.set(0.32, 0.35, 0.25);
    legs.position.y = 0.28;
    g.add(legs);
    // shopping bag
    const bag = new THREE.Mesh(this.geo.box, this.mats.crate);
    bag.scale.set(0.18, 0.22, 0.12);
    bag.position.set(0.28, 0.7, 0);
    g.add(bag);
    return g;
  }

  private makeWorkerMesh(role: WorkerRole, index: number) {
    const g = new THREE.Group();
    const colors: Record<WorkerRole, number> = {
      farmer: 0x7ad46a,
      grinder: 0x4ec8ff,
      vendor: 0xffc84a,
      bot: 0x6bc8ff,
    };
    const bodyMat = new THREE.MeshStandardMaterial({ color: colors[role], roughness: 0.65 });
    if (role === "bot") {
      const body = new THREE.Mesh(this.geo.box, bodyMat);
      body.scale.set(0.7, 0.55, 0.7);
      body.position.y = 0.45;
      g.add(body);
      const dome = new THREE.Mesh(this.geo.sphere, bodyMat);
      dome.scale.set(0.35, 0.28, 0.35);
      dome.position.y = 0.85;
      g.add(dome);
      const light = new THREE.Mesh(
        this.geo.sphere,
        new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffaa00, emissiveIntensity: 0.8 }),
      );
      light.scale.setScalar(0.1);
      light.position.y = 1.2;
      light.name = "spin";
      g.add(light);
      return g;
    }
    const legs = new THREE.Mesh(this.geo.box, new THREE.MeshStandardMaterial({ color: 0x3a2850 }));
    legs.scale.set(0.38, 0.4, 0.28);
    legs.position.y = 0.28;
    g.add(legs);
    const body = new THREE.Mesh(this.geo.cyl, bodyMat);
    body.scale.set(0.4, 0.5, 0.32);
    body.position.y = 0.75;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(this.geo.sphere, this.mats.player);
    head.scale.setScalar(0.28);
    head.position.y = 1.2;
    g.add(head);
    const hat = new THREE.Mesh(this.geo.cone, bodyMat);
    hat.scale.set(0.28, 0.35, 0.28);
    hat.position.y = 1.5;
    g.add(hat);
    g.scale.setScalar(0.95 + index * 0.02);
    return g;
  }

  private productMesh(kind: "raw" | "washed" | "glitter" | "boxed") {
    const g = new THREE.Group();
    if (kind === "raw") {
      const pink = new THREE.MeshStandardMaterial({
        color: 0xff8ec8,
        emissive: 0xff5aa8,
        emissiveIntensity: 0.2,
        roughness: 0.7,
      });
      const m = new THREE.Mesh(this.geo.sphere, pink);
      m.scale.set(0.35, 0.22, 0.32);
      m.position.y = 0.12;
      g.add(m);
      const s = new THREE.Mesh(this.geo.sphere, this.mats.leaf);
      s.scale.setScalar(0.08);
      s.position.set(0.05, 0.28, 0);
      g.add(s);
    } else if (kind === "washed") {
      const m = new THREE.Mesh(this.geo.sphere, this.mats.washed);
      m.scale.set(0.32, 0.22, 0.3);
      m.position.y = 0.12;
      g.add(m);
    } else if (kind === "glitter") {
      const m = new THREE.Mesh(this.geo.sphere, this.mats.glitterMat);
      m.scale.set(0.28, 0.2, 0.28);
      m.position.y = 0.12;
      g.add(m);
      const s = new THREE.Mesh(this.geo.sphere, this.mats.leaf);
      s.scale.setScalar(0.07);
      s.position.set(0, 0.28, 0);
      g.add(s);
    } else {
      const box = new THREE.Mesh(this.geo.box, this.mats.crate);
      box.scale.set(0.35, 0.3, 0.35);
      box.position.y = 0.18;
      g.add(box);
      const bow = new THREE.Mesh(this.geo.sphere, this.mats.hat);
      bow.scale.set(0.12, 0.08, 0.12);
      bow.position.y = 0.4;
      g.add(bow);
    }
    return g;
  }

  private syncWorkers() {
    for (const w of this.workers) this.scene.remove(w.mesh);
    this.workers = [];
    if (!this.level) return;
    const add = (role: WorkerRole, count: number) => {
      for (let i = 0; i < count; i++) {
        const mesh = this.makeWorkerMesh(role, i);
        let pos: THREE.Vector3;
        if (role === "farmer" || role === "bot") {
          pos = new THREE.Vector3(this.level.spawn.x + (i - 1) * 1.4, 0, this.level.spawn.z - 2);
        } else if (role === "grinder") {
          pos = new THREE.Vector3(this.spa.pos.x + 1.5, 0, this.spa.pos.z + 1.2 + i * 0.5);
        } else {
          pos = new THREE.Vector3(this.market.pos.x - 1.5, 0, this.market.pos.z + 1.2 + i * 0.5);
        }
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this.workers.push({
          role,
          mesh,
          pos: pos.clone(),
          timer: i * 0.4,
          workTimer: 0,
          targetCrop: null,
          spinPart: mesh.getObjectByName("spin") || null,
        });
      }
    };
    add("farmer", this.up("hire_farmer"));
    add("grinder", this.up("hire_grinder"));
    add("vendor", this.up("hire_vendor"));
    add("bot", this.up("hire_bot") > 0 ? 1 : 0);
  }

  // --- loop ---
  private loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.acc += delta;
    while (this.acc >= FIXED) {
      if (this.screen === "playing") this.fixedUpdate(FIXED);
      this.acc -= FIXED;
    }
    this.updateVisuals(delta);
    this.renderer.render(this.scene, this.camera);
    this.hudTimer += delta;
    if (this.hudDirty || this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.hudDirty = false;
      this.emitHud();
    }
  }

  private fixedUpdate(dt: number) {
    // Juice: brief freeze on impact (presentation only)
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      return;
    }
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    // squash recover
    this.squash += (1 - this.squash) * Math.min(1, dt * 8);
    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = null;
    }
    this.updatePlayer(dt);
    this.updateWaves();
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateChain(dt);
    this.updateWorkers(dt);
    this.updateCustomers(dt);
    this.updatePickups(dt);
    this.syncStagePiles();
    this.syncCarryVisual();
    this.updateParticles(dt);
    this.updateFloats(dt);
    this.checkLevelEnd();
    this.hudDirty = true;
  }

  private computeMoveBasis() {
    // Camera-relative forward on XZ (where you look on the farm)
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  private bodyForward(out: THREE.Vector3) {
    // Character mesh faces +Z locally; faceYaw is rotation.y
    out.set(Math.sin(this.faceYaw), 0, Math.cos(this.faceYaw));
    return out;
  }

  private updatePlayer(dt: number) {
    this.computeMoveBasis();
    if (this.isMobile && (Math.abs(this.touchLook.x) > 0.01 || Math.abs(this.touchLook.y) > 0.01)) {
      this.yaw -= this.touchLook.x * 2.4 * dt;
      this.pitch = clamp(this.pitch + this.touchLook.y * 1.6 * dt, 0.35, 1.15);
    }

    let mx = 0;
    let mz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (this.isMobile) {
      mx += this.touchMove.x;
      mz += this.touchMove.y;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    const wish = this.tmpV
      .copy(this.forward)
      .multiplyScalar(mz)
      .addScaledVector(this.right, mx);
    this.playerVel.x = wish.x * this.moveSpeed;
    this.playerVel.z = wish.z * this.moveSpeed;

    if ((this.keys.has("Space") || this.touchJump) && this.onGround) {
      this.playerVel.y = 8.5;
      this.onGround = false;
      this.touchJump = false;
    }
    this.playerVel.y -= 22 * dt;
    this.moveWithCollisions(dt);

    const shooting = this.mouseDown || this.touchShoot || this.keys.has("KeyF");

    // Face: shooting → aim dir; else move; else camera look
    if (shooting) {
      // Snap body to camera look so gun points into the view
      this.faceYaw = Math.atan2(this.forward.x, this.forward.z);
    } else if (len > 0.1) {
      this.faceYaw = Math.atan2(wish.x, wish.z);
    } else {
      this.faceYaw = Math.atan2(this.forward.x, this.forward.z);
    }

    if (this.playerMesh) {
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.y = this.faceYaw;
      // squash & stretch (volume-ish preserve)
      const sy = this.squash;
      const sx = Math.sqrt(1 / Math.max(0.5, sy));
      this.playerMesh.scale.set(sx, sy, sx);
    }
    // landing dust
    if (this.onGround && this.playerVel.y < -2) {
      this.spawnHitParticles(this.playerPos.clone().setY(0.1), 0xc4b090, 4);
      this.pulseSquash(0.75);
    }
    // move dust
    const moving = Math.hypot(this.playerVel.x, this.playerVel.z) > 2 && this.onGround;
    if (moving) {
      this.moveDustCd -= dt;
      if (this.moveDustCd <= 0) {
        this.moveDustCd = 0.12;
        this.spawnHitParticles(this.playerPos.clone().setY(0.05), 0xd8c8a0, 1);
      }
    }

    this.fireCd = Math.max(0, this.fireCd - dt);
    if (shooting && this.fireCd <= 0) {
      this.shoot();
      this.fireCd = 1 / this.gunStats().fireRate;
    }
    this.handleInteract(dt);
    if (this.hurtCd > 0) this.hurtCd -= dt;
  }

  private moveWithCollisions(dt: number) {
    this.playerPos.x += this.playerVel.x * dt;
    this.resolvePlayerSolids("x");
    this.playerPos.z += this.playerVel.z * dt;
    this.resolvePlayerSolids("z");
    this.playerPos.y += this.playerVel.y * dt;
    this.onGround = false;
    if (this.playerPos.y <= 0) {
      this.playerPos.y = 0;
      this.playerVel.y = 0;
      this.onGround = true;
    }
    this.resolvePlayerSolids("y");
  }

  private resolvePlayerSolids(axis: "x" | "y" | "z") {
    const r = PLAYER_RADIUS;
    const feet = this.playerPos.y;
    const head = this.playerPos.y + PLAYER_HEIGHT;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    for (const s of this.solids) {
      const overlapX = px + r > s.minX && px - r < s.maxX;
      const overlapZ = pz + r > s.minZ && pz - r < s.maxZ;
      const overlapY = head > s.minY && feet < s.maxY;
      if (axis === "y") {
        if (overlapX && overlapZ) {
          if (this.playerVel.y <= 0 && feet < s.maxY && feet > s.maxY - 0.6 && head > s.maxY) {
            this.playerPos.y = s.maxY;
            this.playerVel.y = 0;
            this.onGround = true;
          } else if (this.playerVel.y > 0 && head > s.minY && feet < s.minY) {
            this.playerPos.y = s.minY - PLAYER_HEIGHT;
            this.playerVel.y = 0;
          }
        }
      } else if (axis === "x" && overlapY && overlapZ) {
        if (px < (s.minX + s.maxX) / 2) {
          if (px + r > s.minX) {
            this.playerPos.x = s.minX - r;
            this.playerVel.x = 0;
          }
        } else if (px - r < s.maxX) {
          this.playerPos.x = s.maxX + r;
          this.playerVel.x = 0;
        }
      } else if (axis === "z" && overlapY && overlapX) {
        if (pz < (s.minZ + s.maxZ) / 2) {
          if (pz + r > s.minZ) {
            this.playerPos.z = s.minZ - r;
            this.playerVel.z = 0;
          }
        } else if (pz - r < s.maxZ) {
          this.playerPos.z = s.maxZ + r;
          this.playerVel.z = 0;
        }
      }
    }
  }

  // --- combat ---
  private shoot() {
    const gun = this.gunStats();
    this.computeMoveBasis();

    // Aim: prefer nearest pest (top-down friendly), else body forward
    let aim = this.bodyForward(this.tmpV2).clone();
    let best: Enemy | null = null;
    let bestD = 22;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - this.playerPos.x, e.pos.z - this.playerPos.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      aim.set(best.pos.x - this.playerPos.x, 0, best.pos.z - this.playerPos.z).normalize();
      // Turn body to face the target so gun points at them
      this.faceYaw = Math.atan2(aim.x, aim.z);
      if (this.playerMesh) this.playerMesh.rotation.y = this.faceYaw;
    } else {
      // Fire where the character faces / camera looks
      aim.copy(this.bodyForward(this.tmpV2));
    }

    // Muzzle in front of body (local +Z)
    const bf = this.bodyForward(this.tmpV);
    const br = this.tmpV3.set(Math.cos(this.faceYaw), 0, -Math.sin(this.faceYaw));
    const origin = new THREE.Vector3(
      this.playerPos.x + bf.x * 0.9 + br.x * 0.35,
      this.playerPos.y + 1.15,
      this.playerPos.z + bf.z * 0.9 + br.z * 0.35,
    );

    // Muzzle flash
    this.spawnHitParticles(origin, RAINBOW[this.rainbowIdx % RAINBOW.length], 5);
    this.addTrauma(0.06);
    this.pulseSquash(0.92);
    gameAudio.play("shoot");

    for (let i = 0; i < gun.projectiles; i++) {
      const dir = aim.clone();
      dir.x += (Math.random() - 0.5) * gun.spread * 0.5;
      dir.z += (Math.random() - 0.5) * gun.spread * 0.5;
      dir.normalize();
      let bullet = this.bullets.find((b) => !b.active);
      if (!bullet) {
        const mesh = new THREE.Mesh(this.geo.sphere, this.mats.bullet.clone());
        mesh.scale.setScalar(0.24);
        this.scene.add(mesh);
        bullet = {
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          life: 0,
          damage: 0,
          mesh,
          active: false,
        };
        this.bullets.push(bullet);
      }
      const color = RAINBOW[(this.rainbowIdx++) % RAINBOW.length];
      bullet.active = true;
      bullet.pos.copy(origin);
      bullet.vel.copy(dir).multiplyScalar(gun.bulletSpeed);
      bullet.life = 1.65;
      bullet.damage = gun.damage;
      bullet.mesh.visible = true;
      bullet.mesh.position.copy(origin);
      bullet.mesh.scale.setScalar(0.28);
      const bm = bullet.mesh.material as THREE.MeshStandardMaterial;
      bm.color.setHex(color);
      bm.emissive.setHex(color);
      bm.emissiveIntensity = 1.2;
    }
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.life -= dt;
      const steps = 4;
      const stepDt = dt / steps;
      for (let s = 0; s < steps && b.active; s++) {
        b.pos.addScaledVector(b.vel, stepDt);
        b.mesh.position.copy(b.pos);
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.pos.x - b.pos.x;
          const dz = e.pos.z - b.pos.z;
          if (dx * dx + dz * dz > (e.radius + 1.45) ** 2) continue;
          if (b.pos.y < -0.3 || b.pos.y > e.height + 1.2) continue;
          e.hp -= b.damage;
          e.hitFlash = 0.15;
          // light knockback (feel only)
          const kdist = Math.hypot(dx, dz) || 1;
          e.pos.x -= (dx / kdist) * 0.35;
          e.pos.z -= (dz / kdist) * 0.35;
          b.active = false;
          b.mesh.visible = false;
          this.spawnHitParticles(b.pos, 0xffffff, 8);
          this.spawnHitParticles(b.pos, RAINBOW[this.rainbowIdx % RAINBOW.length], 6);
          if (e.hp <= 0) {
            e.alive = false;
            e.mesh.visible = false;
            this.killCount++;
            this.combo += 1;
            this.comboTimer = 2.5;
            const bonus = e.coin + Math.min(5, this.combo - 1);
            this.save.coins += bonus;
            this.spawnFloat(
              e.pos.clone().setY(1.5),
              this.combo > 1 ? `x${this.combo} +${bonus}c` : `+${bonus}c`,
              "#ffe08a",
            );
            this.addTrauma(0.35);
            this.addHitstop(0.05);
            this.pulseSquash(1.15);
            gameAudio.play("kill");
          } else {
            gameAudio.play("hit");
            this.addTrauma(0.12);
            this.spawnFloat(e.pos.clone().setY(1.2), "Hit!", "#fff");
          }
          break;
        }
      }
      if (b.life <= 0 || b.pos.y < -1) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  private updateWaves() {
    while (this.waveIndex < this.level.enemyWaves.length) {
      const wave = this.level.enemyWaves[this.waveIndex];
      if (this.elapsed < wave.delay) break;
      for (let i = 0; i < wave.count; i++) this.spawnEnemy(wave.kind);
      this.waveIndex++;
    }
  }

  private spawnEnemy(kind: EnemyKind) {
    const stats = enemyStats(kind, this.level.id);
    const hw = this.level.width / 2 - 2;
    const hd = this.level.depth / 2 - 2;
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let z = 0;
    if (edge === 0) {
      x = (Math.random() - 0.5) * hw * 2;
      z = -hd;
    } else if (edge === 1) {
      x = (Math.random() - 0.5) * hw * 2;
      z = hd;
    } else if (edge === 2) {
      x = -hw;
      z = (Math.random() - 0.5) * hd * 2;
    } else {
      x = hw;
      z = (Math.random() - 0.5) * hd * 2;
    }
    const mesh = this.makeEnemyMesh(kind, stats.color, stats.height);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      pos: new THREE.Vector3(x, 0, z),
      vel: new THREE.Vector3(),
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      damage: stats.damage,
      radius: stats.radius,
      height: stats.height,
      coin: stats.coin,
      mesh,
      attackCd: 0,
      hitFlash: 0,
      stealCd: 0,
      alive: true,
    });
  }

  private updateEnemies(dt: number) {
    const pad = 1.0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.stealCd = Math.max(0, e.stealCd - dt);

      let tx = this.playerPos.x;
      let tz = this.playerPos.z;
      let standoff = true;
      if (e.kind === "thief" && this.boxed > 0) {
        tx = this.market.pos.x;
        tz = this.market.pos.z;
        standoff = false;
      } else if (e.kind === "pest" || e.kind === "beetle" || e.kind === "dino" || e.kind === "raptor") {
        let best: Crop | null = null;
        let bestD = 12;
        for (const c of this.crops) {
          if (c.harvested || c.ready < 1) continue;
          const dist = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (dist < bestD) {
            bestD = dist;
            best = c;
          }
        }
        if (best && Math.hypot(this.playerPos.x - e.pos.x, this.playerPos.z - e.pos.z) > 7) {
          tx = best.pos.x;
          tz = best.pos.z;
          standoff = false;
        }
      }

      const dx = tx - e.pos.x;
      const dz = tz - e.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const stopAt = standoff ? e.radius + PLAYER_RADIUS + pad : e.radius + 0.4;
      if (dist > stopAt + 0.1) {
        e.pos.x += (dx / dist) * e.speed * dt;
        e.pos.z += (dz / dist) * e.speed * dt;
      } else if (dist < stopAt - 0.05) {
        e.pos.x = tx - (dx / dist) * stopAt;
        e.pos.z = tz - (dz / dist) * stopAt;
      }
      e.mesh.position.set(e.pos.x, Math.sin(this.clock.elapsedTime * 4 + e.id) * 0.06, e.pos.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        e.mesh.traverse((ch: THREE.Object3D) => {
          const m = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive) {
            m.emissive.setHex(e.hitFlash > 0 ? 0xffffff : 0x000000);
            m.emissiveIntensity = e.hitFlash > 0 ? 0.8 : 0;
          }
        });
      }

      const pdist = Math.hypot(this.playerPos.x - e.pos.x, this.playerPos.z - e.pos.z);
      if (pdist < stopAt + 0.4 && e.attackCd <= 0) {
        this.hurtPlayer(e.damage);
        e.attackCd = 1.0;
      }
      if ((e.kind === "pest" || e.kind === "beetle" || e.kind === "dino" || e.kind === "raptor") && e.attackCd <= 0) {
        for (const c of this.crops) {
          if (c.harvested || c.ready < 1) continue;
          if (Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) < 1.1) {
            c.ready = 0;
            c.harvested = true;
            c.growTimer = 7;
            c.mesh.scale.setScalar(0.2);
            e.attackCd = 1.2;
            /* quiet pest */
            break;
          }
        }
      }
      if (e.kind === "thief" && this.boxed > 0 && e.stealCd <= 0) {
        if (Math.hypot(this.market.pos.x - e.pos.x, this.market.pos.z - e.pos.z) < 2.2) {
          this.boxed = Math.max(0, this.boxed - 1);
          e.stealCd = 2.5;
          this.flashMessage("Stolen!");
        }
      }
    }
  }

  private hurtPlayer(dmg: number) {
    if (this.hurtCd > 0) return;
    gameAudio.play("hurt");
    this.health -= dmg;
    this.hurtCd = 0.9;
    this.addTrauma(0.4);
    this.pulseSquash(0.7);
    this.spawnHitParticles(this.playerPos.clone().setY(1.2), 0xd46a5c, 6);
    if (this.health <= 0) {
      this.health = 0;
      this.screen = "gameOver";
      document.exitPointerLock?.();
      writeSave(this.save);
      this.emitHud(true);
    }
  }

  // --- FARM ---
  private near(pos: THREE.Vector3, extra = 0) {
    return Math.hypot(pos.x - this.playerPos.x, pos.z - this.playerPos.z) < INTERACT_RANGE + extra;
  }

  private handleInteract(dt: number) {
    const want = this.keys.has("KeyE") || this.touchInteract || this.keys.has("KeyQ");
    this.interactHint = null;

    let nearest: Crop | null = null;
    let cropD = SCOOP_RADIUS;
    for (const c of this.crops) {
      if (c.harvested || c.ready < 1) continue;
      const d = Math.hypot(c.pos.x - this.playerPos.x, c.pos.z - this.playerPos.z);
      if (d < cropD) {
        cropD = d;
        nearest = c;
      }
    }
    if (nearest) {
      this.interactHint = "Scoop";
      if (want) {
        this.harvestProgress += this.harvestRate() * dt;
        if (this.harvestProgress >= 1) {
          this.harvestProgress = 0;
          const targets = this.crops
            .filter((c) => !c.harvested && c.ready >= 1)
            .filter((c) => Math.hypot(c.pos.x - this.playerPos.x, c.pos.z - this.playerPos.z) < SCOOP_RADIUS)
            .sort(
              (a, b) =>
                Math.hypot(a.pos.x - this.playerPos.x, a.pos.z - this.playerPos.z) -
                Math.hypot(b.pos.x - this.playerPos.x, b.pos.z - this.playerPos.z),
            )
            .slice(0, 1 + (this.up("harvest_speed") > 0 ? 1 : 0));
          let total = 0;
          for (const crop of targets) {
            crop.harvested = true;
            crop.ready = 0;
            crop.growTimer = 4 + Math.random() * 2.5;
            crop.mesh.scale.setScalar(0.15);
            const y = this.cropYield();
            total += y;
            this.raw += y;
            this.spawnHitParticles(crop.pos.clone().setY(0.6), 0xffe14a, 8);
            this.spawnFloat(crop.pos.clone().setY(1), `+${y} stinky`, "#ffe14a");
          }
          if (total > 0) {
            gameAudio.play("scoop");
            this.addTrauma(0.08);
            this.pulseSquash(0.88);
          }
        }
      } else this.harvestProgress = Math.max(0, this.harvestProgress - dt * 2);
      return;
    }
    this.harvestProgress = 0;

    if (this.near(this.spa.pos, 0.6)) {
      if (this.raw > 0) {
        this.interactHint = "Wash";
        if (want) {
          this.spaInteract += this.spaRate() * dt;
          if (this.spaInteract >= 1) {
            this.spaInteract = 0;
            const n = Math.min(2, this.raw);
            this.raw -= n;
            this.spa.buffer += n;
            this.spawnFloat(this.spa.pos.clone().setY(1.8), `Wash ×${n}`, "#4ec8ff");
            gameAudio.play("spa");
            /* quiet */
          }
        }
      } else if (this.spa.buffer > 0) this.interactHint = "…";
      else if (this.washed > 0) this.interactHint = "→ Grind";
      else this.interactHint = null;
      return;
    }

    if (this.near(this.processor.pos, 0.6)) {
      if (this.washed > 0) {
        this.interactHint = "Grind";
        if (want) {
          this.processInteract += dt * 4.5;
          if (this.processInteract >= 0.18) {
            this.processInteract = 0;
            const n = Math.min(2, this.washed);
            this.washed -= n;
            this.processor.buffer += n;
            this.spawnFloat(this.processor.pos.clone().setY(2), `Feed ×${n}`, "#c9a0ff");
            gameAudio.play("grind");
            /* quiet */
          }
        }
      } else if (this.processor.buffer > 0) this.interactHint = "…";
      else if (this.glitter > 0) this.interactHint = "→ Box";
      else this.interactHint = null;
      return;
    }

    if (this.near(this.packer.pos, 0.6)) {
      if (this.glitter > 0) {
        this.interactHint = "Box";
        if (want) {
          this.packInteract += this.packRate() * dt;
          if (this.packInteract >= 1) {
            this.packInteract = 0;
            const n = Math.min(2, this.glitter);
            this.glitter -= n;
            this.packer.buffer += n;
            this.spawnFloat(this.packer.pos.clone().setY(2), `Box ×${n}`, "#ffc84a");
            gameAudio.play("box");
            /* quiet */
          }
        }
      } else if (this.packer.buffer > 0) this.interactHint = "…";
      else if (this.boxed > 0) this.interactHint = "→ Sell";
      else this.interactHint = null;
      return;
    }

    if (this.near(this.market.pos, 0.6)) {
      if (this.boxed > 0) {
        this.interactHint = "Sell";
        if (want) {
          this.sellProgress += this.sellRate() * dt;
          if (this.sellProgress >= 1) {
            this.sellProgress = 0;
            const n = Math.min(2, this.boxed);
            this.boxed -= n;
            this.sold += n;
            this.save.totalSold += n;
            const pay = this.sellPrice() * n;
            this.save.coins += pay;
            this.health = Math.min(this.maxHealth, this.health + 2 * n);
            this.spawnHitParticles(this.market.pos.clone().setY(1.2), 0xff9acc, 12);
            this.spawnFloat(this.market.pos.clone().setY(2), `+${pay}c`, "#ffe08a");
            this.serveCustomers(n);
            gameAudio.play("sell");
            this.addTrauma(0.2);
            this.pulseSquash(1.12);
            this.flashMessage(`+${pay}c`);
            writeSave(this.save);
          }
        } else this.sellProgress = Math.max(0, this.sellProgress - dt);
      } else this.interactHint = null;
      return;
    }

    const step = this.nextStep();
    // Fountain / compost / jukebox
    if (this.tryDecorInteract()) {
      if (want) this.doDecorInteract();
      return;
    }

    this.interactHint = null;
    this.spaInteract = 0;
    this.processInteract = 0;
    this.packInteract = 0;
    this.sellProgress = 0;
  }

  private updateChain(dt: number) {
    for (const c of this.crops) {
      if (!c.harvested) continue;
      c.growTimer -= dt;
      if (c.growTimer <= 0) {
        c.harvested = false;
        c.ready = 1;
        c.mesh.scale.setScalar(1);
        this.spawnHitParticles(c.pos.clone().setY(0.5), 0x7ad46a, 3);
      } else {
        const t = 1 - clamp(c.growTimer / 6.5, 0, 1);
        c.mesh.scale.setScalar(0.15 + t * 0.85);
      }
    }

    if (this.spa.buffer > 0) {
      this.spa.progress += this.spaRate() * dt * 0.55;
      if (this.spa.progress >= 1) {
        this.spa.progress = 0;
        this.spa.buffer -= 1;
        this.washed += 1;
        this.spawnHitParticles(this.spa.pos.clone().setY(1.2), 0x4ec8ff, 6);
        this.spawnFloat(this.spa.pos.clone().setY(2), "+1 clean pile", "#a8e8ff");
        gameAudio.play("pop");
      }
    }

    if (this.processor.buffer > 0) {
      this.processor.progress += this.processRate() * dt * 0.7;
      if (this.processor.progress >= 1) {
        this.processor.progress = 0;
        this.processor.buffer -= 1;
        this.glitter += 1;
        this.spawnHitParticles(this.processor.pos.clone().setY(1.5), 0xb06bff, 8);
        this.spawnFloat(this.processor.pos.clone().setY(2.2), "+1 glitter", "#d4a0ff");
        gameAudio.play("pop");
      }
    }

    if (this.packer.buffer > 0) {
      this.packer.progress += this.packRate() * dt * 0.55;
      if (this.packer.progress >= 1) {
        this.packer.progress = 0;
        this.packer.buffer -= 1;
        this.boxed += 1;
        this.spawnHitParticles(this.packer.pos.clone().setY(1.4), 0xffc84a, 8);
        this.spawnFloat(this.packer.pos.clone().setY(2), "+1 gift crate", "#ffe08a");
        gameAudio.play("box");
        // New stock draws customers
        this.ensureCustomerQueue();
      }
    }

    // Keep queue filled while we have stock
    if (this.boxed > 0) this.ensureCustomerQueue();

    const auto = this.up("process_auto");
    if (auto > 0) {
      const r = 4 + auto * 1.5;
      if (this.raw > 0 && Math.hypot(this.spa.pos.x - this.playerPos.x, this.spa.pos.z - this.playerPos.z) < r) {
        if (Math.random() < dt * 0.8 * auto) {
          this.raw -= 1;
          this.spa.buffer += 1;
        }
      }
      if (
        this.washed > 0 &&
        Math.hypot(this.processor.pos.x - this.playerPos.x, this.processor.pos.z - this.playerPos.z) < r
      ) {
        if (Math.random() < dt * 0.8 * auto) {
          this.washed -= 1;
          this.processor.buffer += 1;
        }
      }
      if (
        this.glitter > 0 &&
        Math.hypot(this.packer.pos.x - this.playerPos.x, this.packer.pos.z - this.playerPos.z) < r
      ) {
        if (Math.random() < dt * 0.8 * auto) {
          this.glitter -= 1;
          this.packer.buffer += 1;
        }
      }
    }
  }

  /** Stacks of goods you can see at each station */
  private syncStagePiles() {
    const setPile = (key: string, count: number, kind: "raw" | "washed" | "glitter" | "boxed") => {
      const g = this.pileGroups[key];
      if (!g) return;
      const want = Math.min(8, count);
      while (g.children.length > want) {
        const c = g.children[g.children.length - 1];
        g.remove(c);
      }
      while (g.children.length < want) {
        const m = this.productMesh(kind);
        const i = g.children.length;
        m.position.set((i % 3) * 0.4 - 0.4, Math.floor(i / 3) * 0.28, Math.floor(i / 3) * 0.15);
        g.add(m);
      }
    };
    // Input-ish: what you're bringing next / outputs
    setPile("raw", this.raw + this.spa.buffer, "raw");
    setPile("washed", this.washed, "washed");
    setPile("washedOut", this.processor.buffer, "washed");
    setPile("glitter", this.glitter, "glitter");
    setPile("glitterOut", this.packer.buffer, "glitter");
    setPile("boxed", this.boxed, "boxed");
    setPile("boxedSell", this.boxed, "boxed");
  }

  /** What the player is currently hauling */
  private syncCarryVisual() {
    if (!this.carryMesh) return;
    while (this.carryMesh.children.length) this.carryMesh.remove(this.carryMesh.children[0]);
    let kind: "raw" | "washed" | "glitter" | "boxed" | null = null;
    let n = 0;
    if (this.boxed > 0) {
      kind = "boxed";
      n = Math.min(3, this.boxed);
    } else if (this.glitter > 0) {
      kind = "glitter";
      n = Math.min(3, this.glitter);
    } else if (this.washed > 0) {
      kind = "washed";
      n = Math.min(3, this.washed);
    } else if (this.raw > 0) {
      kind = "raw";
      n = Math.min(3, this.raw);
    }
    if (!kind) return;
    for (let i = 0; i < n; i++) {
      const m = this.productMesh(kind);
      m.position.set(0, i * 0.28, 0);
      m.scale.setScalar(0.85);
      this.carryMesh.add(m);
    }
  }

  private ensureCustomerQueue() {
    const want = Math.min(6, Math.max(1, this.boxed + (this.packer.buffer > 0 ? 1 : 0)));
    while (this.customers.filter((c) => c.state === "queue" || c.state === "buy").length < want) {
      this.spawnCustomer();
    }
  }

  private spawnCustomer() {
    if (!this.market) return;
    const slot = this.customers.length;
    const hues = [0xff9acc, 0x7ad4ff, 0xffe08a, 0xc9a0ff, 0x7ad46a, 0xffb080];
    const mesh = this.makeCustomerMesh(hues[slot % hues.length]);
    // Queue along +Z side of market
    const pos = new THREE.Vector3(
      this.market.pos.x + (slot % 3) * 0.7 - 0.7,
      0,
      this.market.pos.z + 3.2 + Math.floor(slot / 3) * 0.9,
    );
    mesh.position.copy(pos);
    // Face market
    mesh.rotation.y = Math.atan2(this.market.pos.x - pos.x, this.market.pos.z - pos.z);
    this.scene.add(mesh);
    this.customers.push({
      mesh,
      pos: pos.clone(),
      slot,
      state: "queue",
      timer: 0,
      bob: Math.random() * Math.PI * 2,
    });
  }

  private serveCustomers(n: number) {
    let left = n;
    for (const c of this.customers) {
      if (left <= 0) break;
      if (c.state !== "queue" && c.state !== "buy") continue;
      c.state = "leave";
      c.timer = 0;
      this.spawnFloat(c.pos.clone().setY(1.6), "Thanks!", "#ffe08a");
      gameAudio.play("thanks");
      left--;
    }
  }

  private updateCustomers(dt: number) {
    // Attract when stock exists
    if (this.boxed > 0 && Math.random() < dt * 0.35) this.ensureCustomerQueue();

    for (const c of this.customers) {
      c.bob += dt * 3;
      if (c.state === "queue" || c.state === "buy") {
        const amp = this.boxed > 0 ? 0.1 : 0.04;
        c.mesh.position.y = Math.abs(Math.sin(c.bob * (this.boxed > 0 ? 1.4 : 1))) * amp;
        // Impatient hop if waiting long
        c.timer += dt;
        if (c.timer > 12 && this.boxed === 0) {
          // leave empty-handed occasionally
          if (Math.random() < dt * 0.15) {
            c.state = "leave";
            c.timer = 0;
            this.spawnFloat(c.pos.clone().setY(1.4), "…later", "#aaa");
          }
        }
      } else if (c.state === "leave") {
        c.timer += dt;
        c.pos.z += 3.5 * dt;
        c.pos.x += Math.sin(c.bob) * 0.8 * dt;
        c.mesh.position.set(c.pos.x, 0, c.pos.z);
        c.mesh.rotation.y = 0;
        if (c.timer > 2.5) {
          this.scene.remove(c.mesh);
          c.state = "leave";
          c.timer = 99;
        }
      }
    }
    this.customers = this.customers.filter((c) => !(c.state === "leave" && c.timer >= 99));
  }

  private updateWorkers(dt: number) {
    if (this.screen !== "playing") return;
    const botLv = this.up("hire_bot");
    if (botLv > 0) {
      for (const w of this.workers) {
        if (w.role !== "bot") continue;
        w.timer += dt * (0.55 + botLv * 0.35);
        w.mesh.position.y = Math.sin(this.clock.elapsedTime * 4) * 0.08;
        if (w.timer < 1) continue;
        w.timer = 0;
        const range = 4 + botLv * 2;
        let best: Crop | null = null;
        let bestD = range;
        for (const c of this.crops) {
          if (c.harvested || c.ready < 1) continue;
          const d = Math.hypot(c.pos.x - w.pos.x, c.pos.z - w.pos.z);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best) {
          best.harvested = true;
          best.ready = 0;
          best.growTimer = 5;
          best.mesh.scale.setScalar(0.15);
          const y = this.cropYield();
          this.raw += y;
          this.spawnFloat(best.pos.clone().setY(1), `Bot +${y}`, "#6bc8ff");
        }
      }
    }

    for (const w of this.workers) {
      if (w.role === "bot") continue;
      w.timer += dt;

      if (w.role === "farmer") {
        if (!w.targetCrop || w.targetCrop.harvested || w.targetCrop.ready < 1) {
          w.targetCrop = null;
          let best: Crop | null = null;
          let bestD = 999;
          for (const c of this.crops) {
            if (c.harvested || c.ready < 1) continue;
            if (this.workers.some((o) => o !== w && o.targetCrop === c)) continue;
            const d = Math.hypot(c.pos.x - w.pos.x, c.pos.z - w.pos.z);
            if (d < bestD) {
              bestD = d;
              best = c;
            }
          }
          w.targetCrop = best;
          w.workTimer = 0;
        }
        if (w.targetCrop) {
          const dx = w.targetCrop.pos.x - w.pos.x;
          const dz = w.targetCrop.pos.z - w.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.55) {
            w.pos.x += (dx / dist) * 3.8 * dt;
            w.pos.z += (dz / dist) * 3.8 * dt;
            w.mesh.rotation.y = Math.atan2(dx, dz);
          } else {
            w.workTimer += dt;
            if (w.workTimer >= 0.8 && w.targetCrop && !w.targetCrop.harvested) {
              const c = w.targetCrop;
              c.harvested = true;
              c.ready = 0;
              c.growTimer = 5;
              c.mesh.scale.setScalar(0.15);
              const y = this.cropYield();
              this.raw += y;
              this.spawnFloat(c.pos.clone().setY(1), `Farmer +${y}`, "#7ad46a");
              w.targetCrop = null;
              w.workTimer = 0;
            }
          }
        }
      } else if (w.role === "grinder") {
        if (this.raw > 0) {
          const home = this.spa.pos;
          const dx = home.x + 1.5 - w.pos.x;
          const dz = home.z + 1.1 - w.pos.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist > 0.45) {
            w.pos.x += (dx / dist) * 2.8 * dt;
            w.pos.z += (dz / dist) * 2.8 * dt;
          } else {
            w.workTimer += dt * (0.9 + this.up("hire_grinder") * 0.5);
            if (w.workTimer >= 1 && this.raw > 0) {
              w.workTimer = 0;
              this.raw -= 1;
              this.spa.buffer += 1;
              this.spawnFloat(home.clone().setY(1.6), "Spa!", "#4ec8ff");
            }
          }
        } else if (this.washed > 0) {
          const home = this.processor.pos;
          const dx = home.x + 1.5 - w.pos.x;
          const dz = home.z + 1.1 - w.pos.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist > 0.45) {
            w.pos.x += (dx / dist) * 2.8 * dt;
            w.pos.z += (dz / dist) * 2.8 * dt;
          } else {
            w.workTimer += dt * (0.9 + this.up("hire_grinder") * 0.5);
            if (w.workTimer >= 1 && this.washed > 0) {
              w.workTimer = 0;
              this.washed -= 1;
              this.processor.buffer += 1;
              this.spawnFloat(home.clone().setY(1.6), "Fed!", "#c9a0ff");
            }
          }
        }
      } else if (w.role === "vendor") {
        if (this.glitter > 0) {
          const home = this.packer.pos;
          const dx = home.x - 1.4 - w.pos.x;
          const dz = home.z + 1.1 - w.pos.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist > 0.45) {
            w.pos.x += (dx / dist) * 2.8 * dt;
            w.pos.z += (dz / dist) * 2.8 * dt;
          } else {
            w.workTimer += dt * (0.8 + this.up("hire_vendor") * 0.45);
            if (w.workTimer >= 1 && this.glitter > 0) {
              w.workTimer = 0;
              this.glitter -= 1;
              this.packer.buffer += 1;
              this.spawnFloat(home.clone().setY(1.6), "Boxed!", "#ffc84a");
            }
          }
        } else if (this.boxed > 0) {
          const home = this.market.pos;
          const dx = home.x - 1.4 - w.pos.x;
          const dz = home.z + 1.2 - w.pos.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist > 0.45) {
            w.pos.x += (dx / dist) * 2.8 * dt;
            w.pos.z += (dz / dist) * 2.8 * dt;
          } else {
            w.workTimer += dt * (0.75 + this.up("hire_vendor") * 0.45);
            if (w.workTimer >= 1 && this.boxed > 0) {
              w.workTimer = 0;
              this.boxed -= 1;
              this.sold += 1;
              this.save.totalSold += 1;
              const pay = this.sellPrice();
              this.save.coins += pay;
              this.serveCustomers(1);
              this.spawnFloat(home.clone().setY(2), `Vendor +${pay}c`, "#ffe08a");
              writeSave(this.save);
            }
          }
        }
      }

      w.mesh.position.x = w.pos.x;
      w.mesh.position.z = w.pos.z;
      w.mesh.position.y = Math.abs(Math.sin(this.clock.elapsedTime * 8 + w.timer)) * 0.06;
    }
  }

  private checkLevelEnd() {
    if (this.sold >= this.level.quota) {
      this.screen = "levelComplete";
      document.exitPointerLock?.();
      const bonus = Math.floor(this.timeLeft * 0.4) + this.killCount * 2;
      this.save.coins += bonus;
      if (this.level.id >= this.save.highestLevel) {
        this.save.highestLevel = Math.min(LEVELS.length, this.level.id + 1);
      }
      writeSave(this.save);
      gameAudio.play("levelup");
      this.addTrauma(0.5);
      for (let i = 0; i < 24; i++) {
        this.spawnHitParticles(this.playerPos.clone().setY(1.2), RAINBOW[i % RAINBOW.length], 2);
      }
      this.flashMessage(`Quota cleared! Bonus +${bonus}c`);
      this.emitHud(true);
      return;
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      gameAudio.play("fail");
      this.screen = "gameOver";
      document.exitPointerLock?.();
      writeSave(this.save);
      this.emitHud(true);
    }
  }

  private spawnFloat(pos: THREE.Vector3, text: string, color: string) {
    this.floats.push({
      id: this.nextFloatId++,
      text,
      color,
      pos: pos.clone(),
      life: 1.15,
      maxLife: 1.15,
      vy: 1.9,
    });
    if (this.floats.length > 28) this.floats.shift();
  }

  private updateFloats(dt: number) {
    for (const f of this.floats) {
      f.life -= dt;
      f.pos.y += f.vy * dt;
      f.vy *= 0.98;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }


  private addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private addHitstop(sec: number) {
    this.hitstop = Math.max(this.hitstop, sec);
  }

  private pulseSquash(amount: number) {
    this.squash = Math.max(0.55, Math.min(1.35, amount));
  }

  private spawnHitParticles(pos: THREE.Vector3, color: number, n = 6) {
    for (let i = 0; i < n; i++) {
      let p = this.particles.find((x) => !x.active);
      if (!p) {
        const mesh = new THREE.Mesh(this.geo.box, new THREE.MeshBasicMaterial({ color }));
        mesh.scale.setScalar(0.12);
        this.scene.add(mesh);
        p = { mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.5, active: false };
        this.particles.push(p);
      }
      p.active = true;
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.vel.set((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(0.08 + clamp(p.life / p.maxLife, 0, 1) * 0.1);
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private updateVisuals(delta: number) {
    const t = this.clock.elapsedTime;
    for (const cloud of this.clouds) {
      cloud.position.x = cloud.userData.baseX + Math.sin(t * cloud.userData.drift) * 3;
    }
    const step = this.screen === "playing" ? this.nextStep() : 0;
    for (const ring of this.decorRings) {
      const isHot = ring.userData.step === step;
      const pulse = 1 + Math.sin(t * (isHot ? 4.5 : 2.2) + (ring.userData.pulse || 0)) * (isHot ? 0.18 : 0.06);
      ring.scale.set(pulse, pulse, pulse);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = isHot ? 0.9 : 0.4;
    }
    for (const part of this.spinParts) part.rotation.y += delta * 2.5;
    for (const fl of this.fairyLights) {
      fl.intensity = 0.4 + Math.sin(t * 3 + fl.position.x) * 0.25;
    }
    for (const flower of this.flowers) {
      flower.position.y = 0.12 + Math.sin(t * 2 + flower.position.x) * 0.03;
    }
    for (const ff of this.fireflies) {
      ff.mesh.position.x = ff.base.x + Math.sin(t * 1.2 + ff.phase) * 0.6;
      ff.mesh.position.z = ff.base.z + Math.cos(t * 0.9 + ff.phase) * 0.6;
      ff.mesh.position.y = ff.base.y + Math.sin(t * 2.2 + ff.phase) * 0.35;
      const mat = ff.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(t * 5 + ff.phase) * 0.4;
      mat.transparent = true;
    }
    for (const c of this.crops) {
      if (c.harvested) continue;
      c.mesh.rotation.y = Math.sin(t * 1.5 + c.id) * 0.15;
      const orb = c.mesh.getObjectByName("orb");
      if (orb) {
        orb.position.x = Math.cos(t * 3 + c.id) * 0.35;
        orb.position.z = Math.sin(t * 3 + c.id) * 0.35;
        orb.position.y = 0.65 + Math.sin(t * 5 + c.id) * 0.1;
      }
    }

    if (this.screen === "title") {
      this.camera.position.set(Math.sin(t * 0.2) * 10, 11, 14);
      this.camera.lookAt(0, 0.5, -4);
      if (this.playerMesh) this.playerMesh.rotation.y = t * 0.4;
      return;
    }
    // Soft sky day-cycle (presentation only)
    if (this.scene.background && (this.scene.background as THREE.Color).isColor) {
      const day = 0.5 + 0.5 * Math.sin(t * 0.05);
      const col = (this.scene.background as THREE.Color);
      col.setRGB(0.45 + day * 0.15, 0.62 + day * 0.12, 0.82 + day * 0.08);
      if (this.scene.fog && (this.scene.fog as THREE.Fog).isFog) {
        (this.scene.fog as THREE.Fog).color.copy(col);
      }
    }

    this.computeMoveBasis();
    const dist = 14;
    const height = 10.5 + this.pitch * 2.5;
    // Lookahead in move direction
    const look = 1.2;
    this.camLookAhead.set(this.playerVel.x, 0, this.playerVel.z);
    if (this.camLookAhead.lengthSq() > 0.01) this.camLookAhead.normalize().multiplyScalar(look);
    this.camTarget.set(
      this.playerPos.x + this.camLookAhead.x,
      this.playerPos.y + 0.4,
      this.playerPos.z + this.camLookAhead.z,
    );
    this.camPos.set(
      this.playerPos.x - this.forward.x * dist + this.camLookAhead.x * 0.3,
      this.playerPos.y + height,
      this.playerPos.z - this.forward.z * dist + this.camLookAhead.z * 0.3,
    );
    // trauma² screenshake
    const shake = this.trauma * this.trauma;
    if (shake > 0.001) {
      const t = this.clock.elapsedTime * 40;
      this.camPos.x += Math.sin(t * 1.7) * shake * 0.35;
      this.camPos.y += Math.cos(t * 2.1) * shake * 0.22;
      this.camPos.z += Math.sin(t * 1.3) * shake * 0.35;
    }
    const lerp = 1 - Math.exp(-8 * delta);
    this.camera.position.lerp(this.camPos, lerp);
    this.camera.lookAt(this.camTarget);
  }


  private decorateRanch(rng: () => number) {
    const w = this.level.width;
    const d = this.level.depth;
    // Flower clusters
    for (let i = 0; i < 40; i++) {
      const x = (rng() - 0.5) * w * 0.85;
      const z = (rng() - 0.5) * d * 0.85;
      if (Math.hypot(x, z - this.level.spawn.z) < 2) continue;
      const colors = [0xff6bb5, 0xffe14a, 0xb06bff, 0x4ab8ff, 0xff8a40, 0xffffff];
      const petal = new THREE.Mesh(
        this.geo.sphere,
        new THREE.MeshStandardMaterial({
          color: colors[i % colors.length],
          emissive: colors[i % colors.length],
          emissiveIntensity: 0.25,
          roughness: 0.5,
        }),
      );
      petal.scale.setScalar(0.12 + rng() * 0.08);
      petal.position.set(x, 0.12, z);
      this.scene.add(petal);
      this.flowers.push(petal);
    }
    // Candy trees
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        this.geo.cyl,
        new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.9 }),
      );
      trunk.scale.set(0.25, 1.4, 0.25);
      trunk.position.y = 0.7;
      trunk.castShadow = true;
      g.add(trunk);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: i % 2 ? 0xff8ec8 : 0x7ad46a,
        roughness: 0.65,
        emissive: i % 2 ? 0xff5aa8 : 0x3a8a40,
        emissiveIntensity: 0.12,
      });
      for (let j = 0; j < 3; j++) {
        const canopy = new THREE.Mesh(this.geo.sphere, canopyMat);
        canopy.scale.set(0.7 + j * 0.15, 0.55, 0.7 + j * 0.1);
        canopy.position.set((j - 1) * 0.25, 1.6 + j * 0.25, (j % 2) * 0.15);
        canopy.castShadow = true;
        g.add(canopy);
      }
      // edge placement
      const edge = i % 4;
      let x = 0;
      let z = 0;
      if (edge === 0) {
        x = -w / 2 + 2 + rng() * 3;
        z = (rng() - 0.5) * d * 0.8;
      } else if (edge === 1) {
        x = w / 2 - 2 - rng() * 3;
        z = (rng() - 0.5) * d * 0.8;
      } else if (edge === 2) {
        x = (rng() - 0.5) * w * 0.8;
        z = -d / 2 + 2 + rng() * 3;
      } else {
        x = (rng() - 0.5) * w * 0.8;
        z = d / 2 - 2 - rng() * 3;
      }
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.trees.push(g);
    }
    // Fairy lights along path
    const pathPts = [this.spa.pos, this.processor.pos, this.packer.pos, this.market.pos];
    for (let i = 0; i < pathPts.length - 1; i++) {
      const a = pathPts[i];
      const b = pathPts[i + 1];
      for (let s = 0; s < 3; s++) {
        const t = (s + 1) / 4;
        const light = new THREE.PointLight(RAINBOW[(i + s) % RAINBOW.length], 0.55, 8);
        light.position.set(a.x + (b.x - a.x) * t, 2.2, a.z + (b.z - a.z) * t);
        this.scene.add(light);
        this.fairyLights.push(light);
        const bulb = new THREE.Mesh(
          this.geo.sphere,
          new THREE.MeshStandardMaterial({
            color: RAINBOW[(i + s) % RAINBOW.length],
            emissive: RAINBOW[(i + s) % RAINBOW.length],
            emissiveIntensity: 0.9,
          }),
        );
        bulb.scale.setScalar(0.12);
        bulb.position.copy(light.position);
        this.scene.add(bulb);
      }
    }

    // Ambient fireflies
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(
        this.geo.sphere,
        new THREE.MeshBasicMaterial({ color: 0xffe8a0 }),
      );
      mesh.scale.setScalar(0.06);
      const base = new THREE.Vector3((rng() - 0.5) * w * 0.7, 0.8 + rng() * 1.5, (rng() - 0.5) * d * 0.7);
      mesh.position.copy(base);
      this.scene.add(mesh);
      this.fireflies.push({ mesh, base, phase: rng() * Math.PI * 2 });
    }
    // Checkered picnic rugs
    for (let i = 0; i < 3; i++) {
      const rug = new THREE.Mesh(
        this.geo.box,
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffc0e0 : 0xfff0a0, roughness: 0.95 }),
      );
      rug.scale.set(2.5, 0.04, 2.5);
      rug.position.set((rng() - 0.5) * w * 0.5, 0.02, (rng() - 0.5) * d * 0.4);
      this.scene.add(rug);
    }
  }

  private spawnStars(rng: () => number) {
    const n = 12 + Math.floor(this.level.id * 2);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffe14a,
        emissive: 0xffaa00,
        emissiveIntensity: 0.75,
        metalness: 0.4,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(this.geo.cone, mat);
      mesh.scale.set(0.25, 0.35, 0.25);
      const x = (rng() - 0.5) * this.level.width * 0.7;
      const z = (rng() - 0.5) * this.level.depth * 0.7;
      mesh.position.set(x, 0.7, z);
      this.scene.add(mesh);
      this.stars.push({
        mesh,
        pos: new THREE.Vector3(x, 0.7, z),
        taken: false,
        spin: rng() * Math.PI,
      });
    }
  }

  private spawnExtraStations() {
    // Healing fountain near spawn
    const f = new THREE.Group();
    const base = new THREE.Mesh(
      this.geo.cyl,
      new THREE.MeshStandardMaterial({ color: 0xb0d4ff, metalness: 0.3, roughness: 0.4 }),
    );
    base.scale.set(1.2, 0.4, 1.2);
    base.position.y = 0.2;
    f.add(base);
    const water = new THREE.Mesh(
      this.geo.cyl,
      new THREE.MeshStandardMaterial({
        color: 0x6ed4ff,
        transparent: true,
        opacity: 0.7,
        emissive: 0x4ab8ff,
        emissiveIntensity: 0.35,
      }),
    );
    water.scale.set(0.9, 0.5, 0.9);
    water.position.y = 0.6;
    water.name = "spin";
    f.add(water);
    this.spinParts.push(water);
    const spout = new THREE.Mesh(this.geo.sphere, this.mats.leaf);
    spout.scale.setScalar(0.2);
    spout.position.y = 1.1;
    f.add(spout);
    const fpos = new THREE.Vector3(this.level.spawn.x - 4, 0, this.level.spawn.z - 1);
    f.position.copy(fpos);
    this.scene.add(f);
    this.decorInteract.push({ kind: "fountain", pos: fpos, mesh: f, cd: 0 });
    this.addRingMarker(fpos, 0x6ed4ff);

    // Compost for bonus coins from raw overflow
    const c = new THREE.Group();
    const bin = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({ color: 0x6b8f4a, roughness: 0.8 }),
    );
    bin.scale.set(1.4, 1.1, 1.2);
    bin.position.y = 0.55;
    bin.castShadow = true;
    c.add(bin);
    const lid = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({ color: 0x4a6a30, roughness: 0.7 }),
    );
    lid.scale.set(1.5, 0.12, 1.3);
    lid.position.y = 1.15;
    c.add(lid);
    const cpos = new THREE.Vector3(this.spa.pos.x - 3.5, 0, this.spa.pos.z + 2.5);
    c.position.copy(cpos);
    this.scene.add(c);
    this.decorInteract.push({ kind: "compost", pos: cpos, mesh: c, cd: 0 });
    this.addRingMarker(cpos, 0x7ad46a);

    // Jukebox near market — coin for music dance + tip
    const j = new THREE.Group();
    const box = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({ color: 0xff4d94, metalness: 0.35, roughness: 0.4 }),
    );
    box.scale.set(0.9, 1.4, 0.6);
    box.position.y = 0.7;
    box.castShadow = true;
    j.add(box);
    const neon = new THREE.Mesh(
      this.geo.box,
      new THREE.MeshStandardMaterial({
        color: 0x4ab8ff,
        emissive: 0x4ab8ff,
        emissiveIntensity: 0.8,
      }),
    );
    neon.scale.set(0.6, 0.35, 0.08);
    neon.position.set(0, 1.0, 0.32);
    neon.name = "spin";
    j.add(neon);
    this.spinParts.push(neon);
    const jpos = new THREE.Vector3(this.market.pos.x + 3.2, 0, this.market.pos.z + 1.5);
    j.position.copy(jpos);
    this.scene.add(j);
    this.decorInteract.push({ kind: "jukebox", pos: jpos, mesh: j, cd: 0 });
    this.addRingMarker(jpos, 0xff4d94);
  }

  private updatePickups(dt: number) {
    const t = this.clock.elapsedTime;
    for (const s of this.stars) {
      if (s.taken) continue;
      s.spin += dt * 3;
      s.mesh.rotation.y = s.spin;
      s.mesh.position.y = 0.7 + Math.sin(t * 3 + s.spin) * 0.15;
      // soft magnet
      const sd = Math.hypot(s.pos.x - this.playerPos.x, s.pos.z - this.playerPos.z);
      if (sd < 3.2 && sd > 0.01) {
        s.pos.x += ((this.playerPos.x - s.pos.x) / sd) * dt * 4.5;
        s.pos.z += ((this.playerPos.z - s.pos.z) / sd) * dt * 4.5;
        s.mesh.position.x = s.pos.x;
        s.mesh.position.z = s.pos.z;
      }
      if (sd < 1.35) {
        s.taken = true;
        s.mesh.visible = false;
        const starPay = 3 + Math.floor(this.level.id / 2);
        this.save.coins += starPay;
        this.addTrauma(0.05);
        this.spawnFloat(s.pos.clone().setY(1.2), `+${starPay}c`, "#ffe14a");
        gameAudio.play("coin");
        writeSave(this.save);
      }
    }
    for (const d of this.decorInteract) {
      if (d.cd > 0) d.cd -= dt;
    }
  }

  private tryDecorInteract(): boolean {
    for (const d of this.decorInteract) {
      if (Math.hypot(d.pos.x - this.playerPos.x, d.pos.z - this.playerPos.z) > 2.4) continue;
      if (d.kind === "fountain") {
        this.interactHint = "Heal";
        return true;
      }
      if (d.kind === "compost") {
        this.interactHint = this.raw > 0 ? "Compost" : "Compost";
        return true;
      }
      if (d.kind === "jukebox") {
        this.interactHint = "Dance";
        return true;
      }
    }
    return false;
  }

  private doDecorInteract() {
    for (const d of this.decorInteract) {
      if (Math.hypot(d.pos.x - this.playerPos.x, d.pos.z - this.playerPos.z) > 2.4) continue;
      if (d.cd > 0) continue;
      if (d.kind === "fountain") {
        d.cd = 4;
        const before = this.health;
        this.health = Math.min(this.maxHealth, this.health + 30);
        const gained = Math.floor(this.health - before);
        this.addTrauma(0.1);
        this.spawnHitParticles(d.pos.clone().setY(1), 0x6ed4ff, 14);
        this.spawnFloat(d.pos.clone().setY(1.8), gained > 0 ? `+${gained} HP` : "Full!", "#6ed4ff");
        gameAudio.play("spa");
        return;
      }
      if (d.kind === "compost" && this.raw > 0) {
        d.cd = 0.8;
        const n = Math.min(2, this.raw);
        this.raw -= n;
        const pay = n * 3;
        this.save.coins += pay;
        this.spawnFloat(d.pos.clone().setY(1.5), `Compost +${pay}c`, "#7ad46a");
        gameAudio.play("pop");
        writeSave(this.save);
        return;
      }
      if (d.kind === "jukebox") {
        d.cd = 5;
        this.save.coins += 6;
        // Happy customers tip
        for (const c of this.customers.slice(0, 2)) {
          if (c.state === "queue") this.spawnFloat(c.pos.clone().setY(1.5), "♪", "#ff9acc");
        }
        this.spawnHitParticles(d.pos.clone().setY(1.2), 0xff4d94, 12);
        this.spawnFloat(d.pos.clone().setY(2), "+6c tips", "#ff9acc");
        this.addTrauma(0.15);
        gameAudio.play("thanks");
        writeSave(this.save);
        return;
      }
    }
  }

  private flashMessage(msg: string) {
    this.message = msg;
    this.messageT = 2.6;
    this.hudDirty = true;
  }

  private projectFloats(): FloatText[] {
    const out: FloatText[] = [];
    const v = this.tmpV;
    for (const f of this.floats) {
      v.copy(f.pos).project(this.camera);
      if (v.z > 1) continue;
      out.push({
        id: f.id,
        text: f.text,
        x: (v.x * 0.5 + 0.5) * 100,
        y: (-v.y * 0.5 + 0.5) * 100,
        color: f.color,
        life: f.life / f.maxLife,
      });
    }
    return out;
  }

  private actionLabelFromHint(): string {
    const h = this.interactHint || "";
    if (h === "Scoop") return "SCOOP";
    if (h === "Wash") return "WASH";
    if (h === "Grind") return "GRIND";
    if (h === "Box") return "BOX";
    if (h === "Sell") return "SELL";
    if (h === "Heal") return "HEAL";
    if (h === "Compost") return "DUMP";
    if (h === "Dance") return "DANCE";
    if (h.startsWith("→")) return "GO";
    return "USE";
  }

  private anchorWorldPos(anchor: string): THREE.Vector3 {
    switch (anchor) {
      case "field":
        return new THREE.Vector3(0, 2.4, this.level.spawn.z * 0.55);
      case "spa":
        return this.spa.pos.clone().setY(2.8);
      case "grind":
        return this.processor.pos.clone().setY(2.8);
      case "pack":
        return this.packer.pos.clone().setY(2.8);
      case "market":
        return this.market.pos.clone().setY(2.8);
      case "player":
      default:
        return this.playerPos.clone().setY(2.6);
    }
  }

  private projectWorldOffers(): WorldOffer[] {
    if (this.screen !== "playing" || !this.market) return [];
    const offers: WorldOffer[] = [];
    const worldItems = UPGRADES.filter((u) => u.worldShop);
    const v = this.tmpV;

    // Find nearest station anchor (not player) so only that area's buttons show
    const stations: { id: string; pos: THREE.Vector3; dist: number }[] = [
      { id: "field", pos: new THREE.Vector3(0, 0, this.level.spawn.z * 0.55), dist: 0 },
      { id: "spa", pos: this.spa.pos.clone(), dist: 0 },
      { id: "grind", pos: this.processor.pos.clone(), dist: 0 },
      { id: "pack", pos: this.packer.pos.clone(), dist: 0 },
      { id: "market", pos: this.market.pos.clone(), dist: 0 },
    ];
    for (const s of stations) {
      s.dist = Math.hypot(this.playerPos.x - s.pos.x, this.playerPos.z - s.pos.z);
    }
    stations.sort((a, b) => a.dist - b.dist);
    const nearest = stations[0];
    const atStation = nearest.dist < 5.5;
    const activeAnchor = atStation ? nearest.id : null;

    // Group defs
    const byAnchor = new Map<string, typeof worldItems>();
    for (const def of worldItems) {
      const a = def.worldAnchor || "market";
      if (!byAnchor.has(a)) byAnchor.set(a, []);
      byAnchor.get(a)!.push(def);
    }

    const place = (anchor: string, defs: typeof worldItems, maxShow = 6) => {
      const base = this.anchorWorldPos(anchor);
      let slot = 0;
      for (const def of defs) {
        if (slot >= maxShow) break;
        const level = this.save.upgrades[def.id] ?? 0;
        if (level >= def.maxLevel) continue;
        const cost = upgradeCost(def, level);
        const col = slot % 2;
        const row = Math.floor(slot / 2);
        let px: number, py: number, pz: number;
        if (anchor === "player") {
          px = this.playerPos.x + (col === 0 ? -0.95 : 0.95);
          py = this.playerPos.y + 2.35 + row * 0.55;
          pz = this.playerPos.z;
        } else {
          px = base.x + (col === 0 ? -0.9 : 0.9);
          py = base.y + row * 0.7;
          pz = base.z + 0.5;
        }
        v.set(px, py, pz).project(this.camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
        if (!onScreen) {
          slot++;
          continue;
        }
        offers.push({
          id: def.id,
          label: def.shortName || def.name,
          cost,
          level,
          maxLevel: def.maxLevel,
          canAfford: this.save.coins >= cost,
          x: (v.x * 0.5 + 0.5) * 100,
          y: (-v.y * 0.5 + 0.5) * 100,
          visible: true,
        });
        slot++;
      }
    };

    if (activeAnchor && byAnchor.has(activeAnchor)) {
      place(activeAnchor, byAnchor.get(activeAnchor)!, 6);
    } else {
      // Open field: show player combat/mobility upgrades only (max 4)
      const playerDefs = byAnchor.get("player") || [];
      place("player", playerDefs, 4);
    }

    return offers;
  }

  private emitHud(force = false) {
    if (force) this.hudDirty = false;
    const gun = this.gunStats();
    const snap: HudSnapshot = {
      screen: this.screen,
      level: this.level?.id ?? this.save.highestLevel ?? 1,
      levelName: this.level?.name ?? "Booloobee",
      health: this.health,
      maxHealth: this.maxHealth,
      coins: this.save.coins,
      raw: this.raw,
      washed: this.washed,
      glitter: this.glitter,
      boxed: this.boxed,
      sold: this.sold,
      quota: this.level?.quota ?? 0,
      timeLeft: Math.max(0, this.timeLeft || 0),
      gunName: gun.name,
      gunTier: this.save.gunTier,
      interactHint: this.screen === "playing" ? this.interactHint : null,
      message: this.message,
      chain: {
        harvestRate: this.harvestRate(),
        processRate: this.processRate(),
        sellRate: this.sellRate(),
        cropYield: this.cropYield(),
      },
      upgrades: { ...this.save.upgrades },
      killCount: this.killCount,
      isMobile: this.isMobile,
      crew: {
        farmers: this.up("hire_farmer"),
        grinders: this.up("hire_grinder"),
        vendors: this.up("hire_vendor"),
      },
      floats: this.projectFloats(),
      nextStep: this.screen === "playing" ? this.nextStep() : 1,
      character: this.save.character ?? "rancher",
      worldOffers: this.projectWorldOffers(),
      actionLabel: this.actionLabelFromHint(),
    };
    this.cbs.onHud(snap);
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPitch?: () => number;
      setKeys?: (codes: string[]) => void;
    };
    __game?: GameEngine;
  }
}
