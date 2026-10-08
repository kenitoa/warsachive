import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-config";
import { getBuildEvents } from "../lib/build-archive";
import { editorialCollections, editorialStories } from "../lib/archive-data";
import { publicKnowledge } from "../lib/knowledge-data";
import { fullLocaleRoutes } from "../lib/knowledge-localization";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const records = (await getBuildEvents()).map((event) => ({
    url: `${siteUrl}/archive/${event.id}/`,
    lastModified: new Date(event.updatedAt),
    changeFrequency: "monthly" as const,
    priority: .8
  }));
  const updatedAt = (await getBuildEvents()).reduce((latest, event) => event.updatedAt > latest ? event.updatedAt : latest, "");
  const archiveSections = ["archive", "explore", "timeline", "collections", "stories", "about", "entities", "sources", "places", "teach", "services", "read"].map((section) => ({
    url: `${siteUrl}/${section}/`,
    ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    changeFrequency: "weekly" as const,
    priority: .7
  }));
  return [{
    url: siteUrl,
    ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    changeFrequency: "weekly",
    priority: 1
  }, ...archiveSections, ...records,
  ...publicKnowledge.entities.map(entity => ({ url: `${siteUrl}/entities/${entity.id}/` })),
  ...publicKnowledge.sources.map(source => ({ url: `${siteUrl}/sources/${source.id}/` })),
  ...fullLocaleRoutes(publicKnowledge, await getBuildEvents()).map(route => ({ url: `${siteUrl}${route.href}` })),
  ...editorialCollections.map((collection) => ({ url: `${siteUrl}/collections/${collection.id}/`, ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}) })),
  ...editorialStories.map((story) => ({ url: `${siteUrl}/stories/${story.id}/`, lastModified: new Date(story.updatedAt) }))];
}
