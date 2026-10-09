import test from "node:test";
import assert from "node:assert/strict";
import { resolveSiteConfig } from "../lib/site-config-domain.mjs";

test("CI preview uses the loopback root and rejects mismatched path prefixes", () => {
  assert.deepEqual(resolveSiteConfig({ profile: "preview", githubActions: "true", siteUrl: "http://127.0.0.1:4173/" }), { siteUrl: "http://127.0.0.1:4173", basePath: "" });
  assert.throws(() => resolveSiteConfig({ profile: "preview", siteUrl: "https://example.org/warsachive" }), /without a path prefix/);
});

test("production never falls back to an insecure localhost URL", () => {
  assert.throws(() => resolveSiteConfig({ profile: "production" }), /HTTPS/);
  assert.throws(() => resolveSiteConfig({ githubActions: "true" }), /HTTPS/);
  assert.throws(() => resolveSiteConfig({ profile: "production", siteUrl: "http://localhost:3000" }), /HTTPS/);
});

test("explicit deployment addresses govern root custom domains and project paths", () => {
  const environment = { profile: "production", githubActions: "true" };
  assert.deepEqual(resolveSiteConfig({ ...environment, siteUrl: "https://example.org/" }), { siteUrl: "https://example.org", basePath: "" });
  assert.deepEqual(resolveSiteConfig({ ...environment, siteUrl: "https://example.org/warsachive/" }), { siteUrl: "https://example.org/warsachive", basePath: "/warsachive" });
  assert.throws(() => resolveSiteConfig(environment), /HTTPS/);
});

test("unsafe configuration fails before emitting assets or metadata", () => {
  for (const siteUrl of ["file:///tmp/site", "https://user:secret@example.org", "https://example.org/?token=value", "https://example.org/#fragment"]) {
    assert.throws(() => resolveSiteConfig({ siteUrl }));
  }
  assert.throws(() => resolveSiteConfig({ profile: "unexpected" }), /preview or production/);
  assert.deepEqual(resolveSiteConfig({}), { siteUrl: "http://localhost:3000", basePath: "" });
});

test("Vercel production uses the stable root and previews use their own deployment", () => {
  const environment = { vercel: "1", vercelProductionUrl: "archive.vercel.app", vercelUrl: "archive-preview.vercel.app" };
  assert.deepEqual(resolveSiteConfig({ ...environment, vercelEnvironment: "production" }), { siteUrl: "https://archive.vercel.app", basePath: "" });
  assert.deepEqual(resolveSiteConfig({ ...environment, vercelEnvironment: "preview" }), { siteUrl: "https://archive-preview.vercel.app", basePath: "" });
  assert.deepEqual(resolveSiteConfig({ ...environment, vercelEnvironment: "production", siteUrl: "https://archive.example.org" }), { siteUrl: "https://archive.example.org", basePath: "" });
  assert.throws(() => resolveSiteConfig({ vercel: "1" }), /Vercel requires/);
  assert.throws(() => resolveSiteConfig({ ...environment, siteUrl: "http://localhost:3000" }), /HTTPS/);
  assert.throws(() => resolveSiteConfig({ vercel: "1", vercelUrl: "host/path" }), /Vercel requires/);
});
