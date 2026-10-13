#!/usr/bin/env node
/**
 * The two banners of the home page, one pair per language.
 *
 *   node scripts/build/site-banners.mjs            # every banner, every locale
 *   node scripts/build/site-banners.mjs fr         # one locale
 *
 *   labs/_assets/brand/course-banner-<locale>.png      what the course is, at the top of the home page
 *   labs/_assets/brand/cloudity-services-<locale>.png  who offers it, and what else they do
 *   labs/_assets/brand/cloudity-services-<locale>-narrow.png  the same, stacked, for a phone
 *
 * They are drawn here rather than in a design tool so that they follow what
 * they show: the number of levels and labs comes from training-universe.json,
 * the three badges from badge-svg.mjs, the words from i18n/<locale>.json, and
 * the type is the Open Sans the site serves. A locale added to i18n/ gets its
 * banners by re-running this.
 *
 * Each one is a small HTML page, laid out by the browser the verify scripts
 * already use and captured at twice its size, so it stays sharp on a dense
 * screen. The files are committed, like the badge cards: the site build stays a
 * matter of files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderSvg } from "../badges/badge-svg.mjs";
import { strings, fill } from "../lib/strings.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "labs", "_assets", "brand");
const THEME = path.join(ROOT, "site-theme");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));

export const COURSE_BANNER = { width: 1200, height: 340 };
export const SERVICES_BANNER = { width: 1200, height: 260 };
// A wide banner on a phone is a strip of text nobody can read, so the page swaps it for this one
export const SERVICES_BANNER_NARROW = { width: 600, height: 372 };

/** Every locale the generated pages are written in. */
export function bannerLocales() {
  return fs
    .readdirSync(path.join(ROOT, "i18n"))
    .filter((name) => /^[a-z]{2}(-[A-Z]{2})?\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ""))
    .sort((one, other) => (one === "en" ? -1 : other === "en" ? 1 : one.localeCompare(other)));
}

/** What the course banner shows of a locale, the figures filled in. */
export function courseBannerHtml(locale) {
  const words = strings(locale).banners.course;
  const figures = {
    levels: universe.levels.length,
    labs: universe.levels.reduce((total, level) => total + level.labs.length, 0)
  };
  // The same fictional learner as the three examples lower on the home page
  const badges = universe.levels
    .map((level) =>
      svgImage(renderSvg({ level: level.level, handle: "marc-b", fullName: "Marc B", trailblazer: "marcb", date: "2026-09-19" }), "badge")
    )
    .join("");
  const chips = words.chips.map((chip) => `<span class="chip">${escapeHtml(fill(chip, figures))}</span>`).join("");

  return page(
    COURSE_BANNER,
    `
    .banner { background: linear-gradient(105deg, #7A2BFF 0%, #660FF2 34%, #3D078F 100%); }
    .ring { position: absolute; left: 596px; top: -215px; width: 770px; height: 770px; border-radius: 50%; background: #0053FF; }
    .disc { position: absolute; left: 632px; top: -179px; width: 698px; height: 698px; border-radius: 50%;
            background: radial-gradient(circle at 40% 45%, #1B0A3F 0%, #0A0620 72%); }
    .words { position: absolute; left: 52px; top: 0; bottom: 0; width: 540px; display: flex; flex-direction: column; justify-content: center; }
    .eyebrow { font-size: 18px; font-weight: 700; letter-spacing: 3.2px; color: #D9C7FF; }
    .title { margin-top: 12px; font-size: 54px; font-weight: 800; line-height: 1.08; letter-spacing: -0.8px; }
    .title span { display: block; font-weight: 300; }
    .subtitle { margin-top: 14px; font-size: 19px; color: #EDE3FF; }
    .chips { margin-top: 20px; display: flex; gap: 8px; }
    .chip { padding: 5px 13px 6px; border-radius: 999px; font-size: 17px; font-weight: 600; white-space: nowrap;
            background: rgb(255 255 255 / 16%); border: 1px solid rgb(255 255 255 / 34%); }
    .badges { position: absolute; left: 664px; top: 92px; display: flex; gap: 2px; }
    .badge { width: 172px; height: 172px; filter: drop-shadow(0 8px 14px rgb(0 0 0 / 45%)); }
    .badge:nth-child(2) { margin-top: -22px; }
    .offered { position: absolute; right: 30px; bottom: 20px; display: flex; align-items: center; gap: 10px;
               font-size: 16px; color: #C9BEE6; }
    .offered img { height: 34px; }
    `,
    `
    <div class="ring"></div>
    <div class="disc"></div>
    <div class="words">
      <div class="eyebrow">${escapeHtml(words.eyebrow)}</div>
      <div class="title">${escapeHtml(words.title)}<span>${escapeHtml(words.titleLight)}</span></div>
      <div class="subtitle">${escapeHtml(words.subtitle)}</div>
      <div class="chips">${chips}</div>
    </div>
    <div class="badges">${badges}</div>
    <div class="offered">${escapeHtml(words.offeredBy)} ${cloudityLogo()}</div>
    `
  );
}

/** Who offers the course, and the practices a reader may not know they have. */
export function servicesBannerHtml(locale) {
  const words = strings(locale).banners.services;
  const columns = words.practices
    .map((column) => `<div class="column">${column.map((one) => `<div>${escapeHtml(one)}</div>`).join("")}</div>`)
    .join("");

  return page(
    SERVICES_BANNER,
    `
    .banner { background: linear-gradient(100deg, #660FF2 0%, #5A1CF0 42%, #0053FF 100%); }
    .arc { position: absolute; left: 968px; top: -330px; width: 760px; height: 760px; border-radius: 50%;
           border: 46px solid #0A0620; box-sizing: border-box; }
    .who { position: absolute; left: 48px; top: 0; bottom: 0; width: 268px; display: flex; flex-direction: column; justify-content: center; }
    .eyebrow { font-size: 17px; white-space: nowrap; color: #E3D6FF; }
    .who img { margin-top: 10px; width: 236px; }
    .tagline { margin-top: 6px; font-size: 15px; font-weight: 600; letter-spacing: 2.4px; text-transform: uppercase; color: #E3D6FF; }
    .practices { position: absolute; left: 338px; top: 0; bottom: 0; display: flex; align-items: center; }
    .column { padding: 2px 24px; border-left: 2px solid rgb(255 255 255 / 55%); font-size: 25px; font-weight: 800; line-height: 1.5;
              min-height: 112px; white-space: nowrap; }
    .button { position: absolute; left: 868px; top: 152px; padding: 9px 18px 10px; background: #0A0620;
              border-bottom: 4px solid #FFFFFF; font-size: 17px; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
    `,
    `
    <div class="arc"></div>
    <div class="who">
      <div class="eyebrow">${escapeHtml(words.eyebrow)}</div>
      ${cloudityLogo()}
      <div class="tagline">${escapeHtml(words.tagline)}</div>
    </div>
    <div class="practices">${columns}</div>
    <div class="button">${escapeHtml(words.button)}</div>
    `
  );
}

/** The same banner for a narrow screen: who on top, the practices in two columns under it. */
export function servicesBannerNarrowHtml(locale) {
  const words = strings(locale).banners.services;
  const all = words.practices.flat();
  const half = Math.ceil(all.length / 2);
  const columns = [all.slice(0, half), all.slice(half)]
    .map((column) => `<div class="column">${column.map((one) => `<div>${escapeHtml(one)}</div>`).join("")}</div>`)
    .join("");

  return page(
    SERVICES_BANNER_NARROW,
    `
    .banner { background: linear-gradient(120deg, #660FF2 0%, #5A1CF0 45%, #0053FF 100%); }
    .arc { position: absolute; left: 370px; top: -420px; width: 620px; height: 620px; border-radius: 50%;
           border: 40px solid #0A0620; box-sizing: border-box; }
    .who { position: absolute; left: 32px; top: 28px; }
    .eyebrow { font-size: 17px; color: #E3D6FF; }
    .who img { display: block; margin-top: 8px; width: 210px; }
    .tagline { margin-top: 4px; font-size: 14px; font-weight: 600; letter-spacing: 2.2px; text-transform: uppercase; color: #E3D6FF; }
    .practices { position: absolute; left: 32px; top: 158px; display: flex; gap: 26px; }
    .column { padding: 0 0 0 16px; border-left: 2px solid rgb(255 255 255 / 55%); font-size: 23px; font-weight: 800; line-height: 1.42;
              white-space: nowrap; }
    .button { position: absolute; left: 32px; bottom: 26px; padding: 8px 16px 9px; background: #0A0620;
              border-bottom: 4px solid #FFFFFF; font-size: 16px; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
    `,
    `
    <div class="arc"></div>
    <div class="who">
      <div class="eyebrow">${escapeHtml(words.eyebrow)}</div>
      ${cloudityLogo()}
      <div class="tagline">${escapeHtml(words.tagline)}</div>
    </div>
    <div class="practices">${columns}</div>
    <div class="button">${escapeHtml(words.button)}</div>
    `
  );
}

/** Writes the banners of the locales asked for, every one of them by default. */
export async function writeBanners(locales = bannerLocales()) {
  const jobs = [];
  for (const locale of locales) {
    jobs.push({ html: courseBannerHtml(locale), size: COURSE_BANNER, file: path.join(OUT, `course-banner-${locale}.png`) });
    jobs.push({ html: servicesBannerHtml(locale), size: SERVICES_BANNER, file: path.join(OUT, `cloudity-services-${locale}.png`) });
    jobs.push({
      html: servicesBannerNarrowHtml(locale),
      size: SERVICES_BANNER_NARROW,
      file: path.join(OUT, `cloudity-services-${locale}-narrow.png`)
    });
  }
  await rasterise(jobs);
  return jobs.length;
}

const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dataUri = (mime, buffer) => `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;

/** An SVG as a picture of its own, so two badges never share a gradient id. */
const svgImage = (svg, className) => `<img class="${className}" alt="" src="${dataUri("image/svg+xml", svg)}">`;

/** The white Cloudity wordmark the header of the site already shows. */
const cloudityLogo = () =>
  svgImage(fs.readFileSync(path.join(THEME, "images", "cloudity-text-logo-white.svg"), "utf8"), "cloudity");

/** One banner as a page: the site font embedded, everything else inline. */
function page(size, css, body) {
  const font = dataUri("font/woff2", fs.readFileSync(path.join(THEME, "stylesheets", "fonts", "open-sans-latin.woff2")));
  return `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: "Open Sans"; font-weight: 300 800; src: url("${font}") format("woff2"); }
  html, body { margin: 0; padding: 0; }
  .banner { position: relative; overflow: hidden; width: ${size.width}px; height: ${size.height}px;
            font-family: "Open Sans", sans-serif; color: #FFFFFF; }
  ${css}
</style>
<div class="banner">${body}</div>
`;
}

/** HTML to PNG, at twice the size, with the browser the verify scripts already ask for. */
async function rasterise(jobs) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error(
      [
        "playwright-core is needed to write the banners. Install it first:",
        "  npm install --no-save playwright-core",
        "  npx playwright-core install chrome"
      ].join("\n")
    );
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const tab = await browser.newPage({ viewport: COURSE_BANNER, deviceScaleFactor: 2 });
    for (const job of jobs) {
      await tab.setViewportSize(job.size);
      await tab.setContent(job.html, { waitUntil: "load" });
      await tab.evaluate(() => document.fonts.ready);
      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      await tab.screenshot({ path: job.file, clip: { x: 0, y: 0, ...job.size } });
      console.log(`  ${path.relative(ROOT, job.file).split(path.sep).join("/")}`);
    }
  } finally {
    await browser.close();
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const asked = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  console.log("Banners:");
  const written = await writeBanners(asked.length > 0 ? asked : undefined);
  console.log(`${written} banner(s) written.`);
}
