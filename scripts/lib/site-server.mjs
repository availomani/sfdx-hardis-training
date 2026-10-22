/**
 * Serves the built site/ folder over HTTP, under the path the site is
 * published at, for the checks that open pages in a browser.
 *
 *   const { base, close } = await serveSite();
 *   await page.goto(`${base}en/`);
 */
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
export const SITE = path.join(ROOT, "site");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

/** The path the site is published under, from course-site.yml, ending in a slash. */
export function publishedPath() {
  const match = fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8").match(/^site_url:\s*(\S+)/m);
  const pathname = match ? new URL(match[1]).pathname : "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/**
 * Starts the server, on a free port unless one is given. Resolves to
 * { base, close }, base ending in a slash.
 */
export async function serveSite(port = 0) {
  if (!fs.existsSync(SITE)) {
    throw new Error("No built site. Run: node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
  }
  const prefix = publishedPath();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (!url.startsWith(prefix)) {
      res.writeHead(302, { location: prefix });
      res.end();
      return;
    }
    let file = path.join(SITE, url.slice(prefix.length));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  const listening = await new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server.address().port));
  });
  return {
    base: `http://127.0.0.1:${listening}${prefix}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
