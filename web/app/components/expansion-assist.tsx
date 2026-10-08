"use client";
import Link from "next/link";
import { useState } from "react";
import type { ArchiveRecord } from "../../lib/archive-types";
import { apiAvailable, apiRequest, apiObject, safeApiMessage, validateAiCitations } from "../../lib/api-client";
import { useApiSession } from "./expansion-common";
import { decodeDetailedAiResponse, type DetailedAiResponse } from "../../lib/assist-domain";
import { LoginReturnLink } from "./personal-context";

export function ArchiveAssistant({ records }: { records: ArchiveRecord[] }) {
  const { session, error, loading, refresh } = useApiSession();
  const [ids, setIds] = useState<string[]>([]); const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"answer" | "assist">("answer"); const [answer, setAnswer] = useState<DetailedAiResponse | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [report, setReport] = useState(""); const [reportConsent, setReportConsent] = useState(false);
  const publicEnabled = session?.capabilities.ai === true;
  const internalEnabled = (session?.user?.scopes !== undefined ? session.user.scopes.some(scope => scope === "content:write" || scope === "content:review") : ["editor", "reviewer", "admin"].includes(session?.user?.role ?? "")) && session?.capabilities.aiAssist === true;
  const allowed = mode === "answer" ? publicEnabled : internalEnabled;
  async function ask() {
    if (!allowed || !session?.user || !ids.length || ids.length > 8 || question.trim().length < 5) { setMessage("로그인과 서비스 상태를 확인하고 자료 1~8개와 구체적인 질문을 선택하세요."); return; }
    setBusy(true); setAnswer(null);
    try {
      const result = await apiRequest("/ai/answer", { method: "POST", body: { mode, question: question.trim(), recordIds: ids } }, decodeDetailedAiResponse);
      if (!result.text.trim() || !validateAiCitations(result, records, ids)) { setMessage("답변의 정확한 근거 연결을 확인할 수 없어 표시하지 않았습니다."); return; }
      setAnswer(result); setMessage(result.citations.length ? "답변과 연결된 문단을 직접 확인하세요." : "선택한 근거만으로 답하기 어려운 질문입니다.");
    } catch (problem) { setMessage(safeApiMessage(problem)); } finally { setBusy(false); }
  }
  return <div className="expansionManager">
    <p className="expansionNotice">질문에 개인정보나 비공개 연구 메모를 넣지 마세요. 질문과 선택 자료는 연결된 AI 서비스에 전달됩니다. 답변마다 실제 인용 문단을 열어 확인하세요.</p>
    <p role="status">{message || error || (loading ? "서비스 정책을 확인하고 있습니다." : "")}</p>
    {!apiAvailable ? <p>AI 서비스가 연결되지 않았습니다. 아래 자료를 직접 읽거나 비교할 수 있습니다.</p> : <>
      {!session?.user ? <p><LoginReturnLink /> 후 실제 사용 가능 상태를 확인하세요.</p> : !publicEnabled ? <p>공개 답변 평가와 운영 설정이 활성화되지 않아 일반 답변을 제공하지 않습니다.</p> : null}
      <button disabled={busy || loading} type="button" onClick={() => void refresh()}>서비스 상태 다시 확인</button>
    </>}
    <fieldset><legend>질문할 자료 1~8개</legend>{records.map(record => <div className="assistantRecord" key={record.id}><label><input type="checkbox" checked={ids.includes(record.id)} disabled={busy || (!ids.includes(record.id) && ids.length >= 8)} onChange={() => { setIds(ids.includes(record.id) ? ids.filter(id => id !== record.id) : [...ids, record.id]); setAnswer(null); }} />{record.title}</label><Link href={`/archive/${record.id}/`}>자료 직접 읽기 →</Link></div>)}</fieldset>
    <form onSubmit={event => { event.preventDefault(); void ask(); }}><label>자료에 관한 질문<textarea minLength={5} maxLength={2000} required value={question} disabled={busy} onChange={event => { setQuestion(event.target.value); setAnswer(null); }} /></label>
      {internalEnabled ? <label>운영자 내부 작업<select disabled={busy} value={mode} onChange={event => { setMode(event.target.value === "assist" ? "assist" : "answer"); setAnswer(null); }}><option value="answer">평가된 공개 답변</option><option value="assist">운영자 내부 편집 보조</option></select></label> : null}
      <button disabled={busy || loading || !session?.user || !allowed || !ids.length} type="submit">{busy ? "근거를 확인하며 답변 준비 중" : mode === "answer" ? "선택 자료로 질문" : "운영자 편집 보조 요청"}</button>
    </form>
    {answer ? <section className="expansionNotice"><h2>{!answer.citations.length ? "자료만으로 답하기 어렵습니다" : mode === "assist" ? "검수 전 내부 편집 보조" : "자료 도우미의 답변"}</h2>
      <p className="privateText">{answer.text}</p><p>이 답변의 개별 정확성은 사람이 검수하지 않았습니다. 선택한 자료의 설명 범위를 넘는 역사적 사실을 확정하는 근거로 사용하지 마세요.</p>
      <p>응답 모델: {answer.model || "서버 설정 모델"} · 평가 증거: {answer.evaluationId || (mode === "assist" ? "내부 편집 보조" : "서버 운영 설정 확인 필요")}</p><ol>{answer.citationDetails.map((citation, index) => { const record = records.find(item => item.id === citation.recordId); const section = record?.sections.find(item => item.id === citation.sectionId); return <li key={`${citation.recordId}-${citation.sectionId}-${index}`}><Link href={`/archive/${citation.recordId}/#${citation.sectionId}`}>{record?.title} · {section?.title}</Link><p>실제 답변에 사용한 자료 수정 버전: {citation.recordVersion}</p>{record?.updatedAt !== citation.recordVersion ? <p>현재 화면의 자료와 답변에 사용한 버전이 다릅니다. 아래 사용 문단을 확인하세요.</p> : null}<details><summary>답변이 사용한 공개 해설 문단·출처 확인</summary><p className="privateText">{citation.excerpt}</p><p>자료 ID: {citation.sourceIds.join(" · ")}</p><p className="hashValue">자료 해시: {citation.contentHash}</p></details></li>; })}</ol><details><summary>이 답변의 근거·오류 검토 요청</summary><form onSubmit={event => { event.preventDefault(); const recordId = answer.citations[0]?.recordId ?? ids[0]; if (!recordId || !reportConsent || report.trim().length < 10) { setMessage("검토할 이유와 제안 보관 동의를 확인하세요."); return; } setBusy(true); void apiRequest("/corrections", { method: "POST", body: { recordId, category: "AI 답변 검토", proposal: `검토 요청: ${report.trim()}\n평가: ${answer.evaluationId || "내부 보조"}; 모델: ${answer.model}; 인용: ${answer.citationDetails.map(item => `${item.recordId}/${item.sectionId}@${item.recordVersion}`).join(", ")}`, consent: true } }, apiObject).then(item => setMessage(`답변 검토 접수번호 ${String(item.receiptId)}를 보관하세요.`)).catch(error => setMessage(safeApiMessage(error))).finally(() => setBusy(false)); }}><label>확인이 필요한 근거·표현<textarea minLength={10} maxLength={5000} required value={report} onChange={event => setReport(event.target.value)} /></label><label><input type="checkbox" checked={reportConsent} onChange={event => setReportConsent(event.target.checked)} />작성한 검토 이유와 인용 버전의 접수·검토를 위한 보관에 동의합니다.</label><p>질문 원문과 비공개 메모는 자동으로 접수하지 않습니다.</p><button type="submit" disabled={busy || !reportConsent}>답변 검토 요청 접수</button></form></details>
    </section> : null}
    {ids.length ? <Link href={`/saved/?compare=${ids.slice(0, 3).join(",")}`}>선택 자료 최대 3개 직접 비교 →</Link> : null}
  </div>;
}
