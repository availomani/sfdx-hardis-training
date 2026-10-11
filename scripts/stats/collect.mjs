/**
 * What the course statistics read from GitHub: the forks of the course, the
 * badge claims, and the history of each learner repository.
 *
 * Everything read here is public. One GraphQL query per repository brings its
 * branches, its Pull Requests with their commits and comments, and the history
 * of integration, so a run costs about one call per learner and stays far
 * under what the token of a workflow is allowed.
 */
import { spawnSync } from "child_process";

const API = "https://api.github.com";

/** The token of the workflow, or the one the GitHub CLI holds on a workstation. */
export function githubToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) {
    return fromEnv;
  }
  const cli = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  const token = cli.status === 0 ? cli.stdout.trim() : "";
  if (!token) {
    throw new Error("No GitHub token. Set GH_TOKEN, or sign in with: gh auth login");
  }
  return token;
}

async function request(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "sfdx-hardis-training-course-stats",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

/** Every page of a REST list. */
async function paginate(token, path) {
  const out = [];
  for (let page = 1; ; page++) {
    const rows = await request(token, `${API}${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...rows);
    if (rows.length < 100) {
      return out;
    }
  }
}

/** The forks of the course, as { owner, name }. */
export async function listForks(token, upstream) {
  const forks = await paginate(token, `/repos/${upstream}/forks`);
  return forks.map((fork) => ({ owner: fork.owner.login, name: fork.name }));
}

/** "https://github.com/someone/their-repo.git" as { owner, name }, or null. */
export function parseRepositoryUrl(url) {
  const match = String(url || "").match(/github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:[/\s?#]|$)/i);
  return match ? { owner: match[1], name: match[2] } : null;
}

/**
 * The badge claims: who opened each one, the repository it names, its receipt
 * lines, and whether the audit sent it back.
 */
export async function listClaims(token, upstream) {
  const issues = await paginate(token, `/repos/${upstream}/issues?state=all&labels=badge-claim`);
  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const body = issue.body || "";
      const section = (heading) => {
        const match = body.match(new RegExp(`###\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, "i"));
        return match ? match[1].trim() : "";
      };
      return {
        number: issue.number,
        author: issue.user ? issue.user.login : null,
        level: Number((section("Level").match(/\d/) || [])[0]) || null,
        repository: parseRepositoryUrl(section("Public repository URL")),
        receipts: section("Receipts"),
        needsWork: (issue.labels || []).some((label) => label.name === "needs-work")
      };
    });
}

const REPOSITORY_QUERY = `
query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    createdAt
    pushedAt
    isFork
    refs(refPrefix: "refs/heads/", first: 100) { nodes { name } }
    pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage }
      nodes {
        number
        headRefName
        baseRefName
        createdAt
        mergedAt
        commits(first: 100) { nodes { commit { committedDate } } }
        comments(first: 50) { nodes { createdAt } }
      }
    }
    integration: ref(qualifiedName: "refs/heads/integration") {
      target {
        ... on Commit {
          history(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate messageHeadline author { user { login } } }
          }
        }
      }
    }
  }
}`;

const HISTORY_QUERY = `
query ($owner: String!, $name: String!, $after: String!) {
  repository(owner: $owner, name: $name) {
    integration: ref(qualifiedName: "refs/heads/integration") {
      target {
        ... on Commit {
          history(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate messageHeadline author { user { login } } }
          }
        }
      }
    }
  }
}`;

/** The most pages of history read for one repository: 2,000 commits. */
const MAX_HISTORY_PAGES = 20;

/**
 * A GraphQL call. GitHub answers 200 to a query it could not run, with the
 * reason in "errors": a rate limit, a timeout. Only "not found" means the
 * repository is gone, and anything else has to stop the run: counted as a
 * missing repository, it would quietly take a learner out of every figure.
 */
async function graphql(token, query, variables) {
  const answer = await request(token, `${API}/graphql`, { method: "POST", body: JSON.stringify({ query, variables }) });
  const errors = answer.errors || [];
  if (errors.some((error) => error.type !== "NOT_FOUND")) {
    throw new Error(`GitHub could not read ${variables.owner}/${variables.name}: ${errors.map((error) => error.type || error.message).join(", ")}`);
  }
  return answer.data || {};
}

/**
 * One learner repository, in the shape compute.mjs reads. Null when it is
 * gone or went private: the learner keeps their badge, and leaves the figures.
 */
export async function readRepository(token, { owner, name }) {
  const { repository } = await graphql(token, REPOSITORY_QUERY, { owner, name });
  if (!repository) {
    return null;
  }
  if (repository.pullRequests.pageInfo.hasNextPage) {
    console.warn(`${owner}/${name} has more than 100 Pull Requests: the later ones are not read.`);
  }
  const history = repository.integration && repository.integration.target && repository.integration.target.history;
  // The commit that starts the clock is one of the first of the fork, and a
  // fork that took an update of the course has hundreds of commits above it.
  // So the history is read back to the day the repository was created.
  const createdAt = Date.parse(repository.createdAt);
  let page = history;
  for (let pages = 1; page && page.pageInfo.hasNextPage && pages < MAX_HISTORY_PAGES; pages++) {
    const oldest = page.nodes[page.nodes.length - 1];
    if (!oldest || Date.parse(oldest.committedDate) < createdAt) {
      break;
    }
    const more = await graphql(token, HISTORY_QUERY, { owner, name, after: page.pageInfo.endCursor });
    page = more.repository && more.repository.integration && more.repository.integration.target
      ? more.repository.integration.target.history
      : null;
    if (page) {
      history.nodes.push(...page.nodes);
    }
  }
  return {
    owner,
    name,
    createdAt: repository.createdAt,
    pushedAt: repository.pushedAt,
    isFork: repository.isFork,
    branches: repository.refs.nodes.map((ref) => ref.name),
    pullRequests: repository.pullRequests.nodes.map((pr) => ({
      number: pr.number,
      head: pr.headRefName,
      base: pr.baseRefName,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      commitDates: pr.commits.nodes.map((node) => node.commit.committedDate),
      commentDates: pr.comments.nodes.map((node) => node.createdAt)
    })),
    commits: (history ? history.nodes : []).map((node) => ({
      date: node.committedDate,
      message: node.messageHeadline,
      author: node.author && node.author.user ? node.author.user.login : null
    }))
  };
}
