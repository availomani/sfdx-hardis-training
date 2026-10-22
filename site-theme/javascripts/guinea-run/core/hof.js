/*
 * The Hall of Fame: who leads, world by world and overall.
 *
 * The board is hall-of-fame/hall-of-fame.json at the root of the training
 * repository. The game reads it from GitHub (fresh within minutes), then from
 * the site's own copy, and shows an empty board if neither answers: the game
 * never waits for it.
 *
 * A player sends their scores through a GitHub issue the game fills in. The
 * hall-of-fame workflow checks it and writes the board. The rankings below are
 * also what that workflow and the site page use, so all three agree.
 */
import { TALLY_SET, seal } from "./tally.js";

export const REPOSITORY = "hardisgroupcom/sfdx-hardis-training";
export const BOARD_URL = "https://raw.githubusercontent.com/" + REPOSITORY + "/main/hall-of-fame/hall-of-fame.json";
// Written into every result, so a board entry says which game earned it
export const GAME_VERSION = "2026.10.22";
// Best scores saved before results were signed count until this day (UTC), under a lower cap
export const LEGACY_UNTIL = "2026-12-31";
export const WORLD_COUNT = 10;
// The title of a score issue starts with it: the workflow also knows an issue by it, when the label is missing
export const ISSUE_PREFIX = "[Guinea Run] ";
const HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** Whether a text is a possible GitHub handle. */
export function isHandle(text) {
  return HANDLE.test(String(text || ""));
}

/** Whether results without a signature may still be sent at this time. */
export function legacyOpen(now) {
  return now < Date.parse(LEGACY_UNTIL + "T23:59:59Z");
}

/** The players of the overall board, best first: total, then stars, then who sent first (their first time). */
export function rankGeneral(board) {
  return players(board)
    .map((p) => ({ handle: p.handle, badge: p.badge || 0, total: p.total || 0, stars: p.stars || 0, submittedAt: p.firstSubmittedAt || p.submittedAt || "" }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || b.stars - a.stars || a.submittedAt.localeCompare(b.submittedAt));
}

/** The players of one world, best first: score, then stars, then the fastest boss, then who got there first. */
export function rankWorld(board, w) {
  const slow = Number.MAX_SAFE_INTEGER;
  return players(board)
    .filter((p) => p.worlds && p.worlds[w] && p.worlds[w].score > 0)
    .map((p) => {
      const e = p.worlds[w];
      return { handle: p.handle, badge: p.badge || 0, score: e.score, stars: e.stars || 0, bossMs: typeof e.bossMs === "number" ? e.bossMs : null, mode: e.mode || "easy", at: e.at || "" };
    })
    .sort((a, b) => b.score - a.score || b.stars - a.stars || (a.bossMs ?? slow) - (b.bossMs ?? slow) || a.at.localeCompare(b.at));
}

/** The rank (1-based) of a handle in a ranked list, or 0. */
export function rankOf(list, handle) {
  const key = String(handle || "").toLowerCase();
  const i = list.findIndex((p) => p.handle.toLowerCase() === key);
  return i + 1;
}

/** The avatar GitHub serves for a handle. */
export function avatarUrl(handle, size) {
  return "https://github.com/" + encodeURIComponent(handle) + ".png?size=" + (size || 48);
}

/** Reads the board: GitHub first, then the site's copy. Never throws: an empty board at worst. */
export async function loadBoard(siteRoot) {
  const minute = Math.floor(Date.now() / 60000);
  for (const url of [BOARD_URL + "?m=" + minute, siteRoot ? new URL("hall-of-fame/hall-of-fame.json", siteRoot).href : null]) {
    if (!url) {
      continue;
    }
    try {
      const board = await fetchJson(url, 4000);
      if (board && board.players) {
        return { board, ok: true };
      }
    } catch {
      // The next source, or the empty board
    }
  }
  return { board: { players: {} }, ok: false };
}

/**
 * What the player can send: their signed results, and before LEGACY_UNTIL the
 * best scores of worlds finished before results were signed.
 * progress: the progress store. Returns the results, possibly empty.
 */
export function collectResults(progress, now) {
  const results = [];
  for (let w = 0; w < WORLD_COUNT; w++) {
    const e = progress.world(w);
    if (!(e.best > 0)) {
      continue;
    }
    if (e.record && e.record.sg) {
      results.push(e.record);
    } else if (!e.record && legacyOpen(now)) {
      results.push({ w, sc: e.best, st: e.stars, legacy: true });
    }
  }
  return results;
}

/** The address of the new issue that carries the results, signed for this handle and this hour. */
export async function submissionUrl(handle, results, now) {
  const submission = { f: 1, h: handle, hr: Math.floor(now / 3600000), k: TALLY_SET, r: results };
  submission.sg = await seal(submission);
  const scores = JSON.stringify(submission);
  // The form fills its field from "scores". The GitHub mobile app ignores
  // forms and opens a plain issue with the title and the body: the body holds
  // the same text the form writes, so the workflow reads either one.
  const query = new URLSearchParams({
    template: "guinea-run-score.yml",
    title: ISSUE_PREFIX + handle,
    scores,
    body: "### Scores\n\n```json\n" + scores + "\n```\n"
  });
  return "https://github.com/" + REPOSITORY + "/issues/new?" + query.toString();
}

function players(board) {
  const banned = new Set(((board && board.banned) || []).map((h) => String(h).toLowerCase()));
  return Object.values((board && board.players) || {}).filter((p) => p && p.handle && !banned.has(p.handle.toLowerCase()));
}

async function fetchJson(url, ms) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller ? controller.signal : undefined });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
