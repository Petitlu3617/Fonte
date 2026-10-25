(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const toDate=s=>{const[a,b,c]=String(s).split('-').map(Number);return new Date(a,(b||1)-1,c||1)};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const today=()=>iso(new Date());
const dLong=new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'});
const dYear=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'});
const dDay=new Intl.DateTimeFormat('fr-FR',{weekday:'short'});
const pl=(n,s,p)=>n+' '+(n>1?(p||s+'s'):s);
const na=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

/* Boîtes Leitner : intervalle (jours) avant la prochaine révision, selon la boîte où se trouve la carte. */
const INT=[1,2,4,7,30,90,180,365];
const FREQ=['Tous les jours','Tous les 2 jours','Tous les 4 jours','Chaque semaine','Chaque mois','Tous les 3 mois','Tous les 6 mois','Chaque année'];
const COLORS=['#8b7cff','#4fc3f7','#4dd0a8','#c4f25f','#ffd54f','#ffa25f','#ff7a7a','#f48fb1','#ce93d8','#90a4ae'];
const KEY='memo-cartes';
const TITLES={accueil:"Aujourd'hui",paquets:'Paquets',reglages:'Réglages & données'};

/* ---------- Données ---------- */
const blank=()=>({decks:[],cards:[],reg:{echec:'descend'},log:{}});
function norm(x){
  const b=blank();
  if(!x||!Array.isArray(x.cards)||!Array.isArray(x.decks))return null;
  return {decks:x.decks.filter(d=>d&&d.id),cards:x.cards.filter(c=>c&&c.id&&c.deck).map(c=>Object.assign({box:1,due:today(),side:0,ok:0,ko:0},c)),reg:Object.assign(b.reg,x.reg),log:x.log&&typeof x.log==='object'?x.log:{}};
}
function load(){try{return norm(JSON.parse(localStorage.getItem(KEY)||'null'))||blank()}catch(e){return blank()}}
let D=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(D))}catch(e){toast('Enregistrement impossible : stockage plein ou bloqué')}}

const S={tab:'accueil',deck:null,q:null,filtre:'',bulk:false,armed:null};
const deckOf=id=>D.decks.find(d=>d.id===id);
const cardOf=id=>D.cards.find(c=>c.id===id);
const cardsOf=id=>D.cards.filter(c=>c.deck===id);
const isDue=(c,t=today())=>c.due<=t;
const dueOf=id=>D.cards.filter(c=>(!id||c.deck===id)&&isDue(c));
const labs=d=>[d&&d.la||'Recto',d&&d.lb||'Verso'];
const newCard=(deck,a,b)=>({id:uid(),deck,a,b,box:1,due:today(),side:0,ok:0,ko:0,created:today(),last:null});
const dueTxt=c=>{const t=today();if(c.due<=t)return 'à réviser';const n=Math.round((toDate(c.due)-toDate(t))/864e5);return n===1?'demain':n<14?'dans '+n+' j':dYear.format(toDate(c.due))};

function streak(){
  let d=new Date(), n=0;
  if(!D.log[iso(d)])d=addDays(d,-1);
  while(D.log[iso(d)]){n++;d=addDays(d,-1)}
  return n;
}

/* ---------- Vues ---------- */
const dot=c=>`<i class="dot" style="--c:${esc(c)}"></i>`;

function vHome(){
  if(!D.decks.length)return `<div class="card hero">
    <div class="eyebrow">Bienvenue</div>
    <h2>Crée ton premier paquet</h2>
    <p class="sub">Un paquet par thème (anglais, histoire, vocabulaire…), chacun avec sa couleur. Ajoute ensuite des cartes : une face, et ce qu'il faut retrouver derrière.</p>
    <div class="row"><button class="btn acc" type="button" data-act="newdeck">+ Nouveau paquet</button></div>
  </div>${vBoxesHelp()}`;
  const t=today(), due=dueOf(null), nb=D.cards.length, lt=D.log[t]||{ok:0,ko:0}, st=streak();
  let next='';
  if(!due.length&&nb){const m=D.cards.reduce((a,c)=>c.due<a?c.due:a,'9999');next=`<p class="sub">Prochaine révision : <b>${esc(dLong.format(toDate(m)))}</b></p>`}
  const decks=D.decks.map(d=>{
    const all=cardsOf(d.id).length, n=dueOf(d.id).length;
    return `<div class="item deck" style="--c:${esc(d.color)}">
      ${dot(d.color)}
      <button class="tx plain" type="button" data-act="opendeck" data-d="${d.id}"><b>${esc(d.name)}</b><span>${n?`<em>${pl(n,'carte')} à réviser</em> · `:''}${pl(all,'carte')}</span></button>
      ${n?`<button class="btn sm colored" type="button" data-act="start" data-d="${d.id}">Réviser</button>`:'<span class="pill grey">À jour</span>'}
    </div>`}).join('');
  const days=[];for(let i=1;i<=7;i++){const k=iso(addDays(new Date(),i));days.push([k,D.cards.filter(c=>c.due===k).length])}
  const mx=Math.max(1,...days.map(x=>x[1]));
  return `<div class="card hero">
    <div class="eyebrow">${esc(dLong.format(new Date()))}</div>
    <div class="big num">${due.length}</div>
    <div class="sub">${due.length>1?'cartes à réviser':'carte à réviser'}${nb?` sur ${nb}`:''}</div>
    ${due.length?`<div class="row"><button class="btn acc" type="button" data-act="start" data-d="">Réviser tout</button></div>`:nb?next:`<p class="sub">Ajoute des cartes dans un paquet pour commencer.</p>`}
    <div class="stats">
      <div><b class="num">${lt.ok+lt.ko}</b><span>revues aujourd'hui</span></div>
      <div><b class="num">${lt.ok+lt.ko?Math.round(lt.ok*100/(lt.ok+lt.ko))+' %':'–'}</b><span>réussite du jour</span></div>
      <div><b class="num">${st}</b><span>${st>1?'jours de suite':'jour de suite'}</span></div>
    </div>
  </div>
  <div class="card"><div class="head"><h2>Paquets</h2><button class="btn sm" type="button" data-act="newdeck">+ Paquet</button></div><div class="list">${decks}</div></div>
  ${nb?vBoxes(null):''}
  ${nb?`<div class="card"><h2>7 prochains jours</h2><div class="fore">${days.map(([k,n])=>`<div><span class="num">${n||''}</span><i style="height:${n?Math.max(6,n/mx*70):2}px"></i><small>${esc(dDay.format(toDate(k)))}</small></div>`).join('')}</div></div>`:''}`;
}

function vBoxes(deckId){
  const cs=deckId?cardsOf(deckId):D.cards, n=INT.map((_,i)=>cs.filter(c=>c.box===i+1).length), mx=Math.max(1,...n);
  return `<div class="card"${deckId?` style="--c:${esc(deckOf(deckId).color)}"`:''}><div class="head"><h2>Boîtes</h2><span class="small muted">${pl(cs.length,'carte')}</span></div>
  <div class="boxes">${n.map((v,i)=>`<div class="box"><div class="bar"><i style="height:${v?Math.max(8,v/mx*100):0}%"></i></div><b class="num">${v}</b><small>Boîte ${i+1}</small><small class="muted">${FREQ[i]}</small></div>`).join('')}</div></div>`;
}

function vBoxesHelp(){
  return `<div class="card"><h2>Comment ça marche</h2>
  <p class="sub">Tu lis une face et tu cherches ce qu'il y a derrière. <b>Je savais</b> : la carte monte d'une boîte et revient plus tard. <b>Je ne savais pas</b> : elle descend d'une boîte pour revenir plus vite. Après chaque révision la carte change de côté, pour apprendre dans les deux sens.</p>
  <div class="steps">${FREQ.map((f,i)=>`<div><b>${i+1}</b><span>${f}</span></div>`).join('')}</div></div>`;
}

function vDecks(){
  if(!D.decks.length)return vHome();
  return `<div class="card"><div class="head"><h2>Tes paquets</h2><button class="btn sm acc" type="button" data-act="newdeck">+ Nouveau paquet</button></div>
  <div class="list">${D.decks.map(d=>{const cs=cardsOf(d.id),n=dueOf(d.id).length,m=cs.filter(c=>c.box===8).length;
    return `<button class="item deck plain" type="button" data-act="opendeck" data-d="${d.id}" style="--c:${esc(d.color)}">${dot(d.color)}<span class="tx"><b>${esc(d.name)}</b><span>${pl(cs.length,'carte')}${n?` · <em>${n} à réviser</em>`:''}${m?` · ${m} en boîte 8`:''}</span></span><span class="chev">›</span></button>`}).join('')}</div></div>`;
}

function vDeck(){
  const d=deckOf(S.deck), [la,lb]=labs(d), cs=cardsOf(d.id), n=dueOf(d.id).length;
  return `<div class="deckhead" style="--c:${esc(d.color)}">
    <button class="link" type="button" data-act="tab" data-t="paquets">‹ Paquets</button>
    <div class="head"><div><h2>${dot(d.color)} ${esc(d.name)}</h2><p class="sub">${pl(cs.length,'carte')} · ${esc(la)} ⇄ ${esc(lb)}</p></div>
    <div class="row">${n?`<button class="btn colored" type="button" data-act="start" data-d="${d.id}">Réviser (${n})</button>`:''}<button class="btn" type="button" data-act="editdeck" data-d="${d.id}">Modifier</button></div></div>
  </div>
  <div class="card" style="--c:${esc(d.color)}">
    <div class="head"><h2>Ajouter ${S.bulk?'plusieurs cartes':'une carte'}</h2><button class="link" type="button" data-act="bulk">${S.bulk?'Une seule carte':'Import en lot'}</button></div>
    ${S.bulk?`<label class="fld"><span>Une carte par ligne : ${esc(la)} ; ${esc(lb)}</span><textarea id="bulk" rows="7" placeholder="${esc('apple ; pomme\nto run ; courir')}"></textarea></label>
      <div class="row"><button class="btn colored" type="button" data-act="addbulk">Importer</button><span class="small muted">Séparateur : point-virgule ou tabulation (copier-coller depuis un tableur).</span></div>`
    :`<div class="two"><label class="fld"><span>${esc(la)}</span><textarea id="na" rows="2"></textarea></label><label class="fld"><span>${esc(lb)}</span><textarea id="nb" rows="2"></textarea></label></div>
      <div class="row"><button class="btn colored" type="button" data-act="addcard">Ajouter</button><span class="small muted">Elle part en boîte 1, à réviser dès aujourd'hui.</span></div>`}
  </div>
  ${cs.length?vBoxes(d.id):''}
  ${cs.length?`<div class="card"><div class="head"><h2>Cartes</h2><input id="filtre" type="search" placeholder="Rechercher…" value="${esc(S.filtre)}" autocomplete="off"></div><div class="list" id="cardlist">${vCardList()}</div></div>`:''}`;
}

function vCardList(){
  const f=na(S.filtre).trim();
  const cs=cardsOf(S.deck).filter(c=>!f||na(c.a+' '+c.b).includes(f)).sort((x,y)=>x.box-y.box||na(x.a).localeCompare(na(y.a)));
  if(!cs.length)return '<p class="sub">Aucune carte trouvée.</p>';
  return cs.map(c=>`<button class="item plain" type="button" data-act="editcard" data-c="${c.id}"><span class="badge num">${c.box}</span><span class="tx"><b>${esc(c.a)}</b><span>${esc(c.b)}</span></span><span class="due${isDue(c)?' on':''}">${esc(dueTxt(c))}</span></button>`).join('');
}

function vReview(){
  const q=S.q, total=q.ids.length;
  const top=`<div class="rhead"><button class="btn sm" type="button" data-act="quit">✕ Quitter</button><span class="num muted">${Math.min(q.i+1,total)} / ${total}</span><button class="btn sm" type="button" data-act="undo"${q.undo?'':' disabled'}>↶ Annuler</button></div>
  <div class="prog"><i style="width:${q.i/total*100}%"></i></div>`;
  if(q.i>=total){
    const f=q.failed.length;
    return top+`<div class="card hero center">
      <div class="eyebrow">${q.practice?'Entraînement terminé':'Session terminée'}</div>
      <div class="score"><div class="okc"><b class="num">${q.ok}</b><span>je savais</span></div><div class="koc"><b class="num">${q.ko}</b><span>je ne savais pas</span></div></div>
      ${f?`<p class="sub">${q.practice?'Encore quelques cartes à fixer.':(D.reg.echec==='reset'?'Les cartes ratées sont reparties en boîte 1.':'Les cartes ratées ont été redescendues d\'une boîte.')} Tu peux les revoir tout de suite, sans changer leurs boîtes.</p>`:q.practice?'<p class="sub">Tout est su !</p>':''}
      <div class="row center">${f?`<button class="btn acc" type="button" data-act="practice">Revoir les ratées (${f})</button>`:''}<button class="btn" type="button" data-act="quit">Terminer</button></div>
    </div>`;
  }
  const c=cardOf(q.ids[q.i]), d=deckOf(c.deck), [la,lb]=labs(d);
  const Q=c.side?c.b:c.a, A=c.side?c.a:c.b, lq=c.side?lb:la, lr=c.side?la:lb;
  return top+`${q.practice?'<p class="small muted center">Entraînement : les boîtes ne changent pas.</p>':''}
  <div class="flash${q.shown?' flipped':''}" style="--c:${esc(d.color)}" data-act="flip" role="button" tabindex="0" aria-label="Retourner la carte">
    <div class="inner">
      <div class="face front"><span class="lab">${dot(d.color)} ${esc(d.name)} · ${esc(lq)}</span><div class="txt">${esc(Q)}</div><span class="hint">Touche pour retourner</span></div>
      <div class="face back"><span class="lab">${dot(d.color)} ${esc(lr)}</span><div class="txt">${esc(A)}</div><div class="qsmall">${esc(Q)}</div></div>
    </div>
  </div>
  <p class="small muted center">Boîte ${c.box} · ${FREQ[c.box-1]}</p>
  <div class="answer">${vAnswer()}</div>`;
}
const vAnswer=()=>S.q.shown
  ?`<button class="btn ko" type="button" data-act="answer" data-ok="0">Je ne savais pas</button><button class="btn ok" type="button" data-act="answer" data-ok="1">Je savais</button>`
  :`<button class="btn acc wide" type="button" data-act="flip">Retourner</button>`;

function vReglages(){
  const e=D.reg.echec;
  return `<div class="card"><h2>En cas d'erreur</h2>
    <label class="opt"><input type="radio" name="echec" value="descend"${e!=='reset'?' checked':''}><span><b>Descendre d'une boîte</b><small>La carte revient un peu plus vite (méthode douce).</small></span></label>
    <label class="opt"><input type="radio" name="echec" value="reset"${e==='reset'?' checked':''}><span><b>Retour en boîte 1</b><small>Leitner classique : la carte repart tous les jours.</small></span></label>
  </div>
  ${vBoxesHelp()}
  <div class="card"><h2>Données</h2>
    <p class="sub">${pl(D.decks.length,'paquet')}, ${pl(D.cards.length,'carte')}. Tout reste sur cet appareil : exporte une sauvegarde pour la garder ou passer sur un autre appareil.</p>
    <div class="row"><button class="btn" type="button" data-act="export">Exporter (JSON)</button><button class="btn" type="button" data-act="import">Importer…</button></div>
    <div class="row"><button class="btn red${S.armed==='wipe'?' armed':''}" type="button" data-act="wipe">${S.armed==='wipe'?'Confirmer : tout effacer':'Tout effacer'}</button></div>
  </div>`;
}

function render(){
  if(S.tab==='paquets'&&S.deck&&!deckOf(S.deck))S.deck=null;
  const rev=!!S.q;
  $('#nav').hidden=rev;
  $$('#nav [data-t]').forEach(b=>b.dataset.t===S.tab?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  const title=rev?(S.q.practice?'Entraînement':'Révision'):TITLES[S.tab];
  const body=rev?vReview():S.tab==='accueil'?vHome():S.tab==='paquets'?(S.deck?vDeck():vDecks()):vReglages();
  $('#main').innerHTML=(rev?'':`<header class="pagehead"><div class="eyebrow">Mémo</div><h1>${esc(title)}</h1></header>`)+body;
  document.title=rev?'Mémo · '+title:'Mémo';
}

/* ---------- Révision ---------- */
function start(deckId,ids,practice){
  ids=ids||shuffle(dueOf(deckId||null).map(c=>c.id));
  if(!ids.length)return toast('Rien à réviser');
  S.q={deck:deckId||null,ids,i:0,shown:false,ok:0,ko:0,failed:[],undo:null,practice:!!practice};
  render(); scrollTo(0,0);
}
function answer(ok){
  const q=S.q, c=cardOf(q.ids[q.i]); if(!c)return;
  const prev=Object.assign({},c), t=today();
  if(!q.practice){
    c.box=ok?Math.min(8,c.box+1):(D.reg.echec==='reset'?1:Math.max(1,c.box-1));
    c.due=iso(addDays(new Date(),INT[c.box-1]));
    c.side=c.side?0:1; // la prochaine fois, l'autre face
    c[ok?'ok':'ko']++; c.last=t;
    const l=D.log[t]||(D.log[t]={ok:0,ko:0}); l[ok?'ok':'ko']++;
    save();
  }
  q[ok?'ok':'ko']++; if(!ok)q.failed.push(c.id);
  q.undo={prev,ok,day:t}; q.i++; q.shown=false;
  render();
}
function undo(){
  const q=S.q, u=q&&q.undo; if(!u)return;
  const c=cardOf(u.prev.id);
  if(c&&!q.practice){Object.assign(c,u.prev);const l=D.log[u.day];if(l){l[u.ok?'ok':'ko']--;if(!l.ok&&!l.ko)delete D.log[u.day]}save()}
  q[u.ok?'ok':'ko']--; if(!u.ok)q.failed.pop();
  q.i--; q.shown=true; q.undo=null;
  render();
}
/* Retourner sans tout redessiner, pour garder l'animation de la carte. */
function flip(){
  const q=S.q; if(!q||q.i>=q.ids.length)return;
  q.shown=!q.shown;
  const f=$('.flash'), a=$('.answer'); if(!f||!a)return render();
  f.classList.toggle('flipped',q.shown); a.innerHTML=vAnswer();
}

/* ---------- Dialogues ---------- */
const dlg=$('#dlg'), dlgf=$('#dlgf');
function openDlg(html){dlgf.innerHTML=html;S.armed=null;dlg.showModal();const f=dlgf.querySelector('input:not([type=radio]),textarea');if(f)f.focus()}
function closeDlg(){if(dlg.open)dlg.close()}

function dlgDeck(id){
  const d=deckOf(id)||{name:'',color:COLORS[D.decks.length%COLORS.length],la:'',lb:''}, n=id?cardsOf(id).length:0;
  openDlg(`<h2>${id?'Modifier le paquet':'Nouveau paquet'}</h2>
    <label class="fld"><span>Nom du thème</span><input id="dn" value="${esc(d.name)}" placeholder="Anglais, Histoire, Capitales…" maxlength="60"></label>
    <div class="fld"><span>Couleur</span><div class="swatches">${COLORS.map(c=>`<label style="--c:${c}"><input type="radio" name="col" value="${c}"${c===d.color?' checked':''}><i></i></label>`).join('')}</div></div>
    <div class="two"><label class="fld"><span>Nom de la face 1</span><input id="dla" value="${esc(d.la)}" placeholder="Recto (ex. Anglais)" maxlength="30"></label><label class="fld"><span>Nom de la face 2</span><input id="dlb" value="${esc(d.lb)}" placeholder="Verso (ex. Français)" maxlength="30"></label></div>
    <div class="row end">${id?`<button class="btn red" type="button" data-act="deldeck" data-d="${id}" data-n="${n}">Supprimer</button><span class="grow"></span>`:''}<button class="btn" type="button" data-act="close">Annuler</button><button class="btn acc" type="button" data-act="savedeck" data-d="${id||''}">Enregistrer</button></div>`);
}
function saveDeck(id){
  const name=$('#dn').value.trim(); if(!name)return $('#dn').focus();
  const color=(dlgf.querySelector('[name=col]:checked')||{}).value||COLORS[0], la=$('#dla').value.trim(), lb=$('#dlb').value.trim();
  let d=deckOf(id);
  if(d)Object.assign(d,{name,color,la,lb});
  else{d={id:uid(),name,color,la,lb};D.decks.push(d);S.tab='paquets';S.deck=d.id;S.filtre='';S.bulk=false}
  save(); closeDlg(); render();
}

function dlgCard(id){
  const c=cardOf(id), d=deckOf(c.deck), [la,lb]=labs(d);
  openDlg(`<h2>Modifier la carte</h2>
    <label class="fld"><span>${esc(la)}</span><textarea id="ca" rows="2">${esc(c.a)}</textarea></label>
    <label class="fld"><span>${esc(lb)}</span><textarea id="cb" rows="2">${esc(c.b)}</textarea></label>
    <div class="two"><label class="fld"><span>Paquet</span><select id="cdeck">${D.decks.map(x=>`<option value="${x.id}"${x.id===c.deck?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>Boîte</span><select id="cbox">${INT.map((_,i)=>`<option value="${i+1}"${i+1===c.box?' selected':''}>${i+1} · ${FREQ[i]}</option>`).join('')}</select></label></div>
    <p class="small muted">Prochaine révision : ${esc(dueTxt(c))}, côté « ${esc(c.side?lb:la)} » d'abord. ${c.ok+c.ko?`Révisée ${pl(c.ok+c.ko,'fois','fois')}, ${c.ok} réussie${c.ok>1?'s':''}.`:'Jamais révisée.'}</p>
    <div class="row end"><button class="btn red" type="button" data-act="delcard" data-c="${id}">Supprimer</button><span class="grow"></span><button class="btn" type="button" data-act="close">Annuler</button><button class="btn acc" type="button" data-act="savecard" data-c="${id}">Enregistrer</button></div>`);
}
function saveCard(id){
  const c=cardOf(id), a=$('#ca').value.trim(), b=$('#cb').value.trim(); if(!a||!b)return toast('Les deux faces sont nécessaires');
  const box=+$('#cbox').value;
  if(box!==c.box){c.box=box;c.due=box===1?today():iso(addDays(new Date(),INT[box-1]))}
  Object.assign(c,{a,b,deck:$('#cdeck').value});
  save(); closeDlg(); render();
}

/* ---------- Actions ---------- */
function arm(k){if(S.armed===k){S.armed=null;return true}S.armed=k;setTimeout(()=>{if(S.armed===k){S.armed=null;dlg.open?resetArmed():render()}},3000);return false}
function resetArmed(){$$('#dlgf .armed').forEach(b=>{b.classList.remove('armed');b.textContent='Supprimer'})}

function addCard(){
  const a=$('#na').value.trim(), b=$('#nb').value.trim();
  if(!a||!b)return toast('Remplis les deux faces');
  D.cards.push(newCard(S.deck,a,b)); save(); render(); $('#na').focus(); toast('Carte ajoutée');
}
function addBulk(){
  const lines=$('#bulk').value.split(/\r?\n/); let n=0, bad=0;
  for(const l of lines){if(!l.trim())continue;const m=l.match(/^(.*?)\s*[;\t]\s*(.*)$/);if(m&&m[1].trim()&&m[2].trim()){D.cards.push(newCard(S.deck,m[1].trim(),m[2].trim()));n++}else bad++}
  if(!n)return toast('Aucune ligne reconnue (format : face 1 ; face 2)');
  save(); S.bulk=false; render(); toast(pl(n,'carte ajoutée','cartes ajoutées')+(bad?` · ${bad} ignorée${bad>1?'s':''}`:''));
}

function exportData(){
  const b=new Blob([JSON.stringify(Object.assign({app:'memo',version:1,exported:new Date().toISOString()},D),null,1)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='memo-'+today()+'.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('#importf').addEventListener('change',e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f)return;
  f.text().then(t=>{
    const x=norm(JSON.parse(t)); if(!x)throw 0;
    if(!confirm(`Remplacer les données actuelles par cette sauvegarde (${pl(x.decks.length,'paquet')}, ${pl(x.cards.length,'carte')}) ?`))return;
    D=x; save(); S.deck=null; render(); toast('Sauvegarde importée');
  }).catch(()=>toast('Fichier invalide'));
});

const ACT={
  tab:b=>{S.tab=b.dataset.t;S.deck=null;S.armed=null;render();scrollTo(0,0)},
  opendeck:b=>{S.tab='paquets';S.deck=b.dataset.d;S.filtre='';S.bulk=false;render();scrollTo(0,0)},
  newdeck:()=>dlgDeck(null),
  editdeck:b=>dlgDeck(b.dataset.d),
  savedeck:b=>saveDeck(b.dataset.d),
  deldeck:b=>{
    if(!arm('deldeck')){b.classList.add('armed');b.textContent=+b.dataset.n?`Confirmer (${pl(+b.dataset.n,'carte')} supprimée${+b.dataset.n>1?'s':''})`:'Confirmer';return}
    const id=b.dataset.d; D.decks=D.decks.filter(d=>d.id!==id); D.cards=D.cards.filter(c=>c.deck!==id); S.deck=null; save(); closeDlg(); render();
  },
  editcard:b=>dlgCard(b.dataset.c),
  savecard:b=>saveCard(b.dataset.c),
  delcard:b=>{if(!arm('delcard')){b.classList.add('armed');b.textContent='Confirmer';return}D.cards=D.cards.filter(c=>c.id!==b.dataset.c);save();closeDlg();render()},
  close:closeDlg,
  addcard:addCard, addbulk:addBulk,
  bulk:()=>{S.bulk=!S.bulk;render();const f=$(S.bulk?'#bulk':'#na');if(f)f.focus()},
  start:b=>start(b.dataset.d),
  flip:flip,
  answer:b=>answer(b.dataset.ok==='1'),
  undo:undo,
  practice:()=>{const ids=shuffle([...new Set(S.q.failed)]);start(S.q.deck,ids,true)},
  quit:()=>{S.q=null;render();scrollTo(0,0)},
  export:exportData,
  import:()=>$('#importf').click(),
  wipe:()=>{if(!arm('wipe'))return render();D=blank();save();S.deck=null;render();toast('Données effacées')},
};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b||b.disabled)return;
  const f=ACT[b.dataset.act]; if(f){e.preventDefault();f(b)}
});
document.addEventListener('change',e=>{if(e.target.name==='echec'){D.reg.echec=e.target.value;save();toast('Réglage enregistré')}});
document.addEventListener('input',e=>{if(e.target.id==='filtre'){S.filtre=e.target.value;$('#cardlist').innerHTML=vCardList()}});
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select'))return e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&e.target.closest('#na,#nb')?addCard():undefined;
  if(!S.q||dlg.open)return;
  const done=S.q.i>=S.q.ids.length;
  if(!done&&(e.key===' '||e.key==='Enter')){e.preventDefault();flip()}
  else if(!done&&S.q.shown&&(e.key==='ArrowRight'||e.key==='1')){e.preventDefault();answer(true)}
  else if(!done&&S.q.shown&&(e.key==='ArrowLeft'||e.key==='2')){e.preventDefault();answer(false)}
  else if(e.key==='Escape'){S.q=null;render()}
});
dlg.addEventListener('click',e=>{if(e.target===dlg)closeDlg()});

let tt; function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2200)}

/* Au retour sur l'appli un autre jour, recalculer les cartes dues. */
let day=today();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&today()!==day){day=today();if(!S.q)render()}});

render();
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
