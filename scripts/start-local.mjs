import {spawn} from "node:child_process";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const children=[];let stopping=false;
const apiPort=Number(process.env.ARCHIVE_API_PORT||4200);
const bindHost=process.env.ARCHIVE_API_HOST||"127.0.0.1";
const browserHost=bindHost==="localhost"?"localhost":"127.0.0.1";
const webUrl="http://"+browserHost+":3000";
const apiUrl=Number.isInteger(apiPort)&&apiPort>0&&apiPort<=65535?new URL("http://"+browserHost+":"+apiPort).origin:"";
const environment={...process.env,ARCHIVE_API_INLINE_WORKER:"false",ARCHIVE_BUILD_PROFILE:"preview",NEXT_PUBLIC_SITE_URL:webUrl,NEXT_PUBLIC_API_URL:process.env.NEXT_PUBLIC_API_URL||apiUrl,ARCHIVE_API_ALLOWED_ORIGINS:process.env.ARCHIVE_API_ALLOWED_ORIGINS||webUrl+",http://127.0.0.1:4173",ARCHIVE_API_PUBLIC_URL:process.env.ARCHIVE_API_PUBLIC_URL||webUrl};
environment.ARCHIVE_KNOWLEDGE_FILE ||= resolve(root,"web/content/knowledge.json");

function runNode(script,{cwd=root,service=false,args=[]}={}){
 const child=spawn(process.execPath,["--experimental-strip-types",resolve(root,script),...args],{cwd,env:environment,stdio:service?["inherit","inherit","inherit","ipc"]:"inherit",windowsHide:true});
 children.push({child,service});
 if(service){child.on("error",()=>void stop(1));child.on("exit",code=>{if(!stopping)void stop(code||1);});}
 return child;
}
async function runTask(script,cwd=root){await new Promise((done,reject)=>{const child=runNode(script,{cwd});child.on("error",reject);child.on("exit",code=>code===0?done():reject(new Error("시작 준비에 실패했습니다: "+script)));});}
async function prepareSnapshot(){if(environment.ARCHIVE_API_STATIC_IMPORT_FILE)return;await runTask("scripts/prepare-local-snapshot.mjs");environment.ARCHIVE_API_STATIC_IMPORT_FILE=resolve(root,"api/data/local-static-snapshot.json");}
async function stop(code=0){
 if(stopping)return;stopping=true;
 await Promise.all(children.map(({child,service})=>new Promise(done=>{
  if(child.exitCode!==null||child.signalCode!==null){done();return;}
  let settled=false;const finish=()=>{if(!settled){settled=true;clearTimeout(deadline);done();}};
  const deadline=setTimeout(()=>{
   if(process.platform==="win32"&&child.pid){const killer=spawn("taskkill",["/pid",String(child.pid),"/t","/f"],{windowsHide:true,stdio:"ignore"});killer.on("error",finish);killer.on("exit",finish);}
   else{child.kill("SIGKILL");finish();}
  },15_000);
  child.once("exit",finish);
  if(service&&child.connected)child.send({type:"archive-local-shutdown"},error=>{if(error&&!settled)child.kill("SIGTERM");});
  else child.kill("SIGTERM");
 })));
 process.exit(code);
}
async function healthy(url,limit=120_000){const start=Date.now();while(Date.now()-start<limit){try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)});if(response.ok){await response.body?.cancel();return;}}catch{/* Startup retry; the deadline below reports failure. */}await new Promise(resolve=>setTimeout(resolve,500));}throw new Error("서비스 시작을 확인하지 못했습니다: "+url);}
async function browser(url){if(process.platform!=="win32")return;await new Promise(resolve=>{const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-Command","Start-Process -WindowStyle Hidden -FilePath '"+url+"'"],{windowsHide:true,stdio:"ignore"});child.on("error",resolve);child.on("exit",resolve);});}
process.on("SIGINT",()=>void stop());process.on("SIGTERM",()=>void stop());
try{
 if(!apiUrl||!["127.0.0.1","localhost","0.0.0.0"].includes(bindHost))throw new Error("로컬 시작기의 API는 127.0.0.1/localhost/0.0.0.0 바인딩과 유효한 포트를 사용해야 합니다. 운영 호스트는 별도 서버 실행 명령을 사용하세요.");
 const configuredApi=new URL(environment.NEXT_PUBLIC_API_URL);
 if(configuredApi.origin!==apiUrl||configuredApi.pathname!=="/"||configuredApi.username||configuredApi.password||configuredApi.search||configuredApi.hash)throw new Error("로컬 시작의 NEXT_PUBLIC_API_URL은 "+apiUrl+"이어야 합니다. 운영 환경은 별도 배포 명령을 사용하세요.");
 if(!environment.ARCHIVE_API_ALLOWED_ORIGINS.split(",").map(value=>value.trim()).includes(webUrl))throw new Error("로컬 시작의 ARCHIVE_API_ALLOWED_ORIGINS에 "+webUrl+"을 포함해야 합니다.");
 console.log("전쟁 역사 아카이브\n웹: "+webUrl+"/\nAPI: "+apiUrl+"/health/ready\n관리자: "+webUrl+"/admin/ (admin:create로 실제 계정을 먼저 만드세요.)\n종료: Ctrl+C");
 await prepareSnapshot();
 runNode("api/src/server.ts",{service:true});await healthy(apiUrl+"/health/ready",30_000);
 runNode("api/src/worker.ts",{service:true});
 const webDirectory=resolve(root,"web");
 for(const script of ["sync-content-index.mjs","generate-public-artifacts.mjs","generate-assets.mjs"])await runTask("web/scripts/"+script,webDirectory);
 runNode("scripts/run-local-next.mjs",{cwd:webDirectory,service:true,args:[browserHost]});await healthy(webUrl+"/");
 await browser(webUrl+"/");console.log("브라우저가 열리지 않으면 주소창에 "+webUrl+"/ 를 입력하세요.");
}catch(error){console.error(error instanceof Error?error.message:"시작 실패");console.error("npm ci 및 실행 환경을 확인하세요. 데이터베이스는 자동 초기화하지 않습니다.");await stop(1);}
