// Headless smoke test: drives the game in Chrome and saves screenshots to ./shots
import { chromium } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:5199/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = Number(process.env.W ?? 1100);
const H = Number(process.env.H ?? 780);
const tag = process.env.TAG ?? 'desk';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

await page.goto(URL);
await page.waitForTimeout(2500);
await page.screenshot({ path: `shots/${tag}-1-menu.png` });

await page.getByRole('button', { name: /new game/i }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `shots/${tag}-2-dealing.png` });
await page.waitForTimeout(5200);
await page.screenshot({ path: `shots/${tag}-3-ready.png` });
console.log('state', await page.evaluate(() => document.querySelector('.status')?.textContent));

// find which cell/hand positions to use from canvas size
const box = await page.locator('canvas').boundingBox();
console.log('canvas', JSON.stringify(box));
// drag the middle hand card to the board centre
const cx = box.x + box.width / 2;
const hy = box.y + box.height - Math.min(230, box.height * 0.26) / 2;
await page.mouse.move(cx, hy);
await page.waitForTimeout(400);
await page.screenshot({ path: `shots/${tag}-4-hover.png` });
await page.mouse.down();
await page.mouse.move(cx, hy - 80, { steps: 6 });
await page.mouse.move(cx + 10, box.y + box.height * 0.45, { steps: 12 });
await page.waitForTimeout(300);
await page.screenshot({ path: `shots/${tag}-5-drag.png` });
await page.mouse.up();
await page.waitForTimeout(450);
await page.screenshot({ path: `shots/${tag}-6-placed.png` });
await page.waitForTimeout(4200);
await page.screenshot({ path: `shots/${tag}-7-after-ai.png` });
console.log('status', await page.evaluate(() => document.querySelector('.status')?.textContent), '| score', await page.evaluate(() => [...document.querySelectorAll('.score .num')].map((n) => n.textContent).join('-')));
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
