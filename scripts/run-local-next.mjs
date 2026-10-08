import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const host=process.argv[2]||"127.0.0.1";
process.argv=[process.execPath,resolve(root,"node_modules/next/dist/bin/next"),"dev","--hostname",host,"--port","3000"];
// Let the installed CLI terminate its own server child on every platform.
const shutdown=()=>process.emit("SIGTERM");
process.on("message",message=>{if(message&&typeof message==="object"&&message.type==="archive-local-shutdown")shutdown();});
process.once("disconnect",shutdown);
await import("../node_modules/next/dist/bin/next");
