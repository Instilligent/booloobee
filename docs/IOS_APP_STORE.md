# Booloobee — iOS App Store & Payments Plan

Target: **iPhone-first** casual hybrid game (landscape play, portrait title OK).
Payments: **Apple In-App Purchase only** (no external Stripe/web checkout for digital goods).

## Recommended business model

**Free download + hybrid monetization** (industry default for casual farm/supply-chain):

| Stream | Role | Player experience |
|--------|------|-------------------|
| **Rewarded video** (optional) | Monetize non-payers | Watch ad → 2× sell for 60s, free hire cooldown skip, revive once |
| **Consumable IAP** | Impulse spend | Coin packs, star bundles |
| **Non-consumable IAP** | Quality of life | Remove Ads, Starter Pack, Cosmetic skins |
| **Optional monthly** | Light VIP | Auto-scoop boost + exclusive skin (not required to clear content) |

Do **not** hard-lock levels behind paywalls. Research (2025–2026 casual/hybrid): players buy *time compression* and cosmetics, not mandatory progression. Keep core loop free and fun.

Enroll in **Apple Small Business Program** (15% commission under $1M/yr).

## Product IDs (App Store Connect)

Prefix: `com.instilligent.booloobee.`

### Consumables
| Product ID | Display name | Suggested price (NZD) | Grants |
|------------|--------------|----------------------|--------|
| `coins_small` | Coin Pouch | $1.99 | 200 coins |
| `coins_med` | Coin Bucket | $4.99 | 600 coins (+bonus) |
| `coins_large` | Coin Vault | $9.99 | 1500 coins (+bonus) |
| `stars_pack` | Star Bundle | $2.99 | 15 golden stars (instant field collect) |

### Non-consumables
| Product ID | Display name | Suggested price | Grants |
|------------|--------------|-----------------|--------|
| `remove_ads` | No Ads | $4.99 | Permanent ad-free |
| `starter_pack` | Rancher Starter | $2.99 | 300 coins + Farmer hire credit + remove interstitial for 7 days |
| `skin_cowgirl` | Cowgirl Skin | $1.99 | Unlock character (if locked) |
| `skin_wizard` | Mage Skin | $1.99 | Unlock character |
| `skin_dino` | Dino Rider Skin | $1.99 | Unlock character |

### Auto-renewable (optional Phase 2)
| Product ID | Display name | Price | Period | Grants |
|------------|--------------|-------|--------|--------|
| `vip_monthly` | VIP Ranch Pass | $4.99/mo | 1 month | Soft auto-scoop, exclusive hat, 1 daily free double-sell |

## Technical stack (iOS wrapper)

Current game is **web** (React + Three.js). Path to App Store:

1. **Phase A — Web pilot** (now): PWA / TestFlight webview optional for playtests.
2. **Phase B — Capacitor or WKWebView shell**
   - Capacitor iOS project wrapping the built SPA
   - Or native SwiftUI shell + WKWebView loading local bundle
3. **Phase C — StoreKit 2**
   - Native bridge: `purchase(productId)` → JS callback updates save
   - Persist non-consumables via App Receipt + restore purchases
   - Consumables applied immediately to `SaveData.coins` / flags
4. **Local testing**: Xcode **StoreKit Configuration File** (`.storekit`) with all product IDs above — no App Store Connect needed for device tests.

### Save / receipt rules
- Consumables: update local save only after successful transaction finish.
- Non-consumables + subscriptions: trust App Receipt; implement **Restore Purchases** button on title/pause.
- Never gate progression behind mandatory paywalls.

### Privacy / App Review
- Privacy Nutrition Label: purchase history, product interaction; no tracking if ATT not used.
- Age rating: 9+ (cartoon fantasy violence, mild crude humor — unicorn poop theme).
- Guideline 3.1.1: all digital goods via IAP.
- Provide TestFlight notes explaining the 5-step pipeline for reviewers.

## Implementation checklist

- [ ] App Store Connect app record + bundle ID `com.instilligent.booloobee`
- [ ] Create IAP products + localization (EN)
- [ ] StoreKit config file in Xcode
- [ ] JS ↔ native purchase bridge
- [ ] Restore Purchases UI
- [ ] Rewarded ad SDK (optional Phase 2) behind consent
- [ ] Screenshot set 6.7" + 6.5" + iPad
- [ ] Privacy policy URL + support URL
- [ ] Small Business Program enrollment

## Pricing psychology (casual)

- Starter pack under $3 converts best early.
- Remove Ads is high-intent QoL — surface after first rewarded ad.
- Coin packs: show when player is ~20% short of a hire they almost can afford (soft, not spammy).
