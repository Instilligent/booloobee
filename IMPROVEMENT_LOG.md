# Booloobee continuous improvement log

**Pipeline:** change → `node scripts/e2e-game.mjs` → push to `Instilligent/booloobee` on success.

Repo: https://github.com/Instilligent/booloobee

## E2E-verified push cycles (this run)

| # | Commit theme | Highlights |
|---|--------------|------------|
| 1 | Juice + HUD | trauma² shake, hitstop, squash, dust, combos, color-dot pipeline, theme tokens, e2e harness |
| 2 | Guidance + life | next-step rings, fireflies, enemy flash, star magnet, stick knob |
| 3 | Economy + pilot | flags, sell→HP, start coins, USE pulse, SFX mix |
| 4 | Presentation | day-cycle sky, star pay scale, level toast, upgrade L/max |
| 5 | Feel + mobile | knockback, hurt juice, interact range, farmer 30c, safe-area |
| 6 | Rewards + gun | fountain/compost/jukebox pay, worker/move speed, fog, toast |
| 7 | Onboarding | guide arrow to next step, station bob, pause mute |
| 8 | Accessibility | prefers-reduced-motion softens shake/hitstop |

Each row is one green e2e + git push. Many smaller tweaks live inside each cycle.

## Research applied

- **Juice** (Vlambeer / Swink): multi-channel feedback (shake + SFX + particles + squash + floats)
- **Camera:** trauma² shake, exp-lerp follow, movement lookahead
- **Casual farm UX:** short loop, automation hires, next-step highlight, magnet pickups
- **Mobile:** 44px+ targets, safe-area insets, non-blocking landscape tip, stick knob feedback
- **design-ui:** CSS tokens, reduced-motion, no emoji-as-HUD-icons
- **A11y:** reduced-motion media query dampens shake/hitstop

## How to continue loops

```bash
# edit game code, then:
node scripts/e2e-game.mjs && git add -A && git commit -m "loop: …" && git push origin main
```

## Backlog for future loops

- Shake toggle in pause UI
- Conveyor UV scroll / spa steam VFX
- Character idle animations
- Boss unicorn/dino event
- First-30s ghost tutorial path
- Particle pool telemetry / caps
- Seasonal cosmetics
- Shareable score card
- More levels / infinite ranch mode
