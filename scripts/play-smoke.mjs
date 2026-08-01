import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Start Level 1/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/screenshots/playing.png" });
const yaw0 = await page.evaluate(() => window.__controlsTest?.getYaw?.() ?? null);
await page.evaluate(() => {
  window.__controlsTest?.setKeys?.(["KeyW"]);
});
await page.waitForTimeout(500);
const speed = await page.evaluate(() => window.__controlsTest?.getSpeed?.() ?? 0);
await page.evaluate(() => {
  window.__controlsTest?.setKeys?.(["KeyW", "KeyA"]);
});
await page.waitForTimeout(400);
const yawA = await page.evaluate(() => window.__controlsTest?.getYaw?.() ?? null);
// Clear keys
await page.evaluate(() => window.__controlsTest?.setKeys?.([]));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/paused.png" });
// Open upgrades
await page.getByRole("button", { name: /Upgrades/i }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/upgrades.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
const mErr = [];
mobile.on("pageerror", (e) => mErr.push(String(e)));
await mobile.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await mobile.waitForTimeout(600);
await mobile.getByRole("button", { name: /Start Level 1/i }).click();
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-play.png" });
const bodyOverflow = await mobile.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
  hasCanvas: !!document.querySelector("canvas"),
  fireBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("FIRE")),
}));
console.log(JSON.stringify({ yaw0, speed, yawA, errors, mErr, bodyOverflow }, null, 2));
await browser.close();
