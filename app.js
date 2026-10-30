(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const toDate=s=>{const[a,b,c]=String(s).split('-').map(Number);return new Date(a,(b||1)-1,c||1)};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const monday=d=>addDays(d,-((d.getDay()+6)%7));
const today=()=>iso(new Date());
const nf=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}), nf0=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}), nf1=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmt=n=>nf.format(n);
const dLong=new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'});
const dShort=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'});
const dYear=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'2-digit'});
const dMon=new Intl.DateTimeFormat('fr-FR',{month:'short'});
const num=s=>{const v=parseFloat(String(s??'').replace(',','.').replace(/\s/g,''));return isFinite(v)?v:NaN};
const key=n=>String(n||'').trim().toLowerCase();
const na=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const e1rm=(kg,reps)=>reps<=1?kg:kg*(1+reps/30); // formule d'Epley
const hms=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),x=sec%60;return h?h+':'+pad(m)+':'+pad(x):m+':'+pad(x)};
const durTxt=sec=>{if(sec<60)return '< 1 min';const m=Math.round(sec/60);return m<60?m+' min':Math.floor(m/60)+' h '+pad(m%60)};
const setTxt=s=>s.kg>0?fmt(s.kg)+' kg × '+s.reps:'PDC × '+s.reps;
const kgTxt=k=>k>0?fmt(k)+' kg':'PDC';
const isDone=x=>x&&x.done!==false&&x.reps>0;
const GROUPS=[[/leg curl|ischio|souleve de terre/,'Ischios'],[/leg extension|squat|fente|presse/,'Quadriceps'],[/hip|fessier/,'Fessiers'],[/mollet/,'Mollets'],[/abdo|oblique|gainage|crunch/,'Abdominaux'],[/triceps|extension unilaterale|dips/,'Triceps'],[/curl|biceps/,'Biceps'],[/militaire|elevation|face pull|menton|oiseau|epaule/,'Épaules'],[/developpe|ecarte|pompe|pec/,'Pectoraux'],[/traction|tirage|row|dos/,'Dos']];
const groupe=n=>{const t=na(n);for(const[r,g]of GROUPS)if(r.test(t))return g;return 'Autres'};
const DEFAULT_EXOS=['Développé couché','Développé incliné','Développé militaire','Squat','Soulevé de terre','Rowing barre','Tractions','Tirage vertical','Dips','Curl biceps','Extension triceps','Élévations latérales','Presse à cuisses','Fentes','Leg curl','Leg extension','Hip thrust','Mollets debout','Pompes','Gainage'];
const MES=[['poids','Poids','kg'],['mm','Masse musculaire','kg'],['mg','Masse grasse','%'],['eau','Eau','%'],['visc','Graisse viscérale',''],['imc','IMC',''],['age','Âge métabolique','ans'],['taille','Tour de taille','cm'],['poitrine','Poitrine','cm'],['bras','Bras','cm'],['cuisse','Cuisse','cm'],['hanches','Hanches','cm']];
const TITLES={accueil:"Vue d'ensemble",seance:'Séance en cours',historique:'Historique',programme:'Programme',corps:'Poids & mensurations',reglages:'Paramètres & données'};

/* ---------- Données ---------- */
const R={seances:{},mesures:{},reg:{repos:90,objectif:3,auto:true,son:'rock'},prog:{seances:[]}};
let ver=0, idxCache=null, idxVer=-1;
const S={pe:null,mode:'loading',loaded:false,tab:'accueil',exo:null,metric:'max',mes:'poids',histN:15,filtre:'',err:''};
let db=null, dl=null, working=false; const pending={}, over={}, q=[];

function setStatus(){
  const el=$('#status'); el.classList.toggle('err',!!S.err);
  el.textContent=S.err?S.err:S.mode==='loading'?'Connexion…':S.mode==='local'?'Sur cet appareil':!S.loaded?'Chargement…':working?'Enregistrement…':'Enregistré';
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3400)}
function persist(path,val){
  ver++;
  if(S.mode==='local'){saveLocal();return}
  pending[path]=val; over[path]=val; if(!q.includes(path))q.push(path);
  if(S.mode==='db')pump();
}
async function pump(){
  if(working||!db)return; working=true; setStatus();
  while(q.length){
    const path=q.shift(); if(!(path in pending))continue;
    const v=pending[path]; delete pending[path]; const ref=db.doc(path);
    try{
      try{ await (v===null?ref.delete():ref.set(v)) }
      catch(e){ if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,600+Math.random()*600)); await (v===null?ref.delete():ref.set(v))} else throw e }
      S.err='';
    }catch(e){
      const c=e&&e.code; S.err='Non enregistré';
      toast(c==='invalid_argument'?"Enregistrement refusé : tu n'as pas le droit de modifier cette page.":c==='quota_exceeded'?"Espace plein : supprime d'anciennes séances pour continuer.":"L'enregistrement a échoué. Vérifie ta connexion puis modifie de nouveau la séance.");
    }
    setTimeout(()=>{ if(over[path]===v&&!(path in pending)) delete over[path] },4000);
  }
  working=false; setStatus();
}
function overlay(coll,m){
  for(const p in over){ if(!p.startsWith(coll+'/'))continue; const id=p.slice(coll.length+1); if(over[p]===null)delete m[id]; else m[id]=over[p] }
  return m;
}
function saveLocal(){ try{localStorage.setItem('carnet-de-fonte',JSON.stringify(R))}catch(e){ S.err='Non enregistré'; setStatus() } }
function loadLocal(){
  try{ const o=JSON.parse(localStorage.getItem('carnet-de-fonte')||'null')||window.CDF_SEED||null;
    if(o){ R.seances=Object.assign({},o.seances,R.seances); R.mesures=Object.assign({},o.mesures,R.mesures); R.reg=Object.assign({},R.reg,o.reg); if(o.prog&&Array.isArray(o.prog.seances))R.prog=o.prog }
  }catch(e){}
}
function subscribe(){
  const onErr=e=>{ S.err=e&&e.code==='revoked'?'Accès retiré':'Synchro interrompue'; setStatus() };
  const coll=(name,first)=>db.collection(name).orderBy('date','desc').limit(1000).onSnapshot(snap=>{
    const m={}; snap.docs.forEach(d=>{const v=d.data(); if(v)m[d.id]=clone(v)});
    R[name]=overlay(name,m); if(first)S.loaded=true; onData();
  },onErr);
  coll('seances',true); coll('mesures',false);
  db.doc('reglages/app').onSnapshot(s=>{ if(s.exists&&!('reglages/app' in over)){ Object.assign(R.reg,clone(s.data())); syncTimerFromReg(); if(S.tab==='reglages'||S.tab==='accueil')renderTab() } },onErr);
  db.doc('reglages/programme').onSnapshot(s=>{ if(s.exists&&!('reglages/programme' in over)){ const v=clone(s.data()); if(Array.isArray(v.seances)){R.prog=v; ver++; if(S.tab!=='seance'||!touched)renderTab()} } },onErr);
}
let regT; function saveReg(){ clearTimeout(regT); regT=setTimeout(()=>persist('reglages/app',clone(R.reg)),700) }
const saveProg=()=>persist('reglages/programme',clone(R.prog));

/* ---------- Index et calculs ---------- */
function index(){
  if(idxCache&&idxVer===ver)return idxCache;
  const list=Object.values(R.seances).filter(s=>s&&s.date).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.ts||0)-(b.ts||0));
  const ex={};
  for(const s of list)for(const e of s.exos||[]){
    const sets=(e.series||[]).filter(isDone); if(!sets.length)continue;
    const k=key(e.nom); const o=ex[k]||(ex[k]={nom:e.nom,sessions:[]});
    let maxKg=0,maxKgReps=0,e1=0,vol=0,maxReps=0,maxRepsKg=0;
    for(const x of sets){
      const kg=x.kg||0;
      if(kg>maxKg||(kg===maxKg&&x.reps>maxKgReps)){maxKg=kg;maxKgReps=x.reps}
      if(kg>0)e1=Math.max(e1,e1rm(kg,x.reps));
      vol+=kg*x.reps;
      if(x.reps>maxReps||(x.reps===maxReps&&kg>maxRepsKg)){maxReps=x.reps;maxRepsKg=kg}
    }
    o.sessions.push({id:s.id,date:s.date,sets,maxKg,maxKgReps,e1,vol,maxReps,maxRepsKg});
  }
  idxVer=ver; return idxCache={list,ex};
}
const sumS=s=>{let n=0,v=0,ex=0;for(const e of s.exos||[]){let c=0;for(const x of e.series||[])if(isDone(x)){c++;v+=(x.kg||0)*x.reps}n+=c;if(c)ex++}return{ex,n,v}};
const realSessions=()=>index().list.filter(s=>sumS(s).n>0);
const tag=n=>(String(n||'Séance').trim().split(/\s+/)[0]||'Séance').slice(0,6).toUpperCase();
function lastRecord(){
  let best=null;
  for(const o of Object.values(index().ex)){ let bKg=0,bE1=0,bReps=0,seen=false;
    for(const s of o.sessions){ let sk=bKg,se=bE1,sr=bReps;
      for(const x of s.sets){ const kg=x.kg||0,e1=kg>0?e1rm(kg,x.reps):0;
        if(seen&&(kg>0?(kg>sk||e1>se+1e-6):(bKg===0&&x.reps>sr))&&(!best||s.date>=best.date))best={date:s.date,nom:o.nom,set:x};
        sk=Math.max(sk,kg);se=Math.max(se,e1);sr=Math.max(sr,x.reps) }
      bKg=sk;bE1=se;bReps=sr;seen=true }
  }
  return best;
}

/* ---------- Séance en cours ---------- */
let cur=null, touched=false;
const newId=d=>d+'-'+Math.random().toString(36).slice(2,8);
function blank(){const d=today();return{id:newId(d),date:d,nom:'',exos:[],note:''}}
function pickCurrent(){
  const l=index().list; let s=null; for(const x of l)if(x.ouverte===true)s=x;
  cur=s?clone(s):blank(); cur.exos=cur.exos||[];
}
function saveCur(){
  touched=true;
  const empty=!cur.exos.length&&!(cur.note||'').trim();
  if(empty){ if(R.seances[cur.id]){delete R.seances[cur.id];persist('seances/'+cur.id,null)} return }
  const s=clone(cur); s.ts=Date.now(); R.seances[s.id]=s; persist('seances/'+s.id,s);
}
function priorSessions(k){const o=index().ex[k];return o?o.sessions.filter(x=>x.id!==cur.id&&x.date<=cur.date):[]}
function lastTime(k,exceptId){
  const o=index().ex[k]; if(!o)return null;
  const a=o.sessions.filter(x=>x.id!==exceptId); return a[a.length-1]||null;
}
/* Supersets : un exercice avec ss:true est lié à celui qui le précède. */
const LINK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
const blocks=a=>{const b=[];(a||[]).forEach((e,i)=>{if(i&&e&&e.ss&&b.length)b[b.length-1].push(i);else b.push([i])});return b};
function keepExos(a,keep){ // retire des exercices sans casser les supersets restants
  const out=[]; let kept=false;
  (a||[]).forEach((e,i)=>{ if(!e.ss)kept=false; if(!keep(e,i))return; if(e.ss&&!kept)delete e.ss; kept=true; out.push(e) });
  if(out[0])delete out[0].ss; return out;
}
function progTarget(nom){ for(const p of R.prog.seances||[])for(const e of p.exos||[])if(key(e.nom)===key(nom))return e; return null }
function prevSet(i,j){const e=cur.exos[i]; const l=e&&lastTime(key(e.nom),cur.id); return l&&l.sets[j]||null}
function cmpPrev(p,kg,reps){
  if(!p||!(reps>0)||!isFinite(kg))return null;
  const pk=p.kg||0, d=reps-p.reps; let s;
  if(kg===pk)s=Math.sign(d); else if(kg>0&&pk>0){const a=e1rm(kg,reps),b=e1rm(pk,p.reps); s=Math.abs(a-b)<1e-6?0:a>b?1:-1} else s=kg>pk?1:-1;
  return {txt:d===0?'=':(d>0?'+':'−')+Math.abs(d),cls:s>0?'up':s<0?'down':''};
}
const dlHtml=c=>c?`<b class="dl ${c.cls}" aria-hidden="true">${c.txt}</b>`:'<b class="dl" hidden aria-hidden="true"></b>';
const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function exoBody(e,i){
  const k=key(e.nom), last=lastTime(k,cur.id), prior=priorSessions(k), pt=progTarget(e.nom);
  let bKg=0,bE1=0,bReps=0,has=prior.length>0,anyPr=false;
  for(const p of prior){bKg=Math.max(bKg,p.maxKg);bE1=Math.max(bE1,p.e1);bReps=Math.max(bReps,p.maxReps)}
  let nowR=0,prevR=0,cmpN=0;
  const rows=e.series.map((x,j)=>{
    const kg=x.kg||0, d=isDone(x), e1=d&&kg>0?e1rm(kg,x.reps):0, ps=last&&last.sets[j]||null, cp=cmpPrev(ps,kg,x.reps);
    if(d&&ps){nowR+=x.reps;prevR+=ps.reps;cmpN++}
    const pr=d&&has&&(kg>0?(kg>bKg||e1>bE1+1e-6):(bKg===0&&x.reps>bReps));
    if(d){bKg=Math.max(bKg,kg);bE1=Math.max(bE1,e1);bReps=Math.max(bReps,x.reps)} if(pr)anyPr=true;
    return `<div class="set${d?' done':''}${pr?' pr':''}"><span class="n">${pr?'★':j+1}</span>
      <input type="text" inputmode="decimal" id="kg-${i}-${j}" data-f="kg" data-i="${i}" data-j="${j}" value="${kg>0?esc(String(kg).replace('.',',')):''}" placeholder="PDC" aria-label="Charge en kg, série ${j+1}" autocomplete="off">
      <span class="t" aria-hidden="true">×</span>
      <span class="rp"><input type="text" inputmode="numeric" id="rp-${i}-${j}" data-f="reps" data-i="${i}" data-j="${j}" value="${x.reps>0?x.reps:''}" placeholder="${ps?ps.reps:(x.cible||'')}" aria-label="Répétitions, série ${j+1}${ps?', '+ps.reps+' la dernière fois':''}" autocomplete="off">${dlHtml(cp)}</span>
      <button class="chk" data-act="chk" data-i="${i}" data-j="${j}" aria-pressed="${d}" aria-label="${d?'Décocher':'Valider'} la série ${j+1}">${CHECK}</button>
      <button class="x" data-act="del-set" data-i="${i}" data-j="${j}" aria-label="Supprimer la série ${j+1}">×</button></div>`;
  }).join('');
  return `
    <div class="exo-top"><span class="badge">${pad(i+1)}</span><div class="tx"><h3>${esc(e.nom)}</h3><span>${esc(groupe(e.nom))}${pt?` · cible ${pt.series} × ${pt.reps}`:''}</span></div><button class="btn sm" data-act="del-exo" data-i="${i}">Retirer</button></div>
    ${last?`<div class="last">Dernière fois (${esc(dShort.format(toDate(last.date)))}) : <span class="num">${esc(kgTxt(last.sets[0].kg||0))} × ${last.sets.map(x=>x.reps).join(' / ')}</span></div>`:''}
    ${rows?`<div class="sethead"><span>N°</span><span>Charge</span><span></span><span>Reps</span><span>Fait</span><span></span></div><div class="sets">${rows}</div>`:''}
    <div class="row" style="align-items:center;justify-content:space-between"><button class="btn sm" data-act="add-set" data-i="${i}">+ Série</button><span class="chips">${cmpN?(nowR>prevR?`<span class="pill">+${nowR-prevR} rép. vs dernière fois</span>`:nowR<prevR?`<span class="pill red">−${prevR-nowR} rép. vs dernière fois</span>`:'<span class="pill grey">= dernière fois</span>'):''}${anyPr?'<span class="pill">★ Record battu</span>':''}</span></div>`;
}
const ssHead=n=>`<div class="ss-h"><span class="pill">${LINK}${n>2?'Tri-set':'Superset'}</span><span class="small muted">Enchaîne sans repos, puis repos</span></div>`;
function exoCards(){
  return blocks(cur.exos).map(b=>b.length>1
    ?`<article class="card ss">${ssHead(b.length)}${b.map(i=>exoBody(cur.exos[i],i)).join('<hr class="ss-sep">')}</article>`
    :`<article class="card">${exoBody(cur.exos[b[0]],b[0])}</article>`).join('');
}
function renderEditor(){
  const el=$('#tab-seance'), st=sumS(cur), isToday=cur.date===today(), stored=!!R.seances[cur.id];
  const progs=(R.prog.seances||[]);
  el.innerHTML=`<div class="card">
      <div><div class="eyebrow">${isToday?'Séance du jour':'Séance du '+esc(dShort.format(toDate(cur.date)))}</div><h2 style="font-size:26px;margin-top:4px">${esc(cur.nom||'Nouvelle séance')}</h2>
      ${cur.ouverte&&cur.debut?`<div class="sess" style="margin-top:12px"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg><span>Durée de la séance</span><b id="sess-time">${hms((Date.now()-cur.debut)/1000)}</b></div>`:cur.duree?`<p class="sub">Durée : ${durTxt(cur.duree)}</p>`:''}
      <p class="sub">${cur.exos.length?`${st.n} série${st.n>1?'s':''} validée${st.n>1?'s':''} · ${nf0.format(st.v)} kg soulevés`:'Lance une séance du programme ou ajoute un exercice, puis coche chaque série faite.'}</p></div>
      ${!cur.exos.length&&progs.length?`<div class="chips">${progs.map((p,i)=>`<button class="btn sm lime" data-act="lancer" data-p="${i}">${esc(p.nom)} →</button>`).join('')}</div>`:''}
      <div class="row"><label class="fld"><span>Date</span><input type="date" id="f-date" value="${esc(cur.date)}" max="2100-01-01"></label>
      <label class="fld grow"><span>Nom de la séance</span><input type="text" id="f-nom" value="${esc(cur.nom||'')}" placeholder="Ex. Push" maxlength="60" autocomplete="off"></label></div>
      <div class="row"><button class="btn" data-act="focus-exo">+ Exercice</button><button class="btn lime" data-act="terminer"${stored||cur.exos.length?'':' disabled'}>Terminer la séance</button></div>
    </div>
    ${exoCards()}
    <form class="card" data-form="exo"><label class="fld"><span>${cur.exos.length?'Ajouter un exercice':'Premier exercice'}</span><input type="text" id="f-exo" list="exos-list" placeholder="Ex. Développé couché" maxlength="60" autocomplete="off"></label><button class="btn" type="submit">Ajouter l'exercice</button></form>
    <div class="card"><div><h2>Notes de séance</h2><p class="sub">Ressenti, technique, énergie, points à surveiller</p></div><textarea id="f-note" rows="3" maxlength="1000" placeholder="Ex. : bonne énergie, garder 2 min de repos, amplitude à surveiller…">${esc(cur.note||'')}</textarea></div>
    <p class="small muted" style="margin:0">Astuce : les chiffres en gris sont tes répétitions de la dernière fois. Si tu as fait pareil, coche sans rien saisir ; sinon tape ton nombre : la pastille verte (+) ou rouge (−) te montre en direct si tu fais mieux ou moins bien.</p>`;
  renderDatalist();
}
function renderDatalist(){
  const seen=new Set(), out=[];
  Object.values(index().ex).sort((a,b)=>b.sessions.length-a.sessions.length).forEach(o=>{seen.add(key(o.nom));out.push(o.nom)});
  DEFAULT_EXOS.forEach(n=>{if(!seen.has(key(n)))out.push(n)});
  $('#exos-list').innerHTML=out.map(n=>`<option value="${esc(n)}">`).join('');
}
function newRows(nom,n,cible,kg){
  const last=lastTime(key(nom),cur.id); const c=n||(last?last.sets.length:4);
  return Array.from({length:c},(_,j)=>{const p=last&&(last.sets[j]||last.sets[last.sets.length-1]); const r={kg:p?(p.kg||0):(kg||0),reps:null,done:false}; if(cible)r.cible=cible; return r});
}
function lancer(p){
  if(cur.ouverte&&sumS(cur).n>0){ toast("Termine d'abord la séance en cours."); showTab('seance'); return }
  if(cur.ouverte&&R.seances[cur.id]){ delete R.seances[cur.id]; persist('seances/'+cur.id,null) }
  cur=blank(); cur.nom=p.nom; cur.ouverte=true; cur.debut=Date.now();
  cur.exos=(p.exos||[]).map((e,j)=>{const o={nom:e.nom,series:newRows(e.nom,e.series,e.reps,e.kg)}; if(j&&e.ss)o.ss=true; return o});
  saveCur(); showTab('seance');
}

/* ---------- Graphique ---------- */
function niceTicks(lo,hi,n){
  if(lo===hi){const p=Math.max(1,Math.abs(lo)*.05);lo-=p;hi+=p}
  const raw=(hi-lo)/n, mag=Math.pow(10,Math.floor(Math.log10(raw))), r=raw/mag;
  const step=(r<=1?1:r<=2?2:r<=2.5?2.5:r<=5?5:10)*mag;
  const a=Math.floor(lo/step+1e-9)*step, out=[];
  for(let v=a;v<hi+step-1e-9;v+=step)out.push(+v.toFixed(6));
  return out;
}
function drawChart(host,pts,unit){
  host.innerHTML=''; if(!pts.length)return;
  const W=Math.max(250,host.clientWidth||600), H=220, m={t:30,r:50,b:26,l:40};
  const ts=pts.map(p=>toDate(p.d).getTime()), vs=pts.map(p=>p.v);
  let x0=ts[0], x1=ts[ts.length-1]; if(x0===x1){x0-=3*864e5;x1+=3*864e5}
  const ticks=niceTicks(Math.min(...vs),Math.max(...vs),4), lo=ticks[0], hi=ticks[ticks.length-1];
  const X=t=>m.l+(t-x0)/(x1-x0)*(W-m.l-m.r), Y=v=>m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b);
  const P=pts.map((p,i)=>[X(ts[i]),Y(p.v)]);
  let s=`<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Courbe d'évolution, ${pts.length} points, de ${fmt(vs[0])} à ${fmt(vs[vs.length-1])} ${unit}">`;
  ticks.forEach(t=>{s+=`<line class="ch-grid" x1="${m.l}" x2="${W-m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ch-txt" x="${m.l-6}" y="${Y(t)+4}" text-anchor="end">${fmt(t)}</text>`});
  const nx=W<420?3:4, span=x1-x0, yf=span>330*864e5?dYear:dShort;
  for(let i=0;i<nx;i++){const t=x0+span*i/(nx-1);s+=`<text class="ch-txt" x="${X(t)}" y="${H-7}" text-anchor="${i===0?'start':i===nx-1?'end':'middle'}">${esc(yf.format(new Date(t)))}</text>`}
  if(P.length>1){
    const path=P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
    s+=`<path class="ch-area" d="${path}L${P[P.length-1][0].toFixed(1)} ${Y(lo)}L${P[0][0].toFixed(1)} ${Y(lo)}Z"/><path class="ch-line" d="${path}"/>`;
  }
  if(P.length<=45)P.forEach((p,i)=>{if(i<P.length-1)s+=`<circle class="ch-dot" cx="${p[0]}" cy="${p[1]}" r="4"/>`});
  const L=P[P.length-1];
  s+=`<line class="ch-cross" y1="${m.t}" y2="${H-m.b}" x1="0" x2="0" visibility="hidden"/><circle class="ch-dot" cx="${L[0]}" cy="${L[1]}" r="5.5"/><text class="ch-end" x="${L[0]+9}" y="${L[1]+5}">${fmt(vs[vs.length-1])}</text></svg><div class="tip" hidden></div>`;
  host.innerHTML=s;
  const svg=$('svg',host), tip=$('.tip',host), cx=$('.ch-cross',host);
  const show=e=>{
    const r=svg.getBoundingClientRect(), px=(e.clientX-r.left)*W/r.width; let b=0,bd=1e9;
    P.forEach((p,i)=>{const d=Math.abs(p[0]-px);if(d<bd){bd=d;b=i}});
    cx.setAttribute('x1',P[b][0]);cx.setAttribute('x2',P[b][0]);cx.setAttribute('visibility','visible');
    tip.innerHTML=`${esc(dYear.format(toDate(pts[b].d)))} · <b>${fmt(pts[b].v)} ${esc(unit)}</b>`; tip.hidden=false;
    const sc=r.width/W, half=tip.offsetWidth/2; tip.style.left=Math.min(Math.max(P[b][0]*sc,half),r.width-half)+'px';
  };
  svg.addEventListener('pointermove',show); svg.addEventListener('pointerdown',show);
  svg.addEventListener('pointerleave',()=>{tip.hidden=true;cx.setAttribute('visibility','hidden')});
}
function deltaLine(pts,unit){
  if(pts.length<2)return '<div class="delta"><span>Encore une séance et la courbe se dessine.</span></div>';
  const a=pts[0].v,b=pts[pts.length-1].v,d=b-a,best=Math.max(...pts.map(p=>p.v));
  return `<div class="delta"><span>Départ <b>${fmt(a)} ${unit}</b></span><span>Dernière <b>${fmt(b)} ${unit}</b></span><span>Évolution <b class="${d>0?'up':d<0?'down':''}">${d>0?'+':''}${fmt(Math.round(d*100)/100)} ${unit}${a?` (${d>0?'+':''}${nf0.format(d/a*100)} %)`:''}</b></span><span>Meilleure <b>${fmt(best)} ${unit}</b></span></div>`;
}
function tableOf(pts,unit,label){
  return `<details class="t"><summary>Voir le tableau</summary><div class="tw"><table><thead><tr><th>Date</th><th>${esc(label)}</th></tr></thead><tbody>${pts.slice().reverse().map(p=>`<tr><td>${esc(dYear.format(toDate(p.d)))}</td><td>${fmt(p.v)} ${esc(unit)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
const loadingOr=txt=>S.mode==='db'&&!S.loaded?'<div class="empty">Chargement…</div>':`<div class="empty"><span>${txt}</span></div>`;

/* ---------- Vue d'ensemble ---------- */
function seanceItem(s){const t=sumS(s);return `<div class="item"><span class="badge">${esc(tag(s.nom))}</span><div class="tx"><b>${esc(s.nom||'Séance')} · ${esc(dShort.format(toDate(s.date)))}</b><span>${t.ex} exercice${t.ex>1?'s':''} · ${t.n} série${t.n>1?'s':''} validée${t.n>1?'s':''}${s.duree?' · '+durTxt(s.duree):''}</span></div><span class="muted small num" style="white-space:nowrap">${nf0.format(t.v)} kg</span></div>`}
function renderAccueil(){
  const el=$('#tab-accueil'), l=realSessions(), now=new Date(), m0=monday(now), obj=R.reg.objectif||3;
  const byDay={}; l.forEach(s=>byDay[s.date]=(byDay[s.date]||0)+1);
  const wk=w=>{let n=0;for(let i=0;i<7;i++)n+=byDay[iso(addDays(w,i))]||0;return n};
  const cw=wk(m0), w0=iso(m0); let streak=cw>=obj?1:0; for(let w=addDays(m0,-7),g=0;g<520&&wk(w)>=obj;w=addDays(w,-7),g++)streak++;
  const volW=l.filter(s=>s.date>=w0).reduce((a,s)=>a+sumS(s).v,0), rec=lastRecord();
  const progs=R.prog.seances||[];
  let h=`<div class="tiles">
    <div class="tile"><div class="l"><span>Séances enregistrées</span><span class="pill grey">Total</span></div><div class="n">${l.length}</div><div class="d">${l.length?'Depuis le '+esc(dYear.format(toDate(l[0].date))):'Aucune pour l\'instant'}</div></div>
    <div class="tile"><div class="l"><span>Cette semaine</span></div><div class="n">${cw}<small> / ${obj} séances</small></div><div class="d">${streak>0?streak+' semaine'+(streak>1?'s':'')+" d'affilée à l'objectif":'Objectif pas encore atteint'}</div></div>
    <div class="tile"><div class="l"><span>Volume cette semaine</span></div><div class="n">${nf0.format(volW)}<small> kg</small></div><div class="d">Charge × répétitions</div></div>
    <div class="tile"><div class="l"><span>Dernier record</span><span style="color:var(--lime)" aria-hidden="true">★</span></div><div class="n">${rec?esc(rec.set.kg>0?fmt(rec.set.kg)+'×'+rec.set.reps:rec.set.reps+' reps'):'·'}</div><div class="d">${rec?esc(rec.nom)+' · '+esc(dShort.format(toDate(rec.date))):'Il apparaîtra ici'}</div></div></div>`;
  if(!l.length){ el.innerHTML=h+loadingOr("Tes statistiques apparaîtront ici dès ta première séance. Ouvre l'onglet « + » pour commencer."); return }
  const lastN=l.slice(-12), mx=Math.max(...lastN.map(s=>sumS(s).v))||1;
  h+=`<div class="card"><div class="head"><div><h2>Volume d'entraînement</h2><p class="sub">${lastN.length} dernières séances · tonnes soulevées</p></div><span class="pill">Par séance</span></div>
    <div><div class="bars">${lastN.map(s=>{const v=sumS(s).v;return `<div class="b" title="${esc(s.nom||'Séance')} du ${esc(dShort.format(toDate(s.date)))} : ${nf0.format(v)} kg"><span>${v>=9950?nf0.format(v/1000):nf1.format(v/1000)}</span><i style="height:${Math.max(2,v/mx*78)}%"></i></div>`}).join('')}</div>
    <div class="barlabs" style="margin-top:5px">${lastN.map((s,i)=>`<span>${lastN.length>8&&i%2?'':toDate(s.date).getDate()+'/'+(toDate(s.date).getMonth()+1)}</span>`).join('')}</div></div></div>`;
  if(progs.length)h+=`<div class="card"><div><h2>Raccourcis</h2><p class="sub">Reprends là où tu en es</p></div>
    ${progs.map((p,i)=>{const prev=l.filter(s=>key(s.nom)===key(p.nom)).pop();return `<div class="item"><span class="badge">${esc(tag(p.nom))}</span><div class="tx"><b>${esc(p.nom)}</b><span>${(p.exos||[]).length} exercices${prev?' · dernière le '+esc(dShort.format(toDate(prev.date))):''}</span></div><button class="btn sm" data-act="lancer" data-p="${i}">Démarrer</button></div>`}).join('')}</div>`;
  h+=`<div class="head"><div><h2>Dernières séances</h2><p class="sub">Ton historique récent</p></div><button class="btn sm" data-act="tab" data-t="historique">Tout voir →</button></div>
    <div class="list">${l.slice(-3).reverse().map(seanceItem).join('')}</div>`;
  const first=addDays(m0,-7*15), tISO=iso(now); let cells='', prevM=-1;
  for(let w=0;w<16;w++){
    const ws=addDays(first,w*7); if((ws.getMonth()!==prevM&&w<15)||w===0)cells+=`<span class="mo" style="grid-column:${w+2};grid-row:1">${esc(dMon.format(ws))}</span>`;
    prevM=ws.getMonth();
    for(let d=0;d<7;d++){const day=addDays(ws,d),k=iso(day),fut=k>tISO;
      cells+=`<span class="c${byDay[k]?' on':''}${fut?' fut':''}${k===tISO?' today':''}" style="grid-column:${w+2};grid-row:${d+2}" title="${esc(dLong.format(day))}${byDay[k]?' : séance':''}"></span>`}
  }
  ['L','M','M','J','V','S','D'].forEach((c,i)=>cells+=`<span class="lab" style="grid-column:1;grid-row:${i+2}">${c}</span>`);
  h+=`<div class="card"><div class="head"><div><h2>Régularité</h2><p class="sub">Jours d'entraînement · 16 dernières semaines</p></div>
    <span class="step"><button data-act="obj" data-d="-1" aria-label="Baisser l'objectif hebdomadaire">−</button><b class="num">${obj} / sem.</b><button data-act="obj" data-d="1" aria-label="Augmenter l'objectif hebdomadaire">+</button></span></div>
    <div class="heat" role="img" aria-label="Calendrier des jours d'entraînement">${cells}</div></div>`;
  const g={}; lastN.forEach(s=>(s.exos||[]).forEach(e=>{const c=(e.series||[]).filter(isDone).length; if(c)g[groupe(e.nom)]=(g[groupe(e.nom)]||0)+c}));
  const ge=Object.entries(g).sort((a,b)=>b[1]-a[1]), gm=ge.length?ge[0][1]:1;
  h+=`<div class="card"><div><h2>Répartition du volume</h2><p class="sub">Séries par groupe musculaire · ${lastN.length} dernières séances</p></div>
    <div class="split">${ge.map(([n,c])=>`<span>${esc(n)}</span><span class="tr"><i style="width:${c/gm*100}%"></i></span><b>${c}</b>`).join('')}</div></div>`;
  el.innerHTML=h;
}

/* ---------- Historique, progression, records ---------- */
const METRICS={max:['Charge (kg)','kg',s=>s.maxKg],reps:['Répétitions (meilleure série)','reps',s=>s.maxReps],vol:['Volume (kg)','kg',s=>s.vol],e1:['1RM estimé (kg)','kg',s=>Math.round(s.e1*10)/10]};
function renderHistorique(){
  const el=$('#tab-historique'), all=realSessions().slice().reverse(), ex=index().ex;
  if(!all.length){ el.innerHTML=loadingOr("Tes séances terminées, tes courbes et tes records s'afficheront ici."); return }
  const noms=[...new Set(all.map(s=>s.nom||'Séance'))];
  if(S.filtre&&!noms.includes(S.filtre))S.filtre='';
  const l=S.filtre?all.filter(s=>(s.nom||'Séance')===S.filtre):all;
  let h=`<div class="head"><div><h2>Historique des séances</h2><p class="sub">${l.length} séance${l.length>1?'s':''}. Touche une séance pour voir le détail.</p></div></div>
    <div class="row"><label class="fld grow"><span>Afficher</span><select id="sel-filtre"><option value="">Toutes les séances</option>${noms.map(n=>`<option value="${esc(n)}"${n===S.filtre?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
    ${dl?'<button class="btn" data-act="csv">Exporter CSV</button>':''}</div>
    <div class="list">${l.slice(0,S.histN).map(s=>{const t=sumS(s);return `<details class="s"><summary><span class="badge">${esc(tag(s.nom))}</span><div class="tx"><b>${esc(s.nom||'Séance')} · ${esc(dYear.format(toDate(s.date)))}${s.ouverte?' · en cours':''}</b><span>${t.ex} exercice${t.ex>1?'s':''} · ${t.n} série${t.n>1?'s':''}${s.duree?' · '+durTxt(s.duree):''}</span></div><span class="vol">${nf0.format(t.v)} kg</span></summary>
      <div class="in"><div class="lines">${(s.exos||[]).map(e=>{const d=(e.series||[]).filter(isDone); if(!d.length)return '';const same=d.every(x=>(x.kg||0)===(d[0].kg||0));return `<div><b style="font-weight:600">${esc(e.nom)}</b><span>${same?esc(kgTxt(d[0].kg||0))+' × '+d.map(x=>x.reps).join(' / '):d.map(x=>esc(setTxt(x))).join(' · ')}</span></div>`}).join('')}</div>
      ${s.note?`<div class="small muted">${esc(s.note)}</div>`:''}
      <div class="row"><button class="btn sm" data-act="open" data-id="${esc(s.id)}">Modifier</button><button class="btn sm" data-act="as-prog" data-id="${esc(s.id)}">En faire un modèle du programme</button><button class="btn sm red" data-act="del-seance" data-id="${esc(s.id)}">Supprimer</button></div></div></details>`}).join('')}</div>
    ${l.length>S.histN?'<div><button class="link" data-act="more">Afficher les séances plus anciennes</button></div>':''}`;
  const keys=Object.keys(ex).sort((a,b)=>ex[a].nom.localeCompare(ex[b].nom,'fr'));
  if(!keys.length){ el.innerHTML=h; return }
  if(!S.exo||!ex[S.exo])S.exo=keys.slice().sort((a,b)=>ex[b].sessions.length-ex[a].sessions.length)[0];
  const o=ex[S.exo], pdc=o.sessions.every(s=>s.maxKg===0); let mk=S.metric; if(pdc)mk='reps';
  const [lab,unit,fn]=METRICS[mk], pts=o.sessions.map(s=>({d:s.date,v:fn(s)}));
  h+=`<div class="card"><div><h2>Progression par exercice</h2><p class="sub">Compare tes charges, répétitions et volume au fil du temps.</p></div>
    <select id="sel-exo" aria-label="Exercice">${keys.map(k=>`<option value="${esc(k)}"${k===S.exo?' selected':''}>${esc(ex[k].nom)}</option>`).join('')}</select>
    <select id="sel-metric" aria-label="Mesure">${Object.keys(METRICS).map(k=>`<option value="${k}"${k===mk?' selected':''}${pdc&&k!=='reps'?' disabled':''}>${METRICS[k][0]}</option>`).join('')}</select>
    <div class="chart" id="ch-exo"></div>${deltaLine(pts,unit)}${tableOf(pts,unit,lab)}</div>`;
  const lim=iso(addDays(new Date(),-14));
  const cards=keys.map(k=>{
    const o=ex[k]; let bk=null,bv=null,br=null;
    for(const s of o.sessions){
      if(!bk||s.maxKg>bk.maxKg||(s.maxKg===bk.maxKg&&s.maxKgReps>bk.maxKgReps))bk=s;
      if(!bv||s.vol>bv.vol)bv=s; if(!br||s.maxReps>br.maxReps)br=s;
    }
    const lastD=o.sessions[o.sessions.length-1].date, recent=o.sessions.length>1&&[bk,br].some(x=>x.date>=lim);
    const w=s=>`<span class="when">${esc(dYear.format(toDate(s.date)))}</span>`, items=[];
    if(bk.maxKg>0){
      items.push(`<div><dt>Charge max</dt><dd>${fmt(bk.maxKg)} <small>kg × ${bk.maxKgReps}</small></dd>${w(bk)}</div>`);
      items.push(`<div><dt>Volume en une séance</dt><dd>${nf0.format(bv.vol)} <small>kg</small></dd>${w(bv)}</div>`);
    }
    items.push(`<div><dt>Reps max</dt><dd>${br.maxReps} <small>${br.maxRepsKg>0?'à '+fmt(br.maxRepsKg)+' kg':'au poids du corps'}</small></dd>${w(br)}</div>`);
    return {lastD,html:`<article class="card"><div class="head"><h3>${esc(o.nom)}</h3>${recent?'<span class="pill">★ Battu récemment</span>':`<span class="small muted">${o.sessions.length} séance${o.sessions.length>1?'s':''}</span>`}</div><dl class="rec">${items.join('')}</dl></article>`};
  }).sort((a,b)=>a.lastD<b.lastD?1:-1);
  h+=`<div class="head"><div><h2>Records personnels</h2><p class="sub">Tes meilleures performances par exercice</p></div></div>`+cards.map(c=>c.html).join('');
  el.innerHTML=h; drawChart($('#ch-exo'),pts,unit);
}

/* ---------- Programme ---------- */
const UP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>', DOWN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const mvBtns=(j,bi,nb,nom)=>`<button class="pe-mv" data-act="pe-mv" data-j="${j}" data-d="-1" aria-label="Monter ${esc(nom)}"${bi?'':' disabled'}>${UP}</button>
        <button class="pe-mv" data-act="pe-mv" data-j="${j}" data-d="1" aria-label="Descendre ${esc(nom)}"${bi<nb-1?'':' disabled'}>${DOWN}</button>`;
function peBlocks(ex,one){
  const bl=blocks(ex);
  return bl.map((b,bi)=>{
    const body=b.length>1
      ?`<div class="ssg"><div class="ss-h"><span class="pill">${LINK}${b.length>2?'Tri-set':'Superset'}</span><span class="sp"></span>${mvBtns(b[0],bi,bl.length,'le superset')}<button class="btn sm" data-act="pe-unss" data-j="${b[0]}">Délier</button></div>${b.map(j=>one(ex[j],j,false,bi,bl.length)).join('')}</div>`
      :one(ex[b[0]],b[0],true,bi,bl.length);
    const nx=bl[bi+1]; return body+(nx?`<button class="sslink" data-act="pe-ss" data-j="${nx[0]}" aria-label="Lier ${esc(ex[b[b.length-1]].nom)} et ${esc(ex[nx[0]].nom)} en superset">${LINK}Superset avec le suivant</button>`:'');
  }).join('');
}
function progEditCard(p,i){
  const ex=p.exos||[];
  return `<div class="card"><div class="head"><div><div class="eyebrow">Modification</div><h2 style="margin-top:4px">${esc(p.nom)}</h2></div><button class="btn lime" data-act="pe-done">Terminé</button></div>
    <label class="fld"><span>Nom de la séance</span><input type="text" id="pe-nom" value="${esc(p.nom)}" maxlength="60" autocomplete="off"></label>
    ${ex.length?peBlocks(ex,(e,j,solo,bi,nb)=>`<div class="pe"><div class="pe-top"><span class="badge" style="min-width:36px;height:36px;font-size:12px;border-radius:10px">${pad(j+1)}</span><b>${esc(e.nom)}</b>
        ${solo?mvBtns(j,bi,nb,e.nom):''}
        <button class="x" data-act="pe-del" data-j="${j}" aria-label="Retirer ${esc(e.nom)}">×</button></div>
      <div class="pe-f"><span class="step"><span class="lbl">Séries</span><button data-act="pe-ser" data-j="${j}" data-d="-1" aria-label="Une série de moins">−</button><b class="num">${e.series}</b><button data-act="pe-ser" data-j="${j}" data-d="1" aria-label="Une série de plus">+</button></span>
        <label class="step"><span class="lbl">Reps visées</span><input type="text" inputmode="numeric" data-pe-reps="${j}" value="${e.reps||''}" maxlength="3" aria-label="Répétitions visées, ${esc(e.nom)}"></label></div></div>`):'<div class="empty"><span>Aucun exercice pour l\'instant. Ajoute le premier ci-dessous.</span></div>'}
    <form class="row" data-form="pe-add"><label class="fld grow"><span>Ajouter un exercice</span><input type="text" id="pe-exo" list="exos-list" placeholder="Ex. Tirage vertical" maxlength="60" autocomplete="off"></label><button class="btn" type="submit">Ajouter</button></form>
    <div><button class="btn sm red" data-act="del-prog" data-p="${i}">Retirer du programme</button></div></div>`;
}
function renderProgramme(){
  const el=$('#tab-programme'), progs=R.prog.seances||[];
  if(S.pe!=null&&!progs[S.pe])S.pe=null;
  let h=`<div class="head"><div><h2>Ton programme</h2><p class="sub">Tes séances types, modifiables à tout moment.</p></div><button class="btn sm" data-act="pe-new">+ Nouvelle séance</button></div>`;
  if(!progs.length){ el.innerHTML=h+loadingOr("Ton programme est vide. Crée une séance avec « + Nouvelle séance », ou dans l'historique ouvre une séance et choisis « En faire un modèle du programme »."); return }
  h+=progs.map((p,i)=>S.pe===i?progEditCard(p,i):`<div class="card"><div class="head"><div><h2>${esc(p.nom)}</h2><p class="sub">${(p.exos||[]).length} exercice${(p.exos||[]).length>1?'s':''} · base du programme</p></div><span class="row"><button class="btn" data-act="pe-edit" data-p="${i}">Modifier</button><button class="btn lime" data-act="lancer" data-p="${i}"${(p.exos||[]).length?'':' disabled'}>Lancer →</button></span></div>
    ${blocks(p.exos).map(b=>{const it=j=>{const e=p.exos[j],last=lastTime(key(e.nom));const kg=last?(last.sets[0].kg||0):(e.kg||0);return `<div class="item"><span class="badge">${pad(j+1)}</span><div class="tx"><b>${esc(e.nom)}</b><span>${esc(groupe(e.nom))} · ${e.series} série${e.series>1?'s':''} × ${e.reps} reps</span></div><span class="kg">${esc(kgTxt(kg))}</span></div>`};
      return b.length>1?`<div class="ssg"><div class="ss-h"><span class="pill">${LINK}${b.length>2?'Tri-set':'Superset'}</span></div>${b.map(it).join('')}</div>`:it(b[0])}).join('')}</div>`).join('');
  el.innerHTML=h+`<p class="small muted" style="margin:0">Touche « Modifier » pour changer le nombre de séries, les reps visées, l'ordre ou les exercices d'une séance, sans la lancer. En modification, « Superset avec le suivant » réunit deux exercices dans un seul cadre. La charge affichée est celle de ta dernière séance.</p>`;
  if(S.pe!=null)renderDatalist();
}

/* ---------- Corps ---------- */
function renderCorps(){
  const el=$('#tab-corps'), list=Object.values(R.mesures).filter(x=>x&&x.date).sort((a,b)=>a.date<b.date?-1:1);
  const [mk,ml,mu]=MES.find(x=>x[0]===S.mes)||MES[0];
  const pts=list.filter(x=>typeof x[mk]==='number').map(x=>({d:x.date,v:x[mk]}));
  let h=`<form class="card" data-form="mes" novalidate><div><h2>Nouvelle mesure</h2><p class="sub">Remplis seulement ce que tu as mesuré.</p></div>
      <div class="mform"><label class="fld"><span>Date</span><input type="date" id="m-date" value="${today()}"></label>
      ${MES.map(([k,l,u])=>`<label class="fld"><span>${l}${u?' ('+u+')':''}</span><input type="text" inputmode="decimal" id="m-${k}" autocomplete="off"></label>`).join('')}</div>
      <button class="btn lime" type="submit">Enregistrer la mesure</button></form>`;
  if(!list.length){ el.innerHTML=h+loadingOr("Ton poids et tes mensurations seront suivis ici. Une mesure par mois suffit pour voir une tendance."); return }
  h+=`<div class="card"><div><h2>Évolution</h2><p class="sub">${ml}${mu?', en '+mu:''}</p></div>
    <div class="seg" role="group" aria-label="Mesure affichée">${MES.map(([k,l])=>`<button data-act="mes" data-m="${k}" aria-pressed="${k===mk}">${l}</button>`).join('')}</div>
    ${pts.length?`<div class="chart" id="ch-mes"></div>${deltaLine(pts,mu)}`:`<div class="small muted">Aucune mesure de ce type pour l'instant.</div>`}</div>
    <div class="card"><div class="head"><h2>Relevés</h2>${dl?'<button class="btn sm" data-act="csv-mes">Exporter CSV</button>':''}</div><div class="tw"><table><thead><tr><th>Date</th>${MES.map(m=>`<th>${m[1]}</th>`).join('')}<th></th></tr></thead><tbody>
    ${list.slice().reverse().map(x=>`<tr><td>${esc(dYear.format(toDate(x.date)))}</td>${MES.map(([k,,u])=>`<td>${typeof x[k]==='number'?fmt(x[k])+(u?' '+u:''):'<span class="muted">·</span>'}</td>`).join('')}<td><button class="btn sm red" data-act="del-mes" data-id="${esc(x.date)}">Supprimer</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  el.innerHTML=h; if(pts.length)drawChart($('#ch-mes'),pts,mu);
}

/* ---------- Paramètres ---------- */
function renderReglages(){
  const n=realSessions().length;
  $('#tab-reglages').innerHTML=`<div class="card"><div><h2>Entraînement</h2><p class="sub">Chrono de repos et objectif</p></div>
      <label class="fld"><span>Repos entre les séries (secondes)</span><input type="text" inputmode="numeric" id="r-repos" value="${R.reg.repos||90}" maxlength="4"></label>
      <label class="chkl"><input type="checkbox" id="r-auto"${R.reg.auto?' checked':''}> Lancer le repos à chaque série cochée</label>
      <div class="fld"><span>Sonnerie de fin de repos (touche pour écouter)</span><div class="seg">${sonsSeg()}</div></div>
      <div class="row" style="align-items:center;justify-content:space-between"><span>Objectif de séances par semaine</span><span class="step"><button data-act="obj" data-d="-1" aria-label="Baisser l'objectif">−</button><b class="num">${R.reg.objectif||3}</b><button data-act="obj" data-d="1" aria-label="Augmenter l'objectif">+</button></span></div></div>
    <div class="card"><div><h2>Sauvegarde & données</h2><p class="sub">Garde une copie de tes entraînements</p></div>
      <p class="muted" style="margin:0">${S.mode==='db'?"Tes données sont enregistrées dans cette page Claude et te suivent d'un appareil à l'autre.":"Les données sont enregistrées localement dans le navigateur de cet appareil. Elles ne sont pas synchronisées entre appareils."} ${n} séance${n>1?'s':''} enregistrée${n>1?'s':''}.</p>
      ${dl?'<button class="btn lime" data-act="backup">Exporter une sauvegarde</button>':''}
      <label class="btn" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer">Importer une sauvegarde<input type="file" id="r-import" accept=".json,application/json" hidden></label>
      ${dl?'<div class="row"><button class="btn sm" data-act="csv">CSV des séances</button><button class="btn sm" data-act="csv-mes">CSV des mesures</button></div>':''}
      <p class="small muted" style="margin:0">La sauvegarde est un fichier JSON. L'importer ajoute ses séances et mesures à celles déjà présentes, sans rien effacer : c'est aussi le moyen de passer tes données d'un appareil ou d'une version à l'autre.</p></div>`;
}
function renderTab(){
  ({accueil:renderAccueil,seance:renderEditor,historique:renderHistorique,programme:renderProgramme,corps:renderCorps,reglages:renderReglages})[S.tab]();
}
function showTab(t){
  S.tab=t; $$('main>section').forEach(s=>s.hidden=s.id!=='tab-'+t); $('#title').textContent=TITLES[t];
  $$('.nav button').forEach(b=>b.dataset.t===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  renderTab(); window.scrollTo(0,0);
}
function onData(){
  ver++; setStatus();
  if(!touched){pickCurrent(); if(S.tab==='seance')renderEditor()}
  if(S.tab!=='seance')renderTab();
}

/* ---------- Chronomètre ---------- */
const T={mode:'repos',dur:90,running:false,end:0,left:90000,t0:0,acc:0,done:false,iv:null,ctx:null,lock:null};
const PRESETS=[45,60,90,120,180,300];
const mmss=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+':'+pad(s%60)};
function syncTimerFromReg(){ if(!T.running){const full=T.left>=T.dur*1000; T.dur=R.reg.repos||90; if(T.mode==='repos'&&full)T.left=T.dur*1000} drawTimer(true) }
/* Le chrono est gardé sur l'appareil : il continue de tourner si on quitte la page et qu'on y revient. */
let tSig='';
function saveT(){ const o={mode:T.mode,running:T.running,end:T.end,left:T.left,t0:T.t0,acc:T.acc,done:T.done,dur:T.dur}, j=JSON.stringify(o); if(j===tSig)return; tSig=j; try{localStorage.setItem('fonte-chrono',j)}catch(e){} }
function loadT(){
  let o=null; try{ o=JSON.parse(localStorage.getItem('fonte-chrono')||'null') }catch(e){}
  if(!o||typeof o!=='object')return;
  T.mode=o.mode==='libre'?'libre':'repos'; if(o.dur>=5)T.dur=o.dur; T.acc=+o.acc||0; T.left=o.left>0?o.left:T.dur*1000; T.done=!!o.done;
  if(!o.running)return;
  if(T.mode==='repos'){
    if(Date.now()>=o.end){ T.running=false; T.left=T.dur*1000; T.done=true; setTimeout(()=>toast('Repos terminé pendant ton absence, série suivante.'),300); return }
    T.end=o.end;
  } else T.t0=o.t0;
  T.running=true; T.iv=setInterval(tick,200); wake(true);
}
function drawTimer(full){
  let ms, prog=0;
  if(T.mode==='repos'){ ms=T.running?T.end-Date.now():T.left; prog=T.running||T.left<T.dur*1000?1-Math.max(0,ms)/(T.dur*1000):0; if(T.done)prog=1 }
  else ms=T.acc+(T.running?Date.now()-T.t0:0);
  $('#t-time').textContent=mmss(T.mode==='repos'?Math.ceil(Math.max(0,ms)/1000)*1000:ms);
  $('#t-prog').style.width=(Math.min(1,Math.max(0,prog))*100)+'%';
  $('#dock').classList.toggle('done',T.done);
  $('#t-label').textContent=T.done?'Terminé':T.mode==='repos'?'Repos':'Chrono';
  $('#t-ico').setAttribute('d',T.running?'M6 4h4v16H6zM14 4h4v16h-4z':'M7 4v16l13-8z');
  $('#t-play').setAttribute('aria-label',T.running?'Mettre en pause':'Démarrer');
  saveT();
  if(full){
    $('#t-presets').innerHTML=PRESETS.map(p=>`<button data-act="t-preset" data-s="${p}" aria-pressed="${p===T.dur}">${mmss(p*1000)}</button>`).join('');
    if(document.activeElement!==$('#t-min'))$('#t-min').value=Math.floor(T.dur/60);
    if(document.activeElement!==$('#t-sec'))$('#t-sec').value=pad(T.dur%60);
    $('#t-auto').checked=!!R.reg.auto; $('#t-sons').innerHTML=sonsSeg();
    $$('#t-modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===T.mode)));
    $('#t-repos-opts').hidden=T.mode!=='repos';
    $$('[data-act="t-minus"],[data-act="t-plus"]').forEach(b=>b.disabled=T.mode!=='repos');
  }
}
function audio(){ try{ T.ctx=T.ctx||new (window.AudioContext||window.webkitAudioContext)(); if(T.ctx.state==='suspended')T.ctx.resume() }catch(e){} }
/*SONS-START*/
const SONS=[['rock','Rock'],['piano','Piano'],['hiphop','Hip-hop'],['electro','Électro'],['fanfare','Fanfare']];
const sonId=()=>SONS.some(x=>x[0]===R.reg.son)?R.reg.son:'rock';
const sonsSeg=()=>SONS.map(([k,l])=>`<button type="button" data-act="son" data-s="${k}" aria-pressed="${k===sonId()}">${l}</button>`).join('');
const SND=(()=>{
  let NB=null;
  const nbuf=c=>{ if(NB&&NB.sampleRate===c.sampleRate)return NB; const b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1; return NB=b };
  const curve=k=>{const n=2048,a=new Float32Array(n);for(let i=0;i<n;i++){const x=i*2/n-1;a[i]=(1+k)*x/(1+k*Math.abs(x))}return a};
  function bus(c){ // compresseur + gain + limiteur doux : sort le plus fort possible sans craquer
    const inp=c.createGain(),cp=c.createDynamicsCompressor(),mk=c.createGain(),sh=c.createWaveShaper();
    cp.threshold.value=-22; cp.knee.value=6; cp.ratio.value=12; cp.attack.value=.002; cp.release.value=.1;
    mk.gain.value=2.4; sh.curve=curve(1.5); inp.connect(cp); cp.connect(mk); mk.connect(sh); sh.connect(c.destination); return inp;
  }
  function env(g,t,a,v,d){ g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+d) }
  function osc(c,out,t,f,dur,type,v,o={}){ const x=c.createOscillator(),g=c.createGain(); x.type=type; x.frequency.setValueAtTime(f,t); if(o.det)x.detune.value=o.det; if(o.to)x.frequency.exponentialRampToValueAtTime(o.to,t+(o.toT||dur)); env(g,t,o.a||.004,v,dur); x.connect(g); g.connect(out); x.start(t); x.stop(t+dur+.1); return x }
  function noise(c,out,t,dur,v,ft,fq,q,to){ const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(); s.buffer=nbuf(c); f.type=ft; f.frequency.setValueAtTime(fq,t); if(to)f.frequency.exponentialRampToValueAtTime(to,t+dur); if(q)f.Q.value=q; env(g,t,.002,v,dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t+dur+.1) }
  const kick=(c,o,t,v=1)=>{ osc(c,o,t,170,.3,'sine',v,{to:48,toT:.12}); osc(c,o,t,360,.05,'triangle',v*.6,{to:110,toT:.04}); noise(c,o,t,.02,v*.5,'highpass',3000) };
  const snare=(c,o,t,v=.8)=>{ noise(c,o,t,.2,v,'bandpass',1900,.8); osc(c,o,t,230,.1,'triangle',v*.6,{to:170,toT:.08}) };
  const hat=(c,o,t,v=.22,op)=>noise(c,o,t,op?.25:.035,v,'highpass',7500);
  const crash=(c,o,t,v=.45,d=1.2)=>noise(c,o,t,d,v,'highpass',4500);
  const clap=(c,o,t,v=.75)=>[0,.011,.022].forEach(d=>noise(c,o,t+d,d>.02?.16:.012,v,'bandpass',1300,1.1));
  function lp(c,out,t,from,to,dur,q){ const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(from,t); f.frequency.exponentialRampToValueAtTime(to,t+dur); if(q)f.Q.value=q; f.connect(out); return f }
  function guitar(c,out,t,r,dur,v=.55){ const ds=c.createWaveShaper(),f=c.createBiquadFilter(),g=c.createGain(); ds.curve=curve(80); f.type='lowpass'; f.frequency.value=3400; env(g,t,.004,v,dur);
    [1,1.5,2].forEach(m=>[-9,9].forEach(det=>{const x=c.createOscillator(),p=c.createGain(); x.type='sawtooth'; x.frequency.value=r*m; x.detune.value=det; p.gain.value=.3; x.connect(p); p.connect(ds); x.start(t); x.stop(t+dur+.1)}));
    ds.connect(f); f.connect(g); g.connect(out) }
  function piano(c,out,t,f,dur,v=.32){ [[1,1],[2,.5],[3,.25],[4,.13],[5,.07],[6,.04]].forEach(([m,a])=>osc(c,out,t,f*m*(1+.0004*m*m),dur/Math.sqrt(m),'sine',v*a,{a:.002})); osc(c,out,t,f*2,.06,'triangle',v*.25,{a:.001}) }
  function stab(c,out,t,fs,dur,v=.35,type='sawtooth',cut=2400){ const f=lp(c,out,t,cut*2,cut*.4,dur+.05); fs.forEach(x=>[-8,8].forEach(d=>osc(c,f,t,x,dur,type,v/fs.length,{det:d}))) }
  function brass(c,out,t,f,dur,v=.4){ const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.Q.value=1.5; fl.frequency.setValueAtTime(500,t); fl.frequency.linearRampToValueAtTime(4000,t+.05); fl.frequency.linearRampToValueAtTime(2400,t+dur); fl.connect(out); [-6,6].forEach(d=>osc(c,fl,t,f,dur,'sawtooth',v/2,{det:d,a:.025})) }
  const N={C3:130.8,E3:164.8,F3:174.6,G3:196,A3:220,B3:246.9,C4:261.6,D4:293.7,Eb4:311.1,E4:329.6,F4:349.2,G4:392,A4:440,Bb4:466.2,B4:493.9,C5:523.3,D5:587.3,Eb5:622.3,E5:659.3,F5:698.5,G5:784,A5:880,B5:987.8,C6:1046.5,D6:1174.7,E6:1318.5};
  const PLAY={
    rock(c,o,t){ const q=.38,e=q/2;
      [[0,N.E3,.16],[e,N.E3,.16],[2*e,N.G3,.16],[3*e,N.E3,.16],[4*e,N.A3,.3],[6*e,N.G3,.15],[7*e,N.E3,1.35]].forEach(([d,r,du])=>guitar(c,o,t+d,r,du));
      [0,2*e,4*e,5*e,7*e].forEach(d=>kick(c,o,t+d)); [q,3*q].forEach(d=>snare(c,o,t+d)); for(let i=0;i<7;i++)hat(c,o,t+i*e); crash(c,o,t+7*e,.5,1.3) },
    piano(c,o,t){ [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>piano(c,o,t+i*.09,f,.5));
      [[.4,[N.F3,N.F5,N.A5,N.C6],.4],[.62,[N.G3,N.G5,N.B5,N.D6],.4],[.88,[N.C3,N.C4,N.C5,N.E5,N.G5,N.C6,N.E6],1.8]].forEach(([d,fs,du])=>fs.forEach(f=>piano(c,o,t+d,f,du,.3)));
      [N.G5,N.C6,N.E6].forEach((f,i)=>piano(c,o,t+1.3+i*.12,f*2,.6,.18)) },
    hiphop(c,o,t){ const s=.155;
      [0,6,10].forEach(i=>{kick(c,o,t+i*s,1); osc(c,o,t+i*s,65.4,.45,'sine',.7); osc(c,o,t+i*s,130.8,.4,'triangle',.35)});
      [4,12].forEach(i=>{snare(c,o,t+i*s,.7); clap(c,o,t+i*s)}); for(let i=0;i<16;i+=2)hat(c,o,t+i*s,.2,i===14);
      [[0,.2],[3,.12],[6,.12],[8,.2],[11,.12],[14,.3]].forEach(([i,du],k)=>stab(c,o,t+i*s,k%3===2?[N.Bb4,N.D5,N.F5]:[N.C5,N.Eb5,N.G5],du,.4,'square',2600));
      noise(c,o,t+13*s,.18,.4,'bandpass',600,4,3500) },
    electro(c,o,t){
      noise(c,o,t,1,.35,'bandpass',400,1.5,9000); osc(c,lp(c,o,t,600,6000,1),t,220,1,'sawtooth',.25,{to:880,toT:1,a:.4});
      [0,.25,.45,.6,.72,.81,.88,.93,.97].forEach((d,i)=>snare(c,o,t+d,.25+i*.06));
      const b=t+1.02, q=.235; crash(c,o,b,.55,1.4);
      for(let i=0;i<6;i++){ kick(c,o,b+i*q,1); stab(c,o,b+i*q+q/2,[N.A4,N.C5,N.E5,N.A5],.13,.5,'sawtooth',3500); hat(c,o,b+i*q+q/2,.25) }
      osc(c,o,b,110,1.3,'sawtooth',.25) },
    fanfare(c,o,t){ const tr=.13;
      [0,tr,2*tr].forEach(d=>{brass(c,o,t+d,N.G4,.1); brass(c,o,t+d,N.E4,.1,.25); snare(c,o,t+d,.35)});
      brass(c,o,t+.4,N.C5,.35); brass(c,o,t+.4,N.G4,.35,.3); brass(c,o,t+.8,N.G4,.13); brass(c,o,t+.8,N.E4,.13,.25);
      [N.C4,N.E4,N.G4,N.C5,N.E5,N.G5].forEach(f=>brass(c,o,t+1,f,1.5,.32));
      [[0,.6],[.4,.8],[1,1]].forEach(([d,v])=>{kick(c,o,t+d,v); osc(c,o,t+d,98,.5,'sine',v*.5)}); crash(c,o,t+1,.5,1.5);
      for(let i=0;i<10;i++)snare(c,o,t+1+i*.05,.2*(1-i/10)) }
  };
  return {play(c,son){ const o=bus(c); (PLAY[son]||PLAY.rock)(c,o,c.currentTime+.05); return o }};
})();
function ring(son){
  const c=T.ctx; if(!c)return;
  if(T.bus){ try{T.bus.disconnect()}catch(e){} }
  T.bus=SND.play(c,son);
}
/*SONS-END*/
function beep(){
  try{ ring(sonId()) }catch(e){}
  try{ navigator.vibrate&&navigator.vibrate([400,150,400,150,800]) }catch(e){}
}
async function wake(on){
  try{ if(on){ if(!T.lock&&navigator.wakeLock)T.lock=await navigator.wakeLock.request('screen') } else if(T.lock){ await T.lock.release(); T.lock=null } }catch(e){ T.lock=null }
}
function tStart(){
  audio(); T.done=false;
  if(T.mode==='repos'){ if(T.left<=0)T.left=T.dur*1000; T.end=Date.now()+T.left } else T.t0=Date.now();
  T.running=true; clearInterval(T.iv); T.iv=setInterval(tick,200); wake(true); drawTimer();
}
function tPause(){
  if(!T.running)return;
  if(T.mode==='repos')T.left=Math.max(0,T.end-Date.now()); else T.acc+=Date.now()-T.t0;
  T.running=false; clearInterval(T.iv); wake(false); drawTimer();
}
function tReset(){ T.running=false; clearInterval(T.iv); T.done=false; T.left=T.dur*1000; T.acc=0; wake(false); drawTimer() }
function tick(){
  if(T.mode==='repos'&&T.running&&Date.now()>=T.end){ T.running=false; clearInterval(T.iv); T.left=T.dur*1000; T.done=true; wake(false); beep(); toast('Repos terminé, série suivante.') }
  drawTimer();
}
function setDur(s){
  s=Math.min(3600,Math.max(5,Math.round(s))); const d=s-T.dur; T.dur=s; R.reg.repos=s; saveReg();
  if(T.running&&T.mode==='repos')T.end+=d*1000; else if(T.mode==='repos'){T.left=s*1000;T.done=false}
  drawTimer(true);
}

/* ---------- Exports ---------- */
const cell=v=>{v=v==null?'':typeof v==='number'?String(v).replace('.',','):String(v);return /[";\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCsv=rows=>'﻿'+rows.map(r=>r.map(cell).join(';')).join('\r\n')+'\r\n';
async function saveFile(name,data,okMsg){
  if(!dl)return;
  try{ await dl.save({filename:name,data}); toast(okMsg) }
  catch(e){ const c=e&&e.code; if(c==='declined')return; toast(c==='rate_limited'?'Un téléchargement est déjà en attente. Réessaie dans un instant.':"Le téléchargement n'est pas disponible ici.") }
}
function csvSeances(){
  const rows=[['Date','Séance','Durée (min)','Exercice','Groupe','Série','Charge (kg)','Répétitions','Volume (kg)','Notes']];
  for(const s of realSessions())for(const e of s.exos||[])(e.series||[]).filter(isDone).forEach((x,j)=>rows.push([s.date,s.nom||'',s.duree?Math.round(s.duree/60):'',e.nom,groupe(e.nom),j+1,x.kg||0,x.reps,(x.kg||0)*x.reps,s.note||'']));
  return rows;
}
function csvMesures(){
  const rows=[['Date',...MES.map(m=>m[1]+(m[2]?' ('+m[2]+')':''))]];
  Object.values(R.mesures).filter(x=>x&&x.date).sort((a,b)=>a.date<b.date?-1:1).forEach(x=>rows.push([x.date,...MES.map(m=>typeof x[m[0]]==='number'?x[m[0]]:'')]));
  return rows;
}
function importBackup(text){
  let o; try{o=JSON.parse(text)}catch(e){toast("Ce fichier n'est pas une sauvegarde lisible.");return}
  if(!o||typeof o!=='object'||(typeof o.seances!=='object'&&typeof o.mesures!=='object')){toast("Ce fichier ne contient ni séances ni mesures.");return}
  let ns=0,nm=0; const okId=k=>/^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(k);
  for(const[k,s]of Object.entries(o.seances||{})){ if(!okId(k)||!s||!/^\d{4}-\d{2}-\d{2}$/.test(s.date||'')||!Array.isArray(s.exos))continue; const c=clone(s); c.id=k; delete c.ouverte; R.seances[k]=c; persist('seances/'+k,c); ns++ }
  for(const[k,m]of Object.entries(o.mesures||{})){ if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!m||typeof m!=='object')continue; const c=Object.assign({},R.mesures[k],clone(m),{date:k}); R.mesures[k]=c; persist('mesures/'+k,c); nm++ }
  if(o.prog&&Array.isArray(o.prog.seances)&&!(R.prog.seances||[]).length){ R.prog=clone(o.prog); saveProg() }
  touched=false; pickCurrent(); renderTab(); toast(`Sauvegarde importée : ${ns} séance${ns>1?'s':''}, ${nm} mesure${nm>1?'s':''}.`);
}

/* ---------- Actions ---------- */
function arm(b){
  if(b.dataset.armed)return true;
  b.dataset.armed='1'; b.dataset.lbl=b.textContent; b.textContent='Confirmer ?'; b.classList.add('armed');
  setTimeout(()=>{ if(b.isConnected&&b.dataset.armed){delete b.dataset.armed;b.textContent=b.dataset.lbl;b.classList.remove('armed')} },3000);
  return false;
}
function readSet(i,j){
  const s=cur.exos[i].series[j], ki=$(`#kg-${i}-${j}`), ri=$(`#rp-${i}-${j}`);
  const kr=ki.value.trim(), kg=kr===''?0:num(kr), rr=ri.value.trim(), reps=rr===''?null:Math.round(num(rr));
  const okK=kg>=0&&kg<=1000, okR=reps===null||(reps>=1&&reps<=999);
  ki.classList.toggle('bad',!okK); ri.classList.toggle('bad',!okR);
  if(okK)s.kg=kg; if(okR)s.reps=reps; return okK&&okR;
}
const ACT={
  tab:b=>showTab(b.dataset.t),
  csv:()=>saveFile('fonte-seances-'+today()+'.csv',toCsv(csvSeances()),'Fichier CSV téléchargé.'),
  'csv-mes':()=>saveFile('fonte-mesures-'+today()+'.csv',toCsv(csvMesures()),'Fichier CSV téléchargé.'),
  backup:()=>saveFile('fonte-sauvegarde-'+today()+'.json',JSON.stringify({app:'fonte',date:today(),seances:R.seances,mesures:R.mesures,reg:R.reg,prog:R.prog}),'Sauvegarde téléchargée.'),
  lancer:b=>{const p=(R.prog.seances||[])[+b.dataset.p]; if(p)lancer(p)},
  'focus-exo':()=>{const f=$('#f-exo'); f.scrollIntoView({block:'center',behavior:'smooth'}); f.focus({preventScroll:true})},
  terminer:()=>{
    if(cur.ouverte&&cur.debut)cur.duree=Math.round((Date.now()-cur.debut)/1000);
    cur.exos.forEach(e=>e.series=e.series.filter(isDone)); cur.exos=keepExos(cur.exos,e=>e.series.length>0); delete cur.ouverte; cur.exos.forEach(e=>e.series.forEach(x=>{delete x.cible;delete x.done}));
    const t=sumS(cur); if(!cur.exos.length)cur.note=''; saveCur();
    toast(t.n?`Séance enregistrée : ${t.n} série${t.n>1?'s':''}, ${nf0.format(t.v)} kg${cur.duree?', '+durTxt(cur.duree):''}.`:'Séance vide, rien à enregistrer.');
    cur=blank(); touched=false; showTab(t.n?'accueil':'seance');
  },
  open:b=>{const s=R.seances[b.dataset.id]; if(!s)return; cur=clone(s);cur.exos=cur.exos||[];touched=true;showTab('seance')},
  more:()=>{S.histN+=20;renderHistorique()},
  'del-seance':b=>{ if(!arm(b))return; const id=b.dataset.id; delete R.seances[id]; persist('seances/'+id,null); if(cur.id===id){cur=blank();touched=false} renderHistorique() },
  'as-prog':b=>{ const s=R.seances[b.dataset.id]; if(!s)return; const nom=s.nom||'Séance';
    const exos=keepExos(clone(s.exos||[]),e=>(e.series||[]).some(isDone)).map(e=>{const d=e.series.filter(isDone), pt=progTarget(e.nom), o={nom:e.nom,series:d.length,reps:pt?pt.reps:Math.max(...d.map(x=>x.reps)),kg:d[0].kg||0}; if(e.ss)o.ss=true; return o});
    if(!exos.length)return; R.prog.seances=R.prog.seances||[]; const i=R.prog.seances.findIndex(p=>key(p.nom)===key(nom));
    if(i>=0)R.prog.seances[i]={nom,exos}; else R.prog.seances.push({nom,exos}); saveProg(); toast(`« ${nom} » ${i>=0?'mis à jour dans':'ajouté à'} ton programme.`) },
  'del-prog':b=>{ if(!arm(b))return; R.prog.seances.splice(+b.dataset.p,1); S.pe=null; saveProg(); renderProgramme() },
  'pe-edit':b=>{ S.pe=+b.dataset.p; renderProgramme() },
  'pe-done':()=>{ S.pe=null; renderProgramme(); window.scrollTo(0,0) },
  'pe-new':()=>{ R.prog.seances=R.prog.seances||[]; R.prog.seances.push({nom:'Nouvelle séance',exos:[]}); S.pe=R.prog.seances.length-1; saveProg(); renderProgramme(); const n=$('#pe-nom'); if(n){n.focus();n.select()} },
  'pe-ser':b=>{ const e=R.prog.seances[S.pe].exos[+b.dataset.j]; e.series=Math.min(12,Math.max(1,(e.series||1)+ +b.dataset.d)); saveProg(); renderProgramme() },
  'pe-mv':b=>{ const p=R.prog.seances[S.pe], a=p.exos, j=+b.dataset.j, bl=blocks(a), bi=bl.findIndex(x=>x.includes(j)), k=bi+ +b.dataset.d; if(bi<0||k<0||k>=bl.length)return; [bl[bi],bl[k]]=[bl[k],bl[bi]]; p.exos=bl.flat().map(i=>a[i]); keepExos(p.exos,()=>true); saveProg(); renderProgramme() },
  'pe-del':b=>{ if(!arm(b))return; const p=R.prog.seances[S.pe], j=+b.dataset.j; p.exos=keepExos(p.exos,(e,i)=>i!==j); saveProg(); renderProgramme() },
  'pe-ss':b=>{ const e=R.prog.seances[S.pe].exos[+b.dataset.j]; if(!e)return; e.ss=true; saveProg(); renderProgramme() },
  'pe-unss':b=>{ const a=R.prog.seances[S.pe].exos, bl=blocks(a).find(x=>x.includes(+b.dataset.j)); if(!bl)return; bl.forEach(i=>delete a[i].ss); saveProg(); renderProgramme() },
  'del-exo':b=>{ const i=+b.dataset.i; if(cur.exos[i].series.some(isDone)&&!arm(b))return; cur.exos=keepExos(cur.exos,(e,k)=>k!==i); saveCur(); renderEditor() },
  'del-set':b=>{ cur.exos[+b.dataset.i].series.splice(+b.dataset.j,1); saveCur(); renderEditor() },
  'add-set':b=>{ const e=cur.exos[+b.dataset.i], l=e.series[e.series.length-1], r={kg:l?l.kg||0:0,reps:null,done:false}; if(l&&l.cible)r.cible=l.cible; e.series.push(r); saveCur(); renderEditor() },
  chk:b=>{ const i=+b.dataset.i,j=+b.dataset.j,s=cur.exos[i].series[j];
    if(isDone(s)){ s.done=false; saveCur(); renderEditor(); return }
    if(!readSet(i,j)){toast('Vérifie la charge et les répétitions de cette série.');return}
    if(!s.reps){ const p=prevSet(i,j); if(p)s.reps=p.reps; else if(s.cible)s.reps=s.cible; else{toast('Indique le nombre de répétitions.');$(`#rp-${i}-${j}`).focus();return} }
    s.done=true; saveCur(); renderEditor();
    const nx=cur.exos[i+1]; if(nx&&nx.ss){ toast('Superset : enchaîne avec '+nx.nom+'.'); return } // pas de repos entre deux exercices liés
    if(R.reg.auto){ if(T.running)tPause(); T.mode='repos'; T.left=T.dur*1000; T.acc=0; tStart(); drawTimer(true) } },
  mes:b=>{S.mes=b.dataset.m;renderCorps()},
  'del-mes':b=>{ if(!arm(b))return; delete R.mesures[b.dataset.id]; persist('mesures/'+b.dataset.id,null); renderCorps() },
  obj:b=>{R.reg.objectif=Math.min(14,Math.max(1,(R.reg.objectif||3)+ +b.dataset.d)); saveReg(); renderTab()},
  't-panel':b=>{const p=$('#t-panel');p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));drawTimer(true)},
  son:b=>{ R.reg.son=b.dataset.s; saveReg(); audio(); try{ring(b.dataset.s)}catch(e){} drawTimer(true); if(S.tab==='reglages')renderReglages() },
  't-play':()=>T.running?tPause():tStart(),
  't-reset':tReset,
  't-minus':()=>setDur(T.dur-15), 't-plus':()=>setDur(T.dur+15),
  't-preset':b=>setDur(+b.dataset.s),
  't-setmode':b=>{ if(T.mode===b.dataset.m)return; tPause(); T.mode=b.dataset.m; T.done=false; T.left=T.dur*1000; T.acc=0; drawTimer(true) }
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]'); if(b&&!b.disabled&&ACT[b.dataset.act])ACT[b.dataset.act](b,e)});
document.addEventListener('submit',e=>{
  const f=e.target.closest('[data-form]'); if(!f)return; e.preventDefault();
  if(f.dataset.form==='exo'){
    const inp=$('#f-exo'), n=inp.value.trim().replace(/\s+/g,' '); if(!n){inp.focus();return}
    if(cur.exos.some(x=>key(x.nom)===key(n))){toast('Cet exercice est déjà dans la séance.');return}
    const known=index().ex[key(n)], def=DEFAULT_EXOS.find(x=>key(x)===key(n)), nom=known?known.nom:def||n, pt=progTarget(nom);
    if(!R.seances[cur.id])cur.ouverte=true;
    if(cur.ouverte&&!cur.debut)cur.debut=Date.now();
    cur.exos.push({nom,series:newRows(nom,pt?pt.series:0,pt?pt.reps:0,pt?pt.kg:0)}); saveCur(); renderEditor();
    const k=$(`#kg-${cur.exos.length-1}-0`); k&&k.scrollIntoView({block:'center',behavior:'smooth'});
  }else if(f.dataset.form==='pe-add'){
    const p=R.prog.seances[S.pe]; if(!p)return; const inp=$('#pe-exo'), n=inp.value.trim().replace(/\s+/g,' '); if(!n){inp.focus();return}
    p.exos=p.exos||[]; if(p.exos.some(x=>key(x.nom)===key(n))){toast('Cet exercice est déjà dans la séance.');return}
    const known=index().ex[key(n)], def=DEFAULT_EXOS.find(x=>key(x)===key(n)), nom=known?known.nom:def||n, last=lastTime(key(nom));
    p.exos.push({nom,series:last?last.sets.length:3,reps:last?Math.max(...last.sets.map(x=>x.reps)):10,kg:last?(last.sets[0].kg||0):0});
    saveProg(); renderProgramme(); const ni=$('#pe-exo'); ni&&ni.focus();
  }else if(f.dataset.form==='mes'){
    const d=$('#m-date').value; if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){toast('Choisis une date.');return}
    const o=Object.assign({},R.mesures[d],{date:d}); let any=false;
    for(const [k] of MES){const raw=$('#m-'+k).value.trim(); if(raw==='')continue; const v=num(raw); if(!(v>0&&v<500)){toast('Une valeur est illisible. Utilise des chiffres, par exemple 78,4.');$('#m-'+k).focus();return} o[k]=v; any=true}
    if(!any){toast('Saisis au moins une valeur.');return}
    R.mesures[d]=o; persist('mesures/'+d,o); renderCorps(); toast('Mesure enregistrée.');
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.f){ if(readSet(+t.dataset.i,+t.dataset.j))saveCur() }
  else if(t.id==='f-date'){ if(/^\d{4}-\d{2}-\d{2}$/.test(t.value)){cur.date=t.value;saveCur();renderEditor()} else t.value=cur.date }
  else if(t.id==='f-nom'){ cur.nom=t.value.trim(); touched=true; if(cur.exos.length)saveCur(); renderEditor() }
  else if(t.id==='pe-nom'){ const p=R.prog.seances[S.pe]; if(p){ p.nom=t.value.trim()||'Séance'; saveProg(); const h=t.closest('.card').querySelector('h2'); if(h)h.textContent=p.nom } }
  else if(t.dataset.peReps!=null){ const e=R.prog.seances[S.pe]&&R.prog.seances[S.pe].exos[+t.dataset.peReps], v=Math.round(num(t.value)); if(e&&v>=1&&v<=999){e.reps=v; saveProg()} else if(e)t.value=e.reps||'' }
  else if(t.id==='f-note'){ cur.note=t.value; if(!R.seances[cur.id]&&!cur.exos.length)cur.ouverte=true; saveCur() }
  else if(t.id==='sel-exo'){ S.exo=t.value; renderHistorique() }
  else if(t.id==='sel-metric'){ S.metric=t.value; renderHistorique() }
  else if(t.id==='sel-filtre'){ S.filtre=t.value; S.histN=15; renderHistorique() }
  else if(t.id==='t-auto'||t.id==='r-auto'){ R.reg.auto=t.checked; saveReg(); drawTimer(true) }
  else if(t.id==='r-repos'){ const v=Math.round(num(t.value)); if(v>=5&&v<=3600)setDur(v); else t.value=R.reg.repos||90 }
  else if(t.id==='t-min'||t.id==='t-sec'){ const m=Math.round(num($('#t-min').value))||0, s=Math.round(num($('#t-sec').value))||0; setDur(m*60+s) }
  else if(t.id==='r-import'){ const f=t.files&&t.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>importBackup(String(r.result||'')); r.onerror=()=>toast("Impossible de lire ce fichier."); r.readAsText(f); t.value='' }
});
document.addEventListener('input',e=>{
  const t=e.target; if(!t.dataset||!t.dataset.f)return; const i=+t.dataset.i,j=+t.dataset.j, b=t.closest('.set')&&t.closest('.set').querySelector('.dl'); if(!b)return;
  const kr=$(`#kg-${i}-${j}`).value.trim(), rr=$(`#rp-${i}-${j}`).value.trim();
  const c=cmpPrev(prevSet(i,j),kr===''?0:num(kr),rr===''?null:Math.round(num(rr)));
  b.hidden=!c; if(c){b.textContent=c.txt; b.className='dl '+c.cls}
});
let rz; window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.tab==='historique'||S.tab==='corps')renderTab()},200)});
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&T.running){wake(true);tick()} });

setInterval(()=>{ const el=document.getElementById('sess-time'); if(el&&cur&&cur.debut&&cur.ouverte)el.textContent=hms((Date.now()-cur.debut)/1000) },1000);
/* ---------- Démarrage ---------- */
pickCurrent(); setStatus(); renderTab(); loadT(); drawTimer(true);
document.addEventListener('pointerdown',audio,{passive:true});
const hsh=(location.hash||'').slice(1); if(TITLES[hsh]&&hsh!=='accueil')showTab(hsh);
(async()=>{
  const C=window.claude&&window.claude.use?window.claude:null;
  try{ db=C?await C.use('db'):null }catch(e){ db=null }
  if(db){ S.mode='db'; subscribe(); pump() }
  else{ S.mode='local'; S.loaded=true; loadLocal(); if(q.length){q.length=0;saveLocal()} syncTimerFromReg(); onData() }
  setStatus();
  try{ dl=C?await C.use('downloads'):null }catch(e){ dl=null }
  if(!dl&&!C)dl={save:async o=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([o.data],{type:'application/octet-stream'}));a.download=o.filename;document.body.appendChild(a);a.click();a.remove()}};
  if(dl&&(S.tab==='historique'||S.tab==='corps'||S.tab==='reglages'))renderTab();
})();
})();

/* Hors ligne : le service worker garde l'appli en cache pour l'ouvrir sans réseau. */
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
