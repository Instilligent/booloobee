/**
 * Booloobee e2e smoke — must pass before push.
 * Exit 0 = success, non-zero = fail.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const URL = process.env.E2E_URL || "http://127.0.0.1:8080/";
const SHOT = process.env.E2E_SHOT || "/workspace/screenshots/e2e-latest.png";
mkdirSync("/workspace/screenshots", { recursive: true });

const fails = [];
function assert(cond, msg) {
  if (!cond) fails.push(msg);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));

try {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => window.__game, { timeout: 25000 });

  // Title + character
  await page.evaluate(() => {
    const g = window.__game;
    g.setCharacter("wizard");
    g.startGame(0);
  });
  await page.waitForTimeout(600);

  const state1 = await page.evaluate(() => {
    const g = window.__game;
    return {
      screen: g.screen ?? "?",
      hasPlayer: !!g.playerMesh,
      crops: g.crops?.length ?? 0,
      coins: g.save?.coins ?? 0,
      health: g.health,
      stars: g.stars?.filter((s) => !s.taken).length ?? 0,
      trees: g.trees?.length ?? 0,
      fireflies: g.fireflies?.length ?? 0,
    };
  });
  // screen is private — use HUD via internal
  const playing = await page.evaluate(() => {
    const g = window.__game;
    // force mid-game state checks
    g.raw = 2;
    g.washed = 1;
    g.glitter = 1;
    g.boxed = 1;
    const p = Object.getPrototypeOf(g);
    // scoop-area offers
    g.playerPos.set(0, 0, g.level.spawn.z * 0.55);
    const field = p.projectWorldOffers.call(g).filter((o) => o.visible);
    g.playerPos.set(g.spa.pos.x + 1, 0, g.spa.pos.z + 1);
    const spa = p.projectWorldOffers.call(g).filter((o) => o.visible);
    g.playerPos.set(g.market.pos.x + 1, 0, g.market.pos.z + 1);
    const market = p.projectWorldOffers.call(g).filter((o) => o.visible);
    // shoot
    p.computeMoveBasis?.call(g);
    p.shoot.call(g);
    const bullets = g.bullets?.filter((b) => b.active).length ?? 0;
    // move
    g.keys?.add?.("KeyW");
    p.updatePlayer?.call(g, 1 / 30);
    g.keys?.delete?.("KeyW");
    // sell
    g.playerPos.set(g.market.pos.x, 0, g.market.pos.z);
    g.touchInteract = true;
    for (let i = 0; i < 30; i++) p.handleInteract?.call(g, 0.05);
    g.touchInteract = false;
    return {
      crops: g.crops.length,
      fieldOffers: field.map((o) => o.label),
      spaOffers: spa.map((o) => o.label),
      marketOffers: market.map((o) => o.label),
      bullets,
      sold: g.sold,
      hasFountain: g.decorInteract?.some((d) => d.kind === "fountain"),
      hasCompost: g.decorInteract?.some((d) => d.kind === "compost"),
      pinkCrop: true,
    };
  });

  assert(state1.crops >= 8, `crops too few: ${state1.crops}`);
  assert(state1.trees >= 4, `trees missing: ${state1.trees}`);
  assert(state1.fireflies >= 8, `fireflies missing: ${state1.fireflies}`);
  assert(playing.fieldOffers.some((l) => /Farmer|Scoop|Yield|Robot/i.test(l)), `field offers wrong: ${playing.fieldOffers}`);
  assert(playing.spaOffers.some((l) => /Spa/i.test(l)), `spa offers wrong: ${playing.spaOffers}`);
  assert(playing.marketOffers.some((l) => /Sell|Price|Seller/i.test(l)), `market offers wrong: ${playing.marketOffers}`);
  assert(playing.bullets >= 1, "shoot produced no bullets");
  assert(playing.hasFountain, "fountain missing");
  assert(playing.hasCompost, "compost missing");
  assert(errors.length === 0, `page errors: ${errors.join(" | ")}`);

  // Mobile portrait still can start
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.__game.goTitle();
  });
  await page.waitForTimeout(300);
  const playVisible = await page.locator("button", { hasText: /Play/i }).isVisible();
  assert(playVisible, "Play button not visible in portrait");
  await page.locator("button", { hasText: /Play/i }).click();
  await page.waitForTimeout(500);
  const afterPlay = await page.evaluate(() => !!window.__game.playerMesh && window.__game.crops?.length > 0);
  assert(afterPlay, "Play did not start game");

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: SHOT });

  if (fails.length) {
    console.error("E2E FAIL:\n- " + fails.join("\n- "));
    console.error("state", JSON.stringify({ state1, playing, errors }, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        crops: state1.crops,
        trees: state1.trees,
        fieldOffers: playing.fieldOffers,
        spaOffers: playing.spaOffers,
        marketOffers: playing.marketOffers,
        bullets: playing.bullets,
        shot: SHOT,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (e) {
  console.error("E2E exception:", e);
  process.exit(1);
} finally {
  await browser.close();
}
