// Draws docs/card-art-template.png: a 1056x1408 (3:4) guide showing what the game overlays on card art.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const dataUrl = await page.evaluate(() => {
  const W = 1056, H = 1408, k = W / 300; // the card is designed in a 300 x 400 space (same scale both ways)
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#2b1620'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2;
  for (let i = 0; i <= W; i += 100) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
  for (let j = 0; j <= H; j += 100) { g.beginPath(); g.moveTo(0, j); g.lineTo(W, j); g.stroke(); }
  const label = (t, x, y, col = '#fff', size = 34) => { g.fillStyle = col; g.font = `700 ${size}px sans-serif`; g.textAlign = 'center'; g.fillText(t, x, y); };
  // name-plate fade (bottom 34%)
  const fade = g.createLinearGradient(0, H * 0.66, 0, H);
  fade.addColorStop(0, 'rgba(255,120,60,0)'); fade.addColorStop(1, 'rgba(255,120,60,.45)');
  g.fillStyle = fade; g.fillRect(0, H * 0.66, W, H * 0.34);
  label('keep detail above this line', W / 2, H * 0.66 + 50, '#ffd0b0', 28);
  // number badges
  const badge = (cx, cy, t) => {
    g.beginPath(); g.arc(cx, cy, 23 * k, 0, Math.PI * 2); g.fillStyle = 'rgba(255,60,90,.45)'; g.fill();
    g.strokeStyle = '#ff6b7a'; g.lineWidth = 4; g.stroke(); label(t, cx, cy + 12, '#fff', 34);
  };
  badge(W / 2, 30 * k, 'TOP'); badge(W / 2, H - 28 * k, 'BTM'); badge(28 * k, H / 2, 'L'); badge(W - 28 * k, H / 2, 'R');
  // name text
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(W * 0.18, H - 56 * k - 42, W * 0.64, 54);
  label('CARD NAME', W / 2, H - 56 * k, '#fff', 36);
  // safe area
  g.setLineDash([18, 14]); g.strokeStyle = '#6ee7a8'; g.lineWidth = 5;
  g.strokeRect(W * 0.14, H * 0.15, W * 0.72, H * 0.65);
  g.setLineDash([]); label('SAFE AREA - face / focal point here', W / 2, H * 0.15 + 46, '#6ee7a8', 32);
  g.strokeStyle = 'rgba(110,231,168,.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2, H * 0.15); g.lineTo(W / 2, H * 0.8); g.moveTo(W * 0.14, H * 0.45); g.lineTo(W * 0.86, H * 0.45); g.stroke();
  label('focal point ~45% down', W / 2, H * 0.45 - 12, 'rgba(110,231,168,.8)', 26);
  // frame drawn over the edge (square corners, nothing is cut off)
  g.lineWidth = 2 * 5 * k; g.strokeStyle = 'rgba(111,176,255,.9)'; g.strokeRect(0, 0, W, H);
  label('1056 x 1408 px  (3:4)', W / 2, H / 2 + 120, 'rgba(255,255,255,.55)', 40);
  label('blue border = frame drawn over the edge (~18 px)', W / 2, H / 2 + 170, 'rgba(255,255,255,.45)', 26);
  label('square corners', W / 2, H / 2 + 215, 'rgba(255,255,255,.45)', 26);
  return c.toDataURL('image/png');
});
fs.writeFileSync('docs/card-art-template.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('wrote docs/card-art-template.png');
