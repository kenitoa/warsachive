import type { NextConfig } from "next";
import { resolveSiteConfig } from "./lib/site-config-domain.mjs";

const { basePath } = resolveSiteConfig({
  profile: process.env.ARCHIVE_BUILD_PROFILE,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  githubActions: process.env.GITHUB_ACTIONS,
  githubRepository: process.env.GITHUB_REPOSITORY,
  vercel: process.env.VERCEL,
  vercelEnvironment: process.env.VERCEL_ENV,
  vercelUrl: process.env.VERCEL_URL,
  vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL
});

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
