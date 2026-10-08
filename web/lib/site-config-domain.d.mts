export interface SiteEnvironment {
  profile?: string;
  siteUrl?: string;
  githubActions?: string;
  githubRepository?: string;
}
export function resolveSiteConfig(environment: SiteEnvironment): { siteUrl: string; basePath: string };
