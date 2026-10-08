import Link from "next/link";
import type { Metadata } from "next";
import { ArchiveShell, ArchiveFooter } from "./archive-shell";
import { getSiteUrl, makePageMetadata } from "../site-config";

export function editorialHoldingMetadata(title: string, path: string): Metadata {
 const metadata=makePageMetadata(`${title} · 검토 안내`,"연결 자료가 공개 보류되어 편집 콘텐츠를 다시 확인하고 있습니다.",path);
 const image=`${getSiteUrl()}/images/social/home.png`;
 return {...metadata,robots:{index:false,follow:true},openGraph:{...metadata.openGraph,images:[{url:image,width:1200,height:630,alt:"전쟁 역사 아카이브"}]},twitter:{card:"summary_large_image",images:[image]}};
}
export function EditorialHolding({title}:{title:string}){
 return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><p className="sectionNumber">EDITORIAL REVIEW</p><h1>{title}</h1><h2>연결 자료를 다시 확인하고 있습니다.</h2><p>사용한 기록이 공개 보류되어 이 읽기 경로의 설명과 자료 연결도 보류했습니다. 기존 주소는 유지하며 검토 전 내용은 노출하지 않습니다.</p><Link href="/archive/">현재 공개 기록 찾기 →</Link><Link href="/about/#review">검토 기준 읽기 →</Link></article><ArchiveFooter/></ArchiveShell>;
}
