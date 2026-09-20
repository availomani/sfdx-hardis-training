/**
 * Training > Check my work.
 *
 * Asks which level and which lab, then runs the same rules the badge claim runs.
 */
import { select, universe, title, info, c } from "../lib/util.mjs";
import runCheck from "../verify/check.mjs";
import { RULES } from "../verify/rules.mjs";

export default async function check(args) {
  title("Check my work");

  const levels = universe().levels;
  const level = Number(
    await select(
      "Which level are you on?",
      levels.map((l) => ({ value: String(l.level), label: `Level ${l.level} - ${l.name}` })),
      args.level
    )
  );

  const levelDef = levels.find((l) => l.level === level);
  const labChoices = [
    { value: "all", label: `Everything in level ${level}  ${c.dim("(what the badge claim checks)")}` },
    // Only the labs that have something to check: Lab 1.1 installs tools, and has no rule
    ...levelDef.labs
      .filter((l) => RULES.some((rule) => rule.level === level && rule.lab === l.lab))
      .map((l) => ({ value: String(l.lab), label: `Lab ${level}.${l.lab} - ${l.title}` }))
  ];
  // "--lab 1.4" and "--lab 4" both name Lab 1.4
  const preselected = args.lab === undefined ? undefined : String(args.lab).split(".").pop();
  const lab = await select("Which lab?", labChoices, preselected);

  info("");
  await runCheck({ level: String(level), lab: lab === "all" ? undefined : lab });
}
