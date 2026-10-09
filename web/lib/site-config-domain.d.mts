export interface SiteEnvironment {
  profile?: string;
  siteUrl?: string;
  githubActions?: string;
  vercel?: string;
  vercelEnvironment?: string;
  vercelUrl?: string;
  vercelProductionUrl?: string;
}
export function resolveSiteConfig(environment: SiteEnvironment): { siteUrl: string; basePath: string };
