import type { Metadata } from "next";
import { resolveSiteConfig } from "../lib/site-config-domain.mjs";

export function getSiteUrl(): string {
  return resolveSiteConfig({
    profile: process.env.ARCHIVE_BUILD_PROFILE,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    githubActions: process.env.GITHUB_ACTIONS,
    githubRepository: process.env.GITHUB_REPOSITORY,
    vercel: process.env.VERCEL,
    vercelEnvironment: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL
  }).siteUrl;
}

/** Same-origin path for public assets, including the GitHub Pages project prefix. */
export function sitePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error("A public asset path must be an absolute application path.");
  }
  return `${new URL(getSiteUrl()).pathname.replace(/\/$/, "")}${path}`;
}

export function makePageMetadata(title: string, description: string, path: string): Metadata {
  const url = `${getSiteUrl()}${path === "/" ? "/" : path}`;
  const detail = path.match(/^\/(archive|collections|stories)\/([a-zA-Z0-9_-]+)\/$/);
  const prefix: Record<string, string> = { archive: "archive", collections: "collection", stories: "story" };
  const imageName = detail ? `${prefix[detail[1]]}-${detail[2]}` : "home";
  const imageUrl = `${getSiteUrl()}/images/social/${imageName}.png`;
  return {
    title: `${title} | 전쟁 역사 아카이브`,
    description,
    alternates: { canonical: url, types: { "application/rss+xml": `${getSiteUrl()}/feed.xml` } },
    openGraph: { title, description, url, locale: "ko_KR", type: "website", siteName: "전쟁 역사 아카이브", images: [{ url: imageUrl, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] }
  };
}
