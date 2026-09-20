---
id: lab-2-1
title: "Lab 2.1 - Backpromote: catch your org up with the team"
description: "Your development org is behind integration. Bring in the stories your teammates merged with the sfdx-hardis Backpromote panel, keeping your own work."
level: 2
lab: 1
lang: en
source_rev: ""
screenshots:
  - annotated/vscode/backpromote-result--what-it-did
  - annotated/vscode/pipeline-cards--backpromote
  - annotated/vscode/backpromote-loading
  - annotated/vscode/backpromote
depends_on:
  commands: [hardis:work:backpromote, hardis:work:refresh]
  flags: []
  config: [backpromoteScanLimit]
  panels: [backpromote, pipeline]
  docs: [salesforce-devops-backpromote]
---

# Lab 2.1 - Backpromote: catch your org up with the team

**Level**: 2 Contributor advanced

**Time**: ~15 min

**You will**: bring three teammates' merged stories into your own dev org, decide what to keep when
the tool asks, and learn what a backpromote will never do for you.

## The situation

You were away for two weeks. While you were gone, three stories were merged into `integration` and
deployed. Your `helios-dev` org still looks like the day you left.

Build your next story on top of that and you will produce a diff full of things that look like
deletions, because your org does not have what everyone else's has. This is the most common way a
contributor accidentally undoes a teammate's work.

## Before you start

- [ ] Level 1 finished, or **Training: Level 2 > Reset this level** on level 2
- [ ] `helios-dev` connected in **Orgs Manager**
- [ ] No uncommitted changes you care about

## Steps

### 1. Bring your teammate's work in

The two weeks you were away have to exist before you can catch up on them. One click makes them:
**Training: Level 2** > **Simulate my teammates**, and take **US-017 Record who signed an
installation off**.

It creates Romain's branch in your own fork from your current `integration`, commits his change under
his name and opens the Pull Request. Review it the way you would a colleague's, then **merge it**.

`integration` now carries three merged Pull Requests your org has never seen as a deployment: your
two Level 1 stories, which are in `helios-dev` only because you built them there, and Romain's, which
is nowhere near it.

### 2. Open Backpromote

In the **DevOps Pipeline** panel, under **Project Contribution Workflow**, click the
**Backpromote (Beta)** card **(1)**.

![The Backpromote card of the DevOps Pipeline panel](../../_assets/annotated/vscode/pipeline-cards--backpromote.png)

It computes its plan before it shows you anything:

1. **Target sandbox** **(1)** is the org the work comes down into, `helios-dev`
2. **Parent branch** **(2)** is where it comes from, `integration`
3. The three lines **(3)** read your org, list the Pull Requests merged in `integration`, and work
   out the difference between the two

![The Backpromote panel computing its plan](../../_assets/annotated/vscode/backpromote-loading.png)

"Backpromote" is the direction that matters: work normally flows **up**, from your branch to
integration to uat to production. A backpromote brings it **down** again, from a major branch into
your own environment, so you are building on what the team has rather than on what you remember.

### 3. See how far behind you are

The **WHERE** block at the top of the panel answers that, and it is the only place that does.
**3 Pull Requests in the window**: three stories were merged into `integration` since the last time
anything came down into your org.

That count, not your memory, is what tells you whether a refresh is needed. On a Monday after a
week off it is worth reading before anything else.

### 4. Choose what comes down

When the plan is ready the panel fills in. The merged Pull Requests are listed newest first
**(1)**: pick the oldest one you want, and everything from there to the head of `integration`
**(2)** comes down. Below, what differs between `integration` and your org is listed by metadata
type, each item with its own tick **(3)**.

![The Backpromote panel, with the merged Pull Requests and the items they bring down](../../_assets/annotated/vscode/backpromote.png)

Go through the list rather than clicking "all":

| What you see                                         | What to do                                                        |
|------------------------------------------------------|-------------------------------------------------------------------|
| Metadata from the three merged stories               | **Take it.** That is the whole point                              |
| Something you are half way through building yourself | **Leave it.** A backpromote would overwrite your work in progress |
| Something you do not recognise at all                | **Take it.** If it is on `integration`, it is the team's truth    |

For a file that both sides changed, the panel offers a third answer beside **Overwrite** and **Keep
org version**: **Merge**. It writes the file with both versions in it, marked, and you pick between
them in the VS Code merge editor, the same way [Lab 2.7](2-7-resolve-a-git-merge-conflict.md) has you resolve a Pull Request conflict.
Reach for it when both changes are real and you need both.

The rule when you hesitate: `integration` wins. It is the shared reality, and your org is a copy of
it that you are allowed to modify temporarily.

### 5. Run it and read the result

Click **Backpromote to helios-dev** **(1)**. The panel works through the run step by step **(2)**,
and when it finishes it tells you what happened **(3)**.

![The Backpromote panel, finished, with its summary](../../_assets/annotated/vscode/backpromote-result--what-it-did.png)

Read the four lines of the summary rather than the colour:

- how many items reached your org, and how many were deleted from it
- how many deployment actions ran, were skipped, or failed
- **how many manual actions are waiting for you in the sandbox**, which nothing can do for you
- which Pull Requests it wrote its history onto, so the next backpromote knows where to start

Then click **Back to `<your branch>`** **(4)**. It is the last button of the panel and the one
people miss, and the next note explains why it matters.

<details markdown="1"><summary>Under the hood: what Backpromote just did</summary>

The panel ran:

    sf hardis:work:backpromote

which:

1. Fetched `integration` and compared it with your branch
2. Built a plan: the components that differ, and for each one whether it is added, changed or
   removed
3. Deployed the ones you selected into your dev org, using the same deployment engine as the CI
4. Recorded what it did, so a second run does not redo the same work

Three things it deliberately does **not** do, and knowing them saves an afternoon:

- **It does not bring records on its own.** It deploys metadata, and it runs the deployment actions
  the merged Pull Requests declared, which is where a data load would live. If a teammate's story
  needed reference data and nobody declared an action for it, that data is not in your org, and no
  deployment will ever put it there. [Lab 2.4](2-4-ship-reference-data-and-a-batch-with-deployment-actions.md) is about that exact problem
- **It does not undo what you did by hand.** If you changed something in your org that
  `integration` also changed, the deployment overwrites it. That is why you read the list
- **It does not touch the shared orgs.** A backpromote refuses a production org, and any org a
  major branch deploys to. It only ever writes to a developer sandbox, a scratch org or a Developer
  Edition org

And one thing it does that nobody expects the first time:

!!! warning "It leaves you on the backpromote branch"
    The deployment runs from a branch called `backpromote/integration/<your org>`, and **the
    checkout stays there when the command finishes**. The panel says so, and offers the
    **Back to `<your branch>`** button **(4)** to undo it: it restores the changes it stashed
    before the run, then proposes a merge of the parent branch.

    Take that button. If you do not, **New User Story** still branches from the target you pick, so
    nothing breaks, but anything you had in progress stays stashed behind a branch you have
    forgotten about. The branch you are on is always in the bottom left corner of VS Code.

The history is not on your computer either. sfdx-hardis records what reached your sandbox in a
**Backpromotes comment** on each Pull Request it brought down, so the next backpromote knows where
to start, from any machine and any teammate. That is also why the command needs a git provider
token: without one it cannot read its own history, and it stops.

</details>

## What you should see

Open `helios-dev` and check that the metadata from the three merged stories is there. In particular
`Panels_Required__c` and `Crew_Notes__c` from Level 1, if you did Level 1 in a different org.

## If it goes wrong

**The panel says there is nothing to backpromote.**
Your org is already level with `integration`, which happens if you just finished Level 1 in the same
org. Nothing to do: move on.

**The deployment fails on a component that depends on something else.**
Take the whole set rather than a subset. Metadata has dependencies, and half a story often does not
deploy.

**Your own work in progress was overwritten.**
It was in the list and you took it. Rebuild it in the org: it is still in your branch if you
committed it, and the deployment only changed the org.

## Check your work

Welcome page > **Training: Level 2** > **Check my work**, then pick Lab 2.1.

## Go deeper

- [Backpromote](https://sfdx-hardis.cloudity.com/salesforce-devops-backpromote/)

[Next: Lab 2.2 - Fix a deployment error caused by a missing dependency](2-2-fix-a-missing-dependency-deployment-error.md){ .md-button .md-button--primary }
