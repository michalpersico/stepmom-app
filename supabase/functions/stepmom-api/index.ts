import worker,{hash} from './worker.js';
const base=Deno.env.get('SUPABASE_URL')!;
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const secret=secrets.default||Object.values(secrets)[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const headers={apikey:String(secret),'Content-Type':'application/json',...(String(secret).startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
async function rest(path:string,options:RequestInit={}){const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw Error('database_'+r.status);return r.status===204?null:r.json();}
class Objects {
 async getMany(keys:string[]){
  const out=[];
  for(let i=0;i<keys.length;i+=40){const batch=keys.slice(i,i+40);const rows=await rest('stepmom_objects?select=key,value&key=in.'+encodeURIComponent('('+batch.map(k=>JSON.stringify(k)).join(',')+')')+'&limit=40');const found=new Map(rows.map((r:any)=>[r.key,r.value]));for(const key of batch)out.push(found.get(key)||null);}
  return out;
 }

 async get(key:string){const rows=await rest('stepmom_objects?select=value&key=eq.'+encodeURIComponent(key));if(!rows.length)return null;const value=rows[0].value;return {json:async()=>value,text:async()=>JSON.stringify(value)};}
 async head(key:string){if(key==='media/stepmom2026.mp4'){const cfg=await this.get('config/media');return cfg?{size:1}:null;}return await this.get(key)?{size:1}:null;}
 async put(key:string,raw:string,options:any={}){const conditional=!!options.onlyIf;const rows=await rest('stepmom_objects?on_conflict=key',{method:'POST',headers:{Prefer:(conditional?'resolution=ignore-duplicates':'resolution=merge-duplicates')+',return=representation'},body:JSON.stringify({key,value:JSON.parse(raw),updated_at:new Date().toISOString()})});return rows?.length?{etag:'stored'}:null;}
 async list({prefix,delimiter,limit=1000,cursor}:any){limit=Math.min(limit,500);const offset=Number(cursor||0);const pattern=delimiter?prefix+'*/manifest.json':prefix+'*';const rows=await rest('stepmom_objects?select=key&order=key&key=like.'+encodeURIComponent(pattern)+'&limit='+(limit+1)+'&offset='+offset);const truncated=rows.length>limit;const selected=rows.slice(0,limit);return {objects:delimiter?[]:selected.map((r:any)=>({key:r.key})),delimitedPrefixes:delimiter?selected.map((r:any)=>r.key.slice(0,-'manifest.json'.length)):[],truncated,cursor:String(offset+limit)};}
}
const bucket=new Objects();
Deno.serve(async(req:Request)=>{
 const url=new URL(req.url),path=url.pathname.replace(/^\/stepmom-api/,'').replace(/^\/functions\/v1\/stepmom-api/,'');
 const origin=req.headers.get('Origin')||'';
 const cors={'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Max-Age':'600','Access-Control-Expose-Headers':'Content-Disposition','Vary':'Origin'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const wrap=(r:Response)=>{const h=new Headers(r.headers);for(const [k,v]of Object.entries(cors))h.set(k,v);return new Response(r.body,{status:r.status,headers:h});};
 try{
 const auth=await(await bucket.get('config/auth'))?.json();if(!auth)return wrap(Response.json({error:'configuration'},{status:503}));
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 const isAdmin=await hash(token)===auth.adminKey;
 if(path==='/api/media/manifest'){const m=await(await bucket.get('config/media'))?.json();return wrap(Response.json(m||{error:'video_missing'},{status:m?200:503}));}
 if(path==='/api/admin/media/init'&&req.method==='POST'){
  if(!isAdmin)return wrap(Response.json({error:'auth'},{status:403}));
  const r=await fetch(base+'/storage/v1/bucket',{method:'POST',headers,body:JSON.stringify({id:'stepmom-media',name:'stepmom-media',public:true,file_size_limit:50000000})});
  if(!r.ok&&r.status!==409)return wrap(Response.json({error:'storage_init'},{status:500}));return wrap(Response.json({saved:true}));
 }
 const part=/^\/api\/admin\/media\/part\/(\d{3})$/.exec(path);
 if(part&&req.method==='POST'){
  if(!isAdmin)return wrap(Response.json({error:'auth'},{status:403}));
  if(Number(req.headers.get('Content-Length')||0)>20000000)return wrap(Response.json({error:'size'},{status:413}));
  const r=await fetch(base+'/storage/v1/object/stepmom-media/part-'+part[1]+'.bin',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','x-upsert':'true'},body:req.body,duplex:'half'} as RequestInit);
  return wrap(Response.json({saved:r.ok},{status:r.ok?200:500}));
 }
 if(path==='/api/admin/media/complete'&&req.method==='POST'){
  if(!isAdmin)return wrap(Response.json({error:'auth'},{status:403}));
  const b=await req.json();if(!Number.isInteger(b.parts)||b.parts<1||b.parts>100)return wrap(Response.json({error:'parts'},{status:400}));
  const parts=[];for(let i=0;i<b.parts;i++){const name='part-'+String(i).padStart(3,'0')+'.bin',p=base+'/storage/v1/object/public/stepmom-media/'+name;const r=await fetch(p,{method:'HEAD'});if(!r.ok)return wrap(Response.json({error:'missing_part'},{status:409}));parts.push(p);}
  await bucket.put('config/media',JSON.stringify({parts,size:b.size,sha256:b.sha256}));return wrap(Response.json({saved:true}));
 }
 const forwarded=new URL('https://app.invalid'+path+url.search);const h=new Headers(req.headers);h.set('Origin',forwarded.origin);let body:BodyInit|undefined;
 if(req.method==='POST'){const b=await req.json();if(path==='/api/session'&&typeof b.studyKey==='string')b.studyKey=await hash(b.studyKey);body=JSON.stringify(b);}
 if(path.startsWith('/api/admin/'))h.set('Authorization','Bearer '+await hash(token));
 const r=await worker.fetch(new Request(forwarded,{method:req.method,headers:h,body}),{STUDY:bucket,STUDY_KEY:auth.studyKey,ADMIN_KEY:auth.adminKey,ASSETS:{fetch:()=>Response.json({error:'not_found'},{status:404})}});
 return wrap(r);
 }catch{return wrap(Response.json({error:'server_request_failed'},{status:500}));}
});
