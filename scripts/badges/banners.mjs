#!/usr/bin/env node
/**
 * The banner badges: one file per level, and the URL of it in every record.
 *
 *   node scripts/badges/banners.mjs
 *
 * The Trailhead Banner project draws a row of badges from what a record says, at
 * about fifty pixels each. The full badge is unreadable there: it carries a
 * name, a GitHub handle, a Trailblazer id and a date, none of which survives.
 * This is the second version, with the Cloudity mark, sfdx-hardis and two
 * letters for the level.
 *
 * Nothing in it is personal, so there are three files and not three per learner:
 *
 *   badges/img/banner-level-1.svg   C1
 *   badges/img/banner-level-2.svg   C2
 *   badges/img/banner-level-3.svg   RM
 *
 * Each badge of each record then points at the one for its level, under
 * `bannerImage`, next to the `image` that is the full badge. That key is what the
 * banner project reads; renaming it is a breaking change for whoever consumes it.
 *
 * Run after any change to badges/_template-banner.svg or to the LEVELS colours,
 * together with scripts/badges/rerender.mjs, which calls it for you.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LEVELS, renderBannerSvg } from "./badge-svg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BADGES = path.join(ROOT, "badges");
const IMG = path.join(BADGES, "img");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
const SITE = universe.course.site;

/** Where the banner version of a level is published. */
export const bannerUrl = (level) => `${SITE}/badges/img/banner-level-${level}.svg`;

/** The file itself, one per level, rewritten from the template. */
export function writeBanners() {
  fs.mkdirSync(IMG, { recursive: true });
  const written = [];
  for (const level of Object.keys(LEVELS)) {
    const file = path.join(IMG, `banner-level-${level}.svg`);
    fs.writeFileSync(file, renderBannerSvg(Number(level)), "utf8");
    written.push(path.relative(ROOT, file).split(path.sep).join("/"));
  }
  return written;
}

/**
 * The URL in every record that does not carry it yet.
 *
 * A badge awarded before this existed gains the key here rather than needing a
 * new claim, and a record that already has it is left alone, so running this
 * twice changes nothing. The superbadge flag is filled in the same way: it says
 * which award is earned on top of the others, and a banner draws those apart.
 */
export function stampRecords() {
  if (!fs.existsSync(BADGES)) {
    return [];
  }
  const touched = [];
  for (const file of fs.readdirSync(BADGES)) {
    if (!file.endsWith(".json") || file.startsWith("_")) {
      continue;
    }
    const full = path.join(BADGES, file);
    const record = JSON.parse(fs.readFileSync(full, "utf8"));
    let changed = false;
    for (const badge of record.badges || []) {
      const url = bannerUrl(badge.level);
      if (badge.bannerImage !== url) {
        badge.bannerImage = url;
        changed = true;
      }
      const superbadge = (LEVELS[badge.level] || {}).superbadge === true;
      if (badge.superbadge !== superbadge) {
        badge.superbadge = superbadge;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(full, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      touched.push(`badges/${file}`);
    }
  }
  return touched;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  for (const file of writeBanners()) {
    console.log(`  ${file}`);
  }
  const touched = stampRecords();
  console.log(`${Object.keys(LEVELS).length} banner badge(s) written, ${touched.length} record(s) updated.`);
  touched.forEach((one) => console.log(`  ${one}`));
}
