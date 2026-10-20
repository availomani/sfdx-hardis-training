/**
 * The step template of the labs: what the markdown says, and what the site makes of it.
 *
 * Every numbered step of a lab reads the same way:
 *
 *   ### 2. Take in the five stories
 *
 *   Goal: all five stories deployed to `helios-uat`.
 *   Refresher: Lab 3.2, Lab 3.5
 *
 *   #### Do
 *   1. numbered tasks, one action per line, the screenshot under its task
 *
 *     !!! tip "In Agentforce Vibes"     inside its task, 2 spaces, body at 6: only
 *         ...                           for what some learners need, never a task
 *                                       of its own (any other indent prints as text)
 *
 *   !!! warning "Careful"          only when something fails or is hard to undo
 *
 *   #### Why this order            the reasons, open, muted
 *
 *   !!! tip "In Agentforce Vibes"  after the Why text, for an aside about some
 *       ...                        learners only (also fine outside the steps)
 *
 *   <details> Under the hood       unchanged
 *
 *   #### You should now see        always last
 *
 * The markdown keeps ordinary headings and lines, so a lab reads well on GitHub
 * and nobody indents a block by hand. scripts/build/site.mjs turns them into
 * styled blocks, and scripts/verify/check-lab-template.mjs keeps every lab on
 * the template.
 *
 * Bold is for what the learner sees on a screen and nothing else: a button, a
 * menu path, a question a command asks. The site paints a short bold run as a
 * chip, and a long one (a question) as plain bold.
 */

/**
 * The words of the template, per locale. A block heading starts with its word:
 * "#### Why this order" is a Why block titled "Why this order".
 */
export const LAB_TEMPLATE = {
  en: {
    do: "Do",
    why: "Why",
    check: "You should now see",
    goal: "Goal",
    refresher: "Refresher",
    meta: ["Level", "Time", "You will"],
    careful: "Careful",
    done: "Done",
    figure: "Figure",
    codeTitles: ["Type this", "Output", "Config", "Edit this file", "What the button ran"],
    underTheHoodOnly: ["What the button ran"]
  },
  fr: {
    do: "À faire",
    why: "Pourquoi",
    check: "Vous devriez voir",
    goal: "Objectif",
    refresher: "Rappel",
    meta: ["Niveau", "Durée", "Vous allez"],
    careful: "Attention",
    done: "Terminé",
    figure: "Figure",
    codeTitles: ["À taper", "Résultat", "Configuration", "À modifier dans le fichier", "Ce que le bouton a lancé"],
    underTheHoodOnly: ["Ce que le bouton a lancé"]
  }
};

/** A bold run longer than this many words is a sentence on a screen, not a button: plain bold. */
export const CHIP_MAX_WORDS = 6;

/** The words of a locale, or an error naming where to add them. */
export function templateWords(locale) {
  const words = LAB_TEMPLATE[locale];
  if (!words) {
    throw new Error(
      `labs/${locale}/ has no entry in LAB_TEMPLATE (scripts/lib/lab-template.mjs), so its steps ` +
      "cannot be built. Add the translated words there."
    );
  }
  return words;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The kind of block a "#### " heading opens, or null for an ordinary heading.
 * The word must stand alone or be followed by a space or a colon.
 */
export function blockKind(headingText, words) {
  for (const kind of ["do", "why", "check"]) {
    if (new RegExp(`^${escape(words[kind])}(?=$|[\\s:])`).test(headingText.trim())) {
      return kind;
    }
  }
  return null;
}

/** "Goal: ..." or "Objectif : ...", the line under a step heading. */
export function lineKey(line, word) {
  const match = line.match(new RegExp(`^${escape(word)}\\s?:\\s+(.*)$`));
  return match ? match[1] : null;
}

/**
 * Splits the lines of a page into lines of prose and lines of code, so no
 * transform ever rewrites the inside of a fence: Lab 3.10 quotes a Pull Request
 * description whose "## " headings are not headings of the lab.
 */
export function markFences(lines) {
  let fence = null;
  return lines.map((line) => {
    const open = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.trim() === open[1]) {
        fence = null;
      }
      return { line, code: true };
    }
    if (open) {
      fence = open[1];
      return { line, code: true };
    }
    return { line, code: false };
  });
}

/** Applies the template to one lab page. */
export function applyLabTemplate(content, locale) {
  const words = templateWords(locale);
  const lines = markFences(content.split(/\r?\n/));
  const out = [];
  let inStep = false;
  let block = null;
  let headPending = false;
  let lastWasHead = false;
  let head = [];

  const closeBlock = () => {
    if (block) {
      out.push("", "</div>", "");
      block = null;
    }
  };
  const flushHead = () => {
    if (head.length) {
      out.push(`<div class="step-head" markdown>`, "");
      for (const item of head) {
        if (item.kind === "refresher") {
          // the links are chips: the commas between them are noise
          item.html = item.html.replace(/\)\s*,\s*\[/g, ") [");
        }
        // markdown="span": the line keeps its code spans and its links to other labs
        out.push(`<p class="step-head-line step-head-${item.kind}" markdown="span"><span class="step-head-key">${item.label}</span> <span class="step-head-text">${item.html}</span></p>`, "");
      }
      out.push("</div>", "");
      head = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const { line, code } = lines[i];
    if (code) {
      if (headPending) {
        headPending = false;
        flushHead();
      }
      out.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,4}) (.*)$/);
    if (heading) {
      closeBlock();
      if (headPending) {
        headPending = false;
        flushHead();
      }
      const level = heading[1].length;
      if (level <= 2) {
        inStep = false;
      }
      if (level === 3) {
        inStep = /^\d+\.\s/.test(heading[2]);
        headPending = inStep;
        lastWasHead = false;
        out.push(line);
        continue;
      }
      if (level === 4 && inStep) {
        const kind = blockKind(heading[2], words);
        if (kind) {
          block = kind;
          out.push(`<div class="blk blk-${kind}" markdown>`, "", `<p class="blk-label">${heading[2].trim()}</p>`, "");
          continue;
        }
      }
      out.push(line);
      continue;
    }
    if (headPending) {
      const goal = lineKey(line, words.goal);
      const refresher = lineKey(line, words.refresher);
      if (goal !== null) {
        head.push({ kind: "goal", label: words.goal, html: goal });
        lastWasHead = true;
        continue;
      }
      if (refresher !== null) {
        head.push({ kind: "refresher", label: words.refresher, html: refresher });
        lastWasHead = true;
        continue;
      }
      if (line.trim() === "") {
        out.push(line);
        lastWasHead = false;
        continue;
      }
      // A Goal wrapped at 100 columns goes on with the next line
      if (lastWasHead && head.length) {
        head[head.length - 1].html += " " + line.trim();
        continue;
      }
      headPending = false;
      flushHead();
    }
    // A Careful box or an Under the hood block ends the block above it
    if (block && (/^!!! /.test(line) || /^\?\?\?\+? /.test(line) || /^<details/.test(line))) {
      closeBlock();
    }
    out.push(line);
  }
  closeBlock();
  if (headPending) {
    flushHead();
  }
  return wrapLabMeta(out.join("\n"), words);
}

/**
 * The three lines at the top of a lab (Level, Time, You will) become one meta
 * block. They keep their bold in the markdown, because lab-times.mjs rewrites
 * the Time line by its bold key, and the site styles that bold as a key, not as
 * a button.
 */
function wrapLabMeta(content, words) {
  const keys = words.meta.map(escape).join("|");
  const meta = new RegExp(`((?:^\\*\\*(?:${keys})\\*\\*\\s?:[^\\n]*(?:\\n(?!\\n)[^\\n]*)*\\n*)+)`, "m");
  return content.replace(meta, (whole) => `<div class="lab-meta" markdown>\n\n${whole.trim()}\n\n</div>\n\n`);
}
/**
 * The bold runs of a page that are prose, not code: each run with the text
 * between its stars, its line in the page, and where it starts in the prose.
 * A run may wrap onto the next line, as a long question often does. Fences and
 * code spans are masked first, so the double star of a glob is never taken for bold.
 */
export function proseBoldRuns(content) {
  const lines = markFences(content.split(/\r?\n/));
  const masked = lines
    // Same length as the text they hide: the runs are cut back out of the page by their index
    .map(({ line, code }) => (code ? " ".repeat(line.length) : line.replace(/`[^`\n]*`/g, (span) => "\u0000".repeat(span.length))))
    .join("\n");
  const runs = [];
  const bold = /\*\*([^*<\n]+(?:\n(?!\s*\n)[^*<\n]+)*?)\*\*/g;
  let match;
  while ((match = bold.exec(masked))) {
    runs.push({ index: match.index, length: match[0].length, text: match[1], line: masked.slice(0, match.index).split("\n").length });
  }
  return runs;
}

/** A bold run the site paints as plain bold rather than a chip: a question, or more than a few words. */
export function isLongBold(text) {
  return text.trim().split(/\s+/).length > CHIP_MAX_WORDS || /\?\s*$/.test(text);
}

/**
 * Marks the long bold runs of a page, so the site paints them as plain bold
 * instead of a chip. A run holding a code span keeps its stars: the code span
 * needs markdown to stay code, and a chip that long is rare.
 */
export function markLongBold(content) {
  const runs = proseBoldRuns(content).filter((run) => isLongBold(run.text) && !run.text.includes("\u0000"));
  let out = content;
  // From the end, so the indexes of the runs before stay right
  for (const run of runs.reverse()) {
    const original = out.slice(run.index, run.index + run.length);
    const text = original.slice(2, -2);
    out = out.slice(0, run.index) + `<strong class="ui-text">${text}</strong>` + out.slice(run.index + run.length);
  }
  return out;
}
