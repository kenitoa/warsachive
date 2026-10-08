"use client";
import Image from "next/image";
import { useState } from "react";
import type { IiifPreview } from "../../lib/knowledge-types";
import styles from "./knowledge-refinement.module.css";

export function IiifCanvasViewer({ preview, download, attribution }: { preview: IiifPreview; download: boolean; attribution: string }) {
  const [index, setIndex] = useState(0); const [displayImages, setDisplayImages] = useState(false); const [failed, setFailed] = useState(false);
  const canvas = preview.canvases[index]; const image = canvas?.imageLinks?.[0];
  return <section className={styles.panel} aria-label="권리 검수된 IIIF 자료 열람"><h3>{preview.title}</h3><p>{preview.summary}</p><p>{preview.attribution || attribution}</p><p>Manifest 권리 표시: {preview.rights ?? "별도 확인한 허가 기록 적용"}</p><label>자료의 장 선택<select value={index} onChange={event => { setIndex(Number(event.target.value)); setFailed(false); }}>{preview.canvases.map((item, position) => <option key={item.id} value={position}>{position + 1}. {item.label}</option>)}</select></label><p>{canvas.label} · {canvas.width} × {canvas.height}</p>
    {image ? <><button type="button" onClick={() => { setDisplayImages(true); setFailed(false); }}>허가된 외부 이미지 열기</button>{displayImages && !failed ? <Image src={image} width={canvas.width} height={canvas.height} unoptimized alt={canvas.label} style={{ maxWidth: "100%", height: "auto" }} onError={() => setFailed(true)} /> : null}{failed ? <p role="alert">이미지를 불러오지 못했습니다. 다시 열기를 누르거나 기관 Manifest를 확인하세요.</p> : null}{download ? <a href={image} target="_blank" rel="noreferrer noopener">기관 이미지 파일 열기 ↗</a> : <p>다운로드 허가는 확인되지 않았습니다.</p>}</> : <p>이 Canvas에 등록한 직접 이미지 참조가 없습니다.</p>}
    <p>이미지는 요청한 뒤 기관에서 직접 불러옵니다. 이 화면에서 허가 범위를 확대하거나 원본 파일을 자동 보관하지 않습니다.</p>
  </section>;
}
