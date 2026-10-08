import {mkdir,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {readArchiveContent} from "../web/scripts/read-archive-content.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const {publicRecords}=await readArchiveContent();
const records=publicRecords.filter(record=>record.review.status==="source-checked"&&!record.review.humanReviewed);
const destination=resolve(root,"api/data/local-static-snapshot.json");
await mkdir(dirname(destination),{recursive:true,mode:0o700});
await writeFile(destination,JSON.stringify({version:1,records}),{mode:0o600});
process.stdout.write(`로컬 API의 출처 대조 공개 자료 ${records.length}건을 준비했습니다. 사람 승인 상태는 생성하지 않습니다.\n`);
