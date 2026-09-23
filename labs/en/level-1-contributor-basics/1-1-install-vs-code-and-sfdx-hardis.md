---
id: lab-1-1
title: "Lab 1.1 - Install VS Code, Git and sfdx-hardis"
description: "Install Git, Node.js, VS Code and the sfdx-hardis extension, then let its Setup panel install the Salesforce CLI and plugins without typing a command."
level: 1
lab: 1
lang: en
source_rev: ""
screenshots:
  - annotated/web/git-download
  - annotated/web/vscode-download
  - annotated/web/nodejs-download
  - annotated/vscode/extensions-install
  - annotated/vscode/welcome--first-open
  - annotated/vscode/welcome--setup-button
  - annotated/vscode/setup
  - annotated/vscode/setup--ready
depends_on:
  commands: []
  flags: []
  config: []
  panels: [welcome, setup]
  docs: [salesforce-devops-use-install, vscode-extension]
---

# Lab 1.1 - Install VS Code, Git and sfdx-hardis

**Level**: 1 Contributor basics

**Time**: ~15 min

**You will**: turn a plain computer into one that can do Salesforce DevOps, without typing a single
command.

## The situation

Your first morning on any Salesforce team, this one or a real one. Before you can be given a ticket,
five things have to be on your machine, and the last of them installs most of the rest for you.

!!! tip "This lab stands on its own"
    It is the same list whether you are here for the course or joining a project that already has a
    pipeline, and it does not care which git provider that project uses: GitHub, GitLab, Azure
    DevOps and Bitbucket all work the same from here. If somebody sent you here to get set up
    before your first day, **finish this lab and stop**. Lab 1.2 is where the training-specific part
    starts: free Salesforce orgs, a training repository, fictional data. None of that belongs on a
    real project.

!!! tip "No VS Code? A browser tab or another editor does it"
    [Agentforce Vibes](https://www.salesforce.com/agentforce/developers/vibe-coding/ide/) is VS Code inside Google Chrome, launched from a Salesforce org:
    a developer sandbox, or the free Developer Edition org [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md)
    signs you up for, which means this path costs nothing and needs nothing you do not already
    create here. The whole course runs in it. Two differences and no others: the
    Salesforce CLI is already there, so the part of the Setup panel that installs it has nothing to
    do, and the extension comes from [Open VSX](https://open-vsx.org/extension/NicolasVuillamy/vscode-sfdx-hardis)
    rather than the Visual Studio Marketplace. Every panel, every button and every step below is
    the same, and so are the screenshots: they were taken in desktop VS Code, which is the same
    editor.

    [Cursor](https://cursor.com/) and the other editors built on VS Code work the same way, and from the same
    Open VSX listing. Whichever one you use, the rest of this lab is written for what you see in it.

## Before you start

- [ ] A computer where you can install software, and permission to do so, **or** any Salesforce
      org to launch Agentforce Vibes from: a developer sandbox, or the free Developer Edition org
      of Lab 1.2

## Steps

### 1. Install VS Code and the extension

!!! tip "In Agentforce Vibes, start at the extensions"
    The three downloads below are already in the tab: Git, Node.js and the editor itself come with
    it. Skip them and go straight to [installing the extension pack](#install-the-extension-pack),
    near the end of this step. One difference
    there: the Extensions view of a browser IDE searches
    [Open VSX](https://open-vsx.org/extension/NicolasVuillamy/vscode-sfdx-hardis) rather than the
    Visual Studio Marketplace, and the pack is the same one under the same name. And wherever this
    lab says to restart VS Code, reload the browser tab instead: it does the same thing, which is
    to let the editor see what was just installed.

First [Git](https://git-scm.com/downloads). Git is the tool that records every version of a project
and moves it between your laptop and wherever your team keeps the project, and everything else in
this course sits on it. You will
never have to type a Git command: the extension runs them for you, and shows you which one it ran.
The download page offers your operating system at the top: on Windows take **Click here to
download** **(1)**, the 64-bit standalone installer.

![The Git download page for Windows](../../_assets/annotated/web/git-download.png)

**Accept every default the installer offers**, and on Windows that matters more than it sounds. The
defaults include **Git Bash**, a Unix-style terminal that comes with Git, and sfdx-hardis uses it:
several of the commands the extension runs for you are shell commands that the Windows command
prompt does not understand. If you untick the Git Bash components, parts of this course fail with
errors that look like nothing to do with Git.

Two screens are worth reading rather than clicking through:

- **Select Components**: leave **Git Bash Here** and **Git GUI Here** ticked
- **Adjusting your PATH environment**: keep the recommended middle option, *Git from the command
  line and also from 3rd-party software*, so VS Code can find Git

macOS and Linux already have a Unix shell, so there is nothing to choose there.

!!! note "You may already have it"
    Plenty of machines do. Install it anyway: the installer recognises an existing Git and offers to
    update it. The Setup panel in step 2 checks it as well, and tells you if it is missing.

!!! tip "Checking Git Bash is there, on Windows"
    Right-click any folder: the menu should offer **Open Git Bash here**. In VS Code you will also
    find **Git Bash** in the terminal's dropdown, next to PowerShell. If neither shows up, run the
    Git installer again and keep the defaults this time.

Then open [Visual Studio Code](https://code.visualstudio.com/) and take the download for your machine.
On Windows that is the **Windows** button **(1)**; the two cards next to it hold the macOS and Linux
builds.

![The Visual Studio Code download page, one card per operating system](../../_assets/annotated/web/vscode-download.png)

Then [Node.js](https://nodejs.org/), **version 22 at the least, 24 recommended**. Two things to
get right on that page:

1. the version selector **(1)**. The one marked **LTS** is the safe choice, as long as it reads 22
   or higher
2. **Windows Installer (.msi)** **(2)**, or the equivalent for your machine

![The Node.js download page, with the version selector and the installer buttons](../../_assets/annotated/web/nodejs-download.png)

Both are next-next-finish installers.

!!! warning "Restart VS Code after installing Git or Node.js"
    Both installers add themselves to the **PATH**, the list of places your machine looks for a
    command. A program only reads that list when it starts, so a VS Code that was already open when
    you installed them still cannot find them, and the Setup panel in step 2 reports them missing
    even though they are there. Close VS Code completely, windows and all, and open it again.

    The same applies to a terminal you already had open.

Then open VS Code and install the extensions. The **Extensions** icon **(1)** sits in the narrow bar
down the left, and looks like four small squares with one lifted away. Click it, type `hardis` in
the search box **(2)**, and click **Install** on **SFDX Hardis Extension Pack for Salesforce, by
Cloudity** **(3)**, published by Nicolas Vuillamy.
{ #install-the-extension-pack }

![The Extensions view of VS Code, with hardis typed in the search box](../../_assets/annotated/vscode/extensions-install.png)

Two things happen around that click, and both are easy to miss:

- VS Code may ask **Do you trust the publishers of these extensions?**. Answer **Trust Publishers &
  Install**. A pack installs extensions from several publishers, and it stops there until you say so
- Once it is installed, open the gear icon next to the pack and tick **Auto Update**. The course and
  the product move together, and an extension a few versions behind is the most common reason a
  panel in these labs does not look like its screenshot

The pack installs sfdx-hardis itself along with the tools that go with it: Git Graph, which draws
your branches, the YAML and Markdown support the configuration files use, and the Apex log viewer.
Later levels use them, so take the pack rather than the single extension above it.

A new icon appears in the left bar **(1)**. Click it: the **Welcome** tab **(2)** opens, and that
tab is where every lab of this course starts.

![VS Code with the sfdx-hardis Welcome tab open](../../_assets/annotated/vscode/welcome--first-open.png)

### 2. Let the Setup panel install the rest

You need the Salesforce CLI and a few plugins. You are not going to install them by hand: the
extension has a panel that checks what is missing and installs it.

!!! tip "In Agentforce Vibes, the Salesforce CLI is already there"
    Its card is green before you start, and the panel has only the plugins left to install. Run the
    same **Run pending installs** and read the same list; there is simply less of it.

On the Welcome page, the button at the top left of the header band **(1)** opens the Setup panel.
There is no card called Setup: the button is labelled with the state of your dependencies, so it
reads **Check in progress** while it is still looking, then either **Dependencies up to date** or
**N update(s) needed**. Hover it and the tooltip says **Open Setup**. Wait for the check to finish,
then click it.

![The Welcome page header, with the dependency-state button at its left](../../_assets/annotated/vscode/welcome--setup-button.png)

The panel lists every dependency the pipeline needs, with the version you have and the version that
is current. The ones worth knowing by name:

- **Salesforce CLI** - the program every Salesforce tool on your machine talks to
- **sfdx-hardis** - the add-on that puts the User Story commands into that CLI
- **SFDMU** - loads and extracts records, which is how your orgs get their data
- **sfdx-git-delta** - works out what changed between two versions of the project, which is what the
  deployments send
- **Salesforce Extension Pack** - the official Salesforce tooling for VS Code

Node.js and **Git** **(3)** have a card each as well: the panel checks what you installed in step 1
and says so.

![The Setup panel, listing every dependency with its version](../../_assets/annotated/vscode/setup.png)

The picture was taken on a machine where everything was already in place, so every card is green and
offers nothing but **Re-check** **(2)**, and the band at the top has nothing to propose **(1)**.

Your first run will not look like that. Anything missing or out of date turns amber and its button
reads **Install** or **Upgrade**, and the band at the top then carries **Run pending installs**
**(1)**. Use that one: it queues the whole list and reports each item as it finishes.

This takes a few minutes. It is the longest part of this lab and the only one you never repeat.

!!! warning "Restart VS Code once the installs are finished"
    The Salesforce CLI lands on the PATH as well, so the same rule applies: close VS Code and open
    it again before you carry on. Then press **Re-check** on the Setup panel. Anything that was
    still red for this reason turns green.

<details markdown="1"><summary>Under the hood: what the Setup panel just did</summary>

For each missing dependency it ran the plain npm command you would have run yourself, for example:

    npm install --global @salesforce/cli
    sf plugins install sfdx-hardis
    sf plugins install sfdmu
    sf plugins install sfdx-git-delta

then re-ran `sf version` and `sf plugins` and compared the answers with the versions published on
the npm registry. That comparison is the whole point of the panel: a pipeline breaks in confusing
ways when one person is two major versions behind, and nobody notices until a deployment fails.

</details>

## What you should see

The **Setup** panel with nothing left to install:

![The Setup panel once everything is installed](../../_assets/annotated/vscode/setup--ready.png)

The line to read is the summary at the top **(1)**. It names anything still missing, and missing is
the only state that stops you. Every card under it is green, **Salesforce CLI** **(2)** included,
with nothing left to do but **Re-check**.

An amber **Upgrade** on one of them is not a failure: it means a newer version exists, and the
button fetches it whenever you feel like it.

That is the whole of this lab. Your machine can now run everything the rest of the course, and every
Salesforce project that uses sfdx-hardis, is going to ask of it.

## If it goes wrong

**The Setup panel says the Salesforce CLI is missing after it installed it.**
It landed somewhere that was not on the PATH of a terminal that was already open. Close VS Code
completely and open it again.

**The extension does not appear after installing it.**
Reload the window: **View > Command Palette**, then **Developer: Reload Window**.

**The Setup panel shows a red line you cannot clear.**
Click the line. The panel tells you what it tried and what it got back, and that message is nearly
always the answer.

## What comes next

If you came here to set up a real project, you are done: open your team's repository and the
**DevOps Pipeline** panel will tell you the rest.

If you are taking the course, [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) builds you a small environment to work in: one free Salesforce
org, three scratch orgs created from it, a copy of the project, and a pipeline. It is the last of
the setup.

## Go deeper

- [Install sfdx-hardis](https://sfdx-hardis.cloudity.com/salesforce-devops-use-install/)
- [The VS Code extension](https://sfdx-hardis.cloudity.com/vscode-extension/)

[Next: Lab 1.2 - Create your Dev Hub, scratch orgs and CI/CD pipeline](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md){ .md-button .md-button--primary }
