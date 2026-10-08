"use client";
import { useState } from "react";
import type { ArchiveRecord } from "../../lib/archive-types";
import { apiItems, apiRequest, decodeAttachment, downloadCmsAttachment, safeApiMessage, type CmsAttachment } from "../../lib/api-client";
import { useApiSession } from "./expansion-common";

export function PrivateEvidenceFiles({ record }: { record: ArchiveRecord | null }) {
  const { session } = useApiSession(); const [sourceId, setSourceId] = useState(""); const [rights, setRights] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<CmsAttachment[]>([]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const canUpload = session?.user?.scopes !== undefined ? session.user.scopes.includes("content:write") || session.user.scopes.includes("content:review") : ["editor", "reviewer", "publisher", "admin"].includes(session?.user?.role ?? "");
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } catch (problem) { setMessage(safeApiMessage(problem)); } finally { setBusy(false); } }
  if (!record) return <section><h2>비공개 검수 근거 파일</h2><p>서버에 저장한 초안을 선택한 뒤 해당 자료와 연결하여 근거 파일을 관리할 수 있습니다.</p></section>;
  return <section><h2>비공개 검수 근거 파일</h2><p>기록 {record.title}. PNG·JPEG·PDF 5MiB 이하 파일의 실제 형식은 서버가 확인합니다. 자료 이용 범위와 보관 근거를 입력하세요. 파일은 인증된 운영자의 검수용이며 공개 본문이나 공개 내보내기에 포함하지 않습니다.</p><p role="status">{message}</p>
    <form onSubmit={event => { event.preventDefault(); if (!file || file.size === 0 || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "application/pdf"].includes(file.type) || !record.sources.some(source => source.id === sourceId) || rights.trim().length < 10) { setMessage("5MiB 이하 PNG·JPEG·PDF, 연결 자료와 이용·보관 근거를 확인하세요."); return; } void run(async () => { const query = new URLSearchParams({ recordId: record.id, sourceId, rights: rights.trim() }); const item = await apiRequest(`/cms/attachments?${query}`, { method: "POST", rawBody: file }, decodeAttachment); setItems(previous => [...previous.filter(existing => existing.attachmentId !== item.attachmentId), item]); setMessage("서버가 비공개 근거 파일을 저장하고 실제 파일 해시를 반환했습니다."); }); }}>
      <label>파일을 연결할 자료<select value={sourceId} onChange={event => setSourceId(event.target.value)} required><option value="">자료 선택</option>{record.sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
      <label>파일 이용 범위와 보관 근거 (1,000자 이하)<textarea minLength={10} maxLength={1000} required value={rights} onChange={event => setRights(event.target.value)} /></label>
      <label>비공개 근거 파일<input type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <button disabled={busy || !canUpload} type="submit">비공개 근거 파일 업로드</button>
    </form>
    <button disabled={busy} type="button" onClick={() => void run(async () => { setItems(await apiRequest(`/cms/attachments?${new URLSearchParams({ recordId: record.id })}`, {}, value => apiItems(value).map(decodeAttachment))); setMessage("서버의 비공개 파일 목록을 확인했습니다."); })}>이 기록의 근거 파일 목록 확인</button>
    <ul>{items.filter(item => item.recordId === record.id).map(item => <li key={item.attachmentId}><p>{record.sources.find(source => source.id === item.sourceId)?.title ?? item.sourceId} · {item.contentType} · {item.size.toLocaleString("ko-KR")}바이트</p><p>{item.rights}</p><p>파일 검사: {item.scanStatus === "clean" ? "서명된 검사 결과 정상" : item.scanStatus === "rejected" ? "검사 결과 거부·다운로드 차단" : "악성 파일 검사 결과 미확인"}{item.scanner ? ` · 검사기 ${item.scanner}` : ""}{item.scannedAt ? ` · ${item.scannedAt}` : ""}</p><p className="hashValue">SHA-256 {item.sha256}</p><button disabled={busy || item.scanStatus === "rejected"} type="button" onClick={() => void run(async () => { const blob = await downloadCmsAttachment(item.attachmentId); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${item.attachmentId}.${item.contentType === "application/pdf" ? "pdf" : item.contentType === "image/png" ? "png" : "jpg"}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("권한을 확인한 비공개 검수 파일을 내려받았습니다."); })}>권한 확인 후 비공개 파일 내려받기</button></li>)}</ul>
  </section>;
}
