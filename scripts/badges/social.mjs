#!/usr/bin/env node
/**
 * The pictures a link shows when somebody shares it: the social cards, and the
 * icon of the site.
 *
 *   node scripts/badges/social.mjs            # every card, and the icon
 *   node scripts/badges/social.mjs --icon     # the icon only, no browser needed
 *
 * A learner sharing their badge on LinkedIn is the point of the badge, and
 * LinkedIn does not render SVG: the preview has to be a raster image, 1200x630,
 * at an absolute URL. So each badge gets `badges/social/<trailblazer>.png`, and
 * every other page of the site gets one card showing the three levels,
 * `labs/_assets/social/course.png`.
 *
 * Both are drawn here as SVG, with the badge itself embedded from
 * `badge-svg.mjs`, so a change to the artwork reaches the cards by re-running
 * this. They are rasterised with the browser the verify scripts already use, and
 * committed like the badge images: a card is part of what a badge is, and the
 * site build stays a build.
 *
 * The icon is the level 3 hexagon with nothing in it but the Cloudity mark. It
 * is written as SVG, not PNG, because a favicon is 16px and a browser scales the
 * vector better than we could resize a bitmap.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LEVELS, renderSvg, escapeXml } from "./badge-svg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BADGES = path.join(ROOT, "badges");
const CARDS = path.join(BADGES, "social");
const COURSE_CARD = path.join(ROOT, "labs", "_assets", "social", "course.png");
const ICON = path.join(ROOT, "site-theme", "images", "badge-mark.svg");

export const CARD = { width: 1200, height: 630 };
const FONT = "Segoe UI, Helvetica, Arial, sans-serif";

/**
 * The same badge twice in one document collides on its own ids: `field` is a
 * gradient and `body` a clip path, and the first definition wins for every copy.
 * The three badges of the course card are the case that showed it.
 */
function namespaceIds(svg, suffix) {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  let out = svg;
  for (const id of ids) {
    out = out.split(`id="${id}"`).join(`id="${id}-${suffix}"`);
    out = out.split(`url(#${id})`).join(`url(#${id}-${suffix})`);
  }
  return out;
}

/** A badge, drawn at a size and a place inside a card. */
function badgeAt(svg, { x, y, size, suffix }) {
  const inner = namespaceIds(svg, suffix)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 320 320">${inner}</svg>`;
}

/** Shrink to fit, the same rule the badge itself uses. */
const fit = (text, max, width, min = 24) =>
  Math.max(min, Math.min(max, Math.floor(width / (String(text).length * 0.55))));

const shell = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#150A33"/>
      <stop offset="100%" stop-color="#0A0620"/>
    </linearGradient>
  </defs>
  <rect width="${CARD.width}" height="${CARD.height}" fill="url(#ground)"/>
${body}
</svg>
`;

/** One learner's card: their badge, their name, the level they earned. */
export function badgeCardSvg({ record, holder }) {
  const badges = record.badges || [];
  const highest = badges.reduce((best, one) => (best === null || one.level > best.level ? one : best), null);
  const level = highest ? highest.level : 1;
  const def = LEVELS[level] || LEVELS[1];
  const badge = renderSvg({
    level,
    handle: holder.recipient || holder.key,
    fullName: holder.name,
    trailblazer: holder.trailblazer,
    date: highest ? highest.issuedOn : ""
  });
  const name = holder.name || holder.key;
  const earned = badges.length > 1 ? `${badges.length} levels earned` : "";

  return shell(`  ${badgeAt(badge, { x: 80, y: 105, size: 420, suffix: "card" })}
  <text x="560" y="215" font-family="${FONT}" font-size="26" letter-spacing="4.5" fill="#A87BFF">SALESFORCE DEVOPS</text>
  <text x="560" y="300" font-family="${FONT}" font-size="${fit(name, 68, 560, 34)}" font-weight="700" fill="#FFFFFF">${escapeXml(name)}</text>
  <text x="560" y="360" font-family="${FONT}" font-size="${fit(def.name, 40, 560, 22)}" font-weight="600" fill="${def.rim}">${escapeXml(def.name)}</text>
  <text x="560" y="412" font-family="${FONT}" font-size="22" fill="#B9B3D0">Badge, not a certification. Checked against a public repository.</text>
  <text x="560" y="470" font-family="${FONT}" font-size="22" fill="#6F6A8A">${escapeXml(earned)}</text>
  <text x="560" y="510" font-family="${FONT}" font-size="24" font-weight="700" fill="#FFFFFF">sfdx-hardis training</text>`);
}

/** The card every other page shows: the three levels of the course. */
export function courseCardSvg() {
  const levels = [1, 2, 3];
  // The same fictional learner as the three examples on the home page
  // (scripts/badges/examples.mjs), so the card and the page agree
  const badges = levels
    .map((level, index) =>
      badgeAt(
        renderSvg({ level, handle: "marc-b", fullName: "Marc B", trailblazer: "marcb", date: "2026-09-19" }),
        { x: 150 + index * 320, size: 300, y: 150, suffix: `level-${level}` }
      )
    )
    .join("\n  ");

  const names = levels
    .map((level, index) => {
      const label = LEVELS[level].name.replace(/^sfdx-hardis /, "");
      return `<text x="${300 + index * 320}" y="500" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="600" fill="#FFFFFF">${escapeXml(label)}</text>
  <text x="${300 + index * 320}" y="530" text-anchor="middle" font-family="${FONT}" font-size="20" letter-spacing="2.5" fill="${LEVELS[level].rim}">LEVEL ${level}</text>`;
    })
    .join("\n  ");

  return shell(`  <text x="600" y="86" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="700" fill="#FFFFFF">Salesforce DevOps with sfdx-hardis</text>
  <text x="600" y="124" text-anchor="middle" font-family="${FONT}" font-size="24" fill="#B9B3D0">Three free hands-on levels, from your first Pull Request to owning the pipeline</text>
  ${badges}
  ${names}
  <text x="600" y="586" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#6F6A8A">Free and open source, by Cloudity</text>`);
}

/**
 * The icon of the site: the level 3 hexagon, its gold rim, the Cloudity mark.
 *
 * Nothing else survives 16 pixels. The rim is what keeps it visible on a white
 * tab strip and on a dark one, so it is the one detail that stays, thicker than
 * on the badge because at this size a hairline disappears.
 */
export function markSvg() {
  const def = LEVELS[3];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" role="img" aria-label="sfdx-hardis training">
  <!--
    Generated by scripts/badges/social.mjs from the level 3 entry of badge-svg.mjs,
    so the day the level colours change the icon changes with them. Rewrite it
    with: node scripts/badges/social.mjs (nothing here may hold two hyphens in a
    row: this is XML, and an SVG a browser refuses to parse is a broken image in
    every tab).
  -->
  <defs>
    <linearGradient id="mark-field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${def.top}"/>
      <stop offset="100%" stop-color="${def.deep}"/>
    </linearGradient>
  </defs>
  <path d="M 295.1 216.16 Q 295.1 238 276.19 248.92 L 178.91 305.08 Q 160 316 141.09 305.08 L 43.81 248.92 Q 24.9 238 24.9 216.16 L 24.9 103.84 Q 24.9 82 43.81 71.08 L 141.09 14.92 Q 160 4 178.91 14.92 L 276.19 71.08 Q 295.1 82 295.1 103.84 Z" fill="url(#mark-field)"/>
  <path d="M 293.8 215.62 Q 293.8 237.25 275.07 248.07 L 178.73 303.69 Q 160 314.5 141.27 303.69 L 44.93 248.07 Q 26.2 237.25 26.2 215.62 L 26.2 104.38 Q 26.2 82.75 44.93 71.93 L 141.27 16.32 Q 160 5.5 178.73 16.31 L 275.07 71.93 Q 293.8 82.75 293.8 104.38 Z" fill="none" stroke="${def.rim}" stroke-width="14"/>
  <svg x="76" y="119" width="168" height="82" viewBox="0 0 112.4 54.9">
    <path fill="#FFFFFF" d="M37.34,39.85l-.32.23c-2.67,2.01-5.86,3.1-9.21,3.15-.08,0-.15,0-.23,0-8.14,0-15-6.28-15.67-14.39-.37-4.45,1.09-8.7,4.1-11.97.67-.73,1.41-1.39,2.21-1.98.79-.59,1.64-1.1,2.53-1.52s1.81-.77,2.76-1.02c.29-.08,1.27-.3,2.22-.49-.04-.08-6.64-7.4-6.79-7.59-.05-.06-.26.08-.26.07C8.68,8.18,2.04,18.16,2.78,29.2c.84,12.63,11.42,22.8,24.08,23.15,5.67.16,11.09-1.55,15.6-4.94l.21-.15c2.61-1.88,7.72-5.14,10.96-6.54-.21-.23-6.52-6.57-6.63-6.73-4.21,1.92-7.38,4.21-9.67,5.86Z"/>
    <path fill="${def.lite}" d="M109.63,26.08c-.74-13.15-11.63-23.42-24.81-23.42h-.1c-5.39.02-10.51,1.73-14.78,4.95l-.21.15c-4.08,2.93-8.7,6.26-13.29,6.26-3.06,0-6.92-1.7-11.52-5.09l-2.71-1.77-1.54-.93c-1.58-.86-3.18-1.71-4.86-2.36-1.74-.67-3.46-1.06-5.37-1.21-1.91-.15-3.57-.18-5.5.06.06.18.29.35.42.49.25.27.5.54.76.81.69.74,1.38,1.47,2.07,2.21,1.15,1.23,11.2,11.02,13.12,13.1,1.53,1.65,3.07,3.31,4.59,5,5,5.53,9.9,11.1,15.29,16.25,4.97,4.75,10.43,9.54,17.33,11.13,8.75,2.01,18.17-.57,24.37-7.13,4.75-5.02,7.14-11.59,6.75-18.49ZM100.48,28.9c-.69,8.09-7.55,14.34-15.67,14.34-.09,0-.17,0-.26,0-11.46,0-27.1-20.38-26.9-20.39,7.25-.22,12.6-4.2,17.41-7.67l.32-.23c2.74-2.06,6-3.15,9.44-3.15,4.38,0,8.6,1.86,11.58,5.1,3.01,3.28,4.46,7.55,4.08,12Z"/>
  </svg>
</svg>
`;
}

/** Every holder of a badge, as the site reads them: the record plus its key. */
export function holders() {
  if (!fs.existsSync(BADGES)) {
    return [];
  }
  return fs
    .readdirSync(BADGES)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .map((file) => {
      const key = file.replace(/\.json$/, "");
      const record = JSON.parse(fs.readFileSync(path.join(BADGES, file), "utf8"));
      const trimmed = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
      return {
        record,
        holder: {
          key,
          name: trimmed(record.name) || key,
          recipient: trimmed(record.recipient),
          trailblazer: trimmed(record.trailblazer) || key
        }
      };
    });
}

/** SVG to PNG, with the browser the verify scripts already ask for. */
async function rasterise(jobs) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error(
      [
        "playwright-core is needed to write the cards. Install it first:",
        "  npm install --no-save playwright-core",
        "  npx playwright-core install chrome"
      ].join("\n")
    );
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: CARD, deviceScaleFactor: 1 });
    for (const job of jobs) {
      const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${job.svg}`;
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForTimeout(120);
      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      await page.screenshot({ path: job.file, clip: { x: 0, y: 0, ...CARD } });
      console.log(`  ${path.relative(ROOT, job.file).split(path.sep).join("/")}`);
    }
  } finally {
    await browser.close();
  }
}

/** Writes the icon. No browser: it stays a vector. */
export function writeIcon() {
  fs.mkdirSync(path.dirname(ICON), { recursive: true });
  fs.writeFileSync(ICON, markSvg(), "utf8");
  return path.relative(ROOT, ICON).split(path.sep).join("/");
}

/** Writes the course card and one card per badge holder. */
export async function writeCards() {
  const jobs = [{ svg: courseCardSvg(), file: COURSE_CARD }];
  for (const one of holders()) {
    jobs.push({ svg: badgeCardSvg(one), file: path.join(CARDS, `${one.holder.key}.png`) });
  }
  await rasterise(jobs);
  return jobs.length;
}

/** The card of one holder, which is what a claim needs. */
export async function writeCardFor(key) {
  const one = holders().find((candidate) => candidate.holder.key === key);
  if (!one) {
    throw new Error(`No badge record for ${key}`);
  }
  await rasterise([{ svg: badgeCardSvg(one), file: path.join(CARDS, `${key}.png`) }]);
  return path.join(CARDS, `${key}.png`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  console.log(`Icon: ${writeIcon()}`);
  if (!process.argv.includes("--icon")) {
    console.log("Cards:");
    const written = await writeCards();
    console.log(`${written} card(s) written.`);
  }
}
