import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRef } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import type { ArchiveRecord } from "../web/lib/archive-types";
import { normalizeSourceUrl } from "../web/lib/archive-domain";
import { backupAndResetSavedRecords, loadMobileArchive, readSavedRecords, writeSavedRecords, type ArchiveLoad } from "./archive-client";
import { loadCatalog, loadCatalogRecord, downloadSelection, readDownloads, clearDownloads, downloadStates, loadDownloadedRecord, selectionSize, type CatalogLoad, type DownloadEntry, type DownloadProgress } from "./catalog-client";
import { MobileAccountPanel } from "./account-panel";
import type { CatalogRecord } from "../web/lib/public-catalog";

const configuredSite = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
const configuredApi = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") || "";

export default function App() {
  const [load, setLoad] = useState<ArchiveLoad | null>(null);
  const [catalogLoad, setCatalogLoad] = useState<CatalogLoad | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [retryDownloadIds, setRetryDownloadIds] = useState<string[]>([]);
  const [fontScale, setFontScale] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const downloadingLock = useRef(false);
  const detailLock = useRef(false);
  const [tab, setTab] = useState<"all" | "saved">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try { const bookmarks = await readSavedRecords(AsyncStorage); if (active) { setSaved(bookmarks); setSavedReady(true); } }
      catch (cause) { if (active) setNotice(cause instanceof Error ? cause.message : "저장 목록을 읽지 못했습니다."); }
      try {
        if (!configuredSite) throw new Error("앱 실행 환경에 EXPO_PUBLIC_SITE_URL로 공개 사이트 주소를 설정해 주세요.");
        try { const next = await loadCatalog(configuredSite, AsyncStorage); if (active) setCatalogLoad(next); }
        catch { const legacy = await loadMobileArchive(configuredSite, AsyncStorage); if (active) { setLoad(legacy); setNotice("이전 전체 자료 형식으로 읽습니다. 분할 목록과 선택 다운로드는 최신 사이트 연결 후 사용할 수 있습니다."); } }
        try { const next = await readDownloads(configuredSite, AsyncStorage); if (active) setDownloads(next); }
        catch { if (active) setNotice("다운로드 목록을 읽지 못했습니다. 기존 데이터를 자동으로 덮어쓰지 않습니다."); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "기록을 불러오지 못했습니다."); }
      finally { if (active) setBusy(false); }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  const records = useMemo(() => catalogLoad?.catalog.records || load?.archive.records || [], [catalogLoad, load]);
  const selected = selectedRecord || load?.archive.records.find((record) => record.id === selectedId);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    return records.filter((record) => (tab === "all" || saved.includes(record.id)) && (!keyword || [record.title, record.summary, record.period, record.region, ...record.labels, ...record.aliases, ...record.people.flatMap((person) => [person.name, ...person.aliases]), ...record.places.flatMap((place) => [place.name, ...place.aliases]), ...("institutions" in record ? record.institutions : record.sources.map((source) => source.institution))].join(" ").toLocaleLowerCase("ko").includes(keyword)));
  }, [records, tab, saved, query]);

  async function refresh() {
    if (downloadingLock.current || detailLock.current) return;
    setBusy(true); setError("");
    try { if (!configuredSite) throw new Error("EXPO_PUBLIC_SITE_URL 설정이 필요합니다."); const next = await loadCatalog(configuredSite, AsyncStorage); setCatalogLoad(next); setDownloads(await readDownloads(configuredSite, AsyncStorage)); setLoad(null); setSelectedRecord(null); setSelectedId(null); setNotice(next.warning || "최신 목록과 보관 버전을 대조했습니다."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "기록을 갱신하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function openRecord(record: ArchiveRecord | CatalogRecord) {
    if (detailLock.current) return;
    if (!("detailPath" in record)) { setSelectedRecord(record); setSelectedId(record.id); return; }
    detailLock.current = true; setDetailBusy(true); setError("");
    try { const detail = await loadCatalogRecord(configuredSite, record, AsyncStorage); setSelectedRecord(detail.record); setSelectedId(record.id); setNotice(detail.warning); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "상세 기록을 읽지 못했습니다."); }
    finally { detailLock.current = false; setDetailBusy(false); }
  }
  function downloadRecords(ids: string[]) {
    if (!catalogLoad || downloadingLock.current) return;
    try { const size = selectionSize(catalogLoad.catalog, ids); Alert.alert("선택 자료 다운로드", `${size.records}개 · ${Math.ceil(size.bytes / 1024)}KB · 목록 버전 ${catalogLoad.catalog.contentHash.slice(0, 12)}\n자체 편집 기록만 보관합니다. 외부 원문·국역·이미지는 포함하지 않습니다.`, [{ text: "취소" }, { text: "다운로드", onPress: () => void performDownload(ids) }]); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "선택 자료를 확인하지 못했습니다."); }
  }
  async function performDownload(ids: string[]) {
    if (!catalogLoad || downloadingLock.current) return;
    downloadingLock.current = true; setDownloading(true); setProgress(null); setRetryDownloadIds([]);
    try { const result = await downloadSelection(configuredSite, catalogLoad.catalog, ids, AsyncStorage, fetch, setProgress); setDownloads(await readDownloads(configuredSite, AsyncStorage)); setNotice(`${result.records}개 기록 (${Math.ceil(result.bytes / 1024)}KB)을 선택 보관했습니다. 외부 원문은 포함되지 않습니다.`); }
    catch (cause) { setRetryDownloadIds(ids); setNotice(cause instanceof Error ? cause.message : "다운로드를 완료하지 못했습니다."); }
    finally { downloadingLock.current = false; setDownloading(false); }
  }
  async function openDownloaded(entry: DownloadEntry) {
    if (!catalogLoad || detailLock.current) return;
    detailLock.current = true; setDetailBusy(true);
    try { const detail = await loadDownloadedRecord(configuredSite, entry, AsyncStorage, catalogLoad); setSelectedRecord(detail.record); setSelectedId(entry.id); setNotice(detail.warning); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "보관한 버전을 읽지 못했습니다."); }
    finally { detailLock.current = false; setDetailBusy(false); }
  }
  function removeDownloads() {
    Alert.alert("선택 다운로드 삭제", "선택 보관한 상세 기록을 삭제합니다. 북마크와 이전 전체 자료 캐시는 유지됩니다.", [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: () => { if (downloadingLock.current) return; downloadingLock.current = true; setDownloading(true); void clearDownloads(configuredSite, AsyncStorage).then(() => { setDownloads([]); setNotice("선택 다운로드를 삭제했습니다."); }).catch(() => setNotice("다운로드를 삭제하지 못했습니다.")).finally(() => { downloadingLock.current = false; setDownloading(false); }); } }]);
  }
  async function toggleSaved(record: ArchiveRecord) {
    if (!savedReady || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    const next = saved.includes(record.id) ? saved.filter((id) => id !== record.id) : [...saved, record.id];
    try { await writeSavedRecords(AsyncStorage, next); setSaved(next); setNotice(next.includes(record.id) ? "이 기기에 기록을 저장했습니다." : "보관함에서 기록을 해제했습니다."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "기기에 기록을 저장하지 못했습니다."); }
    finally { savingLock.current = false; setSaving(false); }
  }
  function recoverSaved() {
    Alert.alert("보관함 복구", "현재 목록을 기기에 백업한 뒤 빈 보관함으로 시작합니다. 기록 원문 캐시는 유지됩니다.", [{ text: "취소", style: "cancel" }, { text: "백업 후 초기화", onPress: () => {
      void backupAndResetSavedRecords(AsyncStorage).then(() => { setSaved([]); setSavedReady(true); setNotice("이전 목록을 백업하고 새 보관함을 시작했습니다."); }).catch(() => setNotice("백업 또는 복구에 실패했습니다. 기존 목록은 자동으로 삭제하지 않습니다."));
    } }]);
  }
  async function openSource(url: string) {
    const safe = normalizeSourceUrl(url);
    if (!safe) { setNotice("확인할 수 없는 원문 주소입니다."); return; }
    try { await Linking.openURL(safe); }
    catch { setNotice("원문을 열지 못했습니다. 인터넷 연결과 브라우저를 확인해 주세요."); }
  }
  async function shareRecord(record: ArchiveRecord) {
    try { await Share.share({ message: `${record.title}\n${configuredSite}/archive/${record.id}/` }); }
    catch { setNotice("공유 창을 열지 못했습니다."); }
  }

  return <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor="#1b211d" />
    <View style={styles.header}><View style={styles.mark}><Text style={styles.markText}>WA</Text></View><View><Text style={styles.brand}>전쟁 역사 아카이브</Text><Text style={styles.brandSub}>PUBLIC READING ROOM</Text></View></View>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {selected ? <>
        <Pressable accessibilityRole="button" onPress={() => { setSelectedId(null); setSelectedRecord(null); }} style={styles.back}><Text style={styles.actionText}>← 검색 결과로 돌아가기</Text></Pressable>
        <Text style={styles.kicker}>{selected.period} · {selected.region}</Text><Text accessibilityRole="header" style={styles.title}>{selected.title}</Text><Text style={styles.lead}>{selected.summary}</Text>
        <View style={styles.actions}><Action label={saved.includes(selected.id) ? "저장 해제" : "기기에 저장"} onPress={() => void toggleSaved(selected)} disabled={!savedReady || saving} /><Action label="기록 공유" onPress={() => void shareRecord(selected)} /></View>
        <View style={styles.status}><Text style={styles.statusTitle}>{selected.review.status === "approved" ? "인적 검수 완료" : "출처 대조 기록"}</Text><Text style={styles.muted}>{selected.review.note}</Text><Text style={styles.muted}>수정 {selected.updatedAt.slice(0, 10)} · 약 {selected.readingMinutes}분</Text></View>
        <View style={styles.actions}><Action label={fontScale === 1 ? "글자 크게" : "기본 글자"} onPress={() => setFontScale(fontScale === 1 ? 1.2 : 1)} />{catalogLoad ? <Action label="이 기록 다운로드" onPress={() => void downloadRecords([selected.id])} disabled={downloading} /> : null}</View>
        {selected.sections.map((section) => <View style={styles.section} key={section.id}><Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>{section.interpretation ? <Text style={styles.kicker}>자료를 바탕으로 한 해석</Text> : null}{section.paragraphs.map((paragraph, index) => <Text style={[styles.body, { fontSize: 16 * fontScale, lineHeight: 29 * fontScale }]} key={`${section.id}-${index}`}>{paragraph}</Text>)}<Text style={styles.muted}>근거: {section.sourceIds.map((id) => selected.sources.find((source) => source.id === id)?.title || id).join(" · ")}</Text></View>)}
        {selected.chronology.length ? <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>시간 흐름</Text>{selected.chronology.map((moment, index) => <View key={`${moment.date}-${index}`} style={styles.timeline}><Text style={styles.kicker}>{moment.date}</Text><Text style={styles.cardTitle}>{moment.title}</Text><Text style={styles.body}>{moment.text}</Text></View>)}</View> : null}
        <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>출처와 원문</Text>{selected.sources.map((source) => <View key={source.id} style={styles.sourceCard}><Text style={styles.cardTitle}>{source.title}</Text><Text style={styles.muted}>{source.creator} · {source.institution}</Text><Text style={styles.muted}>{source.location} · {source.language}</Text><Text style={styles.muted}>{source.rights}</Text><Action label={source.kind === "primary" ? "원문 열기 ↗" : "기관 자료 열기 ↗"} onPress={() => void openSource(source.url)} /></View>)}</View>
        {selected.limitations.length ? <View style={styles.status}><Text style={styles.statusTitle}>읽을 때 확인할 점</Text>{selected.limitations.map((limitation) => <Text style={styles.muted} key={limitation}>• {limitation}</Text>)}</View> : null}
      </> : <>
        <View style={styles.hero}><Text style={styles.kicker}>WAR HISTORY / OPEN COLLECTION</Text><Text accessibilityRole="header" style={styles.title}>사료를 찾고,{"\n"}맥락으로 읽습니다.</Text><Text style={styles.lead}>사건과 인물, 장소의 기록을 출처와 함께 읽고 이 기기에 보관합니다.</Text></View>
        <View style={styles.tabs}><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "all" }} onPress={() => setTab("all")} style={[styles.tab, tab === "all" && styles.activeTab]}><Text style={styles.actionText}>전체 기록 {records.length}</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "saved" }} onPress={() => setTab("saved")} style={[styles.tab, tab === "saved" && styles.activeTab]}><Text style={styles.actionText}>보관함 {saved.length}</Text></Pressable></View>
        <TextInput accessibilityLabel="기록 검색" placeholder="사건, 인물, 지역 검색" placeholderTextColor="#92978b" value={query} onChangeText={setQuery} style={styles.search} returnKeyType="search" clearButtonMode="while-editing" />
        {busy || detailBusy ? <View style={styles.loading}><ActivityIndicator color="#c5ac75" /><Text style={styles.muted}>{detailBusy ? "선택한 기록을 읽고 있습니다." : "공개 목록을 확인하고 있습니다."}</Text></View> : null}
        {error ? <View accessibilityRole="alert" style={styles.status}><Text style={styles.statusTitle}>자료를 불러오지 못했습니다</Text><Text style={styles.muted}>{error}</Text><Action label="다시 시도" onPress={() => void refresh()} /></View> : null}
        {!busy && !error && !filtered.length ? <View style={styles.status}><Text style={styles.statusTitle}>{tab === "saved" ? "저장한 공개 기록이 없습니다" : "검색 결과가 없습니다"}</Text><Text style={styles.muted}>{tab === "saved" ? "기록 상세에서 ‘기기에 저장’을 눌러 보관하세요. 공개가 보류된 기록은 표시되지 않습니다." : "짧은 이름이나 다른 표기로 검색해 보세요."}</Text>{query ? <Action label="검색 초기화" onPress={() => setQuery("")} /> : null}</View> : null}
        {filtered.map((record) => <Pressable key={record.id} disabled={detailBusy} accessibilityRole="button" accessibilityLabel={`${record.title}, 기록 읽기`} onPress={() => void openRecord(record)} style={styles.card}><Text style={styles.kicker}>{record.period} · {record.region}</Text><Text style={styles.cardTitle}>{record.title}</Text><Text style={styles.cardBody}>{record.summary}</Text><View style={styles.cardFooter}><Text style={styles.muted}>{record.sourceCount}개 출처 · 약 {record.readingMinutes}분</Text><Text style={styles.actionText}>{saved.includes(record.id) ? "저장됨 · " : ""}읽기 →</Text></View></Pressable>)}
        {catalogLoad ? <View style={styles.status}><Text accessibilityRole="header" style={styles.statusTitle}>선택해서 오프라인 읽기</Text><Text style={styles.muted}>목록은 가볍게 받고 상세 자료는 열거나 선택해서 보관합니다. 명시적 다운로드 {downloads.length}개 · {Math.ceil(downloads.reduce((total, entry) => total + entry.bytes, 0) / 1024)}KB</Text><Action label="북마크한 공개 기록 다운로드" onPress={() => void downloadRecords(saved.filter(id => records.some(record => record.id === id)))} disabled={downloading || !saved.some(id => records.some(record => record.id === id))} />{catalogLoad.catalog.collections.map(collection => <Action key={collection.id} label={`${collection.title} 다운로드`} onPress={() => void downloadRecords(collection.recordIds)} disabled={downloading} />)}{downloads.length ? <Action label="선택 다운로드 삭제" onPress={removeDownloads} disabled={downloading} /> : null}{downloading ? <Text accessibilityLiveRegion="polite" style={styles.muted}>모든 기록을 확인하고 묶음을 저장하고 있습니다.</Text> : null}</View> : null}
      </>}
      {progress ? <View style={styles.status}><Text accessibilityRole="header" style={styles.statusTitle}>다운로드 {({ downloading: "자료 확인 중", saving: "묶음 저장 중", complete: "완료", failed: "실패" })[progress.phase]}</Text><Text accessibilityLiveRegion="polite" style={styles.muted}>검증한 기록 {progress.completedRecords}/{progress.totalRecords}개 · 받은 자료 {Math.ceil(progress.downloadedBytes / 1024)}/{Math.ceil(progress.totalBytes / 1024)}KB</Text>{progress.phase === "failed" ? <Text style={styles.muted}>전체 자료의 확인·저장이 끝나지 않아 이전 다운로드 묶음의 목록을 유지했습니다. 인터넷 연결·저장 공간을 확인한 뒤 다시 선택하세요.</Text> : null}{progress.phase === "failed" && retryDownloadIds.length ? <Action label="실패한 묶음 다시 시도" disabled={downloading || busy} onPress={() => downloadRecords(retryDownloadIds.filter(id => records.some(record => record.id === id)))} /> : null}</View> : null}
      {catalogLoad && downloads.length ? <View style={styles.status}><Text accessibilityRole="header" style={styles.statusTitle}>기기에 보관한 버전</Text>{downloadStates(catalogLoad.catalog, downloads).map(entry => <View key={entry.id} style={styles.sourceCard}><Text style={styles.cardTitle}>{entry.latest?.title || entry.id}</Text><Text style={styles.muted}>보관한 수정일 {entry.updatedAt.slice(0, 10)} · {Math.ceil(entry.bytes / 1024)}KB · 자료 버전 {entry.sha256.slice(0, 12)}</Text><Text style={styles.muted}>{entry.state === "current" ? catalogLoad.mode === "online" ? "확인한 공개 버전과 같습니다." : "마지막 확인 목록과 같습니다. 현재 공개 상태는 미확인입니다." : entry.state === "outdated" ? "새 공개 버전이 있습니다. 이전 버전임을 확인하고 읽거나 새로 다운로드하세요." : catalogLoad.mode === "online" ? "최신 공개 목록에서 제외돼 본문 열람을 보류했습니다." : "마지막 목록에 없습니다. 현재 공개 상태를 확인하지 못했습니다."}</Text>{entry.state !== "unavailable" || catalogLoad.mode === "offline" ? <Action label={entry.state === "current" ? "보관한 버전 읽기" : "이전 보관 버전 읽기"} disabled={detailBusy || busy} onPress={() => void openDownloaded(entry)} /> : null}{entry.state === "outdated" ? <Action label="새 버전 다운로드" disabled={downloading || busy} onPress={() => downloadRecords([entry.id])} /> : null}</View>)}</View> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      {!busy && !savedReady ? <View style={styles.status}><Text style={styles.statusTitle}>보관함 변경이 잠겨 있습니다</Text><Text style={styles.muted}>기존 저장 목록을 읽지 못했습니다. 새 저장으로 덮어쓰지 않습니다.</Text><Action label="저장 목록 백업 후 복구" onPress={recoverSaved} /></View> : null}
      {load ? <View style={styles.connection}><Text style={styles.statusTitle}>{load.mode === "offline" ? "오프라인 보관본" : "공개 정적 소장본"}</Text><Text style={styles.muted}>자료 갱신 {load.archive.generatedAt.slice(0, 10)} · 보관함은 이 기기에만 저장됩니다.</Text>{load.warning ? <Text style={styles.muted}>{load.warning}</Text> : null}<Action label="최신 기록 확인" onPress={() => void refresh()} disabled={busy || downloading || detailBusy} /></View> : null}
      {catalogLoad ? <View style={styles.connection}><Text style={styles.statusTitle}>{catalogLoad.mode === "offline" ? "오프라인 목록" : "최신 공개 목록"}</Text><Text style={styles.muted}>목록 발행 {catalogLoad.catalog.generatedAt} · 버전 {catalogLoad.catalog.contentHash.slice(0, 12)}</Text><Text style={styles.muted}>마지막 온라인 확인 {catalogLoad.checkedAt || "기록 없음"} · UTC</Text><Text style={styles.muted}>보관 기록의 정정·공개 상태는 연결 후 확인하세요. 오프라인에서 새로 보류된 기록을 즉시 확인한 것으로 표시하지 않습니다.</Text>{catalogLoad.warning ? <Text style={styles.muted}>{catalogLoad.warning}</Text> : null}<Action label="최신 목록 확인" onPress={() => void refresh()} disabled={busy || downloading || detailBusy} /></View> : null}
      <MobileAccountPanel apiUrl={configuredApi} siteUrl={configuredSite} bookmarks={saved} onImport={async ids => { if (!savedReady || savingLock.current) throw new Error("기기 북마크 저장 준비가 아직 끝나지 않았습니다."); savingLock.current = true; setSaving(true); try { await writeSavedRecords(AsyncStorage, ids); setSaved(ids); } finally { savingLock.current = false; setSaving(false); } }} />
      <Text style={styles.footer}>기록의 출처와 맥락을 함께 보존합니다.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1b211d" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: "#41473c" },
  mark: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 12, borderWidth: 1, borderColor: "#bda571" },
  markText: { color: "#ded6c3", fontFamily: "serif", fontSize: 13, fontWeight: "700" },
  brand: { color: "#eee8d9", fontFamily: "serif", fontSize: 15, fontWeight: "700" },
  brandSub: { marginTop: 5, color: "#aaa995", fontSize: 9, letterSpacing: 1.5 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  hero: { paddingTop: 42, paddingBottom: 30 },
  kicker: { color: "#c7ac78", fontSize: 11, fontWeight: "700", lineHeight: 20, letterSpacing: .7 },
  title: { marginTop: 16, color: "#eee8d9", fontFamily: "serif", fontSize: 32, lineHeight: 43, letterSpacing: -.5 },
  lead: { marginTop: 20, color: "#bfc1b4", fontSize: 15, lineHeight: 26 },
  tabs: { flexDirection: "row", marginBottom: 18, gap: 8 },
  tab: { flex: 1, alignItems: "center", minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: "#4b5145" },
  activeTab: { backgroundColor: "#353d31", borderColor: "#b29a64" },
  search: { minHeight: 52, paddingHorizontal: 15, color: "#eee8d9", borderWidth: 1, borderColor: "#6b725e", backgroundColor: "#252d25", marginBottom: 20, fontSize: 15 },
  card: { padding: 20, marginBottom: 15, borderWidth: 1, borderColor: "#4b5145", backgroundColor: "#252d25" },
  cardTitle: { marginTop: 7, marginBottom: 8, color: "#eee8d9", fontFamily: "serif", fontSize: 22, lineHeight: 31 },
  cardBody: { color: "#c0c2b6", fontSize: 14, lineHeight: 24 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#4b5145" },
  muted: { color: "#bfc1b4", fontSize: 13, lineHeight: 23 },
  action: { alignSelf: "flex-start", minHeight: 46, justifyContent: "center", paddingHorizontal: 15, marginTop: 12, borderWidth: 1, borderColor: "#84744f" },
  actionText: { color: "#dfc994", fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  back: { minHeight: 48, justifyContent: "center", marginTop: 18, marginBottom: 20 },
  section: { marginVertical: 25 },
  sectionTitle: { color: "#eee8d9", fontFamily: "serif", fontSize: 25, marginBottom: 15 },
  body: { color: "#d1d2c5", fontSize: 16, lineHeight: 29, marginBottom: 18 },
  status: { marginTop: 10, marginBottom: 20, padding: 18, borderWidth: 1, borderColor: "#6b725e", backgroundColor: "#2b3529" },
  statusTitle: { color: "#eee8d9", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  sourceCard: { paddingVertical: 18, borderTopWidth: 1, borderTopColor: "#4b5145" },
  timeline: { paddingLeft: 16, marginBottom: 20, borderLeftWidth: 2, borderLeftColor: "#9f885e" },
  connection: { padding: 18, marginTop: 30, backgroundColor: "#2c352a", borderWidth: 1, borderColor: "#4b5145" },
  notice: { marginTop: 15, padding: 12, backgroundColor: "#343c2f", color: "#eee8d9", fontSize: 14, lineHeight: 23 },
  loading: { alignItems: "center", gap: 12, paddingVertical: 25 },
  disabled: { opacity: .5 },
  footer: { color: "#a2aa98", fontSize: 12, lineHeight: 22, marginTop: 28 }
});
