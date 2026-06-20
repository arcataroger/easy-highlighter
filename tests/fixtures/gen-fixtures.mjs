// Offline fixture generator: renders believable multi-column articles with REAL
// Unicode fonts (Latin / CJK / Arabic) using the browser's system fonts, and
// writes a PNG plus ground-truth line boxes (JSON) for each. The browser is
// used ONLY here, to author fixtures — the actual detector tests run in pure
// Vitest against these committed PNG + JSON files.
//
// Run: node tests/fixtures/gen-fixtures.mjs   (or: npm run fixtures:gen)
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "engine", "cv", "__fixtures__");

const LATIN =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat".split(
    " "
  );
const ARABIC =
  "لكن لا بد أن أوضح لك أن كل هذه الأفكار المغلوطة حول استنكار النشوة وتمجيد الألم نشأت بالفعل وسأعرض لك التفاصيل لتكتشف حقيقة وأساس تلك السعادة البشرية"
    .split(" ");
// CJK has no spaces; we slice runs of characters per line instead.
const CJK =
  "在不久的将来人工智能将彻底改变我们的生活方式从医疗教育到交通运输每一个领域都会受到深远的影响科学家们正在努力研究如何让机器更好地理解人类语言并与我们自然地交流这是一个充满希望与挑战的时代";

const CASES = [
  {
    name: "latin-article",
    dir: "ltr",
    font: "Georgia, 'Times New Roman', serif",
    words: LATIN,
    cjk: false,
  },
  {
    name: "arabic-article",
    dir: "rtl",
    font: "'Geeza Pro', 'Noto Naskh Arabic', serif",
    words: ARABIC,
    cjk: false,
  },
  {
    name: "cjk-article",
    dir: "ltr",
    font: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif",
    cjk: CJK,
  },
];

function buildDoc(cfg) {
  const { dir, font, words, cjk } = cfg;
  const W = 1000;
  const margin = 60;
  const size = 18;
  const pitch = Math.round(size * 1.7);
  const gutter = 46;
  const colW = Math.floor((W - margin * 2 - gutter) / 2);
  const cols = [
    { x0: margin, x1: margin + colW },
    { x0: margin + colW + gutter, x1: margin + colW + gutter + colW },
  ];

  const root = document.createElement("div");
  root.style.cssText =
    `position:absolute;left:0;top:0;width:${W}px;background:#fff;` +
    `font-family:${font};color:#111;`;
  document.body.style.margin = "0";
  document.body.appendChild(root);

  const lines = [];
  let rndState = 12345;
  const rnd = () => ((rndState = (rndState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const place = (band, col, x, top, w, fontSize, text, rtl) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      `position:absolute;left:${x}px;top:${top}px;width:${w}px;` +
      `font-size:${fontSize}px;line-height:1.0;white-space:nowrap;overflow:hidden;` +
      (rtl ? "direction:rtl;text-align:right;" : "");
    root.appendChild(el);
    lines.push({ band, col, el });
  };

  // Build one line's text to roughly fill width `w`.
  const lineText = (w, fontSize) => {
    if (cjk) {
      const n = Math.max(4, Math.floor(w / fontSize));
      let s = "";
      for (let i = 0; i < n; i++) s += cjk[Math.floor(rnd() * cjk.length)];
      return s;
    }
    let s = words[Math.floor(rnd() * words.length)];
    while (s.length < w / (fontSize * 0.5)) s += " " + words[Math.floor(rnd() * words.length)];
    return s;
  };

  let y = 50;
  // Headline (full width, large).
  place("headline", 0, margin, y, W - margin * 2, 40, lineText(W - margin * 2, 40), dir === "rtl");
  y += 40 * 1.5;

  const bodyTop = y + 16;
  const nLines = 15;
  for (let c = 0; c < 2; c++) {
    let top = bodyTop;
    for (let li = 0; li < nLines; li++) {
      place("body", c, cols[c].x0, top, colW, size, lineText(colW, size), dir === "rtl");
      top += pitch;
    }
  }
  const capTop = bodyTop + nLines * pitch + 30;
  place("caption", 0, margin, capTop, colW, 13, lineText(colW, 13), dir === "rtl");

  // Measure everything relative to the page (root is at 0,0).
  const gt = lines.map(({ band, col, el }) => {
    const r = el.getBoundingClientRect();
    return {
      band,
      col,
      x0: Math.round(r.left),
      y0: Math.round(r.top),
      x1: Math.round(r.right),
      y1: Math.round(r.bottom),
    };
  });
  const docH = Math.max(...gt.map((g) => g.y1)) + 40;
  return { width: W, height: docH, cols, gt };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1400 }, deviceScaleFactor: 1 });
mkdirSync(OUT, { recursive: true });

for (const cfg of CASES) {
  const meta = await page.evaluate(buildDoc, cfg);
  await page.screenshot({
    path: join(OUT, `${cfg.name}.png`),
    clip: { x: 0, y: 0, width: meta.width, height: meta.height },
  });
  writeFileSync(
    join(OUT, `${cfg.name}.json`),
    JSON.stringify({ cols: meta.cols, gt: meta.gt }, null, 2)
  );
  // Reset the page for the next case.
  await page.evaluate(() => (document.body.innerHTML = ""));
  console.log(`wrote ${cfg.name}.png (${meta.width}x${meta.height}) + .json (${meta.gt.length} lines)`);
}

await browser.close();
