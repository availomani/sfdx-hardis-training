---
id: lab-3-2
title: "Lab 3.2 - Review and merge a contributor Pull Request"
description: "Review a teammate's Salesforce Pull Request as a release manager: find what the deployment check missed, request a change, and merge."
level: 3
lab: 2
lang: en
source_rev: ""
screenshots:
  - annotated/web/github-pr-files
  - annotated/vscode/welcome-custom-menu-3
depends_on:
  commands: [hardis:project:deploy:smart]
  flags: [--check]
  config: []
  panels: [pipeline]
  docs: [salesforce-devops-validate-merge-request, salesforce-devops-handle-merge-request-results]
---

# Lab 3.2 - Review and merge a contributor Pull Request

**Level**: 3 Release Manager

**Time**: ~25 min

**You will**: review somebody else's work, find the thing the robot did not, ask for a change, and
merge.

## The situation

Mariia has a new story, **US-052 - The Installation layout in two columns**: planners scroll the
Information section of every installation while its second column sits empty. Her Pull Request is
open, its checks are green, and it waits for you.

Green checks mean "this will deploy". They do not mean "this is right". Deciding the second is your
job now, **before** the merge, and it is the part of release management that cannot be automated.
A review after the merge is an audit: the change is already in `integration`, and on its way to
every org after it.

## Before you start

- [ ] [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md) finished: JWT authentication on all four orgs
- [ ] A clean working tree

## Steps

### 1. Receive Mariia's Pull Request

**Training: Level 3** > **Simulate my teammates**, from the Welcome page, and pick **US-052
The Installation layout in two columns**.

![The Level 3 training menu on the Welcome page](../../_assets/annotated/vscode/welcome-custom-menu-3.png)

It opens her Pull Request into `integration` in your fork (your own copy of the course repository on
GitHub, for example `github.com/my-username/sfdx-hardis-training`). Open it from **Pull requests**,
and wait for its two checks.

### 2. Read the robot first

Read the sfdx-hardis comment, top to bottom. Four things, in this order:

1. **Did it deploy?** The comment opens on a banner reading *Validation Results (deployment
   simulation)* on a check job and *Deployment Results* on a merge job, with a line under it saying
   whether it passed. The Salesforce deployment id is not printed anywhere: it is carried as an
   invisible HTML marker, so that a merge job can reuse the validation as a Quick Deploy
2. **How much does it deploy?** Not a list. One line of counts: how many components were sent, how
   many changed, and how many of those were created, updated, deleted or left unchanged. If the
   counts do not match the size of the story, that is your cue to go and read the diff
3. **What does it delete?** The `deleted` count on that same line. Flows get more: a **Flow changes**
   list linking to a diff comment per Flow, and a **Flow deletion** table when versions are being
   removed. There is no destructive changes section for anything else, so a deleted field shows up
   as one number and nothing else. That is worth knowing before you rely on the comment to catch one
4. **Tests and coverage.** Coverage every time, and a collapsed *Apex test classes* block when the
   job ran named test classes. Failures only when there are failures

Reading it in that order takes two minutes. On US-052 it reads green, a small number of components
updated and **nothing deleted**, and it is right about all of it. The exact counts are yours, not
the lab's: they compare your branch with what your `helios-integration` holds today, so a story that
touches one file can still update a few components when your org is behind. `deleted: 0` is the
number that matters here, and it is the one step 4 is about. The comment also tells you what it
cannot do for you, which is step 3.

### 3. Read the diff, looking for what the robot cannot see

The robot checks that the deployment works. It cannot check that the deployment is a good idea.

Click **Files changed** **(1)**. The file tree on the left lists what the story touched: one file,
the layout **(2)**. One removed line is marked **(3)**: leave it for now, step 4 is about it.

![The Files changed tab of Mariia's Pull Request](../../_assets/annotated/web/github-pr-files.png)

Go through the diff with four questions:

| Question                                 | Why it matters                                                                                                        |
|------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| **Does this match the story?**           | Compare with US-052 in the backlog. Extra changes are either scope creep or an accident, and both are worth a comment |
| **Does anything disappear?**             | A removed field, a removed picklist value, a removed permission. Salesforce will happily deploy a deletion            |
| **Are permissions on a Permission Set?** | A Profile carrying field permissions means somebody bypassed the convention                                           |
| **Would this be reversible?**            | If this turns out wrong in production on Friday, what is the path back?                                               |

### 4. Find the one the robot missed

The layout diff has three changes. Two go together: `Crew_Capacity_Cap__c` leaves the first column,
and comes back in the second. That is the story.

The third is a removed block **(3)** in the picture of step 3, and nothing adds it back:
`Total_Capacity_kW__c`. Read fast, it looks
like part of the move. Read again: the installed capacity did not move to the second column, it
**left the layout**.

Nothing fails. The field still exists, the deployment check is green. But once this is merged,
nobody sees a capacity on an installation record any more, and the first person to notice will be
whoever reads that number on a Monday morning.

Then compare with what Mariia wrote. The description says *the crew capacity cap moves to the second
column*. It says nothing about a field going. That is the gap a review is for: the diff says one
thing, the description another, and only one of them is what gets deployed.

**Nothing in the pipeline can catch that.** A layout with one field fewer is a valid deployment, the
counts line says `updated: 1`, and only somebody who knows the org can see what is missing.

### 5. Ask for the change, on the line

Hover the line where `Total_Capacity_kW__c` is removed, click the blue **+** that appears, and
comment:

> `Total_Capacity_kW__c` comes off the layout with this change, and the description does not say so.
> I think it went missing with the move: can you put it back in the second column, under the cap,
> read only?

Then **Review changes** at the top right of the tab, **Comment**, **Submit review**. On a real
project you would choose **Request changes**, which keeps the Merge button honest until the author
answers. GitHub hides it here because the teammate Pull Requests of this course are opened from your
own account, and nobody requests changes from themselves.

Two things about that comment worth copying:

- **It says why**, so the reader can judge rather than take your word
- **It says what happens next**, so nobody has to ask

**Do not merge.** The Merge button is green, and it is wrong.

### 6. Review the fix, then merge

The fix is Mariia's to make: a release manager reviews and merges the contributors' Pull Requests,
and does not write their features. She answers the next morning, on the same branch.
**Training: Level 3** > **Simulate my teammates**, and pick **US-052 Mariia puts Total Capacity
back, beside the cap**.

It adds one commit to her branch, so the same Pull Request updates, and its checks run again. Open
**Files changed** again: GitHub offers to show only the changes since your review, and there is one,
`Total_Capacity_kW__c` added in the second column, read only, under the cap. The whole diff of the
Pull Request now moves one field and removes nothing.

When the checks are green, merge with **Squash and merge**, as for every feature Pull Request (Lab
1.6): the two commits become one line in the history of `integration`, titled like the Pull Request.
On a real project, this is where you click **Approve** first.

### 7. Delete the branch

GitHub offers the button. Take it.

<details markdown="1"><summary>Under the hood: what produced the comment you just read</summary>

The check job ran:

    sf hardis:project:deploy:smart --check

and then posted the comment through the GitHub API with the token the workflow already has.

**The comment is updated in place** on every push rather than added again, which is why the Pull
Request does not fill up with twenty robot comments. It finds itself again through a hidden marker
carrying a message key, and there are in fact **two** such comments, each updated independently: one
for the check job, one for the merge job. A third one collects the deployment actions, and Flows get
one each.

The counts it prints come from what Salesforce reported back about the deployment, not from the git
diff. The two can differ, and when they do the deployment is the truth: it is what the org received,
or would have received.

Deletions are the weak spot. `hardis:work:save` writes `manifest/destructiveChanges.xml` when a
contributor removes something, and a contributor can produce one **without meaning to**, by
unticking something in the selection screen after it was committed. The comment gives that a number
in the counts line, and a table only when Flows are involved. If a Pull Request's counts show
anything deleted, the comment has told you everything it is going to: the rest is the diff.

<!-- command-links:start -->
Command documentation: [hardis:project:deploy:smart](https://sfdx-hardis.cloudity.com/hardis/project/deploy/smart/), [hardis:work:save](https://sfdx-hardis.cloudity.com/hardis/work/save/)
<!-- command-links:end -->

</details>

## What you should see

- Your review comment on Mariia's Pull Request, on the line that removed `Total_Capacity_kW__c`
- Her fix in the same Pull Request, and the Pull Request squash merged into `integration`
- The Installation layout in `integration` with the cap and `Total_Capacity_kW__c` in the second
  column

## If it goes wrong

**Simulate my teammates says "Nothing to commit".**
The scenario already ran: each one is used once. The Pull Request is in your fork, open or merged.

**The checks never run after Mariia's fix.**
Actions are disabled, or the JWT secrets are missing for `integration`. [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md).

**You merged before the fix.**
Then `Total_Capacity_kW__c` is off the layout in `integration`. Run the fix scenario anyway: it
opens the fix as a new Pull Request from the same branch, and you review and merge that one. If you
already deleted her branch, click **Restore branch** at the bottom of the merged Pull Request
first.

## Check your work

Welcome page > **Training: Level 3** > **Check my work**, then pick **Lab 3.2**.

## Go deeper

- [Review and merge Pull Requests](https://sfdx-hardis.cloudity.com/salesforce-devops-validate-merge-request/)
- [Check the Pull Request results](https://sfdx-hardis.cloudity.com/salesforce-devops-handle-merge-request-results/)

[Next: Lab 3.3 - Deploy to integration and read the deployment log](3-3-deploy-to-integration-and-read-the-log.md){ .md-button .md-button--primary }
