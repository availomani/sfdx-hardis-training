#!/usr/bin/env node
/**
 * Verifies a Guinea Run score submission, sent as a GitHub issue the game fills in.
 *
 * Every field of the issue is untrusted input. The workflow passes it through the
 * environment and never interpolates it into a shell command.
 *
 * Reads: ISSUE_BODY, ISSUE_AUTHOR, ISSUE_CREATED_AT, GUINEA_RUN_KEYS,
 *        GUINEA_RUN_LIMITS, and optionally ISSUE_NUMBER, BOARD_FILE, SUBMISSION_FILE
 * Writes on stdout, for $GITHUB_OUTPUT: valid=true|false, reason=<short code>
 * Writes SUBMISSION_FILE (default /tmp/submission.json) when the submission is valid.
 *
 * The reason is a short code for the maintainers, in the job log. The player is
 * only told the submission could not be verified. The limits are secret on
 * purpose: they are never printed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { recordText, submissionText, hmac } from "../../site-theme/javascripts/guinea-run/core/tally.js";
import { isHandle, LEGACY_UNTIL, WORLD_COUNT } from "../../site-theme/javascripts/guinea-run/core/hof.js";
import { MODES } from "../../site-theme/javascripts/guinea-run/core/story.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIELD_LABEL = "Scores";
export const MAX_FIELD_BYTES = 16 * 1024;
export const DEFAULT_LIMITS = { cap: 20000, legacyCap: 6000, minBossMs: 0, rateMinutes: 10 };
const HOUR = 3600000;

/** The value of one issue form field, addressed by its heading, without a code fence. */
export function extractField(body, label) {
  // Cut on the "### " headings, as scripts/badges/parse-claim.mjs does
  const section = String(body || "")
    .split(/^###\s+/m)
    .find((part) => part.split(/\r?\n/)[0].trim().toLowerCase() === label.toLowerCase());
  if (section === undefined) {
    return "";
  }
  let value = section.split(/\r?\n/).slice(1).join("\n").trim();
  const fence = /^```[a-z]*\s*\n([\s\S]*?)\n?```$/i.exec(value);
  if (fence) {
    value = fence[1].trim();
  }
  return value === "_No response_" ? "" : value;
}

/** The signing keys, { id: key bytes }, from the GUINEA_RUN_KEYS secret. */
export function parseKeys(text) {
  const keys = {};
  if (!text || !String(text).trim()) {
    return keys;
  }
  const raw = JSON.parse(text);
  for (const [id, value] of Object.entries(raw || {})) {
    const bytes = Buffer.from(String(value), "base64");
    if (bytes.length > 0) {
      keys[String(id)] = bytes;
    }
  }
  return keys;
}

/**
 * The limits, from the GUINEA_RUN_LIMITS secret, completed with the built-in
 * fallbacks. warn is called (without the values) when the secret is missing or unreadable.
 */
export function parseLimits(text, warn = () => {}) {
  let raw = null;
  if (text && String(text).trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      warn("GUINEA_RUN_LIMITS is not readable JSON: the built-in fallback limits apply.");
    }
  } else {
    warn("GUINEA_RUN_LIMITS is empty: the built-in fallback limits apply.");
  }
  raw = raw && typeof raw === "object" ? raw : {};
  const perWorld = (table, fallback) => {
    const out = [];
    for (let w = 0; w < WORLD_COUNT; w++) {
      const value = table && table[String(w)];
      out.push(Number.isFinite(value) ? value : fallback);
    }
    return out;
  };
  return {
    caps: perWorld(raw.caps, DEFAULT_LIMITS.cap),
    legacyCaps: perWorld(raw.legacyCaps, DEFAULT_LIMITS.legacyCap),
    minBossMs: perWorld(raw.minBossMs, DEFAULT_LIMITS.minBossMs),
    rateMinutes: Number.isFinite(raw.rateMinutes) ? raw.rateMinutes : DEFAULT_LIMITS.rateMinutes
  };
}

/**
 * Checks a submission. Returns { valid: true, submission } with the accepted
 * results normalized, or { valid: false, reason }.
 *
 * keys: from parseKeys. limits: from parseLimits. board: the Hall of Fame board.
 * issueNumber: an issue already applied to the board is not rate limited again.
 */
export async function verifySubmission({ body, author, createdAt, keys, limits, board, issueNumber }) {
  const refuse = (reason) => ({ valid: false, reason });
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) {
    return refuse("bad-issue-date");
  }

  // The field, its size and its shape
  const text = extractField(body, FIELD_LABEL);
  if (!text) {
    return refuse("no-field");
  }
  if (Buffer.byteLength(text, "utf8") >= MAX_FIELD_BYTES) {
    return refuse("too-large");
  }
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    return refuse("bad-json");
  }
  if (!s || typeof s !== "object" || Array.isArray(s) || s.f !== 1 || !Array.isArray(s.r) || typeof s.sg !== "string") {
    return refuse("bad-format");
  }

  // Who sends it
  if (typeof s.h !== "string" || !isHandle(s.h) || s.h.toLowerCase() !== String(author || "").toLowerCase()) {
    return refuse("handle-mismatch");
  }
  const handleKey = s.h.toLowerCase();
  const banned = new Set(((board && board.banned) || []).map((h) => String(h).toLowerCase()));
  if (banned.has(handleKey)) {
    return refuse("banned");
  }

  // When it was signed: the hour of the issue, give or take one
  const issueHour = Math.floor(created / HOUR);
  if (!Number.isInteger(s.hr) || s.hr < issueHour - 1 || s.hr > issueHour + 1) {
    return refuse("stale-hour");
  }

  // The seal of the whole submission
  const sealKey = keys[String(s.k)];
  if (!Number.isInteger(s.k) || !sealKey) {
    return refuse("unknown-key");
  }
  if (!sameText(await hmac(sealKey, submissionText(s)), s.sg)) {
    // Signed as the game did before the s2 format: the page runs an old copy
    // of the game (a tab left open, a cached file). Refused all the same, the
    // old format let the unsigned scores be edited, but the player is told why.
    return refuse(sameText(await hmac(sealKey, oldSubmissionText(s)), s.sg) ? "old-game" : "bad-seal");
  }

  // Each result
  const seen = new Set();
  const results = [];
  const legacyEnd = Date.parse(LEGACY_UNTIL + "T23:59:59.999Z");
  for (const r of s.r) {
    if (!r || typeof r !== "object") {
      return refuse("bad-result");
    }
    if (!Number.isInteger(r.w) || r.w < 0 || r.w >= WORLD_COUNT) {
      return refuse("bad-world");
    }
    if (seen.has(r.w)) {
      return refuse("duplicate-world");
    }
    seen.add(r.w);
    if (!Number.isInteger(r.st) || r.st < 1 || r.st > 3) {
      return refuse("bad-stars");
    }
    if (!Number.isInteger(r.sc) || r.sc < 0) {
      return refuse("bad-score");
    }
    if (r.legacy === true) {
      if (r.sc > limits.legacyCaps[r.w]) {
        return refuse("legacy-over-cap");
      }
      if (created > legacyEnd) {
        return refuse("legacy-closed");
      }
      results.push({ w: r.w, score: r.sc, stars: r.st, bossMs: null, mode: "easy", legacy: true, at: new Date(created).toISOString() });
      continue;
    }
    const resultKey = keys[String(r.k)];
    if (!Number.isInteger(r.k) || !resultKey) {
      return refuse("unknown-result-key");
    }
    if (typeof r.sg !== "string" || !sameText(await hmac(resultKey, recordText(r)), r.sg)) {
      return refuse("bad-result-signature");
    }
    if (!MODES.some((m) => m.id === r.m)) {
      return refuse("bad-mode");
    }
    if (r.sc > limits.caps[r.w]) {
      return refuse("over-cap");
    }
    if (r.bm !== null && r.bm !== undefined && (!Number.isInteger(r.bm) || r.bm < limits.minBossMs[r.w])) {
      return refuse("boss-too-fast");
    }
    // A result is played before it is sent: one dated after the issue, by more than the clock drift, is not
    if (!Number.isInteger(r.at) || r.at <= 0 || r.at > created + HOUR) {
      return refuse("bad-result-date");
    }
    results.push({
      w: r.w,
      score: r.sc,
      stars: r.st,
      bossMs: Number.isInteger(r.bm) ? r.bm : null,
      mode: r.m,
      legacy: false,
      at: new Date(r.at).toISOString()
    });
  }
  if (results.length === 0) {
    return refuse("no-results");
  }

  // One submission every few minutes per player
  const previous = board && board.players && board.players[handleKey];
  if (previous && previous.submittedAt && Number(previous.issue) !== Number(issueNumber)) {
    const last = Date.parse(previous.submittedAt);
    if (Number.isFinite(last) && created - last < limits.rateMinutes * 60000) {
      return refuse("rate-limited");
    }
  }

  return { valid: true, submission: { handle: String(author), results: results.sort((a, b) => a.w - b.w) } };
}

/** Compares two signatures in constant time. */
/** The submission text of the game before the s2 format, only to recognize an old game. */
function oldSubmissionText(s) {
  const sigs = (s.r || []).filter((r) => r && r.sg).map((r) => r.sg).sort();
  return ["s1", String(s.h).toLowerCase(), s.hr, s.k, sigs.join(",")].join("|");
}

function sameText(a, b) {
  const one = Buffer.from(String(a), "utf8");
  const other = Buffer.from(String(b), "utf8");
  return one.length === other.length && crypto.timingSafeEqual(one, other);
}

async function main() {
  const out = (valid, reason) => {
    console.log(`valid=${valid}`);
    console.log(`reason=${reason}`);
  };
  const boardFile = process.env.BOARD_FILE || path.join(ROOT, "hall-of-fame", "hall-of-fame.json");
  let board = { players: {}, banned: [] };
  try {
    board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
  } catch (error) {
    console.error(`The board could not be read, checking against an empty one: ${error.message}`);
  }
  let keys;
  try {
    keys = parseKeys(process.env.GUINEA_RUN_KEYS);
  } catch {
    console.error("GUINEA_RUN_KEYS is not readable JSON.");
    out(false, "bad-keys");
    return;
  }
  const limits = parseLimits(process.env.GUINEA_RUN_LIMITS, (message) => console.error(`::warning::${message}`));
  const result = await verifySubmission({
    body: process.env.ISSUE_BODY,
    author: (process.env.ISSUE_AUTHOR || "").trim(),
    createdAt: process.env.ISSUE_CREATED_AT,
    keys,
    limits,
    board,
    issueNumber: process.env.ISSUE_NUMBER
  });
  if (!result.valid) {
    console.error(`Submission refused: ${result.reason}`);
    out(false, result.reason);
    return;
  }
  const file = process.env.SUBMISSION_FILE || "/tmp/submission.json";
  fs.writeFileSync(file, JSON.stringify(result.submission, null, 2) + "\n", "utf8");
  console.error(`Submission accepted: ${result.submission.results.length} result(s).`);
  out(true, "ok");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
