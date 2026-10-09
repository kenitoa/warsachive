/** Resolve one URL/prefix contract for Next output, public data and page metadata. */
export function resolveSiteConfig(environment) {
  const { profile, siteUrl, githubActions, vercel, vercelEnvironment, vercelUrl, vercelProductionUrl } = environment;
  if (profile && !["preview", "production"].includes(profile)) {
    throw new Error("ARCHIVE_BUILD_PROFILE must be preview or production.");
  }
  let candidate = siteUrl?.trim();
  if (!candidate && vercel === "1") {
    const host = vercelEnvironment === "production" ? vercelProductionUrl : vercelUrl;
    if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !host.includes(".")) {
      throw new Error("Vercel requires NEXT_PUBLIC_SITE_URL or a valid deployment hostname.");
    }
    candidate = `https://${host}`;
  }
  if (!candidate) {
    candidate = "http://localhost:3000";
  }
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) site URL without credentials, query or fragment.");
  }
  const production = vercel === "1" || profile === "production" || (githubActions === "true" && profile !== "preview");
  if (production && url.protocol !== "https:") {
    throw new Error("Production requires an HTTPS site URL.");
  }
  if (profile === "preview" && url.pathname !== "/") {
    throw new Error("Preview requires a site URL without a path prefix.");
  }
  return { siteUrl: url.href.replace(/\/$/, ""), basePath: url.pathname.replace(/\/$/, "") };
}
