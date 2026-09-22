# Translating the course

The course ships in **English** and in **French**. `labs/en/` is the reference and every other
locale is a mirror of it.

## English is the reference, always

This is the one rule the rest of the page follows from.

- **Every change starts in `labs/en/`.** A lab is written, corrected or renamed in English first,
  and the translations follow. There is no such thing as a fix that lives only in French
- **A translation is never the source of a fact.** When the two disagree about what a button does,
  English is right and the translation is behind. Fix the translation, or fix English first and then
  the translation, but never the other way round
- **The structure is English.** File names, folders, front matter keys, `id`, `level`, `lab`,
  `screenshots` and `depends_on` are identical in every locale, and the URLs are the English slugs.
  Only the prose, the titles and the descriptions are translated
- **A translation may lag, and that is not a failure.** `source_rev` says which version of the
  English page a translation was made from, and `scripts/i18n/check-translations.mjs` lists the ones
  the source has moved past. That list is what to re-read, not a broken build

## What to translate

| Path                     | Translate                                                                       |
|--------------------------|---------------------------------------------------------------------------------|
| `labs/en/**/*.md`        | **Yes.** Copy to `labs/<locale>/`, same file names, and translate               |
| `i18n/en.json`           | **Yes.** Copy to `i18n/<locale>.json` and translate: it is every generated page |
| `labs/_assets/**`        | No. Screenshots are shared across locales, in English                           |
| `labs/_snippets/**`      | No. Command blocks, included by reference                                       |
| `training-universe.json` | No. Org aliases, branch names, User Story ids and character names never change  |
| `BACKLOG.md`             | No. Generated                                                                   |
| `labs/link-map.*.md`     | No. Generated, one per locale, and not published                                |

### The pages nobody writes

The backlog, the page of each User Story, the badges index and each badge page are built from
`training-universe.json` and the badge records, so there is no markdown file to copy for them.
Their words live in `i18n/<locale>.json`, and so does the translation of what
`training-universe.json` writes in English: the pitch of the company, the level names, the roles
of the cast, and the title, story and acceptance criteria of each User Story, under `universe`.

Anything a locale leaves out reads in English rather than disappearing, so a half-translated file
still ships a page somebody can use.

## The tools stay in English

The course assumes the learner runs **sfdx-hardis, its VS Code extension and their Salesforce orgs
in English**, because every screenshot was taken that way. So in a translated lab:

- **Anything you click keeps its English name**, in bold as in the source: **Setup**,
  **Orgs Manager**, **Save / Publish**, **Recent Changes**, **Merging is blocked**. The sentence
  around it is translated, the label is not
- **The prompts and the log lines quoted from a command stay verbatim.** They are what the reader
  sees on screen
- **The concepts are translated**, with the French Salesforce vocabulary where there is one:
  *présentation de page* for the concept, **Page Layouts** for the menu entry
- Say so once, near the top of the locale's home page, so nobody wonders why the buttons are in
  another language

A learner who sets `SFDX_HARDIS_LANG` gets a CLI in their own language and lab text that no longer
matches the labels. That is their choice to make, and the course does not suggest it.

## How to add a locale

1. `cp -r labs/en labs/<locale>`
2. Translate every `.md` file, keeping the front matter keys, the file names, the `**(1)**` pill
   references and the image paths
3. In each translated file, set `lang: <locale>`. It is what the site reads to keep the menu of a
   page in one language, and what the translate widget swaps to reach the same page
4. Translate `i18n/en.json` into `i18n/<locale>.json`, which is the backlog, the story pages and
   the badges. Add `universe` to it for what `training-universe.json` says in English
5. Declare the locale in the three places that need a word in it:
   - `TROUBLESHOOTING` in `scripts/build/site.mjs`, the translated "If it goes wrong" heading, which
     is how that section gets folded on the site
   - `LOCALES` in `scripts/build/lab-crossrefs.mjs`, the word for "step", which is how
     "Lab 2.7, étape 3" becomes a link to that heading
   - `NAV_LABELS` and `LOCALE_NAMES` in `scripts/build/universe.mjs`, the half-dozen words the
     navigation and the link map need
6. `node scripts/build/lab-crossrefs.mjs`, which links every mention of another lab
7. Commit the English side first if you changed it, then
   `node scripts/i18n/stamp-source-rev.mjs <locale>`, which writes each `source_rev` from git
8. `node scripts/build/universe.mjs`, then `node scripts/build/site.mjs`
9. Add the locale to the `nav` and to `extra.languages` in `course-site.yml`, and a banner in
   `site-overrides/main.html`. The `nav` holds one flat course per language, English first, and a
   reader only ever sees one of them: `site-overrides/partials/nav.html` keeps the entries whose
   language is the language of the page. `extra.languages` is the home page of the locale, where
   the logo points and where the picker falls back for a page with no counterpart, and it carries
   the flag the picker shows. That key is not called `alternate` on purpose, and renaming it back
   breaks the picker: the reason is written where it is declared
10. Build the site, then `node scripts/verify/check-nav.mjs` and
   `node scripts/verify/check-language-switch.mjs`. The first says that each menu holds one
   language, that the picker lands on the same page in the other language and that page points
   back, and that the previous and next arrows stay inside one language. The second walks to a lab
   through the menu before clicking the picker, which is the only way to catch a link that went
   stale on the way, and it checks that the language a reader picks is remembered in a cookie and
   that the next page they open moves to it

The theme speaks the language of the page too, from its own dictionary:
`site-overrides/partials/language.html` picks it from the front matter, so a locale Zensical has
no dictionary for fails the build there, which is the moment to find out.

## A link that knows its language

The language a reader picks is remembered in a cookie for a year, and a page opened in another
language moves to the same page in the remembered one. A link can override that with `?lang=en` or
`?lang=fr`, which also becomes the new preference: it is how a link shared in one language reaches a
reader who once picked another. The steps of a Trailmix are the case that matters, because each
Trailmix is one language and its targets are shared far from the site.

The site already serves `/en/...`, so `/fr/...` needs no restructuring.

## Staleness

`source_rev` is what makes a translation checkable. `scripts/i18n/check-translations.mjs` lists the
translated files whose English source has moved since, and it runs in CI.

```bash
node scripts/i18n/check-translations.mjs          # list what is behind
node scripts/i18n/stamp-source-rev.mjs fr         # after re-reading, stamp them again
```

A translation behind its source is not an error: it is a list of what to re-read.

The generated pages are checked the same way, and one way more. `i18n/<locale>.json` carries its own
`source_rev`, naming the commit of `i18n/en.json` it was translated from, and a key it does not
answer is a failure rather than a report: the site falls back to English key by key, so the hole
reads as an English sentence in the middle of a French paragraph and nothing else shows it.

```bash
node scripts/i18n/check-i18n.mjs                  # missing keys (fails), and staleness (reports)
node scripts/i18n/check-i18n.mjs --stamp          # after re-reading i18n/en.json
```

It also checks the fiction: every User Story, level and cast member of `training-universe.json` has
its translation, with the same number of acceptance criteria as the story it belongs to.

## Shape

Staleness is one way a translation rots. Losing something is the other, and it is quieter: a
paragraph skipped, an image left out, an "Under the hood" block never carried over. Nothing fails,
and a learner meets it as a step that points at a picture which is not there.

```bash
node scripts/i18n/check-structure.mjs
```

It compares headings, images, code fences, `<details>` blocks, `**(n)**` pill references,
admonitions and tables, and says nothing about the words. It reports and never fails, because a
deliberate difference is allowed: today the French home page carries one admonition more than the
English one, the note saying the product stays in English. Read the list rather than silencing it.

## What never gets translated

Org aliases, branch names, API names, User Story ids, command lines, `Helios Energy` and the
character names.

The technical and brand terms already listed in the
[sfdx-hardis translation rules](https://github.com/hardisgroupcom/sfdx-hardis/blob/main/.claude/rules/translations.md):
Salesforce, SFDMU, Git, GitHub, GitLab, VS Code, Cloudity, Apex, LWC, sfdx-hardis, merge, commit,
branch, sandbox, scratch org, package.xml. "org" stays "org" in every language.

**"Lab N.M" is an identifier, not a word.** It is the same in every locale, because it names a page
whose URL and whose entry in the Training menu are the same everywhere. What changes around it is
the word for a step: "Lab 2.7 step 3" in English, "Lab 2.7, étape 3" in French, and
`scripts/build/lab-crossrefs.mjs` knows both.

## French

Beyond the rules above:

- Official Salesforce French where there is one and where people use it: *champ*, *objet*,
  *profil*, *type d'enregistrement*, *règle de validation* are used as concepts. *Ensemble
  d'autorisations* exists and nobody says it, so this course says **permission set**
- Developer terms stay English: repository, Flow, flag, merge, commit, branch, fork, scratch org,
  sandbox, pipeline, Pull Request, hotfix, backpromote, retrofit, deployment action, User Story
- **"repository", never "dépôt".** French Salesforce and git users say repository, the plural is
  *repositories*, and it is masculine: *le repository*, *du repository*, *ce repository*
- **"Flow", never "flux".** A Salesforce Flow is a Flow in French: *le flow*, *les flows*,
  *Flow Builder*. The same goes for a JWT flow
- The test for the whole family: what a French developer says out loud, not whether a dictionary
  has an entry for it
- *déploiement* for deployment, *récupérer* for retrieve, *notes de version* for release notes,
  *présentation de page* for page layout
- French typography: a space before `:`, `;`, `?` and `!`, and ordinary quotes rather than guillemets
  so that the markdown stays easy to diff
- No em-dashes, the same rule the English course follows

## The Trailmixes

A Trailhead Trailmix cannot be localised. Each language is a **new Trailmix**, built from the same
step list with `/<locale>/` targets, and `labs/link-map.<locale>.md` is generated to hold those URLs.
Budget one Trailmix per language per level.

## Badge pages

Locale independent. One page per learner, whatever language they learned in.
