/**
 * The two hosts of this course, in one place.
 *
 * The course is built here and published to
 * sfdx-hardis-training/sfdx-hardis-training.github.io, an organization site,
 * which therefore serves at the root of its host rather than under a repository
 * name. That is the base path the custom domain answers on, so the copy
 * published there today already has the URLs it will keep.
 *
 * It has been published until now as a project site of this repository, under
 * /sfdx-hardis-training/. That URL is in the badge records people already hold,
 * in the Trailhead trailmixes, in the sfdx-hardis command descriptions and in
 * the VS Code extension fixtures, so it keeps answering: the old site publishes
 * one redirect page per page of the course, built by
 * scripts/build/redirect-site.mjs.
 *
 * SITE_URL is the canonical one, and course-site.yml says the same thing in
 * site_url. scripts/verify/check-site.mjs fails if the two ever disagree, which
 * is what makes this file the switch: the day the domain answers, SITE_URL
 * becomes CLOUDITY_SITE_URL, site_url follows it, and the workflow starts
 * deploying the redirect site in place of the course.
 *
 * None of these carry a trailing slash. A base URL that sometimes ends in one
 * and sometimes does not is how a joined path gains a double slash.
 */

/** The custom domain, once DNS and the certificate are in place. */
export const CLOUDITY_SITE_URL = "https://sfdx-hardis-training.cloudity.com";

/** The project site of this repository, where the course has lived so far. */
export const GITHUB_PAGES_SITE_URL = "https://hardisgroupcom.github.io/sfdx-hardis-training";

/** Where the course is canonically published. Flip to CLOUDITY_SITE_URL, together with site_url in course-site.yml. */
export const SITE_URL = GITHUB_PAGES_SITE_URL;
