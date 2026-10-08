import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-config";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const basePath = new URL(siteUrl).pathname.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: `${basePath}/`, disallow: ["account", "admin", "workspace", "corrections", "assist"].map(path => `${basePath}/${path}/`) }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: new URL(siteUrl).origin
  };
}
