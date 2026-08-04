import type {
  CharacterDef,
  CharacterId,
  EnemyKind,
  GunStats,
  GunTier,
  LevelDef,
  UpgradeDef,
  WorldAnchor,
} from "./types";

export const RAINBOW = [0xff5a7a, 0xffa04a, 0xffe14a, 0x5ee07a, 0x4ab8ff, 0xb06bff, 0xff9aff];

export const CHARACTERS: CharacterDef[] = [
  { id: "rancher", name: "Rancher", emoji: "🤠", body: 0xffe8f4, pants: 0x4a3a6e, hat: 0xff5aa8 },
  { id: "cowgirl", name: "Cowgirl", emoji: "⭐", body: 0xffd0e8, pants: 0x5a3a28, hat: 0xffc84a },
  { id: "robot", name: "Bot-Bee", emoji: "🤖", body: 0x8ec8ff, pants: 0x3a5080, hat: 0xffe14a },
  { id: "wizard", name: "Mage", emoji: "🔮", body: 0xc9a0ff, pants: 0x3a2060, hat: 0xb06bff },
  { id: "dino_rider", name: "Dino", emoji: "🦖", body: 0x7ad46a, pants: 0x2a5030, hat: 0xff8a40 },
];

export function characterDef(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const GUN_TIERS: Record<GunTier, GunStats> = {
  0: {
    name: "Sparkle Sprinkler",
    damage: 34,
    fireRate: 4.2,
    bulletSpeed: 38,
    spread: 0.02,
    projectiles: 1,
    color: 0xff5a7a,
  },
  1: {
    name: "Prism Pumper",
    damage: 20,
    fireRate: 4.4,
    bulletSpeed: 38,
    spread: 0.12,
    projectiles: 3,
    color: 0xffe14a,
  },
  2: {
    name: "Rainbow Hose",
    damage: 40,
    fireRate: 5.0,
    bulletSpeed: 42,
    spread: 0.03,
    projectiles: 1,
    color: 0x4ab8ff,
  },
  3: {
    name: "Double Rainbow",
    damage: 30,
    fireRate: 5.4,
    bulletSpeed: 40,
    spread: 0.08,
    projectiles: 2,
    color: 0xb06bff,
  },
  4: {
    name: "Unicorn Laser",
    damage: 60,
    fireRate: 6.8,
    bulletSpeed: 56,
    spread: 0.01,
    projectiles: 1,
    color: 0xff9aff,
  },
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: "hire_farmer",
    category: "crew",
    name: "Farmer",
    shortName: "Farmer",
    description: "Scoops for you.",
    baseCost: 30,
    costScale: 1.55,
    maxLevel: 3,
    worldShop: true,
    worldAnchor: "field",
  },
  {
    id: "hire_bot",
    category: "crew",
    name: "Robot",
    shortName: "Robot",
    description: "Auto-scoops.",
    baseCost: 90,
    costScale: 1.8,
    maxLevel: 3,
    worldShop: true,
    worldAnchor: "field",
  },
  {
    id: "harvest_speed",
    category: "chain",
    name: "Big Scoop",
    shortName: "Scoop+",
    description: "Faster scooping.",
    baseCost: 18,
    costScale: 1.28,
    maxLevel: 8,
    worldShop: true,
    worldAnchor: "field",
  },
  {
    id: "crop_yield",
    category: "chain",
    name: "Bigger Drops",
    shortName: "Yield+",
    description: "More per scoop.",
    baseCost: 22,
    costScale: 1.32,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "field",
  },
  {
    id: "hire_grinder",
    category: "crew",
    name: "Spa Crew",
    shortName: "Spa crew",
    description: "Washes & grinds.",
    baseCost: 55,
    costScale: 1.65,
    maxLevel: 2,
    worldShop: true,
    worldAnchor: "spa",
  },
  {
    id: "spa_speed",
    category: "chain",
    name: "Bubble Boost",
    shortName: "Spa+",
    description: "Spa faster.",
    baseCost: 24,
    costScale: 1.3,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "spa",
  },
  {
    id: "process_speed",
    category: "chain",
    name: "Glitter Grinder",
    shortName: "Grind+",
    description: "Grind faster.",
    baseCost: 26,
    costScale: 1.3,
    maxLevel: 8,
    worldShop: true,
    worldAnchor: "grind",
  },
  {
    id: "process_auto",
    category: "chain",
    name: "Auto Hopper",
    shortName: "Auto",
    description: "Auto-feed stations.",
    baseCost: 70,
    costScale: 1.85,
    maxLevel: 3,
    worldShop: true,
    worldAnchor: "grind",
  },
  {
    id: "pack_speed",
    category: "chain",
    name: "Bow Machine",
    shortName: "Box+",
    description: "Box faster.",
    baseCost: 28,
    costScale: 1.3,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "pack",
  },
  {
    id: "hire_vendor",
    category: "crew",
    name: "Seller",
    shortName: "Seller",
    description: "Boxes & sells.",
    baseCost: 65,
    costScale: 1.7,
    maxLevel: 2,
    worldShop: true,
    worldAnchor: "market",
  },
  {
    id: "sell_price",
    category: "chain",
    name: "Price Up",
    shortName: "Price+",
    description: "More coins per crate.",
    baseCost: 30,
    costScale: 1.35,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "market",
  },
  {
    id: "sell_speed",
    category: "chain",
    name: "Fast Sell",
    shortName: "Sell+",
    description: "Sell faster.",
    baseCost: 24,
    costScale: 1.28,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "market",
  },
  {
    id: "gun_tier",
    category: "gun",
    name: "Rainbow Gun",
    shortName: "Gun+",
    description: "Better gun.",
    baseCost: 60,
    costScale: 1.6,
    maxLevel: 4,
    worldShop: true,
    worldAnchor: "player",
  },
  {
    id: "gun_damage",
    category: "gun",
    name: "More Sparkle",
    shortName: "Dmg+",
    description: "+15% damage.",
    baseCost: 40,
    costScale: 1.4,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "player",
  },
  {
    id: "gun_rate",
    category: "gun",
    name: "Faster Hose",
    shortName: "Rate+",
    description: "+12% fire rate.",
    baseCost: 42,
    costScale: 1.4,
    maxLevel: 6,
    worldShop: true,
    worldAnchor: "player",
  },
  {
    id: "max_health",
    category: "player",
    name: "Sparkle Vest",
    shortName: "HP+",
    description: "+25 HP.",
    baseCost: 25,
    costScale: 1.35,
    maxLevel: 5,
    worldShop: true,
    worldAnchor: "player",
  },
  {
    id: "move_speed",
    category: "player",
    name: "Sneakers",
    shortName: "Speed+",
    description: "Move faster.",
    baseCost: 30,
    costScale: 1.4,
    maxLevel: 4,
    worldShop: true,
    worldAnchor: "player",
  },
];

export function upgradeCost(def: UpgradeDef, level: number) {
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

export function enemyStats(kind: EnemyKind, levelId: number) {
  const scale = 1 + (levelId - 1) * 0.05;
  switch (kind) {
    case "pest":
      return { hp: 16 * scale, speed: 2.4, damage: 2, radius: 0.6, color: 0xfff0f8, coin: 5, height: 1.0 };
    case "beetle":
      return { hp: 28 * scale, speed: 2.1, damage: 3, radius: 0.75, color: 0xe8d4ff, coin: 9, height: 1.15 };
    case "thief":
      return { hp: 22 * scale, speed: 3.2, damage: 2, radius: 0.6, color: 0xffd4a8, coin: 14, height: 1.2 };
    case "brute":
      return { hp: 70 * scale, speed: 1.7, damage: 5, radius: 1.1, color: 0xffb0d0, coin: 30, height: 1.9 };
    case "dino":
      return { hp: 40 * scale, speed: 2.0, damage: 4, radius: 0.95, color: 0x5ec86a, coin: 16, height: 1.5 };
    case "raptor":
      return { hp: 24 * scale, speed: 3.8, damage: 3, radius: 0.65, color: 0xff8a40, coin: 12, height: 1.1 };
  }
}

export { LEVELS } from "./levels";
