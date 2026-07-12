import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";

const drawers = [
  ["01", "전쟁과 전투", "WAR & CONFLICT"],
  ["02", "인물과 증언", "PEOPLE & TESTIMONY"],
  ["03", "지도와 장소", "MAPS & PLACES"]
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ebe6d7" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.mark}><Text style={styles.markText}>WA</Text></View>
          <View><Text style={styles.brand}>전쟁 역사 아카이브</Text><Text style={styles.brandSub}>WAR HISTORY ARCHIVE</Text></View>
          <Text style={styles.index}>№ 001</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>DIGITAL COLLECTION · 2026</Text>
          <Text style={styles.title}>역사의 현장에서{`\n`}기록을 꺼내 읽습니다.</Text>
          <Text style={styles.lead}>사건과 인물, 장소와 사료를 연결해 전쟁의 앞뒤에 남은 이야기를 탐색합니다.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}><Text style={styles.cardIndex}>WA / 0001</Text><Text style={styles.cardYear}>2026</Text></View>
          <Text style={styles.cardLabel}>디지털 아카이브</Text>
          <Text style={styles.cardTitle}>전쟁 역사 자료 파이프라인 구축 기록</Text>
          <Text style={styles.cardBody}>크롤링부터 정보화까지, 기록이 소장 자료가 되는 과정을 정리한 최초의 수집 기록입니다.</Text>
          <View style={styles.cardFooter}><Text style={styles.tag}>구축 기록</Text><Text style={styles.source}>출처 1건</Text></View>
        </View>

        <Text style={styles.sectionLabel}>분류 서랍 / CLASSIFICATION</Text>
        <View style={styles.drawerList}>
          {drawers.map(([number, title, english]) => (
            <View style={styles.drawer} key={number}><Text style={styles.drawerNumber}>{number}</Text><View><Text style={styles.drawerTitle}>{title}</Text><Text style={styles.drawerEnglish}>{english}</Text></View><Text style={styles.arrow}>↗</Text></View>
          ))}
        </View>

        <View style={styles.connection}><View style={styles.dot} /><Text style={styles.connectionText}>GitHub Pages 정적 소장본</Text><Text style={styles.endpoint}>NAS 가공 기록은 front 저장소에 누적됩니다.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ebe6d7" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, backgroundColor: "#ebe6d7" },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "#706b5c" },
  mark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: "#292a24", borderRadius: 19 },
  markText: { color: "#292a24", fontFamily: "serif", fontSize: 11, fontWeight: "700" },
  brand: { color: "#292a24", fontFamily: "serif", fontSize: 13, fontWeight: "700" },
  brandSub: { marginTop: 3, color: "#747266", fontSize: 7, fontWeight: "700", letterSpacing: 1.4 },
  index: { marginLeft: "auto", color: "#747266", fontFamily: "serif", fontSize: 10 },
  hero: { paddingTop: 62, paddingBottom: 48 },
  kicker: { color: "#8c392f", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 16, color: "#292a24", fontFamily: "serif", fontSize: 38, fontWeight: "500", lineHeight: 47, letterSpacing: -1.4 },
  lead: { maxWidth: 330, marginTop: 20, color: "#65645a", fontSize: 15, lineHeight: 25 },
  card: { minHeight: 360, padding: 22, borderWidth: 1, borderColor: "#706b5c", backgroundColor: "#f4f0e6", shadowColor: "#554f40", shadowOffset: { width: 6, height: 8 }, shadowOpacity: .12, shadowRadius: 0, elevation: 3 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#292a24" },
  cardIndex: { color: "#747266", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  cardYear: { color: "#747266", fontSize: 9 },
  cardLabel: { marginTop: 34, color: "#8c392f", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  cardTitle: { marginTop: 13, color: "#292a24", fontFamily: "serif", fontSize: 27, fontWeight: "500", lineHeight: 35 },
  cardBody: { marginTop: 18, color: "#65645a", fontSize: 13, lineHeight: 22 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 16, borderTopWidth: 1, borderTopColor: "#b7ae99" },
  tag: { paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "#b7ae99", color: "#56564b", fontSize: 9 },
  source: { color: "#747266", fontSize: 9 },
  sectionLabel: { marginTop: 54, marginBottom: 13, color: "#8c392f", fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  drawerList: { borderTopWidth: 1, borderTopColor: "#706b5c" },
  drawer: { minHeight: 74, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#b7ae99" },
  drawerNumber: { width: 36, color: "#8c392f", fontSize: 9, fontWeight: "800" },
  drawerTitle: { color: "#292a24", fontFamily: "serif", fontSize: 17, fontWeight: "500" },
  drawerEnglish: { marginTop: 4, color: "#747266", fontSize: 8, letterSpacing: .8 },
  arrow: { marginLeft: "auto", color: "#8c392f", fontSize: 16 },
  connection: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 42, padding: 15, backgroundColor: "#30372f" },
  dot: { width: 6, height: 6, marginRight: 8, borderRadius: 3, backgroundColor: "#a5b393" },
  connectionText: { color: "#ddd8ca", fontSize: 10, fontWeight: "700" },
  endpoint: { width: "100%", marginTop: 8, color: "#999b91", fontSize: 9 }
});
