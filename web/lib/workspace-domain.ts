export const workspaceKey = "war-archive.workspace.v1";
export type Evidence = { id: string; recordId: string; sourceId: string; locator: string; kind: "quote" | "note"; text: string; recordVersion: string; capturedAt: string; snapshot?: { recordTitle: string; sourceTitle: string; sourceUrl: string; sectionId: string; summary: string; origin: "editorial" | "source-link" } };
export type ResearchClaim = { id: string; statement: string; evidence: Evidence[]; limitations: string };
export type ResearchProject = { id: string; title: string; question: string; recordIds: string[]; claims: ResearchClaim[]; notes: string; updatedAt: string; nextChecks?: string[] };
export type TeachingPlan = { id: string; title: string; goal: string; level: string; recordIds: string[]; questions: string[]; updatedAt: string; teacherNotes?: string; answerKey?: string };
export type WorkspaceState = { version: 1; projects: ResearchProject[]; plans: TeachingPlan[] };
export type ImportConflict = { kind: "project" | "plan"; id: string; title: string; localUpdatedAt: string; incomingUpdatedAt: string; differences: { field: string; local: string; incoming: string }[] };
export function emptyWorkspace(): WorkspaceState { return { version: 1, projects: [], plans: [] }; }
const idPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,80}$/;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, limit = 4000): value is string { return typeof value === "string" && value.length <= limit; }
function id(value: unknown): value is string { return typeof value === "string" && idPattern.test(value); }
function ids(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 100 && value.every(id) && new Set(value).size === value.length; }
function date(value: unknown): value is string { return text(value, 40) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)); }
function isEvidence(value: unknown): value is Evidence {
  return object(value) && id(value.id) && id(value.recordId) && (value.sourceId === "" || id(value.sourceId)) && text(value.locator, 500)
    && ["quote", "note"].includes(String(value.kind)) && text(value.text, 8000) && text(value.recordVersion, 100) && date(value.capturedAt)
    && (value.snapshot === undefined || (object(value.snapshot) && text(value.snapshot.recordTitle, 500) && text(value.snapshot.sourceTitle, 1000) && text(value.snapshot.sourceUrl, 2000) && text(value.snapshot.sectionId, 100) && text(value.snapshot.summary, 4000) && ["editorial", "source-link"].includes(String(value.snapshot.origin))))
    && (value.kind !== "quote" || (id(value.sourceId) && typeof value.locator === "string" && value.locator.trim().length > 0 && typeof value.text === "string" && value.text.trim().length > 0));
}
function isClaim(value: unknown): value is ResearchClaim {
  return object(value) && id(value.id) && text(value.statement, 2000) && text(value.limitations, 4000)
    && Array.isArray(value.evidence) && value.evidence.length <= 50 && value.evidence.every(isEvidence) && new Set(value.evidence.map(item => item.id)).size === value.evidence.length;
}
export function isResearchProject(value: unknown): value is ResearchProject {
  return object(value) && id(value.id) && text(value.title, 160) && text(value.question, 1000) && ids(value.recordIds)
    && text(value.notes, 16000) && date(value.updatedAt) && (value.nextChecks === undefined || (Array.isArray(value.nextChecks) && value.nextChecks.length <= 30 && value.nextChecks.every(item => text(item, 1000)))) && Array.isArray(value.claims) && value.claims.length <= 100
    && value.claims.every(isClaim) && new Set(value.claims.map(item => item.id)).size === value.claims.length;
}
export function isTeachingPlan(value: unknown): value is TeachingPlan {
  return object(value) && id(value.id) && text(value.title, 160) && text(value.goal, 1000) && text(value.level, 80) && ids(value.recordIds)
    && Array.isArray(value.questions) && value.questions.length <= 40 && value.questions.every(question => text(question, 2000)) && date(value.updatedAt)
    && (value.teacherNotes === undefined || text(value.teacherNotes, 10000)) && (value.answerKey === undefined || text(value.answerKey, 10000));
}
export function parseWorkspace(raw: string | null): WorkspaceState {
  if (raw === null) return emptyWorkspace();
  if (raw.length > 2000000) throw new Error("작업공간 파일은 2MB 이하만 가져올 수 있습니다.");
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.plans)
    || value.projects.length > 50 || value.plans.length > 50 || !value.projects.every(isResearchProject) || !value.plans.every(isTeachingPlan)
    || new Set(value.projects.map(project => project.id)).size !== value.projects.length || new Set(value.plans.map(plan => plan.id)).size !== value.plans.length) throw new Error("지원하지 않는 작업공간 형식입니다. 기존 데이터는 변경하지 않았습니다.");
  return { version: 1, projects: value.projects, plans: value.plans };
}
export function importConflicts(current: WorkspaceState, incoming: WorkspaceState): ImportConflict[] {
  function conflict(local: ResearchProject | TeachingPlan, imported: ResearchProject | TeachingPlan, kind: "project" | "plan"): ImportConflict {
    const a = Object.entries(local); const b = Object.entries(imported); const keys = [...new Set([...a.map(([key]) => key), ...b.map(([key]) => key)])].filter(key => key !== "id" && key !== "updatedAt");
    const display = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
    return { kind, id: imported.id, title: imported.title, localUpdatedAt: local.updatedAt, incomingUpdatedAt: imported.updatedAt, differences: keys.filter(key => JSON.stringify(a.find(([field]) => field === key)?.[1]) !== JSON.stringify(b.find(([field]) => field === key)?.[1])).map(key => ({ field: key, local: display(a.find(([field]) => field === key)?.[1]), incoming: display(b.find(([field]) => field === key)?.[1]) })) };
  }
  return [
    ...incoming.projects.filter(project => current.projects.some(item => item.id === project.id && JSON.stringify(item) !== JSON.stringify(project))).map(project => conflict(current.projects.find(item => item.id === project.id)!, project, "project")),
    ...incoming.plans.filter(plan => current.plans.some(item => item.id === plan.id && JSON.stringify(item) !== JSON.stringify(plan))).map(plan => conflict(current.plans.find(item => item.id === plan.id)!, plan, "plan"))
  ];
}
export function mergeWorkspace(current: WorkspaceState, incoming: WorkspaceState, choices: Record<string, "local" | "incoming" | "both">): WorkspaceState {
  function merge<T extends { id: string; title: string }>(local: T[], imported: T[], kind: string): T[] {
    const result = [...local];
    for (const item of imported) {
      const index = result.findIndex(existing => existing.id === item.id);
      if (index < 0) { result.push(item); continue; }
      if (JSON.stringify(result[index]) === JSON.stringify(item)) continue;
      const choice = choices[`${kind}:${item.id}`];
      if (!choice) throw new Error("같은 ID의 작업이 다릅니다. 충돌 항목마다 보존 방법을 선택하세요.");
      if (choice === "incoming") result[index] = item;
      if (choice === "both") { let counter = 1; let nextId = `${item.id.slice(0, 60)}-import-${counter}`; while (result.some(existing => existing.id === nextId)) nextId = `${item.id.slice(0, 60)}-import-${++counter}`; result.push({ ...item, id: nextId, title: `${item.title.slice(0, 140)} (가져온 사본)` }); }
    }
    return result;
  }
  return parseWorkspace(JSON.stringify({ version: 1, projects: merge(current.projects, incoming.projects, "project"), plans: merge(current.plans, incoming.plans, "plan") }));
}
export function projectFromShelf(shelf: { bookmarks: string[]; notes: Record<string, string> }, selectedIds: string[], projectId: string, now: string): ResearchProject {
  if (!id(projectId) || !date(now) || !ids(selectedIds) || !selectedIds.every(recordId => shelf.bookmarks.includes(recordId) || Object.hasOwn(shelf.notes, recordId))) throw new Error("가져올 저장 기록을 확인하세요.");
  const notes = selectedIds.map(recordId => shelf.notes[recordId] ? `[${recordId}]\n${shelf.notes[recordId]}` : "").filter(Boolean).join("\n\n");
  if (notes.length > 16000) throw new Error("선택한 메모가 연구 하나의 허용량을 넘습니다. 항목을 나누어 가져오세요. 기존 메모는 유지됩니다.");
  return { id: projectId, title: "보관함에서 가져온 연구", question: "", recordIds: selectedIds,
    claims: [], notes, updatedAt: now };
}
export function publicTeachingPlan(plan: TeachingPlan): TeachingPlan { const { teacherNotes: _notes, answerKey: _key, ...publicPlan } = plan; void _notes; void _key; return publicPlan; }
export function publicWorkspace(state: WorkspaceState): WorkspaceState { return { ...state, plans: state.plans.map(publicTeachingPlan) }; }
export function encodePlan(plan: TeachingPlan): string { if (!isTeachingPlan(plan)) throw new Error("수업 경로를 확인하세요."); const value = encodeURIComponent(JSON.stringify(publicTeachingPlan(plan))); if (value.length > 12000) throw new Error("공유 경로가 너무 큽니다. 질문을 줄이거나 파일로 내보내세요."); return value; }
export function decodePlan(raw: string): TeachingPlan { if (raw.length > 12000) throw new Error("공유 경로가 허용 크기를 초과했습니다."); const value: unknown = JSON.parse(raw.startsWith("{") ? raw : decodeURIComponent(raw)); if (!isTeachingPlan(value)) throw new Error("공유된 수업 경로 형식이 올바르지 않습니다."); return value; }
export function exportRis(records: { title: string; url: string; sources: { title: string; creator: string; url: string; created?: string }[] }[]): string {
  const clean = (value: string) => value.replace(/[\r\n\t]/g, " ");
  return records.flatMap(record => record.sources.map(source => `TY  - ELEC\nTI  - ${clean(source.title)}\nAU  - ${clean(source.creator)}\nUR  - ${clean(source.url)}\nN1  - 연결 기록: ${clean(record.title)}; 제작 시점: ${clean(source.created ?? "미확인")}; 아카이브: ${clean(record.url)}\nER  - \n`)).join("\n");
}
export function mergeShelfNotes(local: Record<string, string>, incoming: Record<string, string>, choices: Record<string, "local" | "incoming" | "both">): Record<string, string> {
  const notes = { ...local };
  for (const [recordId, note] of Object.entries(incoming)) {
    if (!id(recordId) || !text(note, 4000)) throw new Error("메모 형식을 확인하세요.");
    if (!Object.hasOwn(notes, recordId) || notes[recordId] === note) { notes[recordId] = note; continue; }
    const choice = choices[recordId]; if (!choice) throw new Error("다른 기기의 메모와 충돌합니다. 각 메모의 보존 방법을 선택하세요.");
    if (choice === "incoming") notes[recordId] = note;
    if (choice === "both") { const combined = `[기기 메모]\n${notes[recordId]}\n\n[서버 메모]\n${note}`; if (combined.length > 4000) throw new Error("두 메모가 4,000자를 넘습니다. 파일로 두 버전을 보관한 뒤 하나를 선택하세요."); notes[recordId] = combined; }
  }
  return notes;
}
