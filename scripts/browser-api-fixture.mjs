// Browser tests only. This isolated temporary database never seeds the runtime API.
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../api/src/infrastructure/database.ts";
import { readConfig } from "../api/src/config.ts";
import { createApp } from "../api/src/http/app.ts";

const folder=await mkdtemp(join(tmpdir(),"archive-browser-fixture-"));
const config=readConfig({ARCHIVE_API_DB_PATH:join(folder,"test.sqlite"),ARCHIVE_API_EXPORT_DIR:join(folder,"exports"),ARCHIVE_API_ALLOWED_ORIGINS:"http://127.0.0.1:4173",ARCHIVE_API_PUBLIC_URL:"http://127.0.0.1:4173",ARCHIVE_API_SESSION_SECRET:"isolated-browser-tests-only-secret-32",ARCHIVE_PUBLICATION_SECRET:"isolated-publication-tests-only-key-32"});
const store=new Store(config.dbPath); const app=createApp({store,config});
const admin=await app.auth.bootstrapAdmin("fixture-admin@example.org","Browser fixture admin","fixture-password-only-123");
const content=JSON.parse(await readFile(new URL("../web/content/editorial.json",import.meta.url),"utf8"));
app.editorial.importStatic(admin,{version:1,records:content.records},"browser-fixture");
const server=createServer((request,response)=>void app.handler(request,response));
server.listen(4200,"127.0.0.1",()=>console.log("Isolated browser API ready on 4200; external adapters disabled."));
const worker=setInterval(()=>void app.worker.tick(),500);
let stopping=false; function stop(){if(stopping)return;stopping=true;clearInterval(worker);server.close(()=>{store.close();process.exit(0);});server.closeAllConnections();}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
