---
title: "Help"
description: "Where to ask when a step of the course does not work, and what Cloudity offers a team running sfdx-hardis on a real Salesforce project: setup, training and support."
id: help
lang: en
---

# Help

## The course and the tools are free

Everything this course teaches is open source. The sfdx-hardis CLI and the VS Code extension that
runs it are published under the AGPL-3.0 licence, on GitHub, and cost nothing to use:
[hardisgroupcom/sfdx-hardis](https://github.com/hardisgroupcom/sfdx-hardis) and
[hardisgroupcom/vscode-sfdx-hardis](https://github.com/hardisgroupcom/vscode-sfdx-hardis). The
labs you are reading, their screenshots and the Helios Energy project they are built on live in
[hardisgroupcom/sfdx-hardis-training](https://github.com/hardisgroupcom/sfdx-hardis-training),
under the same terms. There is no paid version of the product waiting behind a page of this
course, and no paid version of the course.

Both come from [Cloudity](https://cloudity.com/), a Salesforce consulting company. Cloudity built
sfdx-hardis for its own delivery teams, releases it in the open, and keeps maintaining it there.
Anyone can open an issue or a Pull Request, and a good part of what ships each month started as
somebody's bug report.

## When a step of the course does not work

1. Open the **If it goes wrong** block of the step. It lists the two or three ways that step
   usually fails, and what to do about each.
2. Leave a comment at the bottom of the page. Every page of this course ends with a comment box,
   backed by GitHub Discussions: say which step, what you clicked and what you saw. That is the
   fastest way to get the page fixed, and it helps the next person on the same step.
3. For the product rather than the course, read the
   [sfdx-hardis documentation](https://sfdx-hardis.cloudity.com/) and search the
   [issues](https://github.com/hardisgroupcom/sfdx-hardis/issues) before opening one.

## When the course changed after you forked

The lab pages are always current: you read them on this site. What your fork holds is fixed on
the day you forked it: the scripts behind the **Training** menu, the teammate stories of
**Simulate my teammates**, the rules of **Check my work** and the project configuration. When the
course adds a lab or fixes one of those, your fork does not get it on its own.

Every training command tells you when that happened: it checks your fork against the course
first, and says how many changes you are missing. **Where am I?** always shows it. Changes to the
lab pages, the translations, the site and the badges of other learners are left out, since you read
them here and they change nothing your fork runs.

To bring the changes in, click **Update my course** in the Training menu of your level. It merges
the course into a branch of its own, made from your `integration`, and opens a Pull Request into
`integration`, like every change in this course. Wait for its checks, merge it with **Merge pull
request**, never a squash, then **Pull** in the Source Control panel. Your work is kept.

If the course and you changed the same file, the command stops, undoes everything and names the
files. Then either **Reset this level**, which starts the level again from its current state and
throws away your work on `integration` in that level, or merge by hand the way
[Lab 2.7](level-2-contributor-advanced/2-7-resolve-a-git-merge-conflict.md) solves a conflict.

## Help on a real project

This course runs on a fictional company, with free orgs and a repository you create for yourself.
A real project brings what no course can hand you: an org with ten years of history in it, a team
that has to keep shipping while the pipeline is being built, and a release calendar. Cloudity does
that work as a service, on top of the same open-source product this course teaches.

- **Setup.** Your team drives and a Cloudity expert reviews the branch model, the pipeline and the
  configuration, or Cloudity sets the whole pipeline up on your Git platform and hands it over.
- **Training.** Sessions for contributors, release managers and project leads, and the change
  management that makes a new way of working stick.
- **Support.** A subscription that keeps a Cloudity expert reachable after go-live, with priority
  on deployment incidents, and a release manager as a service when you have nobody in the seat.

## Support is what keeps sfdx-hardis maintained

sfdx-hardis is free to use. It is not free to maintain. Three Salesforce releases a year, metadata
types that change shape, APIs that move under the product, bugs found by teams deploying to
production on a Friday: somebody has to do that work, week after week, and at Cloudity that
somebody is paid to.

Support subscriptions are what pays for it, and for this course being free. If your team runs its
deliveries on sfdx-hardis, a subscription is the most direct way to keep the project alive and
moving, and it puts your feature requests in front of the people who decide what ships next.

[What Cloudity offers](https://sfdx-hardis.cloudity.com/salesforce-devops-home/#get-help-from-cloudity){ .md-button .md-button--primary }
