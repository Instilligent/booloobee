export type Screen =
  | "title"
  | "playing"
  | "paused"
  | "upgrade"
  | "levelComplete"
  | "gameOver"
  | "victory";

export type EnemyKind = "pest" | "beetle" | "thief" | "brute" | "dino" | "raptor";

export type CharacterId = "rancher" | "cowgirl" | "robot" | "wizard" | "dino_rider";

export type GunTier = 0 | 1 | 2 | 3 | 4;

export type UpgradeCategory = "gun" | "chain" | "crew" | "player";

export interface GunStats {
  name: string;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  spread: number;
  projectiles: number;
  color: number;
}

export interface UpgradeDef {
  id: string;
  category: UpgradeCategory;
  name: string;
  description: string;
  baseCost: number;
  costScale: number;
  maxLevel: number;
  /** Short label for floating world button */
  shortName?: string;
  /** Show as floating buy button near market */
  worldShop?: boolean;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  body: number;
  pants: number;
  hat: number;
}

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  width: number;
  depth: number;
  seed: number;
  cropCount: number;
  enemyWaves: { delay: number; kind: EnemyKind; count: number }[];
  quota: number;
  timeLimit: number;
  platforms: { x: number; y: number; z: number; w: number; d: number; h?: number }[];
  spawn: { x: number; z: number };
  spa: { x: number; z: number };
  processor: { x: number; z: number };
  packer: { x: number; z: number };
  market: { x: number; z: number };
  goalHint: string;
}

export interface SaveData {
  version: 2;
  coins: number;
  gunTier: GunTier;
  upgrades: Record<string, number>;
  highestLevel: number;
  totalSold: number;
  character: CharacterId;
}

export interface FloatText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

/** Floating in-world hire/buy button (screen %) */
export interface WorldOffer {
  id: string;
  label: string;
  cost: number;
  level: number;
  maxLevel: number;
  canAfford: boolean;
  x: number;
  y: number;
  visible: boolean;
}

export interface HudSnapshot {
  screen: Screen;
  level: number;
  levelName: string;
  health: number;
  maxHealth: number;
  coins: number;
  raw: number;
  washed: number;
  glitter: number;
  boxed: number;
  sold: number;
  quota: number;
  timeLeft: number;
  gunName: string;
  gunTier: GunTier;
  interactHint: string | null;
  message: string | null;
  chain: {
    harvestRate: number;
    processRate: number;
    sellRate: number;
    cropYield: number;
  };
  upgrades: Record<string, number>;
  killCount: number;
  isMobile: boolean;
  crew: {
    farmers: number;
    grinders: number;
    vendors: number;
  };
  floats: FloatText[];
  nextStep: number;
  character: CharacterId;
  worldOffers: WorldOffer[];
  actionLabel: string;
}
