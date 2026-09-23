---
title: "Free hands-on Salesforce DevOps course"
description: "Free hands-on Salesforce DevOps course in three levels: Git, Pull Requests, CI/CD pipelines and release management with sfdx-hardis and VS Code."
id: home
lang: en
---

# Salesforce DevOps training with sfdx-hardis

Three free learning paths that take you from "I have never used Git" to "I own the pipeline".

You will work on a real repository for a fictional solar installer, **Helios Energy**, with free
Salesforce orgs that come pre-loaded with the app and its data. Everything you do here is
what a real Salesforce team does every day, with the same tools.

If Git is new to you, that is the expected starting point. Level 1 defines the six words you need,
repository and fork among them, at the moment you first meet each one, and the VS Code extension
runs the Git commands for you.

## The three levels

| Level                                                                 | Who it is for                                                    | Time | Before you start   | You finish able to                                                                                  |
|-----------------------------------------------------------------------|------------------------------------------------------------------|------|--------------------|-----------------------------------------------------------------------------------------------------|
| [**1 - Contributor basics**](level-1-contributor-basics/index.md)     | Admins and developers joining a team that already has a pipeline | 2 h  | Nothing            | Take a User Story, build it, publish it, get a green Pull Request, merge it                         |
| [**2 - Contributor advanced**](level-2-contributor-advanced/index.md) | The same people, once the easy stories are behind them           | 4 h  | Level 1            | Solve deployment errors, declare deployment actions, handle overwrites, resolve conflicts           |
| [**3 - Release Manager**](level-3-release-manager/index.md)           | The person who owns the pipeline, the orgs and the releases      | 6 h  | Levels 1 **and** 2 | Take over an org with no pipeline, review and merge, release to UAT and production, hotfix, monitor |

Levels 1 and 2 are both the contributor path, and they are for **admins and developers alike**. You
do not need to know Git, the Salesforce CLI or DevOps: every step is a click in VS Code or on
GitHub, shown on a screenshot. You may stop after Level 1 and you will be able to deliver. Level 2
is where you learn what to do when delivery goes wrong, which is most of the job.

!!! tip "Developers: open the Under the hood blocks"
    Each significant step ends with a collapsed **Under the hood** block: the command the button
    ran, the files it wrote, and the decision it made for you. An admin can skip them. A developer
    should read every one: they are how you learn what sfdx-hardis does, which is what you need the
    day you script it, debug a pipeline, or take over Level 3.

**Level 2 is required before Level 3.** A release manager reviews other people's deployment errors,
conflicts and deployment actions. Someone who has never solved one cannot review one.

## What you need

- A computer you are allowed to install software on. Lab 1.1 walks through what to install,
  one download at a time, with screenshots. Nothing to install, or not allowed to?
  [Agentforce Vibes](https://www.salesforce.com/agentforce/developers/vibe-coding/ide/) is VS Code in a browser tab,
  launched from a developer sandbox or from the free Developer Edition org Lab 1.2 signs you up
  for, and the course runs there too, as it does in
  [Cursor](https://cursor.com/) and the other editors built on VS Code.
- A [GitHub](https://github.com/) account, free.
- One free [Salesforce Developer Edition org](https://developer.salesforce.com/signup) to start
  with, and one more at Level 3. Lab 1.2 signs you up, and creates the other orgs the course
  needs from that one.
- Nothing else. No paid service, no licence, no credit card.

## What you get

A **Cloudity badge** per level, on a page you can share. It carries your name as your GitHub
profile shows it, your GitHub and Trailblazer usernames, and the date. Here are the three that
Marc B earned:

![Level 1 badge of Marc B](../_assets/badges/example-level-1.svg){ width="200" }
![Level 2 badge of Marc B](../_assets/badges/example-level-2.svg){ width="200" }
![Level 3 badge of Marc B](../_assets/badges/example-level-3.svg){ width="200" }

**Claim my badge**, in the Training menu of each level, checks your work one last time and opens
the claim for you. A job then re-runs every check of the level against your repository and
publishes the badge page.

It is a badge, not a certification. There is no exam and no accreditation. Share it under
*Featured* on LinkedIn, not under *Licenses & certifications*.

Your badge also shows up on your Trailhead banner.
[Trailhead Banner](https://thb.nabondance.me/) draws a LinkedIn cover image from a Trailblazer
username: rank, badge counts, certifications, and the highest sfdx-hardis training badge you have
claimed. Type your Trailblazer username, generate it, and set it as your LinkedIn cover.

![A Trailhead banner, with the sfdx-hardis Release Manager badge in the top row](../_assets/badges/trailhead-banner.png)

## Under the hood, every time

Every lab is written as clicks in the VS Code extension, because that is how the product is meant
to be used. Every significant step then closes with an **Under the hood** block naming the exact
command that ran and the files it touched, so you finish with a mental model rather than a muscle
memory.

## Start

[Level 1 - Contributor basics](level-1-contributor-basics/index.md){ .md-button .md-button--primary }

[Lire ce cours en français](../fr/index.md)
