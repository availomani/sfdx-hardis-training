/**
 * The words of the generated pages, per locale.
 *
 * The labs are plain markdown, one folder per language, and need nothing from
 * here. The backlog, the story pages and the badge pages are built from
 * training-universe.json and the badge records, so their words live in
 * i18n/<locale>.json instead, and a locale is that one file translated.
 *
 * English is the reference twice over: i18n/en.json holds the page words, and
 * training-universe.json holds the fiction, in English. A locale file carries
 * the translation of both, the second under "universe", and anything it does not
 * translate falls back to English rather than disappearing from the page.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const I18N = path.join(ROOT, "i18n");

const cache = new Map();

function read(locale) {
  const file = path.join(I18N, `${locale}.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The locale's value where it has one, the English one everywhere else. */
function merge(english, translated) {
  if (translated === undefined || translated === null) {
    return english;
  }
  if (Array.isArray(english) || typeof english !== "object" || english === null) {
    return translated;
  }
  const out = { ...english };
  for (const key of Object.keys(english)) {
    out[key] = merge(english[key], translated[key]);
  }
  // Keys a locale adds on its own, "universe" for one, are kept as they are
  for (const key of Object.keys(translated)) {
    if (!(key in out)) {
      out[key] = translated[key];
    }
  }
  return out;
}

/** The words of the generated pages for this locale, English underneath. */
export function strings(locale) {
  if (cache.has(locale)) {
    return cache.get(locale);
  }
  const english = read("en");
  if (!english) {
    throw new Error("i18n/en.json is missing: it is the reference every locale falls back to");
  }
  const merged = locale === "en" ? english : merge(english, read(locale) || {});
  cache.set(locale, merged);
  return merged;
}

/**
 * The fiction, in this locale: a story, a role, a level name, the pitch.
 *
 * training-universe.json writes them in English, and a locale translates them
 * under "universe" in its own file. An untranslated one reads in English, which
 * is a page somebody can still use.
 */
export function universeText(locale, universe) {
  const translated = (strings(locale).universe || {});
  return {
    pitch: () => (translated.company && translated.company.pitch) || universe.company.pitch,
    level: (level) => ((translated.levels || {})[String(level.level)]) || level.name,
    role: (person) => {
      const one = (translated.cast || {})[person.handle];
      return (one && (typeof one === "string" ? one : one.role)) || person.role;
    },
    // "You" is a character of the fiction like the others, and it is a word
    name: (person) => {
      const one = (translated.cast || {})[person.handle];
      return (one && typeof one === "object" && one.name) || person.name;
    },
    story: (story) => {
      const one = (translated.stories || {})[story.id] || {};
      return {
        title: one.title || story.title,
        story: one.story || story.story,
        acceptance: Array.isArray(one.acceptance) && one.acceptance.length === story.acceptance.length
          ? one.acceptance
          : story.acceptance
      };
    }
  };
}

/** "Lab {level}.{lab} - {title}" and friends: the placeholders a string declares. */
export function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
}
