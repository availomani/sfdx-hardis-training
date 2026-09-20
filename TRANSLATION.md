# Adding a language

No translated content ships in v1. The structure exists so that adding one is additive rather than a
rewrite.

## What to translate

| Path                     | Translate                                                                      |
|--------------------------|--------------------------------------------------------------------------------|
| `labs/en/**/*.md`        | **Yes.** Copy to `labs/<locale>/`, same file names, and translate              |
| `labs/_assets/**`        | No. Screenshots are shared across locales, in English                          |
| `labs/_snippets/**`      | No. Command blocks, included by reference                                      |
| `training-universe.json` | No. Org aliases, branch names, User Story ids and character names never change |
| `BACKLOG.md`             | No. Generated                                                                  |

## How

1. `cp -r labs/en labs/fr`
2. Translate every `.md` file, keeping the front matter keys and the file names
3. In each translated file, set `lang: fr` and `source_rev` to the git SHA of the English file you
   translated from
4. `node scripts/build/universe.mjs`
5. `node scripts/build/site.mjs`
6. Add the locale nav to `course-site.yml`

The site already serves `/en/...`, so `/fr/...` needs no restructuring.

## Staleness

`source_rev` is what makes a translation checkable. `scripts/i18n/check-translations.mjs` lists the
translated files whose English source has moved since, and it runs in CI.

```bash
node scripts/i18n/check-translations.mjs
```

A translation behind its source is not an error: it is a list of what to re-read.

## What never gets translated

Org aliases, branch names, API names, User Story ids, command lines, `Helios Energy` and the
character names.

The technical and brand terms already listed in the
[sfdx-hardis translation rules](https://github.com/hardisgroupcom/sfdx-hardis/blob/main/.claude/rules/translations.md):
Salesforce, SFDMU, Git, GitHub, GitLab, VS Code, Cloudity, Apex, LWC, sfdx-hardis, merge, commit,
branch, sandbox, scratch org, package.xml. "org" stays "org" in every language.

## The Trailmixes

A Trailhead Trailmix cannot be localised. Each language is a **new Trailmix**, built from the same
step list with `/<locale>/` targets. Budget one Trailmix per language per level.

## Badge pages

Locale independent. One page per learner, whatever language they learned in.

## The CLI language

The labs mention `SFDX_HARDIS_LANG`. A French learner can set it and read French CLI output against
English lab text, which is already an improvement over nothing.
