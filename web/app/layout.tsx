import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteUrl } from "./site-config";
import "./globals.css";
import "./architecture.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "전쟁 역사 아카이브 | 사건·인물·사료로 읽는 전쟁사",
  description: "고대부터 현대까지 전쟁과 전투의 사건, 인물, 장소와 원문 사료를 출처와 맥락 속에서 탐색하는 디지털 역사 아카이브입니다.",
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
    url: siteUrl
  },
  twitter: {
    card: "summary",
    title: "전쟁 역사 아카이브",
    description: "사건, 인물, 장소와 사료를 연결하는 디지털 역사 보관소"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
