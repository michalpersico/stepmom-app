import { API_BASE } from './config.js';
const $=id=>document.getElementById(id);let key='',cursor=null;
async function fetchAuth(url){const r=await fetch(API_BASE+url,{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw new Error(r.status===403?'auth':'request');return r;}
let exportURL=null;
async function download(id,kind,button){
 const old=button?.textContent;if(button)button.disabled=true;
 $('status').textContent='מכין את קובץ התוצאות… יש להמתין עד להופעת קישור ההורדה.';
 document.getElementById('readyDownload')?.remove();
 try{
  const res=await fetchAuth('/api/admin/export/'+id+'?kind='+kind),blob=await res.blob();
  if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);
  const a=document.createElement('a');a.id='readyDownload';a.href=exportURL;
  a.download=res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||('stepmom_'+id+'_'+kind+(kind==='metadata'?'.json':'.csv'));
  a.textContent='הקובץ מוכן — לחצי כאן להורדה';a.style.display='block';
  $('status').after(a);a.click();
  $('status').textContent='הקובץ מוכן. אם ההורדה לא התחילה, לחצי על הקישור שמתחת להודעה.';
 }catch(e){$('status').textContent=e.message==='auth'?'מפתח הניהול אינו תקין. הזיני אותו שוב.':'הורדת הקובץ נכשלה. בדקי את החיבור ונסי שוב.';}
 finally{if(button){button.disabled=false;button.textContent=old;}}
}
async function load(){try{const data=await(await fetchAuth('/api/admin/sessions'+(cursor?'?cursor='+encodeURIComponent(cursor):''))).json();for(const s of data.sessions){const box=document.createElement('article'),p=document.createElement('p');p.textContent=`${s.participant} · ${new Date(s.created).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})} · ${s.status}`;box.append(p);for(const [kind,label]of [['samples','דירוגים CSV'],['events','אירועים CSV'],['metadata','פרטי הפעלה JSON']]){const btn=document.createElement('button');btn.textContent=label;btn.onclick=()=>download(s.id,kind,btn);box.append(btn,document.createTextNode(' '));}$('results').append(box);}cursor=data.cursor;$('more').hidden=!cursor;$('status').textContent=data.sessions.length?'הנתונים נטענו. unfinished מציין שלא התקבל אישור סיום; בדקו גם את האירועים ומדדי האיכות.':'טרם נשמרו הפעלות.';}catch{$('status').textContent='הטעינה נכשלה. בדקי את מפתח הניהול ואת החיבור.';}}
$('login').onsubmit=e=>{e.preventDefault();key=$('key').value;$('key').value='';cursor=null;$('results').replaceChildren();void load();};$('more').onclick=()=>void load();
