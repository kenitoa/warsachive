/** Resolve one URL/prefix contract for Next output, public data and page metadata. */
export function resolveSiteConfig(environment) {
  const { profile, siteUrl, githubActions, githubRepository } = environment;
  if (profile && !["preview", "production"].includes(profile)) {
    throw new Error("ARCHIVE_BUILD_PROFILE must be preview or production.");
  }
  let candidate = siteUrl?.trim();
  if (!candidate) {
    const repository = githubRepository?.split("/");
    if (profile !== "preview" && repository?.length === 2 && repository.every((part) => /^[a-zA-Z0-9_.-]+$/.test(part))) {
      const [owner, name] = repository;
      candidate = name.endsWith(".github.io") ? `https://${name}` : `https://${owner}.github.io/${name}`;
    } else {
      candidate = "http://localhost:3000";
    }
  }
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) site URL without credentials, query or fragment.");
  }
  const production = profile === "production" || (githubActions === "true" && profile !== "preview");
  if (production && url.protocol !== "https:") {
    throw new Error("Production requires an HTTPS site URL or a valid GitHub repository.");
  }
  if (profile === "preview" && url.pathname !== "/") {
    throw new Error("Preview requires a site URL without a path prefix.");
  }
  return { siteUrl: url.href.replace(/\/$/, ""), basePath: url.pathname.replace(/\/$/, "") };
}
