export type Screen = "title" | "playing" | "paused" | "upgrade" | "levelComplete" | "gameOver" | "victory";

export type EnemyKind = "pest" | "beetle" | "thief" | "brute";

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
  /** ② Poop Spa */
  spa: { x: number; z: number };
  /** ③ Glitter Grinder */
  processor: { x: number; z: number };
  /** ④ Fancy Boxer */
  packer: { x: number; z: number };
  /** ⑤ Pink Market */
  market: { x: number; z: number };
  goalHint: string;
}

export interface SaveData {
  version: 1;
  coins: number;
  gunTier: GunTier;
  upgrades: Record<string, number>;
  highestLevel: number;
  totalSold: number;
}

export interface FloatText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

export interface HudSnapshot {
  screen: Screen;
  level: number;
  levelName: string;
  health: number;
  maxHealth: number;
  coins: number;
  /** ① scooped stinky piles */
  raw: number;
  /** ② washed at spa */
  washed: number;
  /** ③ glitter powder from grinder */
  glitter: number;
  /** ④ boxed with bows */
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
  /** Next suggested step 1-5 */
  nextStep: number;
}
