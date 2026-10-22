/*
 * What a player has done, kept in their browser: which worlds are open, the
 * best score and stars of each, the badges, Victor's notes found, and the
 * deployment actions plan declared in world 3, which the runners read.
 *
 * Every access is wrapped: a browser that blocks storage still plays, it just
 * forgets between visits. With ?guinea-unlock=all every world is open and
 * nothing is written, so a check never changes a real player's progress.
 */

const KEY = "guinea-run-progress-v1";

function empty() {
  return { v: 1, unlocked: 0, worlds: {}, badges: [], notes: {}, plan: null, finished: false };
}

export function createProgress(options) {
  const volatile = Boolean(options && options.volatile);
  let state = empty();
  // Read even when volatile: a check can set a plan or a progress and play it,
  // without the game ever writing over it
  {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1) {
          state = Object.assign(empty(), parsed);
        }
      }
    } catch {
      state = empty();
    }
  }
  if (options && options.unlockAll) {
    state.unlocked = 99;
  }

  function save() {
    if (volatile) {
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage refused: the game goes on without remembering
    }
  }

  return {
    get unlocked() {
      return state.unlocked;
    },
    get badges() {
      return state.badges.slice();
    },
    get plan() {
      return state.plan;
    },
    get finished() {
      return state.finished;
    },
    world(id) {
      return state.worlds[id] || { best: 0, stars: 0 };
    },
    hasNote(id) {
      return Boolean(state.notes[id]);
    },
    notesFound() {
      return Object.keys(state.notes).length;
    },
    /** Records a finished world, opens the next one, and returns whether the score is a new best. */
    complete(id, score, stars, next) {
      const previous = state.worlds[id] || { best: 0, stars: 0 };
      const newBest = score > previous.best;
      state.worlds[id] = { best: Math.max(previous.best, score), stars: Math.max(previous.stars, stars) };
      if (next !== undefined) {
        state.unlocked = Math.max(state.unlocked, next);
      }
      save();
      return newBest;
    },
    addBadge(level) {
      if (!state.badges.includes(level)) {
        state.badges.push(level);
        state.badges.sort();
        save();
      }
    },
    addNote(id) {
      state.notes[id] = true;
      save();
    },
    setPlan(plan) {
      state.plan = plan;
      save();
    },
    setFinished() {
      state.finished = true;
      save();
    },
    reset() {
      state = empty();
      save();
    }
  };
}
