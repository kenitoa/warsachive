import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Synthetic baseline only. This does not claim field INP, a real user's p75, or actual device proof.
const site = process.env.ARCHIVE_PERFORMANCE_SITE || "http://127.0.0.1:4173";
const url = new URL(site); if (!((url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) || url.protocol === "https:") || url.username || url.password || url.search || url.hash) throw new Error("Use a configured local preview or HTTPS site.");
const output = resolve("artifacts/refinement-performance.json"); const paths = ["/", "/archive/", "/workspace/", "/teach/", "/account/"];
const browser = await chromium.launch(); const samples = [];
try { for (const profile of ["desktop", "mobile-constrained"]) {
  for (let iteration = 0; iteration < 3; iteration++) for (const path of paths) {
    const context = await browser.newContext({ viewport: profile === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 }, reducedMotion: "reduce" }); const page = await context.newPage();
    if (profile !== "desktop") { const cdp = await context.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8 }); }
    await page.addInitScript(() => {
      window.__archiveLab = { lcp: null, cls: 0, supported: PerformanceObserver.supportedEntryTypes };
      let session = 0, lastTime = 0, startTime = 0;
      if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) new PerformanceObserver(list => { const entries = list.getEntries(); window.__archiveLab.lcp = entries.at(-1)?.startTime ?? window.__archiveLab.lcp; }).observe({ type: "largest-contentful-paint", buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) new PerformanceObserver(list => { for (const entry of list.getEntries()) { if (entry.hadRecentInput) continue; if (entry.startTime - lastTime < 1000 && entry.startTime - startTime < 5000) session += entry.value; else { startTime = entry.startTime; session = entry.value; } lastTime = entry.startTime; window.__archiveLab.cls = Math.max(window.__archiveLab.cls, session); } }).observe({ type: "layout-shift", buffered: true });
    });
    const response = await page.goto(site.replace(/\/$/, "") + path, { waitUntil: "networkidle", timeout: 45000 }); if (!response?.ok()) throw new Error("The measured page was unavailable.");
    let searchInteractionMs = null;
    if (path === "/archive/") { const start = performance.now(); await page.getByRole("searchbox", { name: "기록 검색" }).fill("난중일기"); await page.getByRole("button", { name: "검색", exact: true }).click(); await page.waitForURL(/q=/); searchInteractionMs = Math.round(performance.now() - start); }
    const metric = await page.evaluate(() => ({ ...window.__archiveLab, navigationMs: performance.getEntriesByType("navigation")[0]?.duration ?? null, htmlBytes: new TextEncoder().encode(document.documentElement.outerHTML).length, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 }));
    samples.push({ profile, path, iteration, ...metric, searchInteractionMs }); await context.close();
  }
} } finally { await browser.close(); }
const p75 = values => { const ordered = values.filter(value => typeof value === "number").toSorted((a, b) => a - b); return ordered.length ? ordered[Math.ceil(ordered.length * .75) - 1] : null; };
const baselines = ["desktop", "mobile-constrained"].flatMap(profile => paths.map(path => { const entries = samples.filter(sample => sample.profile === profile && sample.path === path); return { profile, path, sampleCount: entries.length, syntheticP75LcpMs: p75(entries.map(sample => sample.lcp)), syntheticP75Cls: p75(entries.map(sample => sample.cls)), syntheticP75SearchWorkflowMs: p75(entries.map(sample => sample.searchInteractionMs)), horizontalOverflow: entries.some(sample => sample.horizontalOverflow) }; }));
const report = { version: 1, observedAt: new Date().toISOString(), site, evidenceType: "synthetic-browser-baseline", fieldCoreWebVitalsVerified: false, actualDeviceVerified: false, profile: { constrainedCpuMultiplier: 4, latencyMs: 150, downloadBitsPerSecond: 1600000 }, proposedFieldTargets: { p75LcpMs: 2500, p75InpMs: 200, p75Cls: .1 }, baselines, samples };
await mkdir(resolve("artifacts"), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ operation: "performance.baseline", samples: samples.length, horizontalOverflow: baselines.filter(item => item.horizontalOverflow).length, fieldEvidence: false, report: "artifacts/refinement-performance.json" }));
if (baselines.some(item => item.horizontalOverflow)) process.exitCode = 1;
