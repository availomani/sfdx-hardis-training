# Changelog

What changed in the course, for learners and trainers. The course has no versions: each section is
a day, newest first, and a change goes under the date of the day it is made.

## 2026-10-07

- Labs 1.5, 2.2 and 2.8: the Metadata Retriever screenshots show its new **Retrieve mode** list.
- Labs 2.6 and 2.8: the Metadata Retriever now brings Profiles back whole, with only the permissions they grant, and the labs say what that changes in the file you commit.

## 2026-10-06

- Lab 2.4: the Helios project turns on the stop of the check on a pending manual step, which sfdx-hardis no longer does by default.
- Clean up a training org says when a step failed instead of "nothing to remove", and retries when the org's address briefly does not answer.
- Lab 1.3: what to do when New User Story says the branch already exists.
- Lab 1.6: the checks table names the pills the picture carries, the check comment picture shows the Simulated deployment line, and the deployment one its table of changes.
- Level 1: the address of your fork is spelled out where a step opens it, not in every paragraph.
- Labs 1.6 and 3.5: the comment shows the code coverage first, and its protected metadata table is opened from a collapsed section.
- Labs 1.6 and 3.2: the Pull Request comment reads "Simulated deployment" on a check, with a table of the changes per type of component.
- Lab 3.5: the Pull Request comment shows the remote site setting protected by package-no-overwrite.xml.
- Lab 3.1: JWT is configured for preprod and production only, the configuration starts with a New User Story, and the second secret has its own picture.
- Labs 3.2, 3.3, 3.5, 3.6 and 3.11: integration and uat keep their auth URL secrets, and Lab 3.6 is where the JWT keys prove themselves.
- Reset this level also deletes the branches of that level's labs and sets up helios-dev and helios-integration again.
- Help: a new "Start the course over" section, linked from every level.
- Lab 2.1: what to answer when VS Code offers to merge the parent branch, and what to do when the backpromote refuses a required field.
- Simulate my teammates commits only its own files, and merges the Pull Request after a MegaLinter formatting fix.

## 2026-10-05

- Lab 3.8: the first monitoring run is green even with findings, and the lab says where to read them.
- A badge claim is answered once: the audit no longer posts the same comment twice on the issue.
- Lab 1.1: the Git installer options are named as the installer shows them, each installer is named where the lab talks about it, and the pill of the Extensions icon sits on that icon.
- Lab 1.2: a note says what a connected org and the default org are, and the Agentforce Vibes tip opens the GitHub CLI step instead of closing it.
- Lab 1.4: what to do when Open in Orgs Manager brings no browser tab.
- Lab 1.5: step 7 says which tab to go back to, with a picture of the two cleaning lines.
- Lab 2.2: the Start panel of Flow Builder has no Done button, the lab now closes it with its X.
- Set up my training environment creates your fork again. Its first step always stopped on "The fork could not be created", because the GitHub CLI refuses `--remote=false` once a repository is named, before it even contacts GitHub. When the fork does fail, the panel now shows what the GitHub CLI said above the usual reasons, and Lab 1.2 says to read it.
- Lab 2.1 works the same whether you did Level 1 or used Reset this level: you pick Romain's US-017, the only work your dev org lacks. The Backpromote panel can only start from a Pull Request of your fork, and after a reset your Level 1 stories are one commit, not Pull Requests, so "pick #1 US-014" could not be done. Step 1c checks that your dev org holds Level 1, which Romain's layout needs, and says how to put it there when you joined at Level 2. The lab also says which rows cannot be picked, that a number in brackets like (#77) is a Pull Request of the course repository, that the panel reads `integration` from GitHub without a pull, and that Romain's Pull Request has three files, not two.
- Every screenshot of VS Code was taken again with version 8.10.0 of the extension and 8.13.0 of sfdx-hardis, and its numbered pills put back in place. The GitHub pictures come from a brand new fork.
- Lab 3.3: the fix Pull Request of US-062 now ships the Crew Leads public group with the sources. Without it, the promotion to UAT of Lab 3.5 ended with a red deployment job, because the group only existed in the org where you created it by hand.
- Lab 3.6: the promotions to preprod and to production stop red until the email deliverability step is done in each org, ticked, and the check run again. The lab now says so, as Lab 3.5 does.
- Lab 2.1: the Backpromote list holds more than the three stories of the picture. The lab names the one to pick, #1 US-014, and says what the rows without a number are.
- Lab 2.4: at the red check, the two post-deployment actions read "not run in this org branch yet", not "skipped".
- Lab 3.5: the example release notes count 22 Pull Requests and 16 tickets, with the two Pull Requests Lab 3.3 gained.
- Save / Publish no longer ends by asking for a manual actions file: the project declares that manual steps are deployment actions, and sends you to the DevOps Pipeline panel.
- The MegaLinter comment of your Pull Requests no longer lists thousands of findings on the scripts of the course.
- Clean up a training org also removes the Crew Leads public group, so Lab 3.3 can be done again on the same org.

## 2026-10-04

- The screenshots of the DevOps Pipeline panel show it as the next VS Code extension draws it: a Pull Requests search button in the header, and a Pull Request window with General, Tickets, Deployment Actions, Validation, Code Quality and Deployment tabs.
- Lab 2.3: the picture of the feature branch and of the badge of its Pull Request shows the diagram again, with both marked.
- Labs 3.5 and 3.10: the branch windows show their Pull Requests as the list the next VS Code extension draws, with its text filter and a checkbox on each story.
- Lab 2.4: after declaring the three deployment actions, an explicit step says to commit their file and publish again, so the Pull Request carries them, and names the VS Code message that reminds you.
- Lab 3.3: the screenshot of the Deployment Actions tab shows the switch to the next promotion above the actions, and every item of the row menu.
- Labs 2.3 and 2.4: the deployment actions file shows the ids the editor generates, and says not to change them.

## 2026-10-03

- Lab 2.7: activate the flow after each change, and open its latest version to rebuild the flat roof rule, because Flow Builder can open an older one without Mariia's cap.
- Lab 2.8: what to do when the retrieve of every row stops on `GenOpAgentConfig`, a type Agentforce creates and the Salesforce CLI does not know yet. The next VS Code extension no longer lists the files of a Lightning Web Component one by one, which made that retrieve fail.
- Labs 2.4 and 3.5: a manual step declared before the deployment now stops the check until it is ticked or marked as done, then the check is run again.
- Lab 3.3 gains a Part 3: a teammate Pull Request whose post-deployment actions fail after the merge, recovered with Retry, a fix Pull Request and Mark as done from the Deployment Actions tab. It needs the next versions of sfdx-hardis and of the VS Code extension.
- Lab 2.3 shows the Deployment Actions tab as the next VS Code extension draws it: actions grouped by Pull Request, the type and the phase under the label.

## 2026-10-02

- The Training menu links and the User Story links of a new fork point to the course at its new address, <https://sfdx-hardis-training.github.io/>. A fork made earlier keeps working: the old address redirects.
- Lab 2.4 says where the two Apex classes are copied, and its Schedule Batch action finds `CrewCapacityBatch` in the list: the class is read from the project, and the lab explains the label it carries. It needs version 8.9.2 of the VS Code extension.
- Lab 2.5 names the two ways to the Org Monitoring Workbench, and says the Apex Tests card runs on the default org instead of asking for one.

## 2026-09-30

- **The course has a new address: <https://sfdx-hardis-training.github.io/>**, on its way to
  sfdx-hardis-training.cloudity.com once the domain is in place. Every old link keeps working:
  hardisgroupcom.github.io/sfdx-hardis-training now sends each page to the same page at the new
  address, and still serves the badge records, the story records and the share cards themselves, so
  a badge already claimed and a fork already made carry on as they are.
- The language picker works on the new address. It held a link that only existed under the old one.
- Lab 2.4 creates a Crew Capacity tab in the Helios Delivery app, so the records can be found in every org without typing a URL.

## 2026-09-29

- Lab 1.6 shows the counts a learner gets today, 36 sent and 7 changed, in its text and its two comment pictures.
- Pictures that show a later state of the course now say so: the pipeline of Lab 1.6, the Data Workbench of Lab 2.4 and the Merge Changes list of Lab 2.7.
- Lab 2.1 names the field the backpromote actually brings, Romain's Signed Off By.
- Lab 3.2 says the fixed Pull Request moves two fields to the second column, and Lab 3.5 explains why its notes count 20 Pull Requests.
- A badge claim now republishes the reset branches, so a retrofit in Labs 3.7 and 3.10 no longer brings badge files along.

## 2026-09-27

- Helios starts with the package-no-overwrite.xml every sfdx-hardis project gets, and Lab 3.5 adds the warehouse remote site setting to it.
- Pull Request checks are faster: MegaLinter no longer runs checkov and grype on the course.
- New **Create my lab records** entry in the Level 2 Training menu: Lab 2.4 no longer asks you to type the 12 Crew Capacity records, it creates them and you check them.
- The Apex code analyzer now blocks a Pull Request, as on a real project: Lab 2.5 shows the query in a loop refused, and the Apex samples the labs copy no longer carry findings.
- Lab 2.4 gives the SOQL query and the label to type when you create the data workspace, links SFDMU, and says how precise a manual action must be.
- Lab 2.8 step 4 says there is nothing to click, and Lab 2.9 says how to create the checklist records by hand.
- Clearer wording across the labs: retrieve, merge and bring back replace vaguer verbs, and the capstones ask for a GitHub star if you liked the course.

## 2026-09-26

- After **Reset this level** on Level 2, **Set up one of my training orgs** and every Pull Request into integration no longer fail on the Signed Off By field, which the start state granted before US-017 created it.
- Lab 2.1 walks through merging Romain's Pull Request click by click, with screenshots. In Level 2, **Simulate my teammates** prints the address of the teammate Pull Request and offers to merge it for you once its checks pass, and it knows when you already merged it yourself.
- **Claim my badge** no longer says your work is only on this computer when it is on your fork: after **Reset this level**, `integration` showed as not pushed, and so did branches pushed without tracking. The help page says how to claim from a fork made before this fix.
- The course site publishes again: the changes of 2026-09-25 below never reached it, because four labs named another lab without linking it.
- **Clean up a training org** works on an org that was used: it deletes the old versions of the Helios flows, and erases the objects instead of leaving them under Deleted Objects, where they made the next **Set up my training environment** fail.
- **Clean up a training org** also removes the External Client Apps of Lab 3.1, which stopped **Add/Configure Org** the next time Level 3 was walked on the same orgs.
- **Trigger my workflows** works after the Actions banner is clicked late: it no longer waits for the scheduled workflows GitHub keeps off on a fork.
- Labs 2.4, 3.5 and 3.6 say when a ticked manual action is recorded: by the next job that carries its Pull Request, so a pre-deployment step is done and ticked before the merge.
- Lab 2.2 keeps the new Crew Warning Sent field visible to the System Administrator profile, so Flow Builder can offer it, and says how to fix a field created without it.
- Lab 3.6 warns that a second DORA report on the same day replaces the baseline Lab 3.11 compares with.
- Lab 3.7 names the Quick Deploy line of the deployment comment, the one its picture marks.

## 2026-09-25

- Lab 3.8 answers the new question about the CI/CD repository that deploys to the org, and explains the `AGENTS.md` the nightly backup writes for coding agents.
- **Set up my training environment** waits for the one click GitHub asks for on a new fork, instead of reporting Actions on while no workflow ran.
- Check my work for Lab 1.2 fails when the fork runs none of its pipeline workflows.
- The monthly checks of the course no longer run on learners' forks.
- Lab 1.4 describes the Installation record page as it is: fields edited in place, no Details tab.
- Lab 1.5 no longer promises your branch in the pipeline diagram before its Pull Request exists.
- Lab 1.6 explains the MegaLinter warnings, and what to do when MegaLinter pushes a commit onto your branch.
- The badge claim says **Create**, the label of the GitHub button.
- **Simulate my teammates** no longer leaves a branch behind that made **Claim my badge** refuse Level 3.
- Lab 2.2 keeps the new checkbox off the layout, and asks for the flow description its picture shows.
- Lab 2.5 no longer promises a MegaLinter check with no findings.
- Lab 2.7 stages the rebuilt flow instead of committing it before the merge.
- Lab 2.8 gives the real size of the retrieved Admin profile.
- Lab 3.5 tests the crew cap on an installation it sets to Planned.
- Lab 3.7 squashes the hotfix, like every fix.
- Lab 3.11 counts eleven checks.
- Level 1 pictures of the DevOps Pipeline show a Level 1 fork, and the training menus show **Update my course**.
- Lab 2.1 pictures show the three stories a learner brings down, and Lab 2.3 the one action of its Pull Request.

## 2026-09-24

- The course has its own **Free training** page on the sfdx-hardis documentation site, linked from its menu, its home page and its guides.
- **Update my course** and **Reset this level** no longer fail on a course change to the workflow files: GitHub is asked once for the permission they need.
- Level 3: a new Lab 3.10 on promotion branches (Beta), and the capstone becomes Lab 3.11.
- Lab 3.10: two GitHub screenshots of a real promotion, the Pull Request description and the red check naming the files with conflict markers.
- Lab 3.10: the explanation of the cherry-pick conflict now matches what git writes, in the layout and in the permission set.
- Reset this level: the start branches are published from `main` automatically, so a reset always lands on the current labs.
- New **Update my course** in the Training menu of every level: brings the course changes made since you forked, through a Pull Request into `integration`, without losing your work.
- Every training command, and **Where am I?**, tells you when your fork is missing course changes it runs (lab pages, translations, the site and badges are ignored).
- Reset this level keeps the certificate keys of Lab 3.1, so a Level 3 pipeline still logs in to its orgs after a reset.
- **Update my course** goes to the end on its own: it waits for the checks of its Pull Request, merges it and brings the update to your computer.
- Badge pages: the LinkedIn button opens a post already written, the preview says which badge was earned, and a square picture can be downloaded to post the badge full size.

## 2026-09-23

- The QA banner shows only on the levels still in QA.
- Level 1 in French: fixes found by walking it end to end.
- Badges: the pages say the badges show up on Trailhead banners.
- Promotion branches are called Beta rather than experimental.
- Fixes found by an end to end walk of the whole course.
- The course runs in Agentforce Vibes, in a browser tab.

## 2026-09-22

- Badges: a second badge for a banner, the banner version on the badge page, and Release Manager as a superbadge.
- Every page shows in the language of the reader, and the badges got a new look.
- A Help page about Cloudity and open source, and the product documentation in the menu.
- One menu per language, and levels that start closed.
- Each lab declares what it does through the panels, so it can be walked automatically.

## 2026-09-21

- Every lesson runs from the VS Code panel, with no terminal behind it.
- The course is available in French, with English as the reference.
- Page views are measured on the course site.

## 2026-09-20

- First release: Salesforce DevOps with sfdx-hardis, 3 levels and 26 labs.
