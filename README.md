# Booloobee Ranch

Silly **3D ranch supply-chain** game — scoop pink unicorn glitter, run the spa→grind→box→sell pipeline, hire robots, rainbow-blast pests.

**18 stages · 5 acts · iOS App Store planned (IAP via StoreKit).**

## Play

```bash
npm install
npm run dev
```

Landscape phone or desktop. Sound unlocks on first tap.

## Campaign structure

| Act | Stages | Theme |
|-----|--------|--------|
| 1 Learn | 1–3 | Starter loop |
| 2 Automate | 4–6 | Hires & upgrades |
| 3 Carnival | 7–9 | Chaos & denser pests |
| 4 Factory | 10–12 | Station bottlenecks |
| 5 VIP / Boss | 13–18 | Stampede → Infinite Parade |

## Features

- Pipeline: scoop → wash → grind → box → sell
- **18 stages** with level select + continue
- Daily gift (+25c) and act-scaled quota bonuses
- Upgrades appear **at the station they affect**
- Characters, unicorns + dinos, stars, fountain, compost, jukebox
- Procedural audio, mobile-first controls
- iOS path: `capacitor.config.ts` + `src/game/iap.ts` StoreKit stub

## iOS (landscape lock)

On a Mac with Xcode:

```bash
git pull
npm run ios:setup
npx cap open ios
```

In Xcode: **App** target → **General** → only **Landscape Left** + **Landscape Right**. Then Run.

Full steps: [docs/CAPACITOR_IOS.md](docs/CAPACITOR_IOS.md).

## Docs

- [iOS App Store & IAP](docs/IOS_APP_STORE.md)
- [Capacitor iOS / landscape](docs/CAPACITOR_IOS.md)
- [Advertising & ASO](docs/ADVERTISING.md)
- [Product roadmap](docs/PRODUCT_ROADMAP.md)
- [Improvement log](IMPROVEMENT_LOG.md)

## Stack

React 19 · TanStack Start · Three.js · Vite · Tailwind v4

## Org

[Instilligent](https://github.com/Instilligent) · `Instilligent/booloobee`
