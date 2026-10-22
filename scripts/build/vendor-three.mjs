#!/usr/bin/env node
/*
 * Copies the few Three.js add-ons Guinea Run needs into
 * site-theme/javascripts/guinea-run/vendor/, with their imports pointed at the
 * one Three.js build the game loads from jsDelivr.
 *
 * The add-ons import the bare names "three" and "three/tsl", which a browser
 * resolves only with an import map, and the course site has none. Loading them
 * through a CDN rewrite would bring a second copy of Three.js into the page,
 * whose objects the renderer does not recognise. So they are kept here, read
 * once, and refreshed with this script when THREE_VERSION changes in game.js.
 *
 *   node scripts/build/vendor-three.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "site-theme/javascripts/guinea-run/vendor");
const GAME = fs.readFileSync(path.join(ROOT, "site-theme/javascripts/guinea-run/game.js"), "utf8");
const VERSION = GAME.match(/THREE_VERSION = "([\d.]+)"/)[1];
const CDN = `https://cdn.jsdelivr.net/npm/three@${VERSION}`;
const THREE_URL = `${CDN}/build/three.webgpu.min.js`;

const FILES = {
  "GLTFLoader.js": "examples/jsm/loaders/GLTFLoader.js",
  "BufferGeometryUtils.js": "examples/jsm/utils/BufferGeometryUtils.js",
  "SkeletonUtils.js": "examples/jsm/utils/SkeletonUtils.js",
  "BloomNode.js": "examples/jsm/tsl/display/BloomNode.js"
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, source] of Object.entries(FILES)) {
  const response = await fetch(`${CDN}/${source}`);
  if (!response.ok) {
    throw new Error(`${source}: HTTP ${response.status}`);
  }
  let code = await response.text();
  // "three/tsl" is a file that itself imports "three/webgpu": its functions are
  // read from the TSL namespace the WebGPU build exports instead
  code = code
    .replace(/import\s*\{([^}]*)\}\s*from 'three\/tsl';/g, (all, names) => `import { TSL as THREE_TSL } from '${THREE_URL}';
const {${names}} = THREE_TSL;`)
    .replace(/from 'three(\/webgpu)?'/g, `from '${THREE_URL}'`)
    .replace(/from '\.\.\/utils\/(BufferGeometryUtils|SkeletonUtils)\.js'/g, "from './$1.js'");
  // Only real import lines count: the doc comments quote "three/addons/..." paths
  const leftover = code.match(/^\s*(?:import|export)\b[^;]*?from '(?!https:|\.\/)[^']+'/m);
  if (leftover) {
    throw new Error(`${name}: an import is left unresolved: ${leftover[0]}`);
  }
  const header = `// three@${VERSION} ${source}, MIT License (https://github.com/mrdoob/three.js/blob/dev/LICENSE).\n// Copied by scripts/build/vendor-three.mjs, imports pointed at ${THREE_URL}. Do not edit.\n`;
  fs.writeFileSync(path.join(OUT, name), header + code);
  console.log(`${name} <- ${source}`);
}
