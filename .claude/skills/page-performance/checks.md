# Performance checks

## 1. Measure in the preview

Open the test page in the preview with an empty cache (a fresh navigation), then run the
function below with the browser evaluate tool. Set `BLOCK` to the block name. Run it at
mobile size (360 x 800) and desktop size (1440 x 900).

```js
async () => {
  const BLOCK = 'csr-initiatives';
  await new Promise((r) => { setTimeout(r, 4000); });
  const entries = (type) => new Promise((resolve) => {
    const list = [];
    try {
      const po = new PerformanceObserver((l) => list.push(...l.getEntries()));
      po.observe({ type, buffered: true });
      setTimeout(() => { po.disconnect(); resolve(list); }, 300);
    } catch { resolve(list); }
  });
  const [lcpList, shifts, longTasks] = await Promise.all([
    entries('largest-contentful-paint'), entries('layout-shift'), entries('longtask'),
  ]);
  const lcp = lcpList.at(-1);
  const cls = shifts.filter((s) => !s.hadRecentInput).reduce((sum, s) => sum + s.value, 0);
  const resources = performance.getEntriesByType('resource');
  const kb = (list) => Math.round(list.reduce((s, r) => s + (r.decodedBodySize || r.encodedBodySize || 0), 0) / 1024);
  const blockFiles = resources.filter((r) => r.name.includes(`/blocks/${BLOCK}/`));
  // cached files report 0 bytes: measure the block files by fetching them again
  const sizes = await Promise.all(blockFiles.map(async (r) => ({
    file: r.name.split('/').pop(),
    kb: Math.round(((await (await fetch(r.name)).text()).length / 1024) * 10) / 10,
  })));
  const sum = (ext) => Math.round(sizes.filter((s) => s.file.endsWith(ext)).reduce((t, s) => t + s.kb, 0) * 10) / 10;
  const images = resources.filter((r) => r.initiatorType === 'img' || /\.(webp|png|jpe?g|gif|avif|svg)(\?|$)/.test(r.name));
  // images loaded although hidden or far below the fold (URLs also shown in view are fine)
  const src = (img) => img.currentSrc || img.src;
  const all = [...document.querySelectorAll('img')];
  const isAway = (img) => img.closest('[hidden]') || img.getBoundingClientRect().top > window.innerHeight * 2;
  const inView = new Set(all.filter((img) => !isAway(img)).map(src));
  const offscreen = [...new Set(all.filter((img) => isAway(img) && img.complete && img.naturalWidth
    && !inView.has(src(img))).map(src))];
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    lcp: lcp ? { ms: Math.round(lcp.startTime), element: lcp.element?.tagName, url: (lcp.url || '').split('/').pop() } : 'none',
    cls: Number(cls.toFixed(3)),
    longTasks: longTasks.map((t) => Math.round(t.duration)),
    blockJsKb: sum('.js'),
    blockCssKb: sum('.css'),
    blockFiles: sizes.map((s) => `${s.file} ${s.kb}KB`),
    images: images.length,
    imagesKb: kb(images),
    largestImages: images.sort((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0)).slice(0, 3)
      .map((r) => `${r.name.split('/').pop().split('?')[0]} ${Math.round((r.decodedBodySize || 0) / 1024)}KB`),
    loadedOffscreenOrHidden: offscreen.map((url) => url.split('/').pop().split('?')[0]),
    requests: resources.length,
  };
}
```

Then check interactions: click the block's main controls (tabs, arrows, accordion) and look
for long tasks over 50 ms (run `entries('longtask')` again, or watch for visible delay).

Notes:
- The local preview does not compress files, so sizes are uncompressed: use them for the
  budgets below, not as download sizes.
- Images that repeat (same URL) are only fetched once: use different sample images when
  you need to check what hidden content loads.
- Local LCP is only a rough guide; PageSpeed on the branch preview is the real measure.

## 2. Budgets

| Item | Budget |
|---|---|
| Block JS (uncompressed with comments, all files loaded for one style) | about 15 KB |
| Block CSS (uncompressed with comments, all files loaded for one style) | about 20 KB |
| Card or thumbnail image | under 50 KB |
| Any other image | under 100 KB (hero: under 150 KB at its largest width) |
| CLS | under 0.1, aim for 0 |
| LCP (mobile, PageSpeed) | under 2.5 s |
| Long tasks during load or a click | none over 50 ms caused by the block |
| New requests in the eager phase | none for content below the fold |

## 3. PageSpeed Insights on the branch preview

After the code is pushed, the branch preview is public:
`https://<branch>--kotaklife-insurance--aloksing-h.aem.page/<page-path>`.
Run PageSpeed (mobile) with the public API, no login needed:

```bash
URL="https://test--kotaklife-insurance--aloksing-h.aem.page/in/en/aem-cods/csr-initiatives"
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$URL")&strategy=mobile&category=performance&category=accessibility" \
  | node -e '
let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
  const r = JSON.parse(s);
  if (r.error) { console.log("error:", r.error.message); return; }
  const lh = r.lighthouseResult; const a = lh.audits;
  console.log("performance", Math.round(lh.categories.performance.score * 100),
    "| accessibility", Math.round((lh.categories.accessibility?.score || 0) * 100));
  ["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "speed-index"]
    .forEach((k) => console.log(k, a[k]?.displayValue));
  Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.details?.type === "opportunity")
    .forEach((x) => console.log("fix:", x.title, x.displayValue || ""));
  Object.values(a).filter((x) => x.score === 0 && lh.categories.accessibility?.auditRefs.some((ref) => ref.id === x.id))
    .forEach((x) => console.log("a11y:", x.title));
}); '
```

- The API is rate limited without a key and its shared daily quota often runs out
  ("Quota exceeded ... Queries per day"). Then run Lighthouse here instead (section 4).
- The page must be previewed from the author first, or the URL answers 404.
- Fix anything below 100 that the change caused. Problems that come from elsewhere (the
  header, the site navigation, fonts, third-party scripts) are reported, not fixed in the
  block.

## 4. Lighthouse here (fallback when PageSpeed has no quota)

Lighthouse is what PageSpeed runs. Use the Chrome that the browser tools already have, and
write the report outside the repo:

```bash
mkdir -p /tmp/lh
CHROME=$(ls /ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)
CHROME_PATH="$CHROME" timeout 240 npx -y lighthouse@12 "$URL" --quiet \
  --only-categories=performance,accessibility --form-factor=mobile \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --output=json --output-path=/tmp/lh/report.json
node -e '
const lh = require("/tmp/lh/report.json"); const a = lh.audits;
console.log("performance", Math.round(lh.categories.performance.score * 100),
  "| accessibility", Math.round(lh.categories.accessibility.score * 100));
["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "speed-index"]
  .forEach((k) => console.log(k, a[k]?.displayValue));
Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && (x.details?.type === "opportunity" || x.metricSavings))
  .forEach((x) => console.log("fix:", x.id, "|", x.title, x.displayValue || ""));
lh.categories.accessibility.auditRefs.filter((r) => a[r.id].score === 0)
  .forEach((r) => console.log("a11y:", r.id, "|", a[r.id].title, "|",
    (a[r.id].details?.items || []).slice(0, 3).map((i) => i.node?.selector || "").join(" ; ")));'
```

- Run one Lighthouse at a time (it starts its own Chrome and uses memory).
- Lab scores vary by a few points between runs: run again before chasing a 98 or 99.
- Read the selectors in `fix:` and `a11y:` lines to tell block problems from site-wide ones
  (header, breadcrumb, footer, fonts).

Example (CSR Initiatives test page on the `test` branch, mobile, 27 Nov 2026): performance
100 (LCP 1.6 s, CLS 0.006, TBT 0 ms), accessibility 90 with failures only in the site
breadcrumb, header menu and footer links. Block findings: "LCP image was lazily loaded"
(the block was the first section) and "Image elements do not have explicit width and
height".
