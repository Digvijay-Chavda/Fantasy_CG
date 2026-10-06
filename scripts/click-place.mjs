import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:5199/');
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /new game/i }).click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(400); if (await page.evaluate(() => window.__scene.inputOn)) break; }
const pts = await page.evaluate(() => window.__scene.debugPoints());
const hp = pts.hand[3];
const cell = pts.cells[5];
// realistic: hover the card, click it, wander over the board, click a cell
await page.mouse.move(hp.x - 200, hp.y);
await page.mouse.move(hp.x, hp.y, { steps: 8 });
await page.waitForTimeout(300);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/r-1-selected.png' });
await page.mouse.move(cell.x, cell.y, { steps: 15 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/r-2-over-cell.png' });
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(1200);
// The placed card must rest at the clicked cell at full board scale (regression: it used to snap back to the hand).
const placed = await page.evaluate((i) => {
  const sc = window.__scene;
  const v = sc.boardViews.get(i);
  return v ? { x: v.x, y: v.y, scale: v.scale.x, home: v.home } : null;
}, 5);
await page.screenshot({ path: 'shots/click-place.png' });
const ok = placed && Math.abs(placed.x - cell.x) < 1 && Math.abs(placed.y - cell.y) < 1 && Math.abs(placed.scale - placed.home.scale) < 0.01;
console.log(ok ? 'PASS click-select then click-cell places the card' : 'FAIL ' + JSON.stringify(placed), '| errors', JSON.stringify(errors));
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
