import { useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, type ApiSession } from "../web/lib/api-client";
import { MobileAccountClient, type AccountShelf } from "./account-client";

export function MobileAccountPanel({ apiUrl, siteUrl, bookmarks, onImport }: { apiUrl: string; siteUrl: string; bookmarks: string[]; onImport: (ids: string[]) => Promise<void> }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [session, setSession] = useState<ApiSession | null>(null);
  const [shelf, setShelf] = useState<AccountShelf | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [conflict, setConflict] = useState(false);
  const operationLock = useRef(false);
  const client = useMemo(() => { if (!apiUrl || !siteUrl) return null; try { return new MobileAccountClient(apiUrl, siteUrl); } catch { return null; } }, [apiUrl, siteUrl]);
  async function run(action: () => Promise<void>) {
    if (operationLock.current) return; operationLock.current = true; setBusy(true);
    try { await action(); }
    catch (error) {
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") setConflict(true);
      if (error instanceof ApiError && ["AUTH_REQUIRED", "UNAUTHORIZED", "CSRF_INVALID"].includes(error.code)) { setSession(null); setShelf(null); setPassword(""); }
      setMessage(error instanceof Error ? error.message : "계정 작업을 완료하지 못했습니다.");
    } finally { operationLock.current = false; setBusy(false); }
  }
  function openWebAccount() { void Linking.openURL(siteUrl + "/account/").catch(() => setMessage("계정 페이지를 열지 못했습니다.")); }
  function login() { void run(async () => { if (!client) return; setSession(await client.login(email, password)); setPassword(""); setMessage("로그인했습니다. 계정 북마크를 불러와 비교한 뒤 공유하세요."); }); }
  function reloadShelf() { void run(async () => { if (!client) return; setShelf(await client.shelf()); setConflict(false); setMessage("최신 계정 버전을 불러왔습니다. 아직 기기나 서버 북마크를 변경하지 않았습니다."); }); }
  function importBookmarks() { Alert.alert("기기 보관함에 합치기", "기존 기기 목록을 유지하며 계정 북마크를 추가합니다.", [{ text: "취소" }, { text: "합치기", onPress: () => void run(async () => { if (!shelf) return; await onImport([...new Set([...bookmarks, ...shelf.payload.bookmarks])]); setMessage("기기에 합쳤습니다. 계정 자료는 변경하지 않았습니다."); }) }]); }
  function exportBookmarks() { Alert.alert("계정에 공유", "불러온 서버 버전과 대조해 북마크를 합칩니다. 계정 메모는 유지합니다.", [{ text: "취소" }, { text: "공유", onPress: () => void run(async () => { if (!client || !shelf) return; setShelf(await client.mergeBookmarks(shelf, bookmarks)); setMessage("서버가 새 계정 버전의 저장 결과를 반환했습니다."); }) }]); }
  function logout() { void run(async () => { if (!client) return; await client.logout(); setSession(null); setShelf(null); setPassword(""); setMessage("계정 연결을 종료했습니다. 기기 북마크와 다운로드는 유지됩니다."); }); }
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>선택적 계정 북마크 공유</Text><Text style={styles.text}>기기와 계정의 북마크는 요청할 때만 합칩니다. 계정 메모는 유지하고 로그인 비밀번호와 세션 정보는 별도 기기 저장에 포함하지 않습니다.</Text>
    {!client ? <><AccountAction label="웹에서 계정 서비스 열기" onPress={openWebAccount} disabled={!siteUrl || busy} /><Text style={styles.text}>앱의 계정 API 연결이 설정되지 않았습니다. 기기 열람과 다운로드는 계속 사용할 수 있습니다.</Text></> : !session?.user ? <>
      <TextInput accessibilityLabel="계정 이메일" placeholder="이메일" placeholderTextColor="#bfc1b4" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <TextInput accessibilityLabel="계정 비밀번호" placeholder="비밀번호" placeholderTextColor="#bfc1b4" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <AccountAction label="계정 로그인" onPress={login} disabled={busy || !email || !password} /><AccountAction label="웹에서 가입·계정 관리" onPress={openWebAccount} disabled={busy || !siteUrl} />
    </> : <><Text style={styles.text}>{session.user.name} · 계정 연결</Text><AccountAction label="계정 북마크 불러오기" onPress={reloadShelf} disabled={busy} />
      {shelf ? <><Text style={styles.text}>기기 {bookmarks.length}개 · 계정 {shelf.payload.bookmarks.length}개 · 계정 버전 {shelf.version} · 계정 메모 {Object.keys(shelf.payload.notes).length}개 유지</Text><AccountAction label="계정 북마크를 기기에 합치기" onPress={importBookmarks} disabled={busy || conflict} /><AccountAction label="기기 북마크를 계정에 합치기" onPress={exportBookmarks} disabled={busy || conflict} /></> : null}
      {conflict ? <Text accessibilityRole="alert" style={styles.text}>다른 기기에서 수정했습니다. 최신 계정 북마크를 다시 불러와 비교하세요. 기존 기기·서버 목록을 덮어쓰지 않았습니다.</Text> : null}<AccountAction label="계정 로그아웃" onPress={logout} disabled={busy} />
    </>}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text> : null}
  </View>;
}
function AccountAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ panel: { padding: 18, marginTop: 24, borderWidth: 1, borderColor: "#6b725e", backgroundColor: "#252d25" }, heading: { color: "#eee8d9", fontSize: 18, marginBottom: 12 }, text: { color: "#bfc1b4", fontSize: 14, lineHeight: 24, marginVertical: 6 }, input: { color: "#eee8d9", minHeight: 48, borderWidth: 1, borderColor: "#6b725e", padding: 12, marginTop: 12 }, button: { minHeight: 46, borderWidth: 1, borderColor: "#84744f", padding: 12, marginTop: 12 }, buttonText: { color: "#dfc994", fontSize: 14, lineHeight: 22 } });
