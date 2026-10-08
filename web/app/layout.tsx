import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteUrl } from "./site-config";
import "./globals.css";
import "./architecture.css";
import "./enhancement.css";
import "./editorial.css";
import "./expansion.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "전쟁 역사 아카이브 | 사건·인물·사료로 읽는 전쟁사",
  description: "임진왜란·정유재란과 관련 사료를 사건, 인물, 장소와 연결해 읽는 역사 아카이브입니다. 기록의 출처와 확인 범위, 검토 상태를 함께 제공합니다.",
  applicationName: "전쟁 역사 아카이브",
  category: "history",
  keywords: ["전쟁 역사", "세계 전쟁사", "디지털 아카이브", "역사 자료", "사료", "전투 기록", "역사 인물"],
  alternates: { canonical: siteUrl },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: "전쟁 역사 아카이브",
    description: "전쟁의 기록을 기억의 질서로 정리하는 디지털 역사 보관소",
    type: "website",
    locale: "ko_KR",
    siteName: "전쟁 역사 아카이브",
    url: siteUrl,
    images: [{ url: `${siteUrl}/images/social/home.png`, width: 1200, height: 630, alt: "전쟁 역사 아카이브" }]
  },
  twitter: {
    card: "summary_large_image",
    images: [`${siteUrl}/images/social/home.png`],
    title: "전쟁 역사 아카이브",
    description: "사건, 인물, 장소와 사료를 연결하는 디지털 역사 보관소"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
