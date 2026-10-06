// Plays a whole game by clicking (select card, click cell), then tests refresh-resume. Screenshots go to ./shots
import { chromium } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:5199/';
const W = Number(process.env.W ?? 1100);
const H = Number(process.env.H ?? 780);
const tag = process.env.TAG ?? 'play';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: process.env.TOUCH === '1' });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(URL);
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /new game/i }).click();
const status = () => page.evaluate(() => document.querySelector('.status')?.textContent ?? '');
const empties = () => page.evaluate(() => 0);
let moves = 0;
const taken = new Set();
for (let guard = 0; guard < 80; guard++) {
  await page.waitForTimeout(500);
  if (await page.locator('.result').count()) break;
  if (!(await page.evaluate(() => window.__scene.inputOn))) continue;
  const pts = await page.evaluate(() => window.__scene.debugPoints());
  const used = await page.evaluate(() => JSON.parse(localStorage.getItem('fantasy-cg-triad-save-v1')).state.board.map((c) => !!c));
  const cell = used.findIndex((u) => !u);
  if (cell < 0) break;
  const hi = Math.floor(pts.hand.length / 2);
  const hp = pts.hand[hi];
  await page.mouse.move(hp.x, hp.y);
  await page.waitForTimeout(150);
  await page.mouse.click(hp.x, hp.y); // select
  await page.waitForTimeout(250);
  if (moves === 3) await page.screenshot({ path: `shots/${tag}-sel.png` });
  await page.mouse.move(pts.cells[cell].x, pts.cells[cell].y, { steps: 5 });
  await page.waitForTimeout(150);
  if (moves === 3) await page.screenshot({ path: `shots/${tag}-preview.png` });
  await page.mouse.click(pts.cells[cell].x, pts.cells[cell].y);
  moves++;
  if (moves === 5) { await page.waitForTimeout(700); await page.screenshot({ path: `shots/${tag}-capture.png` }); }
  if (moves === 6) {
    // refresh mid-game: the same game must come back
    await page.waitForTimeout(3500);
    const before = await page.evaluate(() => localStorage.getItem('fantasy-cg-triad-save-v1'));
    await page.reload();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => localStorage.getItem('fantasy-cg-triad-save-v1'));
    console.log('refresh keeps save:', before === after);
    await page.screenshot({ path: `shots/${tag}-resume-menu.png` });
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/${tag}-resumed.png` });
  }
}
await page.waitForSelector('.result', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `shots/${tag}-result.png` });
console.log('moves played', moves, '| result:', await page.evaluate(() => document.querySelector('.result h2')?.textContent));
console.log('errors', JSON.stringify(errors));
await browser.close();
