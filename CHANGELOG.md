# Changelog

What changed in the course, for learners and trainers. The course has no versions: each section is
a day, newest first, and a change goes under the date of the day it is made.

## 2026-09-26

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
