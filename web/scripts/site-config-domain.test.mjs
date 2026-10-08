import test from "node:test";
import assert from "node:assert/strict";
import { resolveSiteConfig } from "../lib/site-config-domain.mjs";

test("CI preview uses the loopback root and rejects mismatched path prefixes", () => {
  assert.deepEqual(resolveSiteConfig({ profile: "preview", githubActions: "true", githubRepository: "owner/warsachive", siteUrl: "http://127.0.0.1:4173/" }), { siteUrl: "http://127.0.0.1:4173", basePath: "" });
  assert.throws(() => resolveSiteConfig({ profile: "preview", siteUrl: "https://example.org/warsachive" }), /without a path prefix/);
});

test("production never falls back to an insecure localhost URL", () => {
  assert.throws(() => resolveSiteConfig({ profile: "production" }), /HTTPS/);
  assert.throws(() => resolveSiteConfig({ githubActions: "true" }), /HTTPS/);
  assert.throws(() => resolveSiteConfig({ profile: "production", siteUrl: "http://localhost:3000" }), /HTTPS/);
});

test("explicit deployment addresses govern root custom domains and project paths", () => {
  const environment = { profile: "production", githubActions: "true", githubRepository: "owner/warsachive" };
  assert.deepEqual(resolveSiteConfig({ ...environment, siteUrl: "https://example.org/" }), { siteUrl: "https://example.org", basePath: "" });
  assert.deepEqual(resolveSiteConfig({ ...environment, siteUrl: "https://example.org/warsachive/" }), { siteUrl: "https://example.org/warsachive", basePath: "/warsachive" });
  assert.deepEqual(resolveSiteConfig(environment), { siteUrl: "https://owner.github.io/warsachive", basePath: "/warsachive" });
  assert.deepEqual(resolveSiteConfig({ profile: "production", githubRepository: "owner/owner.github.io" }), { siteUrl: "https://owner.github.io", basePath: "" });
});

test("unsafe configuration fails before emitting assets or metadata", () => {
  for (const siteUrl of ["file:///tmp/site", "https://user:secret@example.org", "https://example.org/?token=value", "https://example.org/#fragment"]) {
    assert.throws(() => resolveSiteConfig({ siteUrl }));
  }
  assert.throws(() => resolveSiteConfig({ profile: "unexpected" }), /preview or production/);
  assert.deepEqual(resolveSiteConfig({}), { siteUrl: "http://localhost:3000", basePath: "" });
});
