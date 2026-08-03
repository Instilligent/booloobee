# Booloobee continuous improvement log

Pipeline: change → `node scripts/e2e-game.mjs` → `git push` on success.

## Completed push-cycles (e2e verified)

1. **Juice core** — trauma² shake, hitstop, squash/stretch, dust, combo kills, camera lookahead  
2. **Guidance + life** — next-step rings, fireflies, enemy flash, star magnet, stick knob  
3. **Pilot + pilot ease** — flags, sell-heals-HP, start coins, USE pulse, SFX  
4. **Presentation** — day-cycle sky, star pay scale, level toast, upgrade L/max labels  
5. **Feel + mobile** — knockback, hurt juice, wider interact, cheaper farmer, safe-area insets  

## Research applied

- Vlambeer / Swink **juice**: multi-channel feedback per action (shake + SFX + particles + squash)  
- Trauma² screenshake; short hitstop; separate presentation from sim  
- Casual farm UX: short loops, automation unlocks, clear next-step highlight  
- Mobile: ≥44px targets, safe-area, landscape soft tip (non-blocking), magnet pickups  
- design-ui: tokens, reduced-motion, avoid emoji-as-icons in HUD  

## Backlog themes (for further loops)

- More station VFX (steam, conveyor UV scroll)  
- Character idle animations per skin  
- Boss unicorn/dino event  
- Daily seed challenge  
- Accessibility shake toggle in pause  
- Performance: particle pool caps telemetry  
- Onboarding ghost arrow first 30s  
- Seasonal cosmetics  
- Share score card image  

Run locally: `npm run dev` then `node scripts/e2e-game.mjs`
