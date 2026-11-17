const enc = new TextEncoder();
export function canonical(v) { if(Array.isArray(v))return '['+v.map(canonical).join(',')+']'; if(v && typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'; return JSON.stringify(v); }
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function hash(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function equalSecret(a,b) { if(typeof a!=='string'||typeof b!=='string')return false; return (await hash(a))===(await hash(b)); }
const idOK = id => /^[0-9a-f-]{36}$/.test(id);
const bearer = req => req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
const read = async (bucket,key) => { const o=await bucket.get(key); return o ? o.json() : null; };
async function body(req) { const raw=await req.text(); if(raw.length>500000)throw new Error('body_too_large'); return JSON.parse(raw); }
export function validChunk(b) {
  return b && Number.isInteger(b.index)&&b.index>=0&&b.index<10000 && Array.isArray(b.samples)&&b.samples.length<=1200 && Array.isArray(b.events)&&b.events.length<=2000 && b.samples.every(r=>Array.isArray(r)&&r.length===5&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&Number.isInteger(r[2])&&r[2]>=-21&&r[2]<=0&&r[3]>=0&&r[4]>=0) && b.events.every(e=>e&&Number.isFinite(e.t)&&typeof e.type==='string'&&e.type.length<=80&&JSON.stringify(e).length<=2000);
}
export function csvCell(v) { if(typeof v==='number'&&Number.isFinite(v))return String(v); const s=String(v??''); return '"'+(/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"'; }
function csv(rows) { return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'); }
const israelFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function israelWallclock(ms){
 const parts=Object.fromEntries(israelFormat.formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${String(new Date(ms).getUTCMilliseconds()).padStart(3,'0')}`;
}
const precision6=v=>Number(Number(v).toFixed(6));
export const SAMPLE_HEADERS=['sample_index','frame_index','video_time_sec','time_since_play_sec','flip_time_monotonic_sec','wallclock_iso','bar_value','frame_interval_sec'];
export function sampleRows(chunks,meta){
 const ordered=[...chunks].sort((a,b)=>a.index-b.index);
 const play=ordered.flatMap(c=>c.events).find(e=>e.type==='playback_started');
 const start=Number.isFinite(play?.detail?.playStart)?play.detail.playStart:play?.t;
 const timeOrigin=meta.client?.timeOrigin;
 let index=0;
 return [SAMPLE_HEADERS,...ordered.flatMap(c=>c.samples.map(r=>{
  index++;return [index,r[4],precision6(r[1]),Number.isFinite(start)?precision6(r[0]-start):'',precision6(r[0]),Number.isFinite(timeOrigin)?israelWallclock(timeOrigin+r[0]*1000):'',r[2],index===1?'':precision6(r[3])];
 }))];
}
async function route(req,env) {
 const u=new URL(req.url), p=u.pathname;
 if(p.startsWith('/api/') && req.method!=='GET' && req.headers.get('Origin')!==u.origin)return json({error:'origin'},403);
 if(p==='/api/config')return json({ready:!!(env.STUDY&&env.STUDY_KEY&&env.ADMIN_KEY),scale:{min:-21,max:0,start:0},preplaySeconds:5});
 if(p==='/api/session'&&req.method==='POST'){
  if(!env.STUDY_KEY||!env.ADMIN_KEY||!env.STUDY)return json({error:'not_configured'},503);
  const b=await body(req);
  if(!await equalSecret(b.studyKey,env.STUDY_KEY))return json({error:'study_key'},403);
  if(typeof b.participant!=='string'||! /^[a-zA-Z0-9_-]{1,64}$/.test(b.participant))return json({error:'participant_code'},400);
  if(!await env.STUDY.head('media/stepmom2026.mp4'))return json({error:'video_missing'},503);
  const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
  const m={id,participant:b.participant,created:new Date().toISOString(),tokenHash:await hash(token),client:b.client,version:'web-1',schema:'samples=[performance_sec,video_sec,rating,frame_interval_sec,frame_index]'};
  await env.STUDY.put('sessions/'+id+'/manifest.json',JSON.stringify(m));
  return json({id,token,serverTime:m.created});
 }
 if(p==='/media/stepmom2026.mp4'&&req.method==='GET'){
  const head=await env.STUDY?.head('media/stepmom2026.mp4');if(!head)return json({error:'video_missing'},404);
  const range=req.headers.get('Range');let options={},start=0,end=head.size-1,status=200;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
   if(!m[1])start=Math.max(0,head.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
   if(start>end||start>=head.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
   options={range:{offset:start,length:end-start+1}};status=206;
  }
  const obj=await env.STUDY.get('media/stepmom2026.mp4',options); const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Cache-Control':'private, max-age=3600'};
  if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${head.size}`;
  return new Response(obj.body,{status,headers});
 }
 const match=/^\/api\/session\/([^/]+)\/(chunk|finish)$/.exec(p);
 if(match&&req.method==='POST'){
  const [,id,action]=match;if(!idOK(id))return json({error:'id'},400);
  const m=await read(env.STUDY,'sessions/'+id+'/manifest.json');
  if(!m||!await equalSecret(await hash(bearer(req)),m.tokenHash))return json({error:'auth'},403);
  const b=await body(req),root='sessions/'+id+'/';
  if(action==='chunk'){
   if(!validChunk(b))return json({error:'chunk'},400);
   const key=root+'chunks/'+String(b.index).padStart(6,'0')+'.json',raw=JSON.stringify(b);
   const existing=await env.STUDY.get(key);
   if(existing){if(canonical(JSON.parse(await existing.text()))!==canonical(b))return json({error:'chunk_conflict'},409);return json({saved:true});}
   const put=await env.STUDY.put(key,raw,{onlyIf:{etagDoesNotMatch:'*'}});
   if(!put)return json({error:'retry'},409);
   return json({saved:true});
  }
  if(!Number.isInteger(b.chunks)||b.chunks<0||b.chunks>10000||!['completed','aborted','error'].includes(b.status)||!Number.isFinite(b.videoTime)||!Number.isFinite(b.duration))return json({error:'finish'},400);
  for(let i=0;i<b.chunks;i++)if(!await env.STUDY.head(root+'chunks/'+String(i).padStart(6,'0')+'.json'))return json({error:'missing_chunks'},409);
  const status=b.status==='completed'&&b.duration>0&&b.videoTime>=b.duration-.10?'completed':b.status==='completed'?'incomplete':b.status;
  await env.STUDY.put(root+'finish.json',JSON.stringify({status,chunks:b.chunks,videoTime:b.videoTime,duration:b.duration,finished:new Date().toISOString(),quality:b.quality}));
  return json({saved:true,status});
 }
 if(p.startsWith('/api/admin/')){
  if(!env.ADMIN_KEY||!await equalSecret(bearer(req),env.ADMIN_KEY))return json({error:'auth'},403);
  if(req.method!=='GET')return json({error:'method'},405);
  if(p==='/api/admin/sessions'){
   const result=await env.STUDY.list({prefix:'sessions/',delimiter:'/',limit:100,cursor:u.searchParams.get('cursor')||undefined});
   const sessions=await Promise.all(result.delimitedPrefixes.map(async root=>{const m=await read(env.STUDY,root+'manifest.json');const end=await read(env.STUDY,root+'finish.json');return m?{id:m.id,participant:m.participant,created:m.created,status:end?.status||'unfinished',finished:end?.finished}:null;}));
   return json({sessions:sessions.filter(Boolean),cursor:result.truncated?result.cursor:null});
  }
  const ex=/^\/api\/admin\/export\/([^/]+)$/.exec(p);
  if(ex&&idOK(ex[1])){
   const root='sessions/'+ex[1]+'/',m=await read(env.STUDY,root+'manifest.json');if(!m)return json({error:'missing'},404);
   const end=await read(env.STUDY,root+'finish.json');let cursor,keys=[];
   do{const r=await env.STUDY.list({prefix:root+'chunks/',cursor});keys.push(...r.objects.map(o=>o.key));cursor=r.truncated?r.cursor:undefined;}while(cursor);
   keys.sort();const chunks=[];for(const key of keys)chunks.push(await read(env.STUDY,key));
   const kind=u.searchParams.get('kind')||'samples';
   if(kind==='metadata')return json({...m,tokenHash:undefined,finish:end,chunkCount:keys.length});
   const rows=kind==='events'?[['participant','event','performance_sec','video_sec','detail'],...chunks.flatMap(c=>c.events.map(e=>[m.participant,e.type,e.t,e.video,JSON.stringify(e.detail??'')]))]:sampleRows(chunks,m);
   return new Response(csv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="sara_${m.participant}_${m.created.slice(0,19).replaceAll(':','').replace('T','_')}_${kind}.csv"`,'Cache-Control':'no-store'}});
  }
  return json({error:'not_found'},404);
 }
 if(p.startsWith('/api/'))return json({error:'not_found'},404);
 return env.ASSETS.fetch(req);
}
export default {async fetch(req,env){try{const res=await route(req,env);const h=new Headers(res.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(res.body,{status:res.status,headers:h});}catch{return json({error:'request_failed'},400);}}};
