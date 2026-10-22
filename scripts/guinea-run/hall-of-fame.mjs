#!/usr/bin/env node
/**
 * Writes the Guinea Run Hall of Fame board, hall-of-fame/hall-of-fame.json.
 *
 *   node scripts/guinea-run/hall-of-fame.mjs apply <submission.json> --issue <n> --author <login> --at <iso>
 *   node scripts/guinea-run/hall-of-fame.mjs refresh-badges
 *   node scripts/guinea-run/hall-of-fame.mjs remove <handle>
 *   node scripts/guinea-run/hall-of-fame.mjs ban <handle>
 *
 * apply merges a submission that scripts/guinea-run/verify-submission.mjs
 * accepted: each world keeps the best of what was stored and what was sent, so
 * sending lower scores never lowers a board entry. It also writes the message
 * the workflow posts to the player, with their ranks (RANKS_FILE, default
 * /tmp/ranks.md).
 *
 * The rankings come from site-theme/javascripts/guinea-run/core/hof.js, which
 * the game and the site page use too.
 *
 * Env: BOARD_FILE and BADGES_DIR override the board and the badges folder.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rankGeneral, rankWorld, rankOf, isHandle, WORLD_COUNT } from "../../site-theme/javascripts/guinea-run/core/hof.js";
import { translator } from "../../site-theme/javascripts/guinea-run/texts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PAGE_URL = "https://sfdx-hardis-training.cloudity.com/hall-of-fame/";

/** A board with nobody on it. */
export function emptyBoard() {
  return { version: 1, updatedAt: null, banned: [], players: {} };
}

/**
 * Merges an accepted submission into the board, in place, and returns the entry.
 * submission: { handle, results: [{ w, score, stars, bossMs, legacy, at }] }
 */
export function mergeSubmission(board, submission, { issue, author, at, badge }) {
  const key = String(author).toLowerCase();
  if (String(submission.handle).toLowerCase() !== key) {
    throw new Error("The submission is not from the author of the issue.");
  }
  board.players = board.players || {};
  const entry = board.players[key] || { handle: author, badge: 0, firstSubmittedAt: null, submittedAt: null, issue: null, worlds: {}, total: 0, stars: 0 };
  entry.handle = author;
  entry.worlds = entry.worlds || {};
  for (const r of submission.results) {
    const next = { score: r.score, stars: r.stars, bossMs: r.bossMs ?? null, mode: r.mode || "easy", legacy: r.legacy === true, at: r.at };
    const stored = entry.worlds[String(r.w)];
    if (!stored || better(next, stored)) {
      entry.worlds[String(r.w)] = next;
    }
  }
  entry.badge = badge || 0;
  // The first one breaks ties on the general board: sending again never costs a place
  entry.firstSubmittedAt = entry.firstSubmittedAt || entry.submittedAt || at;
  entry.submittedAt = at;
  entry.issue = Number(issue);
  totals(entry);
  board.players[key] = entry;
  board.updatedAt = at;
  return entry;
}

/** The highest badge level a GitHub handle holds, read from badges/*.json. */
export function badgeLevel(badgesDir, handle) {
  return badgeLevels(badgesDir).get(String(handle).toLowerCase()) || 0;
}

/** The badge of every player, from badges/*.json. Returns whether anything changed. */
export function refreshBadges(board, badgesDir, at) {
  const levels = badgeLevels(badgesDir);
  let changed = false;
  for (const [key, entry] of Object.entries(board.players || {})) {
    const level = levels.get(key) || 0;
    if ((entry.badge || 0) !== level) {
      entry.badge = level;
      changed = true;
    }
  }
  if (changed) {
    board.updatedAt = at;
  }
  return changed;
}

/** Takes a player off the board. Returns whether they were on it. */
export function removePlayer(board, handle) {
  const key = String(handle).toLowerCase();
  const found = Boolean(board.players && board.players[key]);
  if (found) {
    delete board.players[key];
  }
  return found;
}

/** Takes a player off the board and refuses their next submissions. */
export function banPlayer(board, handle) {
  const key = String(handle).toLowerCase();
  board.banned = board.banned || [];
  if (!board.banned.map((h) => String(h).toLowerCase()).includes(key)) {
    board.banned.push(key);
  }
  removePlayer(board, key);
}

/** The message posted to the player: their overall rank, then world by world. */
export function ranksMessage(board, handle) {
  const t = translator("en");
  const general = rankGeneral(board);
  const entry = board.players[String(handle).toLowerCase()];
  const rank = rankOf(general, handle);
  const lines = ["## You are in the Hall of Fame", ""];
  if (rank > 0) {
    lines.push(`You are **#${rank}** of ${general.length} overall, with ${entry.total} points and ${entry.stars} stars.`);
  } else {
    lines.push("Your scores are saved. Score points in a world to appear in the overall ranking.");
  }
  lines.push("", "| World | Your best score | Your rank |", "|---|---|---|");
  for (let w = 0; w < WORLD_COUNT; w++) {
    const one = entry.worlds[String(w)];
    if (!one) {
      continue;
    }
    const list = rankWorld(board, w);
    const place = rankOf(list, handle);
    lines.push(`| ${w + 1}. ${t(`w${w}_name`)} | ${one.score} | ${place > 0 ? `#${place} of ${list.length}` : "-"} |`);
  }
  lines.push(
    "",
    "Sending your scores again later never lowers them: each world keeps your best.",
    "",
    `The Hall of Fame: ${PAGE_URL}`,
    "",
    "Give it a few minutes: the site is being published again with your scores."
  );
  return lines.join("\n") + "\n";
}

/** Reads a board, or an empty one when the file does not exist. */
export function readBoard(file) {
  if (!fs.existsSync(file)) {
    return emptyBoard();
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Writes a board: 2-space JSON and a final newline. */
export function writeBoard(file, board) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(board, null, 2) + "\n", "utf8");
}

/** Whether a new world result beats the stored one: score, then stars, then a shorter boss time. */
function better(next, stored) {
  if (next.score !== stored.score) {
    return next.score > stored.score;
  }
  if ((next.stars || 0) !== (stored.stars || 0)) {
    return (next.stars || 0) > (stored.stars || 0);
  }
  return typeof next.bossMs === "number" && (typeof stored.bossMs !== "number" || next.bossMs < stored.bossMs);
}

function totals(entry) {
  const worlds = Object.values(entry.worlds);
  entry.total = worlds.reduce((sum, one) => sum + (one.score || 0), 0);
  entry.stars = worlds.reduce((sum, one) => sum + (one.stars || 0), 0);
}

function badgeLevels(badgesDir) {
  const levels = new Map();
  if (!fs.existsSync(badgesDir)) {
    return levels;
  }
  for (const file of fs.readdirSync(badgesDir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(badgesDir, file), "utf8"));
    } catch {
      continue;
    }
    const recipient = String(record.recipient || "").toLowerCase();
    if (!recipient) {
      continue;
    }
    const best = (record.badges || []).reduce((max, badge) => Math.max(max, Number(badge.level) || 0), 0);
    levels.set(recipient, Math.max(levels.get(recipient) || 0, best));
  }
  return levels;
}

function main(argv) {
  const boardFile = process.env.BOARD_FILE || path.join(ROOT, "hall-of-fame", "hall-of-fame.json");
  const badgesDir = process.env.BADGES_DIR || path.join(ROOT, "badges");
  const [command, ...rest] = argv;
  const option = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const fail = (message) => {
    console.error(message);
    process.exit(1);
  };
  const board = readBoard(boardFile);
  const now = new Date().toISOString();

  if (command === "apply") {
    const file = rest[0];
    const issue = option("issue");
    const author = option("author");
    const at = option("at");
    if (!file || !issue || !author || !at || !isHandle(author) || !Number.isFinite(Date.parse(at))) {
      fail("Usage: apply <submission.json> --issue <n> --author <login> --at <iso>");
    }
    const submission = JSON.parse(fs.readFileSync(file, "utf8"));
    mergeSubmission(board, submission, {
      issue,
      author,
      at: new Date(Date.parse(at)).toISOString(),
      badge: badgeLevel(badgesDir, author)
    });
    writeBoard(boardFile, board);
    fs.writeFileSync(process.env.RANKS_FILE || "/tmp/ranks.md", ranksMessage(board, author), "utf8");
    console.log(`Board updated for ${author}.`);
  } else if (command === "refresh-badges") {
    if (refreshBadges(board, badgesDir, now)) {
      writeBoard(boardFile, board);
      console.log("Badge marks updated.");
    } else {
      console.log("Badge marks already up to date.");
    }
  } else if (command === "remove" || command === "ban") {
    const handle = rest[0];
    if (!handle || !isHandle(handle)) {
      fail(`Usage: ${command} <handle>`);
    }
    if (command === "ban") {
      banPlayer(board, handle);
    } else if (!removePlayer(board, handle)) {
      fail(`${handle} is not on the board.`);
    }
    board.updatedAt = now;
    writeBoard(boardFile, board);
    console.log(command === "ban" ? `${handle} is banned and off the board.` : `${handle} is off the board.`);
  } else {
    fail("Commands: apply, refresh-badges, remove, ban");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
