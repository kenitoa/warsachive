import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);

test("security-patched UUID remains compatible with Xcode project identifier generation", () => {
  const xcode = require("xcode");
  const project = xcode.project("test.pbxproj");
  project.hash = { project: { objects: {} } };
  const ids = new Set();
  for (let index = 0; index < 50; index++) {
    const id = project.generateUuid();
    assert.match(id, /^[A-F0-9]{24}$/); ids.add(id);
  }
  assert.equal(ids.size, 50);
});
test("patched image-size preserves Metro's synchronous buffer decoder for PNG and SVG", () => {
  const metro = require(resolve(dirname(require.resolve("metro")), "Assets.js"));
  const png = readFileSync(new URL("../public/images/archive-gallery-hero.png", import.meta.url));
  const svg = readFileSync(new URL("../public/icons/archive.svg", import.meta.url));
  const pngSize = metro.getAssetSize("png", png, "archive-gallery-hero.png");
  assert.ok(pngSize.width > 0 && pngSize.height > 0);
  assert.deepEqual(metro.getAssetSize("svg", svg, "archive.svg"), { width: 512, height: 512 });
});
