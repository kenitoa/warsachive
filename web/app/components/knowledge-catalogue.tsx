"use client";

import Link from "next/link";
import { useId, useState } from "react";
import styles from "./knowledge-styles.module.css";

export type KnowledgeCatalogueItem = { id: string; kind: string; title: string; aliases: string[]; description: string; href: string; recordCount: number };
export function KnowledgeCatalogue({ items, categories, searchLabel }: { items: KnowledgeCatalogueItem[]; categories: { value: string; label: string }[]; searchLabel: string }) {
  const controlId = useId();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const normalized = query.normalize("NFKC").toLocaleLowerCase().trim();
  const filtered = items.filter(item => (!kind || item.kind === kind) && `${item.title} ${item.aliases.join(" ")} ${item.description}`.normalize("NFKC").toLocaleLowerCase().includes(normalized));
  return <div><div className={styles.filters}><label htmlFor={`${controlId}-query`}>{searchLabel}<input id={`${controlId}-query`} type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label htmlFor={`${controlId}-type`}>유형<select id={`${controlId}-type`} value={kind} onChange={event => setKind(event.target.value)}><option value="">전체</option>{categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label></div>
    <p role="status" aria-live="polite">{filtered.length}개 항목</p>
    <div className={styles.grid}>{filtered.map(item => <article key={item.id} className={styles.card}><h2><Link href={item.href}>{item.title}</Link></h2><p>{item.description}</p>{item.aliases.length ? <p className={styles.muted}>표기: {item.aliases.join(" · ")}</p> : null}<span className={styles.badge}>연결 공개 기록 {item.recordCount}건</span></article>)}</div>
    {!filtered.length ? <p className={styles.notice}>검색어와 유형을 바꿔 보세요. 기관 자료에서 확인하지 않은 이름·좌표는 추가하지 않았습니다.</p> : null}
  </div>;
}
