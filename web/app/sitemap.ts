import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-config";
import { getBuildEvents } from "../lib/build-archive";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const records = (await getBuildEvents()).map((event) => ({
    url: `${siteUrl}/archive/${event.id}/`,
    lastModified: new Date("2026-07-12T00:00:00+09:00"),
    changeFrequency: "monthly" as const,
    priority: .8
  }));
  const archiveSections = ["archive", "explore", "timeline", "collections", "stories", "about"].map((section) => ({
    url: `${siteUrl}/${section}/`,
    lastModified: new Date("2026-07-14T00:00:00+09:00"),
    changeFrequency: "weekly" as const,
    priority: .7
  }));
  return [{
    url: siteUrl,
    lastModified: new Date("2026-07-12T00:00:00+09:00"),
    changeFrequency: "weekly",
    priority: 1
  }, ...archiveSections, ...records];
}
