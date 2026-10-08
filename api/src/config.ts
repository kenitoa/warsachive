import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { lstatSync,readFileSync } from 'node:fs';
import type { PaymentProduct } from "./adapters/contracts.ts";
import { check } from "./domain/errors.ts";
import { object, identifier, text } from "./domain/validation.ts";
export type ApiConfig = { host: string; port: number; dbPath: string; allowedOrigins: string[]; sessionSecret: string; secureCookies: boolean; publicUrl: string; passwordResetEnabled: boolean; exportDirectory: string; privateStorageDirectory: string; publicationSecret: string; products: PaymentProduct[]; sessionHours: number; aiDailyRequestLimit: number; staticImportFile: string | null; securityEncryptionKey: string; staffMfaRequired: boolean; recentReauthRequired: boolean; deploymentEvidenceSecret: string; notificationReceiptSecret: string; fileScanSecret: string; knowledgeFile: string | null };
function contains(directory: string, path: string): boolean { const canonical = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value; const rel = relative(canonical(directory), canonical(path)); return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)); }
export function readConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const production = env.NODE_ENV === "production";
  const allowedOrigins = (env.ARCHIVE_API_ALLOWED_ORIGINS || (production ? "" : "http://localhost:3000,http://127.0.0.1:3000")).split(",").filter(Boolean).map((entry) => {
    const url = new URL(entry.trim());
    check(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && (url.protocol === "https:" || (!production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))), 500, "INVALID_CONFIG", "API origin 설정이 올바르지 않습니다.");
    return url.origin;
  });
  check(allowedOrigins.length > 0, 500, "INVALID_CONFIG", "API 허용 origin을 설정해야 합니다.");
  const sessionSecret = env.ARCHIVE_API_SESSION_SECRET || (production ? "" : randomBytes(32).toString("hex"));
  check(sessionSecret.length >= 32, 500, "INVALID_CONFIG", "세션 비밀값은 32자 이상이어야 합니다.");
  const secureCookies = env.ARCHIVE_API_SECURE_COOKIES === "true" || production;
  const port = Number(env.ARCHIVE_API_PORT || 4200);
  check(Number.isInteger(port) && port > 0 && port <= 65535, 500, "INVALID_CONFIG", "API 포트를 확인해 주세요.");
  const aiDailyRequestLimit = Number(env.ARCHIVE_AI_DAILY_REQUEST_LIMIT ?? "100");
  check(Number.isSafeInteger(aiDailyRequestLimit) && aiDailyRequestLimit > 0 && aiDailyRequestLimit <= 1000000, 500, "INVALID_CONFIG", "AI 일일 요청 한도를 양의 정수로 설정해 주세요.");
  const publicUrl = env.ARCHIVE_API_PUBLIC_URL || allowedOrigins[0];
  const publicAddress = new URL(publicUrl);
  check((publicAddress.protocol === "https:" || !production && publicAddress.protocol === "http:") && !publicAddress.username && !publicAddress.password && !publicAddress.search && !publicAddress.hash, 500, "INVALID_CONFIG", "공개 주소를 확인해 주세요.");
  const parsed: unknown = JSON.parse(env.ARCHIVE_PRODUCTS_JSON || "[]");
  check(Array.isArray(parsed) && parsed.length <= 100, 500, "INVALID_CONFIG", "상품 설정이 올바르지 않습니다.");
  const products = parsed.map((entry): PaymentProduct => {
    const item = object(entry);
    check(typeof item.amountMinor === "number" && Number.isSafeInteger(item.amountMinor) && item.amountMinor > 0 && typeof item.currency === "string" && /^[a-z]{3}$/.test(item.currency), 500, "INVALID_CONFIG", "상품 금액·통화를 확인해 주세요.");
    let serviceDefinition:PaymentProduct['serviceDefinition'];if(item.serviceDefinition!==undefined){const definition=object(item.serviceDefinition);check(Array.isArray(definition.deliverables)&&definition.deliverables.length>0&&definition.deliverables.length<=20&&Number.isSafeInteger(definition.deliveryDays)&&Number(definition.deliveryDays)>0&&Number(definition.deliveryDays)<=365,500,'INVALID_CONFIG','상품 이행 정의를 확인해 주세요.');serviceDefinition={description:text(definition.description,'상품 설명',5000),audience:text(definition.audience,'상품 대상',2000),deliverables:definition.deliverables.map(v=>text(v,'납품 항목',500)),rightsStatement:text(definition.rightsStatement,'사용권 범위',5000),deliveryDays:Number(definition.deliveryDays),supportPolicy:text(definition.supportPolicy,'지원 정책',5000)};}
    check(env.ARCHIVE_PAYMENT_LIVE_ENABLED!=='true'||Boolean(serviceDefinition),500,'INVALID_CONFIG','실결제 상품의 설명·납품·권리·지원 정의가 필요합니다.');
    return { id: identifier(item.id), title: text(item.title, "상품명", 200), amountMinor: item.amountMinor, currency: item.currency,...serviceDefinition?{serviceDefinition}:{} };
  });
  check(new Set(products.map((item) => item.id)).size === products.length, 500, "INVALID_CONFIG", "상품 식별자가 중복되었습니다.");
  const publicationSecret = env.ARCHIVE_PUBLICATION_SECRET || "";
  check(!publicationSecret || publicationSecret.length >= 32, 500, "INVALID_CONFIG", "발행 서명 비밀값은 32자 이상이어야 합니다.");
  check(!publicationSecret || publicationSecret !== sessionSecret, 500, "INVALID_CONFIG", "발행과 세션의 비밀값을 분리해 주세요.");
  const exportDirectory = resolve(repositoryRoot, env.ARCHIVE_API_EXPORT_DIR || "api/data/exports"); const privateStorageDirectory = resolve(repositoryRoot, env.ARCHIVE_API_PRIVATE_STORAGE_DIR || "api/data/private");
  const securityEncryptionKey = env.ARCHIVE_SECURITY_ENCRYPTION_KEY || '';
  check(!securityEncryptionKey || /^[a-f0-9]{64}$/.test(securityEncryptionKey),500,'INVALID_CONFIG','MFA 암호화 키는 32바이트 hex여야 합니다.');
  const staffMfaRequired = production || env.ARCHIVE_STAFF_MFA_REQUIRED === 'true';
  check(!production||Boolean(env.ARCHIVE_KNOWLEDGE_FILE),500,'INVALID_CONFIG','운영 CMS 지식 레지스트리 경로가 필요합니다.');
  const recentReauthRequired = production || env.ARCHIVE_RECENT_REAUTH_REQUIRED === 'true';
  check(!staffMfaRequired || Boolean(securityEncryptionKey),500,'INVALID_CONFIG','운영 직원 MFA 암호화 키가 필요합니다.');
  const deploymentEvidenceSecret=env.ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET || '',notificationReceiptSecret=env.ARCHIVE_NOTIFICATION_RECEIPT_SECRET || '',fileScanSecret=env.ARCHIVE_FILE_SCAN_SECRET || '';
  const configuredSecrets=[sessionSecret,publicationSecret,securityEncryptionKey,deploymentEvidenceSecret,notificationReceiptSecret,fileScanSecret].filter(Boolean);check(new Set(configuredSecrets).size===configuredSecrets.length,500,'INVALID_CONFIG','세션·발행·MFA·수신 증거 키를 각각 분리해 주세요.');
  for(const secret of [deploymentEvidenceSecret,notificationReceiptSecret,fileScanSecret]) check(!secret || secret.length>=32 && secret!==sessionSecret && secret!==publicationSecret,500,'INVALID_CONFIG','운영 증거 비밀값은 별도 32자 이상이어야 합니다.');
  const knowledgeFile=env.ARCHIVE_KNOWLEDGE_FILE?resolve(repositoryRoot,env.ARCHIVE_KNOWLEDGE_FILE):null;
  if(knowledgeFile){try{const stat=lstatSync(knowledgeFile);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=10*1024*1024,500,'INVALID_CONFIG','지식 레지스트리 파일을 확인해 주세요.');const registry=object(JSON.parse(readFileSync(knowledgeFile,'utf8')) as unknown);check(registry.version===1&&Array.isArray(registry.sources)&&Array.isArray(registry.recordLinks),500,'INVALID_CONFIG','지식 레지스트리 계약을 확인해 주세요.');}catch{check(false,500,'INVALID_CONFIG','읽을 수 있는 안전한 지식 레지스트리 JSON이 필요합니다.');}}
  for (const publicDirectory of [resolve(repositoryRoot, "web/public"), resolve(repositoryRoot, "web/out"), exportDirectory]) check(!contains(publicDirectory, privateStorageDirectory) && !contains(privateStorageDirectory, publicDirectory), 500, "INVALID_CONFIG", "비공개 파일 저장소를 공개 디렉터리 및 상위 경로와 분리해 주세요.");
  return { host: env.ARCHIVE_API_HOST || "127.0.0.1", port, dbPath: resolve(repositoryRoot, env.ARCHIVE_API_DB_PATH || "api/data/archive.sqlite"), allowedOrigins, sessionSecret, secureCookies, publicUrl: publicUrl.replace(/\/$/, ""), passwordResetEnabled: env.ARCHIVE_PASSWORD_RESET_ENABLED === "true", exportDirectory, privateStorageDirectory, publicationSecret, products, sessionHours: 24, aiDailyRequestLimit, staticImportFile: env.ARCHIVE_API_STATIC_IMPORT_FILE ? resolve(repositoryRoot, env.ARCHIVE_API_STATIC_IMPORT_FILE) : null, securityEncryptionKey,staffMfaRequired,recentReauthRequired,deploymentEvidenceSecret,notificationReceiptSecret,fileScanSecret,knowledgeFile };
}
