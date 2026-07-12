export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const repository = process.env.GITHUB_REPOSITORY?.split("/");
  if (repository?.length === 2) {
    const [owner, name] = repository;
    return name.endsWith(".github.io")
      ? `https://${name}`
      : `https://${owner}.github.io/${name}`;
  }

  return "http://localhost:3000";
}
