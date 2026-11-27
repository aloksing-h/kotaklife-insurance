/*
 * UI verification matrix for one block (Playwright only).
 * Usage: node verify-block.mjs <config.json>
 * Config: {
 *   "url": "http://localhost:3000/content/<page>",
 *   "block": "csr-initiatives",
 *   "out": "/abs/path/migration-work/qa/<block>",
 *   "styles": { "<selector>": ["font-size", "color", ...] },      // idle values to record
 *   "hover": ["<selector>", ...],                                  // first visible match is hovered
 *   "click": [{ "trigger": "<selector>", "expect": "<selector>" }],// e.g. tab -> its panel
 *   "open": [{ "trigger": "<selector>", "overlay": "<selector>", "close": "Escape" }]
 * }
 * Writes screenshots, results.json and walkthrough.md to "out".
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { url, block, out } = config;
const VIEWPORTS = config.viewports || [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];
const STATE_PROPS = ['color', 'background-color', 'background-image', 'border-color', 'box-shadow',
  'opacity', 'transform', 'outline', 'text-decoration-line'];
mkdirSync(out, { recursive: true });

let browser;
let browserName = 'chrome';
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch {
  browserName = 'chromium (bundled; Google Chrome is not installed)';
  browser = await chromium.launch({ headless: true });
}

const results = { url, block, browser: browserName, date: new Date().toISOString(), viewports: [] };

const styleOf = (page, selector, props) => page.evaluate(([sel, list]) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length);
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    box: `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`,
    ...Object.fromEntries(list.map((p) => [p, s.getPropertyValue(p)])),
  };
}, [selector, props]);

// state styles of an element and its first descendants (hover often restyles a child)
const stateOf = (page, selector) => page.evaluate(([sel, list]) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length);
  if (!el) return null;
  const parts = [el, ...[...el.querySelectorAll('*')].slice(0, 12)];
  const values = {};
  parts.forEach((part, i) => {
    const s = getComputedStyle(part);
    const label = i ? `${part.tagName.toLowerCase()}${part.classList[0] ? `.${part.classList[0]}` : ''}` : 'self';
    list.forEach((p) => { values[`${label} ${p}`] = s.getPropertyValue(p); });
  });
  return values;
}, [selector, STATE_PROPS]);

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const shot = async (name, target) => {
    const path = `${out}/${vp.name}-${name}.png`;
    await (target || page.locator(`.${block}`).first()).screenshot({ path, timeout: 15000 });
    return path.split('/').pop();
  };
  const v = { viewport: vp, checks: [] };
  const check = (state, pass, detail, screenshot) => v.checks.push({ state, pass, detail, screenshot });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    const root = page.locator(`.${block}[data-block-status="loaded"]`).first();
    await root.waitFor({ state: 'attached', timeout: 15000 });
    await root.scrollIntoViewIfNeeded({ timeout: 15000 });
    await page.waitForTimeout(600);

    // idle
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const idle = {};
    for (const [sel, props] of Object.entries(config.styles || {})) {
      idle[sel] = await styleOf(page, sel, props);
    }
    check('idle', overflow <= 0, { horizontalOverflowPx: overflow, styles: idle }, await shot('idle'));

    // hover
    for (const sel of config.hover || []) {
      const target = page.locator(sel).filter({ visible: true }).first();
      if (await target.count()) {
        const before = await stateOf(page, sel);
        await target.hover({ timeout: 15000 });
        await page.waitForTimeout(400);
        const after = await stateOf(page, sel);
        const changed = Object.keys(after || {}).filter((k) => before?.[k] !== after[k]);
        check(`hover ${sel}`, changed.length > 0, { changed: Object.fromEntries(changed.map((k) => [k, `${before[k]} -> ${after[k]}`])) },
          await shot(`hover-${v.checks.length}`, target));
        await page.mouse.move(0, 0);
      } else check(`hover ${sel}`, false, 'no visible element');
    }

    // focus-visible: Tab into the block (switches on the site's keyboard focus mode)
    let focused = null;
    for (let i = 0; i < 80 && !focused; i += 1) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate((b) => {
        const el = document.activeElement;
        if (!el?.closest(`.${b}`)) return null;
        const ring = (s) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outline : '')
          || (s.boxShadow !== 'none' ? s.boxShadow : '');
        const own = ring(getComputedStyle(el));
        const child = [...el.querySelectorAll('*')].map((c) => ring(getComputedStyle(c))).find(Boolean);
        return { element: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`, name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 40), ring: own || child || ring(getComputedStyle(el, '::after')) || '' };
      }, block);
    }
    if (focused) check('focus-visible', Boolean(focused.ring), focused, await shot('focus'));
    else check('focus-visible', false, 'Tab never reached the block');

    // click: trigger -> expected element visible
    for (const { trigger, expect } of config.click || []) {
      await page.locator(trigger).first().click({ timeout: 15000 });
      await page.waitForTimeout(400);
      const shown = await page.locator(expect).first().isVisible();
      check(`click ${trigger}`, shown, { expectVisible: expect }, await shot(`click-${v.checks.length}`));
    }

    // open overlays: visible, not clipped or covered, slim scrollbar
    for (const { trigger, overlay, close = 'Escape' } of config.open || []) {
      await page.locator(trigger).first().click({ timeout: 15000 });
      await page.waitForTimeout(400);
      const hit = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || !el.getClientRects().length) return { visible: false };
        const r = el.getBoundingClientRect();
        const points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4],
          [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
        const covered = points.filter(([x, y]) => {
          const top = document.elementFromPoint(x, y);
          return !top || !(el === top || el.contains(top));
        }).length;
        const s = getComputedStyle(el);
        return { visible: true, coveredPoints: covered, zIndex: s.zIndex, scrollbarWidth: s.scrollbarWidth, scrolls: el.scrollHeight > el.clientHeight };
      }, overlay);
      check(`open ${trigger}`, hit.visible && hit.coveredPoints === 0, hit, await shot(`open-${v.checks.length}`, page));
      await page.keyboard.press(close);
    }

    // disabled controls are really disabled
    const disabled = await page.evaluate((b) => [...document.querySelectorAll(`.${b} button:disabled, .${b} [aria-disabled="true"]`)]
      .map((el) => ({ name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), disabledAttr: el.disabled === true })), block);
    check('disabled', disabled.every((d) => d.disabledAttr), disabled);
    check('console', consoleErrors.filter((e) => e.includes(block)).length === 0, consoleErrors);
  } catch (error) {
    check('run', false, error.message.split('\n')[0]);
  } finally {
    await page.close();
    await context.close();
  }
  results.viewports.push(v);
}
await browser.close();

writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
const md = [`# UI verification: ${block}`, '', `- Page: ${url}`, `- Browser: ${browserName}`, `- Date: ${results.date}`, ''];
results.viewports.forEach(({ viewport, checks }) => {
  md.push(`## ${viewport.name} (${viewport.width}x${viewport.height})`, '', '| State | Result | Details | Screenshot |', '|---|---|---|---|');
  checks.forEach((c) => md.push(`| ${c.state} | ${c.pass ? 'pass' : '**check**'} | ${JSON.stringify(c.detail).replace(/\|/g, '/').slice(0, 300)} | ${c.screenshot ? `![](${c.screenshot})` : ''} |`));
  md.push('');
});
md.push('## Compared with the Figma spec', '', '_Fill in: key values per state against spec.md, differences over 1px or in colour, open items._', '');
writeFileSync(`${out}/walkthrough.md`, md.join('\n'));
const failed = results.viewports.flatMap((x) => x.checks.filter((c) => !c.pass).map((c) => `${x.viewport.name}: ${c.state}`));
console.log(`browser: ${browserName}\n${failed.length ? `to check: ${failed.join(', ')}` : 'all checks passed'}\n-> ${out}/walkthrough.md`);
