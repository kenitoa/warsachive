"use client";

import { useId, useState } from "react";
import { validateIiifManifest } from "../../lib/knowledge-domain";
import type { IiifPreview } from "../../lib/knowledge-types";
import styles from "./knowledge-styles.module.css";

export function BibliographyDownload({ sourceId, json, ris }: { sourceId: string; json: string; ris: string }) {
  const [status, setStatus] = useState("");
  const download = (body: string, extension: "json" | "ris") => {
    try {
      const url = URL.createObjectURL(new Blob([body], { type: extension === "json" ? "application/json;charset=utf-8" : "application/x-research-info-systems;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${sourceId}.${extension}`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${extension.toUpperCase()} 서지 파일 다운로드를 요청했습니다.`);
    } catch { setStatus("이 브라우저에서 다운로드를 시작하지 못했습니다. 기관 링크와 서지 정보를 직접 복사해 주세요."); }
  };
  return <div className={styles.tools}><h3>서지 정보 내보내기</h3><p>이 사이트가 정리한 출처 메타데이터입니다. 원문·국역·이미지 파일은 포함하지 않습니다.</p><button type="button" onClick={() => download(json, "json")}>서지 JSON</button><button type="button" onClick={() => download(ris, "ris")}>인용 관리용 RIS</button><p role="status" aria-live="polite">{status}</p></div>;
}
export function IiifManifestPreview() {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<IiifPreview | null>(null);
  const [error, setError] = useState("");
  const validate = () => {
    setPreview(null); setError("");
    try {
      if (input.length > 1000000) throw new Error("Manifest 입력은 1MB 이하로 제한합니다.");
      setPreview(validateIiifManifest(JSON.parse(input)));
    } catch (error) { setError(error instanceof Error ? error.message : "JSON 형식을 확인해 주세요."); }
  };
  return <section className={styles.tools}><h2>IIIF 자료 구조 확인</h2><p>현재 등록된 출처에서 검증한 IIIF Manifest는 없습니다. 기관이 제공한 Presentation 3 JSON을 붙여 넣으면 제목·권리 표시·Canvas 정보를 브라우저에서 확인할 수 있습니다.</p><label htmlFor={inputId}>기관 제공 Manifest JSON</label><textarea id={inputId} value={input} onChange={event => { setInput(event.target.value); setError(""); setPreview(null); }} maxLength={1000001} spellCheck={false} /><button type="button" onClick={validate} disabled={!input.trim()}>JSON 구조 확인</button>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{preview ? <div className={styles.preview}><h3>{preview.title}</h3><p>{preview.summary}</p><p>기관 표기: {preview.provider.join(" · ") || "미제공"}</p><p>권리 URI: {preview.rights || "미제공"}</p><p>필수 출처 표시: {preview.attribution || "미제공"}</p><p>Canvas {preview.canvases.length}개 · 이미지 참조 {preview.imageLinks.length}개</p><ol>{preview.canvases.slice(0, 20).map(canvas => <li key={canvas.id}>{canvas.label} · {canvas.width} × {canvas.height}</li>)}</ol><p className={styles.notice}>{preview.warning}</p></div> : null}<p className={styles.muted}>입력은 서버로 전송하거나 저장하지 않습니다. 구조 확인만으로 원문 이미지 이용·다운로드를 허용하지 않습니다.</p></section>;
}
