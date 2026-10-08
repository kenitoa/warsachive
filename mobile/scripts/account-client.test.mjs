import test from "node:test";
import assert from "node:assert/strict";
import { MobileAccountClient, decodeAccountShelf, mergedAccountBookmarks } from "../account-client.ts";
const site="https://example.org/archive";
const api="https://example.org/backend";
const session=(user=null,csrfToken="fixture-csrf")=>({user,csrfToken,capabilities:{}});
const user={id:"fixture-user",name:"fixture",email:"fixture@example.org",role:"member"};
const envelope=(data,status=200,error=null)=>new Response(JSON.stringify({data,error,meta:{requestId:"fixture-request"}}),{status});

test("account login keeps CSRF in memory, includes cookie credentials and does not trim the password",async()=>{
 const calls=[];const client=new MobileAccountClient(api,site,async(url,options)=>{calls.push({url,options});return envelope(url.endsWith("/session")?session():session(user,"fixture-login-csrf"));});
 assert.equal((await client.login("fixture@example.org","  fixture password  ")).user.id,user.id);
 assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith("/api/v1/auth/session"));assert.equal(calls[1].options.credentials,"include");assert.equal(calls[1].options.headers.Origin,"https://example.org");assert.equal(calls[1].options.headers["X-CSRF-Token"],"fixture-csrf");assert.equal(JSON.parse(calls[1].options.body).password,"  fixture password  ");
 assert.equal(calls[1].options.headers.Authorization,undefined);
 await client.logout();assert.equal(calls[2].options.headers["X-CSRF-Token"],"fixture-login-csrf");
});

test("explicit bookmark merge preserves server notes and uses the expected server version",async()=>{
 const snapshot={version:4,payload:{bookmarks:["imjin-war"],notes:{"imjin-war":"server memo"}}};let sent;
 const client=new MobileAccountClient(api,site,async(url,options)=>{if(url.endsWith("/session"))return envelope(session(user));sent=JSON.parse(options.body);return envelope({...sent,version:5});});
 await client.session();const next=await client.mergeBookmarks(snapshot,["nanjung-ilgi","imjin-war"]);
 assert.equal(sent.version,4);assert.deepEqual(sent.payload.bookmarks,["imjin-war","nanjung-ilgi"]);assert.deepEqual(sent.payload.notes,snapshot.payload.notes);assert.equal(next.version,5);assert.equal(snapshot.version,4);
});

test("conflicts, unauthorized responses and malformed success never become a saved shelf",async()=>{
 const snapshot={version:4,payload:{bookmarks:["imjin-war"],notes:{}}};const original=structuredClone(snapshot);
 for(const [status,code]of[[409,"VERSION_CONFLICT"],[401,"AUTH_REQUIRED"]]){const client=new MobileAccountClient(api,site,async()=>envelope(null,status,{code,message:"private server diagnostic"}));await assert.rejects(client.mergeBookmarks(snapshot,["nanjung-ilgi"]),error=>error.code===code&&!error.message.includes("private server diagnostic"));}
 const broken=new MobileAccountClient(api,site,async()=>envelope({version:-1,payload:{bookmarks:[],notes:{}}}));await assert.rejects(broken.shelf(),error=>error.code==="INVALID_RESPONSE");assert.deepEqual(snapshot,original);
});

test("account shelf enforces real ID and note limits without deleting existing values",()=>{
 assert.equal(decodeAccountShelf({version:0,payload:{bookmarks:["a".repeat(80)],notes:{ok:"n".repeat(4000)}}}).payload.notes.ok.length,4000);
 for(const id of["constructor","__proto__","prototype","a".repeat(81)])assert.throws(()=>decodeAccountShelf({version:0,payload:{bookmarks:[id],notes:{}}}));
 assert.throws(()=>decodeAccountShelf({version:0,payload:{bookmarks:[],notes:{ok:"n".repeat(4001)}}}));
 const snapshot={version:1,payload:{bookmarks:Array.from({length:500},(_,index)=>"record-"+index),notes:{ok:"keep"}}};assert.throws(()=>mergedAccountBookmarks(snapshot,["new-record"]),/500/);assert.equal(snapshot.payload.notes.ok,"keep");
});

test("account endpoints require HTTPS or a local development address and never follow redirects",async()=>{
 for(const url of["http://public.example.org","https://user:secret@example.org","https://example.org?token=secret"])assert.throws(()=>new MobileAccountClient(url,site));
 assert.throws(()=>new MobileAccountClient(api,"http://public.example.org"));
 let options;const local=new MobileAccountClient("http://127.0.0.1:4200/api/v1","http://127.0.0.1:4173",async(url,input)=>{options=input;assert.equal(url,"http://127.0.0.1:4200/api/v1/auth/session");return envelope(session());});await local.session();assert.equal(options.redirect,"error");
});
