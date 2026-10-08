import type { MetadataRoute } from "next";
import { getSiteUrl } from "./site-config";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = new URL(getSiteUrl()).pathname.replace(/\/$/, "");
  const startUrl = `${basePath}/`;
  return {
    name: "전쟁 역사 아카이브",
    short_name: "전쟁사 아카이브",
    description: "사건, 인물, 장소와 사료를 연결하는 디지털 역사 아카이브",
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    background_color: "#ebe6d7",
    theme_color: "#30372f",
    lang: "ko-KR",
    icons: [{ src: `${basePath}/icons/archive.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
