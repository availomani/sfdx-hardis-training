# Salesforce DevOps with sfdx-hardis

Three free learning paths that take you from "I have never used Git" to "I own the pipeline", using
[sfdx-hardis](https://sfdx-hardis.cloudity.com/) and its
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-sfdx-hardis).

**Start here: [sfdx-hardis-training.cloudity.com](https://sfdx-hardis-training.cloudity.com/)**

| Level                        | Audience                                                         | Time | Prerequisite   |
|------------------------------|------------------------------------------------------------------|------|----------------|
| **1 - Contributor basics**   | Admins and developers joining a team that already has a pipeline | 2 h  | none           |
| **2 - Contributor advanced** | The same people, once the easy stories are behind them           | 4 h  | Level 1        |
| **3 - Release Manager**      | The person who owns the pipeline, the orgs and the releases      | 7 h  | Levels 1 and 2 |

You work on a real repository for a fictional solar installer, **Helios Energy**, with free
Salesforce orgs that come pre-loaded with the app and its data. Everything is free: no paid
service, no licence, no credit card.

Each level awards a **Cloudity badge**. It is a badge, not a certification.

## Getting started

**The tools**, which is the same list on any Salesforce project, not just this one:

1. Install [Git](https://git-scm.com/downloads), [VS Code](https://code.visualstudio.com/) and
   [Node.js](https://nodejs.org/) 22 or later (24 recommended)
2. Install the **SFDX Hardis Extension Pack for Salesforce** from the VS Code marketplace
3. Open the sfdx-hardis panel, click **Setup**, and let it install the Salesforce CLI and the plugins

**Then the course**, which is the part that only makes sense here:

4. Sign up for one free [Developer Edition org](https://developer.salesforce.com/signup) and
   connect it in **Orgs Manager**, naming it `helios-prod`
5. Clone this repository, and install the [GitHub CLI](https://cli.github.com/), which the next
   step uses and nothing else does
6. Welcome page > **Training: Level 1** > **Set up my training environment**, which forks the
   repository, makes that org a Dev Hub, creates three scratch orgs holding the Helios app
   (`helios-dev`, `helios-integration`, `helios-uat`), and wires the `integration` and `uat`
   branches to them

[Lab 1.1](https://sfdx-hardis-training.cloudity.com/en/level-1-contributor-basics/1-1-install-vs-code-and-sfdx-hardis/) is
the first block, with screenshots, and it stands on its own: finish it and stop if you only came to
set a machine up.
[Lab 1.2](https://sfdx-hardis-training.cloudity.com/en/level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline/) is
the second.

## Everything happens in your own copy

New to Git? A **repository** is a project folder plus every version of it there has ever been, and a
**fork** is your own copy of one, under your own GitHub account. Lab 1.2 makes yours, with
screenshots, and the level home page defines the rest of the vocabulary before you need it.

You fork this repository and work only there: your feature branches, your Pull Requests, your
merges. Nothing is ever pushed here, whose only inbound traffic is badge claims.

Two hard reasons: a Pull Request opened from a fork cannot read the original repository's secrets,
so its CI could never reach your org; and a few hundred learners opening Pull Requests here would
bury the repository.

## The Training menu

The labs are done by clicking in the extension. What the product does not already own a button for,
this project declares itself as a **Training** menu, rendered on the Welcome page:

| Card                               | What it does                                                         |
|------------------------------------|----------------------------------------------------------------------|
| **Set up my training environment** | Forks this repository, creates the scratch orgs, sets the CI secrets |
| **Where am I?**                    | The level and lab you reached, and what to open next                 |
| **Set up one of my training orgs** | Deploys the Helios app and its data into an org you pick             |
| **Check my work**                  | Verifies the lab you just finished                                   |
| **Simulate my teammates**          | Creates the teammate branches and Pull Requests a lab needs          |
| **Reset this level**               | Restarts a level: integration, its lab branches and your dev orgs    |
| **Clean up a training org**        | Removes the Helios app and its data from an org                      |

All seven run `node scripts/training.mjs <verb>`, declared under `customCommands` in
`config/.sfdx-hardis.yml`. They need no `npm install`: everything under `scripts/` is dependency-free
Node.

## Claiming a badge

**Training: Level N > Claim my badge**. It re-runs every check of the level locally, refuses to
claim a level that does not pass, and opens the claim issue form with the level, your Trailblazer
username, your repository and your receipts already filled in. You tick the three consent boxes and
submit. [Opening the form by hand](https://github.com/hardisgroupcom/sfdx-hardis-training/issues/new/choose)
works too.

A job clones your repository, re-runs every check of the level against its actual content and
history, and answers on the issue. Nobody reviews claims by hand. A level 2 claim re-runs the level
1 audit too, and a level 3 claim re-runs all three.

The claim command also shows the open source project each level teaches, sfdx-hardis, MegaLinter
and the VS Code extension, in case you want to star it. It never stars anything for you, and the
badge does not depend on it.

Your repository has to be public, and your GitHub handle becomes public in this repository.

The badge is published as JSON keyed by Trailblazer username, which is how
[Trailhead Banner](https://thb.nabondance.me/) picks it up: type your Trailblazer username there
and it draws a LinkedIn cover image carrying the highest badge you claimed here.

## What is in this repository

```
force-app/            the Helios Delivery app, the sources you deploy and change
scripts/data/         the SFDMU workspaces that seed the orgs
scripts/training.mjs  the single entry point behind the Training menu
scripts/verify/       the per-lab checks, used by "Check my work" and by the badge audit
scripts/build/        generators: the backlog, the site, the screenshot fixtures
scripts/stats/        the course statistics: who starts and finishes a level, and how long the labs take
labs/en/              the lab content, plain markdown, and the reference every locale follows
labs/fr/              the French translation, same file names, same structure
labs/_assets/         the screenshots, produced by the extension harness with Helios fixtures
badges/               the badge pages, one per learner, generated by the claim workflow
config/               the sfdx-hardis project and branch configuration
training-universe.json  the single source of truth for the Helios fiction
```

Lab 3.9 generates the documentation of the Helios project into `docs/`, starting at
`docs/index.md`, with its own `mkdocs.yml`. Both are rebuilt from the sources whenever you ask, and
neither is committed.

## Languages

The course is published in **English** and in **French**, and the language selector in the header of
the site switches between them. The French labs are at
[/fr/](https://sfdx-hardis-training.cloudity.com/fr/).

Both walk through the same clicks on the same screenshots, so they assume sfdx-hardis, its VS Code
extension and your Salesforce orgs are in **English**: a translated lab translates the prose and
keeps the button names.

`labs/en/` is the reference. Every change starts there and the translations follow, and
[TRANSLATION.md](TRANSLATION.md) is how a locale is added or kept in step.

## For maintainers

The site is built here and published to
[sfdx-hardis-training/sfdx-hardis-training.github.io](https://github.com/sfdx-hardis-training/sfdx-hardis-training.github.io).
Its `gh-pages` branch is written by the build and force-pushed on every run, so nothing should ever
be committed to it by hand. That repository is an organization site, so it serves at the root of its
host, and its custom domain is `sfdx-hardis-training.cloudity.com`: the build writes the `CNAME` file
on every run, and `https://sfdx-hardis-training.github.io` redirects there.

The address this repository used to serve, `hardisgroupcom.github.io/sfdx-hardis-training`, keeps
answering. `scripts/build/redirect-site.mjs` builds what it serves: one redirect page per page of
the course, and the badge records, the story records and the share cards copied as they are, because
nothing that fetches one of those parses HTML. A learner's fork made before the move still asks this
address for `BACKLOG/<story>.json` on every Pull Request.

The site URL is written once, as `course.site` in `training-universe.json`, and repeated once more
in `course-site.yml` for the theme. `scripts/verify/check-site.mjs` fails if the two disagree.
`config/.sfdx-hardis.yml` carries it too, in the ticketing URLs and the Training menu links: no check
covers that file, so replace it there by hand on the day the URL changes.

```bash
node scripts/build/universe.mjs          # regenerate the backlog, link map and manifest, and check consistency
node scripts/build/universe.mjs --check  # same, in CI: writes nothing, fails on drift
node scripts/build/data.mjs              # regenerate the seed CSV files
node scripts/build/site.mjs              # assemble site-src/ for Zensical
node scripts/build/redirect-site.mjs     # the site the old URL serves, built from site/
node scripts/build/mocks.mjs             # regenerate the Helios screenshot fixtures in ../vscode-sfdx-hardis
node scripts/build/lab-crossrefs.mjs     # link every mention of another lab, in every locale
node scripts/i18n/check-translations.mjs # which translations their English source has moved past
node scripts/i18n/stamp-source-rev.mjs fr  # stamp source_rev from git, after committing the English side
node scripts/i18n/check-structure.mjs    # a translation that lost an image or a block, reported not enforced
node scripts/i18n/align-tables.mjs       # re-pad the tables of a translated lab
```

A learner's Pull Request sometimes lands here instead of in their fork, because GitHub offers the
original repository as the base of a Pull Request opened from a fork. `fork-pull-requests.yml`
closes it with a comment saying where it belongs, when its head is a branch of the course
(`integration`, `features/US-...`, `training/...`). Any other Pull Request from a fork is a
contribution and is left open, and one closed by mistake stays open once reopened.

The Statistics page of the site is built from `stats/course-stats.json`, which a workflow commits
every Monday: how many learners start and finish each level, and the median time of the labs next to
the time they announce. It is read from the forks of the course and the badge claims, and it names
nobody. [STATS.md](STATS.md) is the same page in this repository, written from that file by the same
workflow: never edit it by hand, and re-render it when the words of the page change in `i18n/en.json`. `scripts/stats/ignore.json` lists the accounts left out, the maintainers and the ones the
end to end tests run under. `scripts/stats/markers.mjs` says which Pull Request ends which lab: a
lab whose User Story or branch changes has to change there too.

The times the pages announce come from the same file. `scripts/build/lab-times.mjs` writes them
into the markdown under `labs/`, in every language, and the weekly workflow commits the result, so
a change of time is a diff anybody can read: the `**Time**` line of a lab, the rows and the total of
a level page, the table of the home page. It is the median, rounded down to five minutes for a lab
and to a quarter of an hour for a level, followed by the median and the fastest plausible time
between two `<!-- observed -->` comments. Never edit a time by hand to follow the figures: the next run
overwrites it. The estimate a lab was written with lives in `training-universe.json` (`time`), and
is what a lab fewer than three learners went through announces. `scripts/stats/lab-times.mjs` holds
the rules.

```bash
node scripts/stats/course-stats.mjs            # read GitHub, write stats/course-stats.json and STATS.md
node scripts/stats/course-stats.mjs --render   # no network: rewrite STATS.md after changing its words
node scripts/build/lab-times.mjs               # no network: write the observed times into the lab pages, and restamp the translations that were current
```

Stamp only once the English commit has its final name: a rebase renames it, and a stamp written
before names a commit that no longer exists.

```bash
node scripts/stats/course-stats.mjs --details  # and one row per learner, in hardis-report/course-stats/
node --test scripts/stats/compute.test.mjs     # the arithmetic, on made-up repositories
```

The `--details` report names people. It is git-ignored, and it stays on your machine.

Screenshots are captured from the extension repository, which must be a sibling clone:

```bash
cd ../vscode-sfdx-hardis
yarn dev && yarn compile
SF_MOCK_UNIVERSE=helios \
SFDX_HARDIS_DOC_SCREENSHOTS_DIR=../sfdx-hardis-training/labs/_assets/vscode \
yarn screenshots
```

`SF_MOCK_UNIVERSE` unset keeps the product documentation screenshots byte for byte unchanged.

## Licence and credits

Built by [Cloudity](https://cloudity.com) and friends, alongside
[sfdx-hardis](https://github.com/hardisgroupcom/sfdx-hardis).

Helios Energy, its people and its backlog are fiction. Any resemblance to a real solar installer is
a coincidence.
