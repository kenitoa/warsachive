/** One-time, evidence-linked registry seed. Never replaces an existing registry. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseKnowledgeRegistry } from "../lib/knowledge-domain.ts";

if (!process.argv.includes("--write")) throw new Error("Use --write only when creating a new knowledge.json. Existing files are never replaced.");
const target = new URL("../content/knowledge.json", import.meta.url);
const editorial = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8"));
const authorities = JSON.parse(await readFile(new URL("../content/editorial/name-authorities.json", import.meta.url), "utf8"));
const records = editorial.records;
const checkedAt = "2026-10-07";
const review = { status: "source-checked", checkedAt, checkedBy: "AI 자료 대조", humanReviewed: false,
  note: "기관 서지·자료 안내와 대조했습니다. 역사 전문가 또는 운영자의 사람 최종 검수는 대기 중입니다." };
const evidence = (sourceId, locator, note = "기관 페이지의 해당 위치를 대조한 서지 근거입니다. 자료의 모든 역사적 주장을 승인한 것은 아닙니다.") => ({ sourceId, locator, note });
const item = (id, references, fields) => ({ id, ...fields, review: { ...review }, evidence: references });
const sourceList = [...new Map(records.flatMap(record => record.sources.map(source => [source.id, source]))).values()];
const providers = {
  "국사편찬위원회": "organization-nikh", "한국학중앙연구원": "organization-aks",
  UNESCO: "organization-unesco", "유네스코 국제기록유산센터": "organization-icdh"
};
const entities = [];
for (const [name, providerId] of Object.entries(providers)) {
  const sources = sourceList.filter(source => source.institution === name);
  if (!sources.length) throw new Error(`No registered source for ${name}`);
  entities.push(item(providerId, sources.map(source => evidence(source.id, "페이지의 제공 기관 표시")), {
    kind: "organization", name, aliases: [], description: "연결한 기관 자료의 제공 주체입니다. 이 사이트와의 협약·공동 검수를 의미하지 않습니다.",
    recordIds: records.filter(record => record.sources.some(source => source.institution === name)).map(record => record.id), externalAuthorityUrls: []
  }));
}
const people = [...new Map(records.flatMap(record => record.people.map(person => [person.id, person]))).values()];
const personEvidence = {
  "yi-sun-sin": [evidence("unesco-nanjung", "페이지 제목 및 자료 설명")],
  "yu-seong-ryong": [evidence("aks-jingbirok", "정의·내용")],
  "toyotomi-hideyoshi": [evidence("nikh-imjin", "전쟁 종결 설명")],
  "yi-deok-hyeong": [evidence("sillok-noryang", "기사 제목·본문")],
  "chen-lin": [evidence("sillok-noryang", "기사 본문의 진린 표기")]
};
for (const person of people) entities.push(item(person.id, personEvidence[person.id], {
  kind: "person", name: person.name, aliases: person.aliases,
  description: "공개 사건·사료 기록에서 연결한 인물입니다. 생몰년·관직·전체 생애는 아직 별도 검수하지 않았습니다.",
  recordIds: records.filter(record => record.people.some(entry => entry.id === person.id)).map(record => record.id), externalAuthorityUrls: []
}));
const places = [...new Map(records.flatMap(record => record.places.map(place => [place.id, place]))).values()];
const placeEvidence = {
  joseon: [evidence("nikh-imjin", "개요")], pyeongyang: [evidence("sillok-pyeongyang", "기사 제목·본문")],
  hansan: [evidence("nikh-imjin", "전쟁 전개 설명")], noryang: [evidence("sillok-noryang", "기사 본문")],
  hyeonchungsa: [evidence("icdh-nanjung", "소장기관 현충사")], andong: [evidence("aks-jingbirok", "국가문화유산 소재지·미디어 정보")]
};
for (const place of places) entities.push(item(place.id, placeEvidence[place.id], {
  kind: "place", name: place.name, aliases: place.id === "hyeonchungsa" ? place.aliases.filter(alias => !["Asan City", "아산"].includes(alias)) : place.aliases,
  description: place.id === "joseon" ? "기록에서 쓰는 역사적 지역·정치체 명칭입니다. 현대 국경과 일치하는 경계로 표시하지 않습니다." : "연결 기록 또는 소장 자료 안내에 나오는 장소입니다. 역사적 사건 위치의 좌표는 확정하지 않았습니다.",
  recordIds: records.filter(record => record.places.some(entry => entry.id === place.id)).map(record => record.id), externalAuthorityUrls: []
}));
entities.push(item("organization-hyeonchungsa", [evidence("icdh-nanjung", "소장기관")], {
  kind: "organization", name: "현충사", aliases: ["Hyeonchungsa"], description: "국제기록유산센터가 난중일기의 소장기관으로 안내한 주체입니다.", recordIds: ["nanjung-ilgi"], externalAuthorityUrls: []
}));
entities.push(item("organization-korean-studies-advancement-center", [evidence("aks-jingbirok", "징비록 표지 미디어 정보·소재지")], {
  kind: "organization", name: "한국국학진흥원", aliases: [], description: "백과사전이 징비록 필사본의 소재·소장 안내에 표시한 기관입니다. 판본마다 소장기관을 구분합니다.", recordIds: ["jingbirok"], externalAuthorityUrls: []
}));
entities.push(item("organization-itkc", [evidence("sillok-pyeongyang", "페이지 하단 국역 저작권·제공 표시"), evidence("sillok-noryang", "페이지 하단 국역 제공 표시")], {
  kind: "organization", name: "한국고전번역원", aliases: [], description: "연결한 실록 기사 국역의 제공 표시에 나오는 기관입니다. 원본 실물 소장기관으로 간주하지 않습니다.", recordIds: ["imjin-war", "jeongyu-war"], externalAuthorityUrls: []
}));
const date = (id, sourceId, locator, fields) => item(id, [evidence(sourceId, locator)], {
  label: "자료 시점", originalText: "미상", calendar: "unknown", precision: "unknown", startYear: null, endYear: null,
  month: null, day: null, era: null, conversion: null, ...fields
});
const dates = [
  date("date-imjin-range", "nikh-imjin", "개요", { purpose: "event", label: "사건 범위", originalText: "1592–1598", precision: "range", startYear: 1592, endYear: 1598 }),
  date("date-jeongyu-range", "nikh-jeongyu", "개요", { purpose: "event", label: "재침·철수 범위", originalText: "1597–1598", precision: "range", startYear: 1597, endYear: 1598 }),
  date("date-pyeongyang-article", "sillok-pyeongyang", "기사 표제의 선조 26년 1월 11일", { purpose: "article", label: "실록 기사 날짜", originalText: "선조 26년 1월 11일", calendar: "lunisolar", precision: "day", startYear: 1593, endYear: 1593, month: 1, day: 11, era: "선조 26년" }),
  date("date-noryang-article", "sillok-noryang", "기사 표제의 선조 31년 11월 27일", { purpose: "article", label: "보고 기사 날짜", originalText: "선조 31년 11월 27일", calendar: "lunisolar", precision: "day", startYear: 1598, endYear: 1598, month: 11, day: 27, era: "선조 31년" }),
  date("date-nanjung-creation", "unesco-nanjung", "자료 설명", { purpose: "creation", label: "일기 작성 범위", originalText: "1592–1598", precision: "range", startYear: 1592, endYear: 1598 }),
  date("date-nanjung-registration", "unesco-nanjung", "Registration Year", { purpose: "registration", label: "세계기록유산 등재 연도", originalText: "2013", calendar: "gregorian", precision: "year", startYear: 2013, endYear: 2013 }),
  date("date-jingbirok-creation", "aks-jingbirok", "내용의 전후 저술 설명", { purpose: "creation", label: "저술 시점", originalText: "전쟁이 끝난 뒤 저술; 정확한 연도 미확정" }),
  date("date-jingbirok-publication", "aks-jingbirok", "내용의 간행 연대 설명", { purpose: "publication", label: "판본별 간행 시점", originalText: "간행 연대에 복수 설명이 있어 판본별 대조 필요" })
];
const materials = [
  item("material-nanjung-ilgi", [evidence("unesco-nanjung", "자료 설명")], { title: "난중일기", kind: "diary", creatorIds: ["yi-sun-sin"], languageTags: ["zh-Hant"], dateIds: ["date-nanjung-creation"], editionIds: ["edition-nanjung-autograph"], description: "전쟁 중 작성한 일기라는 작품 단위 정보입니다. 현재 연결한 기관 안내는 원문 전체 전사·번역과 구분합니다." }),
  item("material-jingbirok", [evidence("aks-jingbirok", "정의·내용")], { title: "징비록", kind: "retrospective", creatorIds: ["yu-seong-ryong"], languageTags: ["zh-Hant"], dateIds: ["date-jingbirok-creation", "date-jingbirok-publication"], editionIds: ["edition-jingbirok-manuscript", "edition-jingbirok-woodblock"], description: "전후 회고 기록의 작품 단위입니다. 필사본·목판본의 형태와 소장 정보를 합치지 않습니다." }),
  item("material-seonjo-sillok", [evidence("sillok-pyeongyang", "자료열람 표제"), evidence("sillok-noryang", "자료열람 표제")], { title: "선조실록", kind: "annals", creatorIds: [], languageTags: ["zh-Hant"], dateIds: [], editionIds: ["edition-sillok-taebaeksan"], description: "연결한 두 기사의 공통 자료 단위입니다. 기사 날짜는 실록 편찬·간행 날짜를 뜻하지 않습니다." })
];
const editions = [
  item("edition-nanjung-autograph", [evidence("unesco-nanjung", "handwritten journal·seven volumes 설명"), evidence("icdh-nanjung", "소장기관")], { materialId: "material-nanjung-ilgi", title: "난중일기 친필 기록", form: "manuscript", extent: "기관 안내의 7권", dateIds: ["date-nanjung-creation"], custodianId: "organization-hyeonchungsa", identifier: null, description: "작품의 디지털 해설과 원본 필사 자료를 구분합니다. 권별 전체 상태·청구기호는 미확인입니다." }),
  item("edition-jingbirok-manuscript", [evidence("aks-jingbirok", "징비록 표지 미디어 정보의 필사본·한국국학진흥원")], { materialId: "material-jingbirok", title: "징비록 필사본 안내", form: "manuscript", extent: null, dateIds: ["date-jingbirok-creation"], custodianId: "organization-korean-studies-advancement-center", identifier: null, description: "기관 페이지의 필사본 안내에 한정한 항목입니다. 전체 면수·청구기호·현재 열람 절차는 확인 대기입니다." }),
  item("edition-jingbirok-woodblock", [evidence("aks-jingbirok", "서지적 사항·내용")], { materialId: "material-jingbirok", title: "징비록 16권 7책 목판본 안내", form: "woodblock", extent: "16권 7책", dateIds: ["date-jingbirok-publication"], custodianId: null, identifier: null, description: "백과사전 본문의 목판본 설명입니다. 필사본 소재지나 한 가지 간행 연도를 이 판본에 일괄 적용하지 않습니다." }),
  item("edition-sillok-taebaeksan", [evidence("sillok-pyeongyang", "태백산사고본·영인본 표시"), evidence("sillok-noryang", "태백산사고본·영인본 표시")], { materialId: "material-seonjo-sillok", title: "태백산사고본에 연결한 실록 기사", form: "unknown", extent: null, dateIds: [], custodianId: null, identifier: null, description: "페이지가 제시한 판본별 장차를 기사 위치와 연결합니다. 이 사이트는 원본 실물의 현재 소장 위치를 추정하지 않습니다." })
];
const rights = [];
const resources = [];
const sources = [];
const translations = [];
for (const source of sourceList) {
  const resourceId = `resource-${source.id}`;
  const rightsId = `rights-${source.id}`;
  const materialIds = source.id.includes("nanjung") ? ["material-nanjung-ilgi"] : source.id === "aks-jingbirok" ? ["material-jingbirok"] : source.id.startsWith("sillok-") ? ["material-seonjo-sillok"] : [];
  const primary = source.kind === "primary";
  const translationId = primary ? `translation-${source.id}` : null;
  rights.push(item(rightsId, [evidence(source.id, "페이지 이용 조건·출처 표시; 개별 미디어 허가 미확인")], {
    target: primary ? "translation" : "image", status: "unknown", statement: source.rights, licenseUrl: null,
    attribution: `${source.title} — ${source.institution}`, holder: null, permissions: { display: false, download: false, reuse: false }
  }));
  resources.push(item(resourceId, [evidence(source.id, source.location)], {
    sourceId: source.id, kind: primary ? "original-and-translation" : "institution-page", url: source.url,
    materialId: materialIds[0] ?? null, editionId: primary ? "edition-sillok-taebaeksan" : null,
    translationId, rightsId, iiifManifest: null, description: primary ? "기관 페이지에서 원문·국역 탭을 선택할 수 있습니다. 국역의 전체 번역자·번역일은 미확정입니다." : "기관 자료 안내 링크입니다. 이미지·본문 전체를 이 사이트가 복제한 디지털 원본은 아닙니다."
  }));
  sources.push(item(source.id, [evidence(source.id, source.location)], {
    title: source.title, creator: source.creator, providerId: providers[source.institution], kind: source.kind,
    languageTags: primary ? ["zh-Hant", "ko"] : source.language === "영어" ? ["en"] : ["ko"], url: source.url,
    locator: source.location, publicationDate: null, accessedAt: checkedAt,
    materialIds, resourceIds: [resourceId], rightsIds: [rightsId], provenanceGroup: source.independenceGroup
  }));
  if (primary) translations.push(item(translationId, [evidence(source.id, "국역 탭·한국고전번역원 제공 표시")], {
    materialId: "material-seonjo-sillok", editionId: "edition-sillok-taebaeksan", languageTag: "ko", translatorIds: [],
    providerId: "organization-itkc", title: source.id === "sillok-pyeongyang" ? "평양 수복 기사 국역" : "이덕형 보고 기사 국역",
    scope: "연결한 기사 1건의 기관 제공 국역; 실록 전체 번역이나 사이트 자체 번역이 아닙니다.", status: "available-at-provider", resourceIds: [resourceId], rightsId
  }));
}
const claims = [
  item("claim-nanjung-creator", [evidence("unesco-nanjung", "자료 설명")], { subjectId: "material-nanjung-ilgi", predicate: "creator", text: "UNESCO 자료 안내는 이순신을 일기 작성자로 설명합니다.", recordIds: ["nanjung-ilgi"], qualification: "기관 서지 설명 대조; 원문 전체의 사실성에 대한 사람 승인이 아닙니다." }),
  item("claim-nanjung-creation", [evidence("unesco-nanjung", "자료 설명")], { subjectId: "material-nanjung-ilgi", predicate: "creation-period", text: "기관 안내의 작성 범위는 1592–1598년입니다.", recordIds: ["nanjung-ilgi"], qualification: "연도 범위와 각 일기의 역법·일자를 구분합니다." }),
  item("claim-nanjung-custodian", [evidence("icdh-nanjung", "소장기관")], { subjectId: "edition-nanjung-autograph", predicate: "custodian", text: "국제기록유산센터는 소장기관을 현충사로 안내합니다.", recordIds: ["nanjung-ilgi"], qualification: "기관 안내의 확인일 기준이며 실물 열람 가능 여부는 별도 확인이 필요합니다." }),
  item("claim-nanjung-registration", [evidence("unesco-nanjung", "Registration Year")], { subjectId: "material-nanjung-ilgi", predicate: "registration", text: "세계기록유산 등록 연도는 2013년으로 표시됩니다.", recordIds: ["nanjung-ilgi"], qualification: "등록 연도는 일기 제작 연도와 다릅니다." }),
  item("claim-jingbirok-creator", [evidence("aks-jingbirok", "정의·내용")], { subjectId: "material-jingbirok", predicate: "creator", text: "백과사전은 유성룡의 전후 회고 기록으로 설명합니다.", recordIds: ["jingbirok"], qualification: "정확한 저술 연도와 판본별 간행 연도는 확정하지 않았습니다." }),
  item("claim-jingbirok-editions", [evidence("aks-jingbirok", "서지적 사항·미디어 정보")], { subjectId: "material-jingbirok", predicate: "bibliography", text: "같은 항목에서 본문의 목판본 설명과 미디어의 필사본 안내가 구분됩니다.", recordIds: ["jingbirok"], qualification: "작품의 제목이 같아도 형태·분량·소장 정보는 판본별로 연결합니다." }),
  item("claim-pyeongyang-date", [evidence("sillok-pyeongyang", "기사 표제")], { subjectId: "sillok-pyeongyang", predicate: "article-date", text: "기사 표제는 선조 26년 1월 11일이며 당시 역법의 날짜입니다.", recordIds: ["imjin-war"], qualification: "그레고리력으로 환산하지 않았으며 사건의 모든 전개 시점으로 사용하지 않습니다." }),
  item("claim-noryang-date", [evidence("sillok-noryang", "기사 표제·본문의 전투 보고")], { subjectId: "sillok-noryang", predicate: "article-date", text: "선조 31년 11월 27일의 보고 기사는 기사 날짜와 보고된 전투 시점을 구분해 읽어야 합니다.", recordIds: ["jeongyu-war"], qualification: "기사 날짜를 노량해전 날짜나 실록 편찬일로 대체하지 않습니다." })
];
const disagreements = [item("disagreement-jingbirok-printing", [evidence("aks-jingbirok", "내용의 간행 설명")], {
  title: "징비록 간행 연대의 복수 설명", question: "어느 판본·간행 행위를 가리키는 연도인가요?", recordIds: ["jingbirok"], claimIds: ["claim-jingbirok-editions"],
  positions: [
    { label: "1647년 간행 설명", description: "항목은 1647년 간행을 설명합니다. 이 연도를 모든 필사본·판본의 제작일로 적용하지 않습니다.", evidence: [evidence("aks-jingbirok", "내용의 1647년 간행 문단")] },
    { label: "앞선 수록·간행 설명", description: "같은 항목은 1633년 문집 수록과 후속 간행을 연결하는 다른 설명도 병기합니다.", evidence: [evidence("aks-jingbirok", "내용의 한편 처음 간행 문단")] }
  ], status: "open", resolution: null
})];
const locations = places.map(place => item(`location-${place.id}`, placeEvidence[place.id], {
  entityId: place.id, label: place.name, kind: place.id === "joseon" ? "historical-region" : ["hyeonchungsa", "andong"].includes(place.id) ? "custodian-location" : "battle-reference",
  coordinate: null, boundary: { status: place.id === "joseon" ? "unknown" : "not-applicable", note: "확인한 위치 근거·유효 시기의 경계 자료가 없으므로 지도에 점·국경을 만들지 않습니다." },
  dateIds: [], recordIds: records.filter(record => record.places.some(entry => entry.id === place.id)).map(record => record.id),
  uncertainty: "좌표와 역사적 경계를 검수하지 않았습니다. 장소 목록과 관련 기록으로 탐색할 수 있습니다."
}));
const relations = [
  item("relation-yi-nanjung", [evidence("unesco-nanjung", "자료 설명")], { subjectId: "yi-sun-sin", predicate: "authored", objectId: "material-nanjung-ilgi", note: "작품 작성자 관계" }),
  item("relation-yu-jingbirok", [evidence("aks-jingbirok", "정의")], { subjectId: "yu-seong-ryong", predicate: "authored", objectId: "material-jingbirok", note: "작품 작성자 관계" }),
  ...editions.map(edition => item(`relation-${edition.id}`, edition.evidence, { subjectId: edition.id, predicate: "edition-of", objectId: edition.materialId, note: "판본·자료 형태와 작품의 관계" })),
  ...editions.filter(edition => edition.custodianId).map(edition => item(`holding-${edition.id}`, edition.evidence, { subjectId: edition.id, predicate: "held-by", objectId: edition.custodianId, note: "기관 안내에서 확인한 소장 관계; 사이트 기관 협약이 아닙니다." })),
  ...sources.map(source => item(`provider-${source.id}`, source.evidence, { subjectId: source.id, predicate: "provided-by", objectId: source.providerId, note: "디지털 자료 제공 관계; 실물 소장과 구분" })),
  ...translations.map(translation => item(`relation-${translation.id}`, translation.evidence, { subjectId: translation.id, predicate: "translation-of", objectId: translation.materialId, note: "일부 기사 국역과 원자료의 관계" })),
  ...records.flatMap(record => record.places.map(place => item(`place-${record.id}-${place.id}`, placeEvidence[place.id], { subjectId: record.id, predicate: "associated-place", objectId: place.id, note: "공개 기록에서 연결한 장소; 지도 좌표 확정이 아닙니다." })))
];
const sourceDates = { "imjin-war": ["date-imjin-range", "date-pyeongyang-article"], "jeongyu-war": ["date-jeongyu-range", "date-noryang-article"], "nanjung-ilgi": ["date-nanjung-creation", "date-nanjung-registration"], jingbirok: ["date-jingbirok-creation", "date-jingbirok-publication"] };
const recordLinks = records.map(record => ({
  recordId: record.id, entityIds: [...record.people, ...record.places].map(entity => entity.id), sourceIds: record.sources.map(source => source.id),
  materialIds: record.id === "nanjung-ilgi" ? ["material-nanjung-ilgi"] : record.id === "jingbirok" ? ["material-jingbirok"] : ["material-seonjo-sillok"],
  dateIds: sourceDates[record.id], claimIds: claims.filter(claim => claim.recordIds.includes(record.id)).map(claim => claim.id),
  locationIds: locations.filter(location => location.recordIds.includes(record.id)).map(location => location.id), collectionLevelId: record.kind === "source" ? "source-reading" : "introduction"
}));
const registry = {
  version: 1, updatedAt: checkedAt, scopeNote: "4개 공개 기록과 8개 등록 출처의 확인된 서지·명칭·기관 제공 관계에서 시작합니다. AI 출처 대조 상태이며 사람 최종 검수·일본과 명 측 원자료 비교·이미지 재이용 허가·좌표 검수는 완료되지 않았습니다.",
  entities, sources, materials, editions, translations, resources, rights, dates, claims, disagreements, locations, relations,
  collectionLevels: [
    { id: "introduction", label: "입문: 사건의 범위", description: "기관 해설과 근거 링크를 통해 사건을 처음 읽습니다.", requirements: ["출처와 해설의 범위 확인", "불확실성 표시"], requiredReview: "source-checked" },
    { id: "source-reading", label: "사료 안내: 작품과 판본", description: "작성자·시점·판본·제공 기관을 구분하는 읽기 단계입니다.", requirements: ["작품과 판본 구분", "원문·국역·현대 해설 구분"], requiredReview: "source-checked" },
    { id: "comparison", label: "비교: 전문가 검수 필요", description: "여러 원자료의 관점과 주장 대조를 위한 출시 단계입니다.", requirements: ["각 관점의 원자료 대조", "번역·해석 전문가 승인", "이견 근거 연결"], requiredReview: "approved" },
    { id: "research", label: "연구: 서지·권리 완결 필요", description: "정확한 판본 위치와 권리 조건을 확인한 연구용 단계입니다.", requirements: ["소장·판본·위치 완결", "인용 위치 검증", "미디어 권리 승인"], requiredReview: "approved" }
  ], recordLinks,
  localizations: records.flatMap(record => [{ recordId: record.id, locale: "ko", sourceVersion: record.updatedAt, sourceIdentity: { title: record.title, summary: record.summary }, status: "source-checked", title: record.title, summary: record.summary, review: { ...review } },
    { recordId: record.id, locale: "en", sourceVersion: record.updatedAt, sourceIdentity: { title: record.title, summary: record.summary }, status: "draft", title: record.id === "nanjung-ilgi" ? "Nanjung Ilgi" : record.id === "jingbirok" ? "Jingbirok" : record.id === "imjin-war" ? "Imjin War" : "Renewed invasion in 1597", summary: "English editorial translation is awaiting bilingual review and is not published.", review: { ...review, status: "needs-review", checkedBy: "AI 번역 초안", note: "번역 검수 미완료. 공개 언어 전환·검색 색인·공개 내보내기에서 제외합니다." } }])
};
parseKnowledgeRegistry(registry, records);
for (const entity of registry.entities) entity.externalAuthorityUrls = [...new Set(authorities.entries.filter(entry => entry.target === entity.id).map(entry => entry.url))];
parseKnowledgeRegistry(registry, records);
await writeFile(target, `${JSON.stringify(registry, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(`Created ${fileURLToPath(target)}: ${sources.length} sources, ${entities.length} entities. No original archive files changed.`);
