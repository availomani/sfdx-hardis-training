#!/usr/bin/env node
/**
 * The public Trailblazer profile behind a username.
 *
 *   node scripts/badges/trailblazer.mjs nvuillamy
 *
 * Used twice by the badge pipeline: the claim refuses a username that has no
 * profile, and the badge shows the name the person carries on Trailhead rather
 * than their GitHub login.
 *
 * The endpoint is the public GraphQL API the Trailhead Banner project reads
 * (https://github.com/nabondance/Trailhead-Banner). It is not a documented
 * Salesforce API: it can change shape or go away without notice. So nothing here
 * ever fails a badge because the call did not work. An API that cannot be
 * reached answers "unknown", never "does not exist", and the caller decides.
 *
 * `node:https` and not `fetch` on purpose. fetch returns its socket to a
 * keep-alive pool, and a caller that then exits (this one rejects a claim and
 * exits) tears that socket down mid-flight: on Windows that is a libuv assertion
 * and exit code 127, so a learner's rejected claim would look like a crash.
 * `agent: false` gives a socket nobody keeps.
 */
import https from "node:https";

const ENDPOINT = new URL("https://profile.api.trailhead.com/graphql");

// Only what the badge needs. A larger query is a larger surface to break on.
const QUERY = `query TrailblazerProfile($slug: String, $hasSlug: Boolean!) {
  profile(slug: $slug) @include(if: $hasSlug) {
    __typename
    ... on PublicProfile {
      name
      companyName
      country
    }
  }
}`;

/** POST the query and return the parsed body, or throw. */
function post(body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: ENDPOINT.hostname,
        path: ENDPOINT.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Accept: "application/json"
        },
        agent: false,
        timeout: timeoutMs
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: response.statusCode || 0, payload: JSON.parse(text) });
          } catch {
            reject(new Error(`the API answered ${response.statusCode} with something that is not JSON`));
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error(`no answer within ${timeoutMs} ms`)));
    request.on("error", reject);
    request.end(body);
  });
}

/**
 * @param {string} slug a Trailblazer username, already shape-checked by the caller
 * @returns {Promise<{state: "public"|"private"|"missing"|"unknown", name: string|null,
 *                    companyName: string|null, country: string|null, detail: string|null}>}
 *
 * `public`  the profile exists and is readable: `name` is the person's name.
 * `private` the profile exists but is not shared: the username is real, the name is not readable.
 * `missing` there is no profile with this username.
 * `unknown` the API could not be asked. Never treat this as missing.
 */
export async function fetchTrailblazerProfile(slug, options = {}) {
  const { timeoutMs = 10000, postImpl = post } = options;
  const empty = { name: null, companyName: null, country: null, detail: null };

  if (!slug) {
    return { state: "missing", ...empty, detail: "no username given" };
  }

  let status;
  let payload;
  try {
    ({ status, payload } = await postImpl(JSON.stringify({ query: QUERY, variables: { slug, hasSlug: true } }), timeoutMs));
  } catch (error) {
    return { state: "unknown", ...empty, detail: String((error && error.message) || error) };
  }

  // A profile that does not exist comes back as a GraphQL error carrying
  // NOT_FOUND, not as an HTTP status: the request itself succeeded. Any other
  // error, and any non-OK status, is the API having a bad day, which is not the
  // learner's problem and must not cost them a badge.
  const errors = Array.isArray(payload && payload.errors) ? payload.errors : [];
  if (errors.length > 0) {
    const notFound = errors.some(
      (error) =>
        (error && error.extensions && error.extensions.code === "NOT_FOUND") ||
        /could not be found/i.test((error && error.message) || "")
    );
    return {
      state: notFound ? "missing" : "unknown",
      ...empty,
      detail: (errors[0] && errors[0].message) || "the API returned an error"
    };
  }
  if (status < 200 || status >= 300) {
    return { state: "unknown", ...empty, detail: `HTTP ${status}` };
  }

  const profile = payload && payload.data && payload.data.profile;
  if (!profile) {
    return { state: "unknown", ...empty, detail: "the API answered without a profile" };
  }
  if (profile.__typename === "PrivateProfile") {
    // The username resolves, so it exists. The name is simply not ours to read.
    return { state: "private", ...empty, detail: "the profile is private" };
  }
  const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return {
    state: "public",
    name: text(profile.name),
    companyName: text(profile.companyName),
    country: text(profile.country),
    detail: null
  };
}

/** True when the username is real, whether or not its profile can be read. */
export function trailblazerExists(result) {
  return result.state === "public" || result.state === "private";
}

// Run directly for a quick check, and so a workflow can call it without a wrapper.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const result = await fetchTrailblazerProfile(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.state === "missing" ? 1 : 0;
}
