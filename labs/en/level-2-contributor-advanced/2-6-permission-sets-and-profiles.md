---
id: lab-2-6
title: "Lab 2.6 - Permission sets, profiles and why a grant disappears"
description: "A permission granted on a Profile vanishes after a green deployment. Learn how sfdx-hardis cleans profiles, and grant access with a permission set."
level: 2
lab: 6
lang: en
source_rev: ""
screenshots:
  - annotated/vscode/pipeline-cards--new-user-story
  - annotated/vscode/pipeline-config
depends_on:
  commands: [hardis:work:save]
  flags: []
  config: [autoCleanTypes, minimizeProfiles, autoRemoveUserPermissions]
  panels: [pipelineConfig, packageXml]
  docs: [salesforce-devops-work-on-user-story-profiles]
---

# Lab 2.6 - Permission sets, profiles and why a grant disappears

**Level**: 2 Contributor advanced

**Time**: ~25 min

**You will**: chase a permission that vanishes between a green deployment and the target org, and
find out it was removed on purpose.

## The situation

> **US-033 - Crews can read the panel batch cost**
>
> As a delivery crew member, I want to see the cost of the batch I am installing, so that I report
> damage with the right value.

You grant the permission, publish, the check is green, the deployment is green, and the permission
is not in the integration org. Nothing failed. Nothing warned you.

This is the failure mode that makes people distrust a pipeline, and it is entirely explainable.

## Before you start

- [ ] [Lab 2.5](2-5-pass-code-quality-and-apex-test-coverage.md) finished and merged
- [ ] `helios-dev` level with `integration`

## Steps

### 1. Take the story and do it the way an admin would

**New User Story** **(2)**, under **Project Contribution Workflow** **(1)** of the DevOps Pipeline
panel. Name `US-033-batch-cost-visibility`, org `helios-dev`.

![The New User Story card of the DevOps Pipeline panel](../../_assets/annotated/vscode/pipeline-cards--new-user-story.png)

The crews log in with the **Helios Crew** profile. It is one of the two Profiles this repository
carries, next to `Admin`, the System Administrator profile: in the **DevOps Pipeline** panel, open
the **Deployment packages** menu, then **Package XML**, and the **Profile** row lists both.

In `helios-dev`, the quick way: **Setup > Object Manager > Panel Batch > Fields & Relationships >
Cost > Set Field-Level Security**, tick **Visible** for the **Helios Crew** profile, **Save**.

That is how most people grant a permission, and it is what this lab is built on.

Bring it down the usual way: **Commit changes**, **Recent Changes**, **Search Metadata**, tick the
`Helios Crew` Profile, retrieve, and commit it from **Source Control**. Then **Save / Publish**,
push, Pull Request, green, merge.

### 2. Discover that nothing happened

Open `helios-integration` and check the field-level security of **Panel Batch > Cost**: the
**Helios Crew** column is not ticked. The permission is not there.

Go back to the Pull Request. The comment says success, and the Profile is among the deployed
components. What was deployed is not what you committed, though.

### 3. Read your own diff

Your commit had the permission in it. You saw it in the diff before you clicked Commit.

Open the **Source Control** panel, look at the history of your branch, and read the commit
**Save / Publish** made after yours, `chore(sfdx-hardis): clean sfdx project`. It takes the
permission you added straight back out, along with every other section of the file that a
Permission Set could carry. What is left is what only a Profile can hold.

That is a project setting called **minimizeProfiles**, one of the cleaning rules this project
switched on, and you can see it in the **Pipeline Settings** panel on the **Salesforce Project**
tab.

### 4. Understand why a project would ever do that

Profiles are the single worst metadata type to version, for three reasons that all bite at once:

1. **They are enormous and they are shared.** One Profile file lists every object, field, tab, app
   and class permission in the org. Two people touching two unrelated stories both produce a
   thousand-line diff of the same file, and they conflict every time
2. **A retrieved Profile says no to what it did not have.** It lists the fields and objects of your
   package with `false` wherever the profile had no access when you retrieved it. If a colleague
   granted one of them since, deploying your file **switches theirs off**, silently
3. **What you retrieve depends on your package.** A Profile is retrieved with only the permissions
   for the components in your package, so the same Profile looks different depending on who
   retrieved it and when

`minimizeProfiles` strips from Profiles everything that a Permission Set could carry instead,
leaving Profiles to hold only what genuinely cannot live anywhere else: login hours, IP ranges,
default record types, page layout assignments.

So the pipeline did not lose your work. It refused to carry it, because carrying it would eventually
delete somebody else's.

!!! note "Why the Profiles stay in the repository all the same"
    Removing Profiles from the sources would be the wrong conclusion. A user logs in with a
    Profile, and what only a Profile holds, the default app, the page layout of each object, the tab
    settings, the login hours, has to be the same in every org. So `Admin` and `Helios Crew` stay in
    `force-app/main/default/profiles/`, stay in `manifest/package.xml`, and are deployed with
    everything else.

    They stay **short** on purpose. A Profile retrieved whole lists hundreds of user permissions, and
    Salesforce adds and removes some at every release, three times a year: a full Profile committed
    in spring can fail to deploy in autumn on a permission that no longer exists. The short version
    names only what this project decided, and `minimizeProfiles` keeps it short every time somebody
    publishes one.

### 5. Do it the way the project expects

Redo the grant where it belongs. Your first Pull Request is merged, so this is a second one for the
same story: **New User Story**, name `US-033-crew-permission-set`, org `helios-dev`.

In `helios-dev`: **Setup > Permission Sets > Helios Delivery Crew > Object Settings > Panel Batches
> Edit**, tick **Read Access** on `Cost`, **Save**.

Retrieve the **Permission Set** this time, commit it, **Save / Publish**, and open the Pull
Request. The **Git Delta package.xml** report
names `Helios_Delivery_Crew`.

Nothing to tidy up: the Profile you published in step 1 stays in the repository, cleaned, and it
keeps being deployed as it always was.

The check goes green. Merge, and check `helios-integration`: **Setup > Permission Sets > Helios
Delivery Crew > Object Settings > Panel Batches**, `Cost` is readable. Every crew member holds that
permission set, whatever their Profile.

### 6. Look at the other protection while you are here

Open the **DevOps Pipeline** panel, then **Pipeline Settings** in the gear menu. Leave the scope
selector **(1)** on **Global Settings**: these are project rules, identical for every branch.

![The Global Pipeline Settings panel, on its Deployment tab](../../_assets/annotated/vscode/pipeline-config.png)

The settings are grouped in tabs. Two of them do the job you just met, and it is worth knowing
which is which:

| Setting                            | Tab                            | What it protects against                                                                    |
|------------------------------------|--------------------------------|---------------------------------------------------------------------------------------------|
| `autoCleanTypes: minimizeProfiles` | **Salesforce Project** **(2)** | A Profile carrying permissions that belong on a Permission Set                              |
| `autoRemoveUserPermissions`        | **Salesforce Project** **(2)** | Specific user permissions that must never travel between orgs at all, whatever carries them |

Both run on your machine, when you publish: they decide what your commit carries. The tab beside
them, **Deployment** **(3)**, decides how the pipeline sends it to each org. That one belongs to the
release manager, and Level 3 is where you meet it.

<details markdown="1"><summary>Under the hood: what cleaning actually did to the file</summary>

The cleaning pass of `hardis:work:save` ran over the Profile you had committed, and for
`minimizeProfiles` it rewrote its XML in a commit of its own.

Whole sections are deleted, because a Permission Set can carry all of them:

`agentAccesses`, `classAccesses`, `customMetadataTypeAccesses`, `customPermissions`,
`externalDataSourceAccesses`, `fieldPermissions`, `flowAccesses`, `objectPermissions`,
`pageAccesses`, `ServicePresenceStatusAccesses`.

Three sections are thinned rather than deleted, keeping only the entries a Permission Set cannot
express:

| Section                   | What survives                                                                    |
|---------------------------|----------------------------------------------------------------------------------|
| `recordTypeVisibilities`  | only the entries marked `default` (or `personAccountDefault`)                    |
| `applicationVisibilities` | only the default app, and apps explicitly hidden (`visible` false)               |
| `userPermissions`         | only permissions explicitly turned **off**, plus everything on the Admin profile |

And some sections are never touched, because nothing else can hold them: `loginHours`,
`loginIpRanges`, `layoutAssignments`, `tabVisibilities`, `custom`, `userLicense`.

So a Profile still does a job in this pipeline. It is just a much smaller one.

Nothing was removed from your org. The cleaning changes **what the repository carries**, never what
Salesforce holds. Your admin-style grant is still in `helios-dev`, which is exactly why the lab
asks you to do it again on the Permission Set rather than to fix the file by hand.

The rule to take away: **if a permission can live on a Permission Set, put it there.** This is not
an sfdx-hardis opinion, it is what Salesforce has been recommending for years, and this pipeline
enforces it rather than hoping.

</details>

## What you should see

- `Cost` granted on the **Helios Delivery Crew** permission set in `helios-integration`
- `Admin` and `Helios Crew` still in `force-app/main/default/profiles/`, with no field permission
  in them

## If it goes wrong

**The permission set edit does not show the Cost field.**
The field is not in the permission set's object settings until the object is granted. Grant read on
**Panel Batch** first.

**The deployment fails with `INSUFFICIENT_ACCESS` on the permission set.**
The CI user cannot grant a permission it does not have itself. Assign **Helios Delivery Manager** to
the integration org user, which **Training: Level 2 > Set up one of my training orgs** does.

**The Profile comes back a thousand lines long.**
It was committed after a retrieve and never went through the cleaning. Check that
`minimizeProfiles` is still listed on the **Salesforce Project** tab of **Pipeline Settings**, then
**Save / Publish** again. Do not shorten the file by hand.

## Check your work

Welcome page > **Training: Level 2** > **Check my work**, then pick Lab 2.6.

## Go deeper

- [Profiles and Permission Sets](https://sfdx-hardis.cloudity.com/salesforce-devops-work-on-user-story-profiles/)

[Next: Lab 2.7 - Resolve a Git merge conflict with a teammate](2-7-resolve-a-git-merge-conflict.md){ .md-button .md-button--primary }
