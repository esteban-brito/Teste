/* game.js — aplicação, estado e interface do draft9-0.
   Dados, avaliação e simulação entram exclusivamente pela API pública. */
import * as PublicEngine from "./src/public/simulation-api.mjs";
const {TEAMS,POOL,forcaTime,simularMapa,simularSerie,forcaDoDia,
  sortearFormaCampanha,distribuirRoles,STYLE_LABEL,STYLE_ID,STYLE_RECIPE,CFG_SIM,
  logistica,srand,rndF,coletarMarcos,atualizarRecordes,manchete,narrativaMVP,
  RECORDE_LABELS}=PublicEngine;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const arred=value=>Math.floor(value+0.4);
const ROLE_COR={IGL:"var(--r-igl)",AWPer:"var(--r-awper)",Entry:"var(--r-entry)",
  Rifler:"var(--r-rifler)",Lurker:"var(--r-lurker)",Support:"var(--r-support)"};
const SPIN_MS=2700; // giro mais rápido (era 4000)
const WIN_INDEX=44;
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const tierOf=o=>o>=22?"tier-h":o>=21?"tier-s":o>=18?"tier-1":o>=15?"tier-2":"tier-3";

/* ——— ÁUDIO · Web Audio sintetizado ————————————————— */
const Audio={ctx:null,mudo:false,master:null,VOL:.65, // master gain: volume geral um pouco mais baixo
  init(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.VOL;this.master.connect(this.ctx["destination"]);}catch{}}
    if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();
    // iOS só libera o áudio se um som tocar DENTRO do gesto do usuário — buffer mudo de 1 amostra
    if(this.ctx&&!this._unlocked){try{const s=this.ctx.createBufferSource();s.buffer=this.ctx.createBuffer(1,1,22050);s.connect(this.master);s.start(0);}catch{}this._unlocked=true;}},
  // tom curto e brilhante (moeda/crédito)
  _blip(f,t,vol=.1,dur=.08,type="square"){const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.02);},
  // sino de cassino: parciais inarmônicas com cauda longa
  _bell(t,base,vol=.12){const ctx=this.ctx;[[1,1],[2.01,.5],[2.99,.32],[4.18,.2]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=base*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.95);});},
  // cascata de moedas caindo: pings rápidos descendentes
  _coins(t,n=10,vol=.07){for(let i=0;i<n;i++){const f=2600-i*120+(Math.random()*200-100);
    this._blip(f,t+i*.045+Math.random()*.012,vol,.06,"triangle");}},
  // ka-CHUNK mecânico: reel travando (thunk grave + estalo do mecanismo)
  _clunk(t,vol=.13){const ctx=this.ctx;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(118,t);o.frequency.exponentialRampToValueAtTime(46,t+.10);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.14);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.16);
    const src=ctx.createBufferSource();src.buffer=this._nz();const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1300;
    const ng=ctx.createGain();ng.gain.setValueAtTime(vol*.85,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(lp).connect(ng).connect(this.master);src.start(t);src.stop(t+.06);},
  // clink metálico: moeda batendo na bandeja (ruído por band-pass ressonante + parcial agudo)
  _clink(t,vol=.05,pitch=1){const ctx=this.ctx;
    const src=ctx.createBufferSource();src.buffer=this._nz();const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=3100*pitch;bp.Q.value=7;
    const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.06);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type="triangle";o.frequency.value=3500*pitch;
    og.gain.setValueAtTime(vol*.6,t);og.gain.exponentialRampToValueAtTime(.0001,t+.035);
    o.connect(og).connect(this.master);o.start(t);o.stop(t+.05);},
  // bandeja de moedas: chuva metálica irregular que rareia (a parte viciante)
  _coinTray(t,n=26,vol=.05){let dt=0;for(let i=0;i<n;i++){const prog=i/n;
    this._clink(t+dt,vol*(0.55+Math.random()*0.6)*(1-prog*0.4),0.8+Math.random()*0.75);
    dt+=(.026+prog*.04)*(0.6+Math.random()*0.9);}},
  // sino metálico de slot antigo (parciais inarmônicas = clang)
  _bellMetal(t,vol=.1){const ctx=this.ctx;[[1,1],[2.76,.55],[5.4,.28],[8.9,.13]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=640*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.6);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.65);});},
  // tick da roleta: click seco de reel + brilho metálico (bola/cilindro de cassino)
  _nz(){if(!this._noise){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*.03);const b=ctx.createBuffer(1,len,ctx.sampleRate);const d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);this._noise=b;}return this._noise;},
  tick(pitch=1){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const src=ctx.createBufferSource();src.buffer=this._nz();
    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1700+1700*pitch;bp.Q.value=1.4;
    const g=ctx.createGain();g.gain.setValueAtTime(.42,t);g.gain.exponentialRampToValueAtTime(.0001,t+.022);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.03);
    this._blip(2400+1400*pitch,t,.05,.035,"triangle");},
  // crédito/seleção: coin-up brilhante
  // JACKPOT de máquina antiga: 3 reels travando (ka-chunk) -> sino metálico -> chuva de moedas na bandeja
  ding(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    this._clunk(t,.09);this._clunk(t+.14,.10);this._clunk(t+.29,.16); // reels parando um a um, o último pesado
    this._bellMetal(t+.34,.11);                                        // sino metálico do prêmio
    this._coinTray(t+.46,30,.055);},                                   // bandeja de moedas (gostoso/viciante)
  // JACKPOT — campeão: arpejo de sinos + cascata de moedas + sino final
  fanfare(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [523,659,784,1047].forEach((f,i)=>this._bell(t+i*.12,f,.12));
    this._coins(t+.25,14,.07);
    this._bell(t+.62,1047,.16);this._blip(1568,t+.62,.08,.5,"triangle");},
  // eliminado: descida abafada de cassino ("não foi dessa vez")
  derrota(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [466,392,311,247].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.setValueAtTime(f,t+i*.16);o.frequency.exponentialRampToValueAtTime(f*.94,t+i*.16+.3);
      g.gain.setValueAtTime(.0001,t+i*.16);g.gain.exponentialRampToValueAtTime(.09,t+i*.16+.04);g.gain.exponentialRampToValueAtTime(.0001,t+i*.16+.5);
      o.connect(g).connect(this.master);o.start(t+i*.16);o.stop(t+i*.16+.55);});},
  // round vencido: blip de moeda (meu=agudo brilhante, adversário=grave seco)
  // ponto marcado: pip macio e curto (sine), claro p/ meu, surdo p/ adversário — não cansa repetindo
  roundWin(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const f=meu?720:380;const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+.04);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(meu?.05:.038,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.14);},
  // momento-chave: tensão de cassino (reels travando num grande prêmio)
  // destaque: realce macio (swell curto de triangle), sem buzz
  impacto(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";
    o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(495,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.3);},
  // fim de jogo: vitória = mini-jackpot (sinos+moedas); derrota = descida menor
  fimJogo(venci){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    if(venci){[659,784,1047].forEach((f,i)=>this._bell(t+i*.1,f,.11));this._coins(t+.2,8,.06);}
    else [440,370,294].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.value=f;const d=t+i*.14;g.gain.setValueAtTime(.0001,d);g.gain.exponentialRampToValueAtTime(.1,d+.03);g.gain.exponentialRampToValueAtTime(.0001,d+.5);
      o.connect(g).connect(this.master);o.start(d);o.stop(d+.55);});}};

const S={
  jogadores:Array(5).fill(null),
  treinador:null,
  drawn:null,
  taken:new Set(),
  sel:null,
  spinning:false,
  justPlaced:null
};

let spinSession=0;

const $=id=>document.getElementById(id);
const roulette=$("roulette"),track=$("track"),picksEl=$("picks"),lineupEl=$("lineup"),lineupCoach=$("lineupCoach");
const hintEl=$("hint"),spinwrap=$("spinwrap"),picksTag=$("picksTag"),picksNote=$("picksNote"),winnerPill=$("winnerPill");
const hint=t=>{hintEl.textContent=t};

// AUTO-FIT do verso do treinador: ajusta a fonte da descrição p/ o MAIOR tamanho que
// preenche a carta sem cortar (cada texto tem comprimento diferente). Mede o .cb-desc
// (que tem o tamanho da carta via .cback position:absolute) e faz busca binária.
function fitText(el,min,max){
  const avail=el.parentElement.clientHeight;         // altura útil do verso (.cback); el cresce com o conteúdo
  if(!avail)return;
  el.style.fontSize=max+"px";
  if(el.scrollHeight<=avail)return;                  // já cabe no máximo
  let lo=min,hi=max;
  for(let i=0;i<14;i++){const m=(lo+hi)/2;el.style.fontSize=m+"px";
    if(el.scrollHeight<=avail)lo=m;else hi=m;}
  el.style.fontSize=lo+"px";
}
// encolhe a fonte de um título até caber em UMA linha (parte do tamanho do CSS; só reduz se precisar).
function fitOneLine(el){
  el.style.fontSize="";                               // volta ao tamanho do CSS (clamp por largura da carta)
  if(el.scrollWidth<=el.clientWidth)return;           // já cabe em 1 linha → mantém o tamanho cheio
  const css=parseFloat(getComputedStyle(el).fontSize)||16;
  let lo=8,hi=css;
  for(let i=0;i<12;i++){const m=(lo+hi)/2;el.style.fontSize=m+"px";
    if(el.scrollWidth<=el.clientWidth)lo=m;else hi=m;}
  el.style.fontSize=lo+"px";
}
function ajustarVersos(){
  document.querySelectorAll(".cb-desc").forEach(el=>{if(el.clientHeight)fitText(el,10,28);});      // treinador: preenche a altura
  document.querySelectorAll(".cb-head").forEach(el=>{if(el.clientWidth)fitOneLine(el);});            // jogador: nome do estilo em 1 linha
}
let _fitRaf;const reajustar=()=>{cancelAnimationFrame(_fitRaf);_fitRaf=requestAnimationFrame(ajustarVersos);};
addEventListener("resize",reajustar);
// re-ajusta quando a fonte web (Barlow) termina de carregar: no mobile ela chega DEPOIS do
// 1º ajuste, mudando a métrica do texto → sem isto, sobra/falta espaço (FOUT).
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajustarVersos);

// MODO VIRAR: quando ativo, clicar numa carta VIRA (frente/verso) em vez de selecioná-la.
let modoVirar=false;
const limparFlips=()=>document.querySelectorAll(".card.flipped,.coachcard.flipped").forEach(c=>c.classList.remove("flipped"));
function setModoVirar(on){
  modoVirar=on;
  const b=$("flipModeBtn");
  if(b){b.classList.toggle("ativo",on);b.setAttribute("aria-pressed",on?"true":"false");b.textContent=on?"Virando ✓":"Virar cartas";}
  if(!on)limparFlips();
}

const teamCardHTML=(t,extra="")=>`<div class="tcard ${extra}" data-team="${esc(t.id)}" style="--col:${esc(t.cor)}">
  <div class="tcoloc">${esc(t.coloc)}</div><div class="tname">${esc(t.nome)}</div><div class="tcamp">${esc(t.camp)}</div></div>`;

const cardClass=p=>p.tipo==="coach"?"coachcard coach-"+p.caracSlug:"card "+tierOf(p.ovr);

const playerHTML=p=>`<div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div><div class="starsig">${p.estrela?"STAR ★ PLAYER":""}</div></div>
  <div class="roles"><span class="role prim" style="--rc:${ROLE_COR[p.prim]}">${esc(p.prim)}</span><span class="role sec${p.secForte?" forte":""}" style="--rc:${ROLE_COR[p.sec]}" title="${p.secForte?"Segunda função de verdade: cobre o pilar por inteiro na química":"Segunda função nominal: cobre o pilar só em parte"}">${esc(p.sec)}</span></div>`;

const coachHTML=p=>`<div class="coach-seal">Treinador</div>
  <div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div></div>
  <div class="carac">${esc(p.carac)}</div>`;

// ——— VERSO da carta: o PLAYSTYLE no topo e as 4 stats da receita dele embaixo ———
// Mesma fonte que decide o OVR e a química, então o que a carta diz é o que o motor usa.
const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",en:"Entrada",tr:"Trade",sn:"AWP"};
const STAT_VERSO_DEF=["fp","op","cl","ut"]; // Coringa (polivalente) e fallback
// eixos da receita (espaço s6) → atributos da carta (espaço do jogador)
const EIXO_ATTR={fogo:"fp",ent:"en",ab:"op",tr:"tr",cl:"cl",ut:"ut"};
/* Ordem das stats no verso: Firepower SEMPRE em primeiro — é a leitura que todo mundo procura
   antes de qualquer outra. Os demais entram por CONTRIBUIÇÃO deste jogador ao estilo dele:
   peso do eixo na receita × o valor que ele tem naquele eixo.

   É o mesmo produto que decide a classificação (a semelhança é um produto-escalar, e os
   denominadores são constantes por jogador, então ordenar por peso×valor ordena por quanto
   cada eixo empurrou o estilo). A carta passa a responder "por onde ESTE jogador expressa o
   estilo" em vez de repetir o que a receita valoriza em tese: dois Closers saem em ordens
   diferentes, um que fecha por clutch puro e outro que fecha no tiro.

   Ordenar pelo valor cru seria outra coisa e estaria errado — 90 de fogo passaria à frente de
   70 de clutch num Âncora, onde o fogo quase não define o estilo. */
const statsDoEstilo=(id,e)=>{
  const rec=id==="joker"?null:STYLE_RECIPE(id);
  if(!rec)return STAT_VERSO_DEF;
  const pesos=rec.ovrW||rec.w; // ovrW quando existe: é o que o nível realmente pondera
  return Object.entries(pesos)
    .map(([eixo,peso])=>({attr:EIXO_ATTR[eixo],contrib:peso*((e&&e[EIXO_ATTR[eixo]])||0)}))
    .filter(x=>x.attr)
    .sort((a,b)=>b.contrib-a.contrib)
    .map(x=>x.attr);
};
const statBar=(lab,v)=>`<div class="statbar"><span class="sb-lab">${esc(lab)}</span><span class="sb-val">${Math.round(v||0)}</span></div>`;
const backPlayer=p=>{const e=p._eng||{};const id=STYLE_ID(e.playstyle);
  const base=statsDoEstilo(id,e);
  const keys=["fp",...base.filter(k=>k!=="fp")].slice(0,4); // Firepower sempre 1º; os outros 3 por contribuição ao estilo
  return `<div class="cb-head">${esc(e.playstyle?STYLE_LABEL(id):(p.prim||""))}</div>`+
  `<div class="cb-stats">${keys.map(k=>statBar(STAT_LABEL[k],e[k])).join("")}</div>`;};
// o que cada característica de treinador FAZ — objetivo, com os números reais do efeito no SINAPSE
const CARAC_DESC={
  Gestor:"Tolera +1 estrela no elenco. Penalidade por estrela extra: 7% → 4%.",
  Desenvolvedor:"Reduz penalidades de elenco cru: 5% por jogador de OVR ≤14, até 18%.",
  Estrategista:"Reduz penalidades de estrutura em 15% e de comando (IGL) em 30%.",
  Motivador:"Reduz em 30% as penalidades de cobertura e saturação do elenco."};
// verso do treinador: só o que a característica FAZ (o nome dela já está na frente da carta)
const backCoach=p=>`<div class="cb-desc">${esc(CARAC_DESC[p.carac]||"")}</div>`;
// jogador vira p/ as stats; treinador vira p/ o significado da característica. Faces giram em 3D.
const cardHTML=p=>{const verso=p.tipo==="coach"?backCoach(p):backPlayer(p);const frente=p.tipo==="coach"?coachHTML(p):playerHTML(p);
  return `<div class="cfaces"><div class="cface cfront">${frente}</div><div class="cface cback">${verso}</div></div>`;};

function elencoCheio(){return S.jogadores.every(Boolean)&&!!S.treinador}

function forcaTotal(){
  return S.jogadores.filter(Boolean).reduce((s,x)=>s+x.ovr,0)||null;
}

// HUD: count-up suave da força total + pulso ao mudar (respeita movimento reduzido)
const _reduzMov=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const _bump=el=>{if(!el||_reduzMov)return;el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump");};
let _pwrCur=0,_pwrRaf=0,_cntPrev=-1;
function animarPwr(val){
  const el=$("pwr");if(!el)return;
  cancelAnimationFrame(_pwrRaf);
  if(val==null){_pwrCur=0;el.textContent="—";return;}
  if(_reduzMov){_pwrCur=val;el.textContent=val;return;}
  const from=_pwrCur||0,to=val,t0=performance.now(),dur=420;
  const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(k<1)_pwrRaf=requestAnimationFrame(step);else _pwrCur=to;};
  _pwrRaf=requestAnimationFrame(step);
  _bump(el);
}
function updateHud(){
  const n=S.jogadores.filter(Boolean).length+(S.treinador?1:0);
  const cnt=$("cnt");cnt.textContent=n+"/6";
  if(_cntPrev!==-1&&n!==_cntPrev)_bump(cnt);
  _cntPrev=n;
  animarPwr(forcaTotal());
  renderResultado();
}

/* ——— UI · cartão de build (selos + veredito; parseia os alertas do motor) ——— */
const SELO_META={Comando:{ic:"◆",lab:"Comando"},AWP:{ic:"◎",lab:"AWP"},"Âncora":{ic:"◈",lab:"Âncora"},
  Iniciativa:{ic:"▲",lab:"Iniciativa"},Estrutura:{ic:"◫",lab:"Estrutura"},Treinador:{ic:"★",lab:"Treinador"},
  Estrelas:{ic:"✦",lab:"Egos"},Excesso:{ic:"⨯",lab:"Saturação"},Desenvolvimento:{ic:"✧",lab:"Lapidação"}};
const pilarDe=t=>{for(const p of["Comando","AWP","Âncora","Iniciativa","Estrutura","Treinador","Estrelas","Desenvolvimento"])if(t.startsWith(p))return p;
  if(/^\d+×/.test(t))return"Excesso";return"—";};
const classificarSelo=t=>{let m=t.match(/\+(\d+)%/);if(m)return{tipo:"bonus",pct:+m[1]};
  m=t.match(/−(\d+)%/);if(m)return{tipo:+m[1]>=12?"grave":"leve",pct:+m[1]};
  if(/falta/.test(t))return{tipo:"neutro",pct:0};return{tipo:"forte",pct:0};};
function construirCartao(alertas,dt){
  const arr=[...alertas,dt!==0?`Treinador ${dt>0?"+":""}${dt}%`:"Treinador"];
  const selos=arr.map(t=>{const c=classificarSelo(t),p=pilarDe(t),m=SELO_META[p]||{ic:"·",lab:p};return{...c,pilar:p,ic:m.ic,lab:m.lab};});
  const val=s=>s.tipo==="forte"?"✓":s.tipo==="neutro"?"—":s.tipo==="bonus"?`+${s.pct}%`:`−${s.pct}%`;
  const ord={grave:0,leve:1,bonus:2,neutro:3,forte:4};
  selos.sort((a,b)=>ord[a.tipo]-ord[b.tipo]||b.pct-a.pct);
  const html=selos.map(s=>`<span class="selo ${s.tipo}"><i>${s.ic}</i>${esc(s.lab)}<b>${val(s)}</b></span>`).join("");
  return html;
}
function renderResultado(){
  const box=$("result");
  if(!elencoCheio()){box.hidden=true;return;}
  // usa os objetos do motor (_eng) p/ química real; cópias + distribuição no contexto do SEU time
  // (cap 2 + AWP) sem corromper os times-fonte de onde os jogadores vieram
  const eng=distribuirRoles(S.jogadores.map(j=>({...j._eng})));
  const r=forcaTime(eng,S.treinador.carac,S.treinador.ovr);
  $("rBruta").textContent=r.bruta;
  $("rQuim").textContent=arred(r.quimica*100)+"%";
  $("rEfet").textContent=r.efetiva;
  const dt=Math.round((r.fatorTreinador-1)*100);
  $("rAlertas").innerHTML=construirCartao(r.alertas,dt);
  box.hidden=false;
}

function updateSpinUI(){
  const pendente=!!S.drawn;
  spinwrap.classList.toggle("gone",pendente||S.spinning||elencoCheio());
  $("respinbtn").hidden=!pendente||S.spinning;
  if(typeof atualizarMajorUI==="function")atualizarMajorUI();
}

function limparHighlights(){
  document.querySelectorAll(".avail,.swp,.sel").forEach(el=>el.classList.remove("avail","swp","sel"));
}

/* ——— UI · roleta (offset medido no DOM, não estimado) ——— */
function offsetParaCentralizar(index){
  track.style.transition="none";
  track.style.transform="translate3d(0,0,0)";
  void track.offsetWidth;
  const alvo=track.children[index];
  if(!alvo)return 0;
  const centroRoleta=roulette.getBoundingClientRect().left+roulette.offsetWidth/2;
  const centroCarta=alvo.getBoundingClientRect().left+alvo.offsetWidth/2;
  return centroRoleta-centroCarta;
}

let spinCleanup=null;
function pararAnimacao(){
  spinSession++;
  if(spinCleanup){spinCleanup();spinCleanup=null;}
  track.style.transition="none";
  track.style.willChange="auto";
  S.spinning=false;
}

function idleTrack(){
  pararAnimacao();
  track.style.transform="translate3d(0,0,0)";
  track.innerHTML=Array.from({length:7},()=>teamCardHTML(pick(TEAMS),"dim")).join("");
}

function abortarSpin(){
  pararAnimacao();
  S.drawn=null;
  limparHighlights();
  renderPicks();
  idleTrack();
  updateSpinUI();
}

function revelarTime(time,winIndex){
  S.drawn=time;
  S.spinning=false;
  track.style.willChange="auto";
  // o card vencedor já está com win/hot pela explosão; só garante o estado dim dos demais
  track.querySelectorAll(".tcard").forEach((el,i)=>{
    if(i!==winIndex){el.classList.add("dim");el.classList.remove("win","hot","tick");}
  });
  renderPicks();
  updateSpinUI();
  hint(`Time sorteado: ${time.nome}${time.camp?" · "+time.camp:""}. Escolha 1 carta.`);
  picksTag.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function sortear(){
  if(S.spinning||elencoCheio()||S.drawn)return;

  Audio.init();
  const sessao=++spinSession;
  S.spinning=true;
  S.sel=null;
  limparHighlights();
  renderPicks();
  updateSpinUI();
  hint("");

  const vencedor=pick(TEAMS);
  const fita=[
    ...Array.from({length:WIN_INDEX},()=>pick(TEAMS)),
    vencedor,
    ...Array.from({length:4},()=>pick(TEAMS))
  ];

  track.style.willChange="transform";
  track.style.transition="none";
  track.style.transform="translate3d(0,0,0)";
  track.innerHTML=fita.map(t=>teamCardHTML(t,"dim")).join("");
  void track.offsetWidth;

  const cardW=track.children[WIN_INDEX].offsetWidth;
  const limite=Math.min(roulette.offsetWidth/2,cardW)*0.4;     // nunca passa do marcador
  const jitter=Math.max(-limite,Math.min(limite,(rnd(20)/100-.1)*cardW));
  const destino=offsetParaCentralizar(WIN_INDEX)+jitter;

  requestAnimationFrame(()=>{
    if(sessao!==spinSession)return;
    track.style.transition=`transform ${SPIN_MS}ms cubic-bezier(.16,.82,.20,1)`; // decel mais limpa, assentamento refinado
    track.style.transform=`translate3d(${destino}px,0,0)`;
  });

  // tick: detecta o card no centro pela posição calculada do transform (barato, sem 49 getBoundingClientRect)
  const cards=[...track.children];
  const gap=parseFloat(getComputedStyle(track).gap)||0;
  const padLeft=parseFloat(getComputedStyle(track).paddingLeft)||0;
  const passo=cardW+gap;
  const centroX=roulette.offsetWidth/2;
  const destinoAbs=Math.abs(destino)||1;
  let ultimoIdx=-1;
  const loopTick=()=>{
    if(sessao!==spinSession||!S.spinning)return;
    const m=new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const idx=Math.round((centroX-m.m41-padLeft-cardW/2)/passo);
    if(idx!==ultimoIdx&&idx>=0&&idx<cards.length){
      ultimoIdx=idx;
      const el=cards[idx];
      el.classList.remove("tick");void el.offsetWidth;el.classList.add("tick");
      Audio.tick(1-Math.min(1,Math.abs(m.m41)/destinoAbs)*.7);   // agudo no início, grave ao chegar
    }
    rafTick=requestAnimationFrame(loopTick);
  };
  let rafTick=requestAnimationFrame(loopTick);

  const finalizar=()=>{
    if(sessao!==spinSession)return;
    cancelAnimationFrame(rafTick);
    track.removeEventListener("transitionend",aoFim);
    clearTimeout(fallback);
    spinCleanup=null;
    S.spinning=false;                                    // para o loop imediatamente
    const carta=track.children[WIN_INDEX];
    const idNaFita=carta?.dataset.team;
    const timeConfirmado=TEAMS.find(t=>t.id===idNaFita)||vencedor;
    // explosão de vitória: glow no card + flash na roleta + ding
    cards.forEach((el,i)=>el.classList.toggle("dim",i!==WIN_INDEX));
    if(carta){carta.classList.remove("dim","tick");carta.classList.add("win","hot");}
    roulette.classList.remove("flash");void roulette.offsetWidth;roulette.classList.add("flash");
    setTimeout(()=>roulette.classList.remove("flash"),520);
    Audio.ding();
    setTimeout(()=>{if(sessao===spinSession)revelarTime(timeConfirmado,WIN_INDEX);},500);
  };

  const aoFim=e=>{
    if(e.target!==track||e.propertyName!=="transform")return;
    finalizar();
  };

  track.addEventListener("transitionend",aoFim);
  const fallback=setTimeout(finalizar,SPIN_MS+350);
  spinCleanup=()=>{track.removeEventListener("transitionend",aoFim);clearTimeout(fallback);};
}

function renderLineup(){
  lineupEl.innerHTML=S.jogadores.map((j,i)=>j
    ?`<div class="${cardClass(j)}${S.justPlaced===String(i)?" land":""}" data-move="${i}" tabindex="0">${cardHTML(j)}</div>`
    :`<div class="slot" data-slot="${i}"><span class="ph">+</span></div>`).join("");
  lineupCoach.innerHTML=S.treinador
    ?`<div class="${cardClass(S.treinador)}${S.justPlaced==="coach"?" land":""}" data-move="coach" tabindex="0">${cardHTML(S.treinador)}</div>`
    :`<div class="slot coach" data-slot="coach"><span class="ph">★</span></div>`;
  S.justPlaced=null;
  if(S.sel)iluminarSlots();
  updateHud();
  ajustarVersos();
}

function renderPicks(){
  if(!S.drawn){
    picksEl.innerHTML="";
    picksTag.hidden=true;
    picksNote.hidden=true;
    winnerPill.textContent="";
    setModoVirar(false); // some o controle junto com as cartas → não vaza o modo pro lineup
    return;
  }
  picksTag.hidden=false;
  picksNote.hidden=false;
  winnerPill.textContent=S.drawn.camp?S.drawn.nome+" · "+S.drawn.camp:S.drawn.nome;
  winnerPill.style.background=`color-mix(in srgb,${S.drawn.cor} 22%,transparent)`;
  winnerPill.style.color=S.drawn.cor;
  winnerPill.style.border=`1px solid color-mix(in srgb,${S.drawn.cor} 45%,transparent)`;

  const cartas=[...S.drawn.jogadores,S.drawn.treinador].filter(Boolean);
  // apelidos já na line: bloqueia jogador repetido (mesmo nick, OVR diferente) na própria seleção
  const nicksNaLine=new Set(S.jogadores.filter(Boolean).map(j=>j.nick));
  picksEl.innerHTML=cartas.map((p,i)=>{
    const preso=S.taken.has(p.id);
    const dup=!preso&&p.tipo!=="coach"&&nicksNaLine.has(p.nick);
    const trava=preso?" taken":dup?" dup":"";
    return`<div class="${cardClass(p)} deal${trava}" data-pick="${esc(p.id)}" ${preso||dup?"":'tabindex="0"'}
      style="--sel:${esc(S.drawn.cor)};animation-delay:${i*55}ms">${cardHTML(p)}</div>`;
  }).join("");
  ajustarVersos();
}

function iluminarSlots(){
  if(!S.sel)return;
  if(S.sel.kind==="coach"){
    const sl=lineupCoach.querySelector('[data-slot="coach"]');
    if(sl){sl.classList.add("avail");sl.tabIndex=0;}
    const mv=lineupCoach.querySelector('[data-move="coach"]');
    if(mv&&S.sel.origem!=="coach")mv.classList.add("swp");
  }else{
    lineupEl.querySelectorAll("[data-slot]").forEach(s=>{s.classList.add("avail");s.tabIndex=0;});
    lineupEl.querySelectorAll("[data-move]").forEach(m=>{
      if(m.dataset.move!==String(S.sel.origem))m.classList.add("swp");
    });
  }
}

function selecionar(origem,kind,card){
  if(S.sel?.origem===origem){
    S.sel=null;limparHighlights();
    hint(S.drawn?`Time sorteado: ${S.drawn.nome}. Escolha 1 carta.`:"");
    return;
  }
  S.sel={origem,kind,card};
  limparHighlights();
  iluminarSlots();
  if(origem==="pick"){
    picksEl.querySelector(`[data-pick="${card.id}"]`)?.classList.add("sel");
  }
}

function concluirPick(){
  S.drawn=null;
  S.sel=null;
  limparHighlights();
  renderLineup();
  renderPicks();
  idleTrack();
  updateSpinUI();
  hint(elencoCheio()?"Elenco completo. Boa sorte no campeonato invicto.":"Sorteie o próximo reforço.");
}

function colocarEm(slot){
  if(!S.sel)return;
  const{origem,kind,card}=S.sel;
  const slotCoach=slot.dataset.slot==="coach";

  if(kind==="coach"){
    if(!slotCoach||origem!=="pick")return;
    S.treinador=card;
    S.taken.add(card.id);
    S.justPlaced="coach";
    return concluirPick();
  }
  if(slotCoach)return;
  const idx=+slot.dataset.slot;
  if(Number.isNaN(idx))return;

  if(origem==="pick"){
    if(S.jogadores.some(j=>j&&j.nick===card.nick)){
      hint(`${card.nick} já está na sua line — não dá pra repetir o mesmo jogador.`);
      return;
    }
    S.jogadores[idx]=card;
    S.taken.add(card.id);
    S.justPlaced=String(idx);
    return concluirPick();
  }
  const orig=+origem;
  if(Number.isNaN(orig)||orig===idx)return;
  [S.jogadores[idx],S.jogadores[orig]]=[S.jogadores[orig],S.jogadores[idx]];
  S.sel=null;
  limparHighlights();
  renderLineup();
  hint("");
}

function trocarCom(el){
  if(!S.sel)return;
  const a=+S.sel.origem,b=+el.dataset.move;
  if(Number.isNaN(a)||Number.isNaN(b)||a===b)return;
  [S.jogadores[a],S.jogadores[b]]=[S.jogadores[b],S.jogadores[a]];
  S.sel=null;
  limparHighlights();
  renderLineup();
  hint("");
}

function resetar(){
  if((S.jogadores.some(Boolean)||S.treinador||S.drawn)&&!confirm("Resetar o elenco e perder o progresso?"))return;
  pararAnimacao();
  Object.assign(S,{jogadores:Array(5).fill(null),treinador:null,drawn:null,sel:null,spinning:false});
  S.taken.clear();
  limparHighlights();
  renderLineup();
  renderPicks();
  idleTrack();
  updateSpinUI();
  hint("Sorteie um time e escolha 1 jogador por rodada.");
}

$("rollbtn").onclick=sortear;
$("mutebtn").onclick=e=>{Audio.init();Audio.mudo=!Audio.mudo;
  e.currentTarget.textContent=Audio.mudo?"🔇":"🔊";
  e.currentTarget.classList.toggle("muted",Audio.mudo);
  if(!Audio.mudo)Audio.tick();};
$("respinbtn").onclick=abortarSpin;
$("resetbtn").onclick=resetar;
$("flipModeBtn").onclick=()=>{setModoVirar(!modoVirar);
  hint(modoVirar?"Modo virar ativo: clique numa carta para ver o verso.":(S.drawn?`Time sorteado: ${S.drawn.nome}. Escolha 1 carta.`:""));};

// TILT COLECIONÁVEL: a carta das picks inclina em 3D seguindo o ponteiro; o foil (CSS) acompanha
// via --mx/--my. Só visual — não interfere no clique/seleção. Desligado em reduced-motion.
const _semTilt=matchMedia("(prefers-reduced-motion:reduce)");
picksEl.addEventListener("pointermove",e=>{
  if(_semTilt.matches)return;
  const c=e.target.closest(".card,.coachcard");if(!c)return;
  const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  c.style.setProperty("--ry",((x-.5)*11).toFixed(2)+"deg");
  c.style.setProperty("--rx",((.5-y)*11).toFixed(2)+"deg");
  c.style.setProperty("--mx",(x*100).toFixed(1)+"%");
  c.style.setProperty("--my",(y*100).toFixed(1)+"%");
});
picksEl.addEventListener("pointerout",e=>{
  const c=e.target.closest(".card,.coachcard");
  if(c&&!(e.relatedTarget&&c.contains(e.relatedTarget)))["--rx","--ry","--mx","--my"].forEach(v=>c.style.removeProperty(v));
});

document.addEventListener("click",e=>{
  if(e.target.closest("#mutebtn,#rollbtn,#respinbtn,#resetbtn,#flipModeBtn"))return; // botões têm handler próprio
  // MODO VIRAR ativo: qualquer carta clicada VIRA (frente/verso), sem selecionar/posicionar
  if(modoVirar){const c=e.target.closest(".card,.coachcard");if(c){c.classList.toggle("flipped");return;}}
  if(S.spinning)return;                                                 // trava interação durante o giro
  const pickEl=e.target.closest("[data-pick]");
  if(pickEl&&picksEl.contains(pickEl)&&!pickEl.classList.contains("taken")&&!pickEl.classList.contains("dup")&&S.drawn){
    const carta=[...S.drawn.jogadores,S.drawn.treinador].filter(Boolean).find(c=>c.id===pickEl.dataset.pick);
    if(!carta)return;
    if(carta.tipo==="coach"&&S.treinador)return hint("Vaga de treinador já ocupada.");
    if(carta.tipo!=="coach"&&S.jogadores.some(j=>j&&j.nick===carta.nick))return hint(`${carta.nick} já está na sua line.`);
    if(carta.tipo!=="coach"&&S.jogadores.every(Boolean))return hint("As 5 vagas estão cheias.");
    selecionar("pick",carta.tipo==="coach"?"coach":"player",carta);
    hint("Clique no slot destacado.");
    return;
  }
  const slot=e.target.closest(".slot.avail");
  if(slot&&S.sel)return colocarEm(slot);
  const swap=e.target.closest(".swp");
  if(swap&&S.sel&&S.sel.origem!=="pick")return trocarCom(swap);
  const move=e.target.closest("[data-move]");
  if(!move)return;
  const isCoach=move.dataset.move==="coach";
  const area=isCoach?lineupCoach:lineupEl;
  if(!area.contains(move))return;
  selecionar(move.dataset.move,isCoach?"coach":"player",isCoach?S.treinador:S.jogadores[+move.dataset.move]);
  hint("Mova para um slot ou troque posições.");
});

document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  if(S.spinning)return;
  if(modoVirar){const c=e.target.closest(".card,.coachcard");if(c){e.preventDefault();c.classList.toggle("flipped");return;}}
  const alvo=e.target.closest("[data-pick]:not(.taken):not(.dup),[data-move],.slot.avail");
  if(!alvo)return;
  e.preventDefault();
  alvo.click();
});

/* ——— UI · telas de torneio (suíça + playoffs) —————— */
const efT=t=>forcaTime(t.jogadores.map(j=>j._eng),t.treinador?.carac,t.treinador?.ovr);
const mono=nome=>nome.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();
const TG={};

function chip(t,perdedor){
  if(!t)return `<div class="team-chip"><div class="team-mono" style="background:#2a3346">?</div><span class="tn">—</span></div>`;
  return `<div class="team-chip${perdedor?" loser":""}"><div class="team-mono" style="background:${t.cor||"#888"}">${mono(t.nome)}</div><span class="tn">${esc(t.nome)}</span></div>`;
}
// monta o objeto-time do jogador a partir do elenco montado
function montarMeuTime(){
  const cartas=S.jogadores.filter(Boolean);
  // cópias dos _eng + distribuição no contexto do SEU time (cap 2 + AWP) — não corrompe os times-fonte.
  // o sim lê cada carta._eng, então as cartas do time apontam pras cópias com as funções do contexto.
  const js=distribuirRoles(cartas.map(p=>({...p._eng})));
  const cartasSim=cartas.map((c,i)=>({...c,_eng:js[i]}));
  const r=forcaTime(js,S.treinador?.carac||null,S.treinador?.ovr||null);
  return {time:{nome:"SEU TIME",cor:"#39d3ff",jogadores:cartasSim},nome:"SEU TIME",cor:"#39d3ff",camp:"",
    ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[],meu:true};
}
function iniciarTorneio(){
  // sorteia 15 dos times (Fisher-Yates) → Major de 16 com o seu time; campo varia a cada run
  const npc=TEAMS.slice();
  for(let i=npc.length-1;i>0;i--){const j=Math.floor(rndF()*(i+1));[npc[i],npc[j]]=[npc[j],npc[i]];}
  // o time NPC que mais compartilha jogadores com o SEU elenco sai do Major (só dá pra excluir 1:
  // melhor esforço contra "donk vs donk"; empate resolve pelo embaralhamento acima)
  const meusNicks=new Set(S.jogadores.filter(Boolean).map(p=>p.nick));
  const overlap=t=>t.jogadores.reduce((n,j)=>n+(meusNicks.has(j.nick)?1:0),0);
  let fora=15,melhor=0;
  npc.forEach((t,i)=>{const o=overlap(t);if(o>melhor){melhor=o;fora=i;}});
  npc.splice(fora,1);
  const base=npc.slice(0,15).map(t=>{const r=efT(t);         // teto de 15 NPC (independe de quantos times existam) → Major sempre 16
    return {time:t,nome:t.nome,cor:t.cor,camp:t.camp,ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[]};});
  base.push(montarMeuTime());
  TG.times=base;TG.rodada=0;TG.classificados=[];TG.eliminados=[];TG.playoffs=null;
  // campanha do jogador: acumula mapas e rating por jogador ao longo do Major
  TG.campanha={mapasV:0,mapasD:0,ratings:{},jornada:[],fim:null};
  sortearFormaCampanha(TG.times); // semeia o "humor" da run: cada Major joga diferente
}
/* ─── PROGRESSO — memória persistente entre campanhas (localStorage, blindado) ───
   Storage indisponível (modo privado/quota) = jogo funciona normal, só não lembra.
   Schema versionado: migrações futuras leem `versao`. Nada aqui toca a simulação. */
const PROGRESSO={
  KEY:"draft90.progresso.v1",
  dados:null,
  vazio(){return {versao:1,titulos:[],recordes:{},contadores:{campanhas:0,titulos:0,invictos:0}};},
  valido(d){return d&&d.versao===1&&Array.isArray(d.titulos)&&d.recordes&&d.contadores;},
  carregar(){let d;try{d=JSON.parse(localStorage.getItem(this.KEY));}catch{d=null;}
    this.dados=this.valido(d)?d:this.vazio();},
  salvar(){try{localStorage.setItem(this.KEY,JSON.stringify(this.dados));}catch{/* sem storage: segue sem memória */}},
  exportar(){const blob=new window.Blob([JSON.stringify(this.dados,null,1)],{type:"application/json"});
    const a=document.createElement("a");a.href=window.URL.createObjectURL(blob);a.download="draft9-0-progresso.json";
    document.body.appendChild(a);a.click();window.URL.revokeObjectURL(a.href);a.remove();},
  importar(texto){let d;try{d=JSON.parse(texto);}catch{return false;}
    if(!this.valido(d))return false;this.dados=d;this.salvar();return true;}
};
PROGRESSO.carregar();
const dataHoje=()=>new Date().toISOString().slice(0,10);
// banner de manchete + celebração de recordes no fim do mapa (some no início do próximo)
function mostrarManchete(jogo,novosRecordes){
  const el=$("manchetePosMapa");if(!el)return;
  const h=manchete(jogo);
  const chips=(novosRecordes||[]).map(n=>`<span class="rec-chip">🏆 ${esc(n.nick?n.nick+" · ":"")}${n.v} ${esc(n.label)}</span>`).join("");
  el.innerHTML=`<span class="manchete-tag">MANCHETE</span><span class="manchete-tx">${esc(h.texto)}</span>${chips?`<span class="manchete-recs">${chips}</span>`:""}`;
  el.hidden=false;
}
// registra os mapas de uma partida jogada pelo jogador (acumula rating por jogador do seu time)
function registrarPartida(jogo){
  const c=TG.campanha;if(!c)return;
  const meuStats=jogo.meuA?jogo.statsA:(jogo.meuB?jogo.statsB:null);if(!meuStats)return;
  const meuSc=jogo.meuA?jogo.placar[0]:jogo.placar[1],advSc=jogo.meuA?jogo.placar[1]:jogo.placar[0];
  const meuVenceu=meuSc>advSc;
  meuVenceu?c.mapasV++:c.mapasD++;
  meuStats.forEach(s=>{const e=c.ratings[s.nick]=c.ratings[s.nick]||{r:[],k:0,d:0,a:0};
    e.r.push(s.rating);e.k+=s.k;e.d+=s.d;e.a+=(s.a||0);});
  if(!c.jornada)c.jornada=[];
  const adv=(typeof MATCH!=="undefined"&&MATCH.B)?MATCH.B.nome:"???";
  c.jornada.push({adv,meu:meuSc,dele:advSc,venc:meuVenceu});
  // MEMÓRIA: marcos do mapa competem com os recordes persistentes; manchete conta a história
  const marcos=coletarMarcos(jogo);
  let novos=[];
  if(marcos){novos=atualizarRecordes(PROGRESSO.dados.recordes,marcos,{data:dataHoje()});
    if(novos.length)PROGRESSO.salvar();}
  mostrarManchete(jogo,novos);
}
// grava a campanha encerrada no progresso persistente (uma vez por campanha)
function registrarCampanhaNoProgresso(c,campeao,rt,roster){
  if(c._registrado)return;c._registrado=true;
  const P=PROGRESSO.dados;
  P.contadores.campanhas++;
  if(campeao){
    P.contadores.titulos++;
    const invicto=c.mapasD===0;if(invicto)P.contadores.invictos++;
    const mvp=rt&&rt[0];
    P.titulos.push({data:dataHoje(),placar:`${c.mapasV}-${c.mapasD}`,invicto,
      elenco:Object.keys(roster||{}),
      treinador:(typeof S!=="undefined"&&S.treinador&&S.treinador.nick)||null,
      mvp:mvp?{nick:mvp.nick,media:+mvp.r.toFixed(2)}:null});
  }
  PROGRESSO.salvar();
}
// detecta fim de campanha e abre a tela final (campeão ou eliminado)
function checarFimDeCampanha(){
  const c=TG.campanha;if(!c||c.fim)return false;
  const meu=TG.times.find(t=>t.meu);if(!meu)return false;
  const P=TG.playoffs;
  if(P&&P.campeao){c.fim=P.campeao.meu?"campeao":"eliminado";telaFinal();return true;}
  if(TG.eliminados.some(t=>t.meu)){c.fim="eliminado";telaFinal();return true;}
  return false;
}
function telaFinal(){
  const c=TG.campanha;const campeao=c.fim==="campeao";
  const meuTime=TG.times&&TG.times.find(t=>t.meu);
  const jogs=(meuTime&&meuTime.time&&meuTime.time.jogadores)||[];
  const roster={};jogs.forEach(j=>{if(j&&j._eng)roster[j._eng.nick]=j._eng;});
  const ROLE={Entry:{a:"ENT",c:"var(--r-entry)"},Rifler:{a:"RIF",c:"var(--r-rifler)"},AWPer:{a:"AWP",c:"var(--r-awper)"},Lurker:{a:"LUR",c:"var(--r-lurker)"},Support:{a:"SUP",c:"var(--r-support)"},IGL:{a:"IGL",c:"var(--r-igl)"}};
  const fx=r=>r>=1.15?"r-top":r>=0.95?"r-mid":"r-low";
  const barW=r=>Math.round(clamp((r-.6)/1.4,0,1)*100);
  const rt=Object.entries(c.ratings).map(([nick,e])=>({nick,r:e.r.reduce((a,b)=>a+b,0)/e.r.length,k:e.k,d:e.d,a:e.a||0,best:Math.max.apply(null,e.r)})).sort((a,b)=>b.r-a.r);
  const mvp=rt[0];
  $("finalTitulo").textContent=campeao?"CAMPEÃO DO MAJOR":"FIM DA CAMPANHA";
  const selos=campeao?(c.mapasD===0?["CAMPEÃO","9-0 INVICTO"]:["CAMPEÃO"]):["ELIMINADO"];
  $("finalSelos").innerHTML=selos.map(x=>`<span class="selo-final${x.indexOf("INVICTO")>=0?" selo-gold":""}">${esc(x)}</span>`).join("");
  if(mvp){const e=roster[mvp.nick]||{};const rl=ROLE[e.primario]||{a:"",c:"#6c7d93"};
    const nv=narrativaMVP(c); // arco da campanha em texto (puro, determinístico)
    $("finalMvpCard").style.display="";
    $("finalMvpCard").innerHTML=`<div class="mvp-badge">MVP</div>`+
      `<div class="mvp-id">${e.pais?`<span class="mvp-flag">${esc(e.pais)}</span>`:""}<span class="mvp-nick">${esc(mvp.nick)}</span>`+
      `${rl.a?`<span class="mvp-role" style="--rc:${rl.c}">${rl.a}</span>`:""}${e.ovr!=null?`<span class="mvp-ovr">OVR ${e.ovr}</span>`:""}</div>`+
      `<div class="mvp-stats">${mvp.k} / ${mvp.d} / ${mvp.a} <span>K·D·A</span></div>`+
      `<div class="mvp-rate ${fx(mvp.r)}">${mvp.r.toFixed(2)}</div>`+
      (nv?`<div class="mvp-narrativa">${esc(nv.texto)}</div>`:"");
  } else $("finalMvpCard").style.display="none";
  registrarCampanhaNoProgresso(c,campeao,rt,roster); // MEMÓRIA: campanha entra no Hall da Fama
  const jor=c.jornada||[];
  $("finalJornada").innerHTML=jor.length?`<div class="sec-lbl">A JORNADA</div><div class="jor-tiles">`+jor.map(m=>`<div class="jt ${m.venc?"jt-w":"jt-l"}"><span class="jt-adv">${esc(String(m.adv||"").slice(0,4))}</span><span class="jt-sc">${m.meu}-${m.dele}</span></div>`).join("")+`</div>`:"";
  $("finalRatings").innerHTML=`<div class="sec-lbl">ELENCO</div>`+rt.map((pp,i)=>{const e=roster[pp.nick]||{};const rl=ROLE[e.primario]||{a:"",c:"#6c7d93"};const md=i===0?"md-g":i===1?"md-s":i===2?"md-b":"";
    return `<div class="fr-row${i===0?" mvp":""}"><span class="fr-pos ${md}">${i+1}</span><span class="fr-role"${rl.a?` style="--rc:${rl.c}"`:""}>${rl.a}</span><span class="fr-nick">${esc(pp.nick)}</span><span class="fr-ovr">${e.ovr!=null?e.ovr:""}</span><span class="fr-bar"><i style="width:${barW(pp.r)}%"></i></span><span class="fr-rate ${fx(pp.r)}">${pp.r.toFixed(2)}</span></div>`;}).join("");
  const bestMap=rt.reduce((mx,pp)=>Math.max(mx,pp.best||0),0);
  const margem=jor.filter(m=>m.venc).reduce((mx,m)=>Math.max(mx,m.meu-m.dele),0);
  const recs=[[`${c.mapasV}-${c.mapasD}`,"mapas"]];if(bestMap)recs.push([bestMap.toFixed(2),"melhor mapa"]);if(margem)recs.push(["+"+margem,"maior margem"]);
  $("finalRec").innerHTML=recs.map(r=>`<div class="rec"><span class="rec-v">${r[0]}</span><span class="rec-l">${r[1]}</span></div>`).join("");
  const ov=$("finalOverlay");ov.classList.remove("is-champ","is-elim");ov.classList.add(campeao?"is-champ":"is-elim");
  abrir("finalOverlay");
  Audio.init();campeao?Audio.fanfare():Audio.derrota();
  const pl=$("finalPlacar");const draw=v=>{pl.innerHTML=`<b>${v}</b><span>—</span><b>${c.mapasD}</b>`;};
  let n=0;draw(0);const passo=()=>{if(n<c.mapasV){n++;draw(n);setTimeout(passo,80);}};setTimeout(passo,300);
}
function suicaCompleta(){return TG.times&&TG.classificados.length>=8;}

function avancarSuica(){
  if(!TG.times||suicaCompleta())return;
  TG.rodada++;
  const ativos=TG.times.filter(t=>t.vivo);
  const buckets={};ativos.forEach(t=>{const k=t.v+"-"+t.d;(buckets[k]=buckets[k]||[]).push(t);});
  // monta os pares da rodada; separa o do jogador
  const pares=[];let parDoJogador=null;
  const jaJogaram=(x,y)=>(x.opps||[]).includes(y);
  Object.values(buckets).forEach(g=>{const a=[...g];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(rndF()*(i+1));[a[i],a[j]]=[a[j],a[i]];} // Fisher-Yates (sort(rnd-.5) é enviesado)
    // anti-rematch (real: suíça evita reencontros): se o par já se enfrentou, troca com alguém à frente
    for(let i=0;i<a.length-1;i+=2){
      if(jaJogaram(a[i],a[i+1]))for(let j=i+2;j<a.length;j++){if(!jaJogaram(a[i],a[j])){[a[i+1],a[j]]=[a[j],a[i+1]];break;}}
    }
    for(let i=0;i<a.length-1;i+=2){const par=[a[i],a[i+1]];
      a[i].opps=a[i].opps||[];a[i+1].opps=a[i+1].opps||[];a[i].opps.push(a[i+1]);a[i+1].opps.push(a[i]);
      if(a[i].meu||a[i+1].meu)parDoJogador=par;else pares.push(par);}
    if(a.length%2)a[a.length-1]._bye=true;
  });
  // jogo DECISIVO (real: classificação/eliminação é MD3): alguém do par está a 1 mapa de sair ou passar
  const decisivo=(x,y)=>x.v===2||x.d===2||y.v===2||y.d===2;
  // resolve os outros jogos (rápido, no fundo); decisivos = melhor-de-3 moedas (favorece o mais forte)
  const resolverPar=([x,y])=>{
    let wx=0,wy=0;const need=decisivo(x,y)?2:1;
    while(wx<need&&wy<need){
      const pX=logistica(forcaDoDia(x.ef,x.quim),forcaDoDia(y.ef,y.quim),CFG_SIM.D_MAPA);
      rndF()<pX?wx++:wy++;}
    const vc=wx>wy?x:y,pd=wx>wy?y:x;vc.v++;pd.d++;vc.hist.push("V");pd.hist.push("D");
  };
  const finalizarRodada=()=>{
    ativos.forEach(t=>{if(t._bye){t.v++;delete t._bye;}});
    TG.times.forEach(t=>{if(t.vivo&&t.v>=3){t.vivo=false;TG.classificados.push(t);}
      else if(t.vivo&&t.d>=3){t.vivo=false;TG.eliminados.push(t);}});
    renderSwiss();
  };
  // se o jogador joga nesta rodada, abre a partida; os outros resolvem ao fim dela
  if(parDoJogador){
    const [a,b]=parDoJogador;const meu=a.meu?a:b,adv=a.meu?b:a;
    const md=decisivo(meu,adv)?3:1; // real: jogos de classificação/eliminação são MD3
    const ctx=`Rodada ${TG.rodada} · Fase Suíça · você está ${meu.v}-${meu.d}${md===3?" · DECISIVO (MD3)":""}`;
    fechar("suicaOverlay");
    abrirPartida(meu,adv,md,ctx,(venc)=>{
      // aplica o resultado da SUA partida
      const meuVenceu=venc===meu; // identidade por referência (robusto a nomes iguais: 2 Spirit/FURIA)
      (meuVenceu?meu:adv).v++;(meuVenceu?adv:meu).d++;
      meu.hist.push(meuVenceu?"V":"D");adv.hist.push(meuVenceu?"D":"V");
      pares.forEach(resolverPar);
      finalizarRodada();
      if(!checarFimDeCampanha())abrir("suicaOverlay");
    });
  }else{
    pares.forEach(resolverPar);
    finalizarRodada();
  }
}
function renderSwiss(){
  $("suicaSub").textContent=suicaCompleta()?"· classificação definida":`· rodada ${TG.rodada}`;
  const records=["0-0","1-0","0-1","2-0","1-1","0-2","2-1","1-2","2-2"];
  let html="";
  records.forEach(rec=>{
    const [v,d]=rec.split("-").map(Number);
    const grupo=TG.times.filter(t=>t.v===v&&t.d===d&&t.vivo);
    if(!grupo.length)return;
    html+=`<div class="swiss-col"><div class="swiss-colhead neutral">${v}:${d}</div>`+
      grupo.map(t=>`<div class="match${t.meu?" mine":""}">${chip(t)}</div>`).join("")+`</div>`;
  });
  // classificados (verde) e eliminados (vermelho)
  html+=`<div class="swiss-col"><div class="swiss-colhead qual">Classificados</div>`+
    Array.from({length:8},(_,i)=>{const t=TG.classificados[i];
      return `<div class="qualified-slot${t?"":" empty"}${t?.meu?" mine":""}">${t?chip(t):'<span class="tn empty-tn">—</span>'}</div>`;}).join("")+`</div>`;
  html+=`<div class="swiss-col"><div class="swiss-colhead elim">Eliminados</div>`+
    Array.from({length:8},(_,i)=>{const t=TG.eliminados[i];
      return `<div class="qualified-slot elim-slot${t?"":" empty"}${t?.meu?" mine":""}">${t?chip(t):'<span class="tn empty-tn">—</span>'}</div>`;}).join("")+`</div>`;
  $("swissBoard").innerHTML=html;
  // controles: avançar some quando acaba; botão de ir aos playoffs aparece SÓ aqui, após classificação
  $("suicaAvancar").hidden=suicaCompleta();
  $("suicaPlayoffs").hidden=!suicaCompleta();
}

// ---- Playoffs ----
function garantirPlayoffs(){
  if(TG.playoffs)return;
  // seed pelo RESULTADO da suíça: 3-0 na frente de 3-1, 3-1 na frente de 3-2, força só como
  // desempate. É como um Major real chaveia, e semear por força punia quem passou invicto.
  const seeds=[...TG.classificados].slice(0,8).sort((a,b)=>a.d-b.d||b.ef-a.ef);
  TG.playoffs={seeds,
    quartas:[[seeds[0],seeds[7]],[seeds[3],seeds[4]],[seeds[1],seeds[6]],[seeds[2],seeds[5]]],
    semi:[null,null,null,null],final:[null,null],campeao:null,fase:0,res:{}};
}
function avancarPlayoff(){
  const P=TG.playoffs;if(!P||P.campeao)return;
  const fd=t=>()=>forcaDoDia(t.ef,t.quim);
  // resolve a série e guarda o SEED vencedor por referência (robusto a times homônimos)
  const jogar=(a,b)=>{const r=simularSerie(a.time,b.time,fd(a),fd(b),3,true);r.vencedorSeed=r.vencedor===a.time?a:b;return r;}; // leve: série NPC, ninguém assiste
  // pares da fase atual
  let pares,aplicar;
  if(P.fase===0){
    pares=P.quartas.map((p,i)=>({par:p,key:"q"+i}));
    aplicar=()=>{P.semi=P.quartas.map((p,i)=>P.res["q"+i].vencedorSeed);P.fase=1;};
  }else if(P.fase===1){
    pares=[{par:[P.semi[0],P.semi[1]],key:"s0"},{par:[P.semi[2],P.semi[3]],key:"s1"}];
    aplicar=()=>{P.final=[P.res.s0.vencedorSeed,P.res.s1.vencedorSeed];P.fase=2;};
  }else{
    pares=[{par:[P.final[0],P.final[1]],key:"f"}];
    aplicar=()=>{P.campeao=P.res.f.vencedorSeed;P.fase=3;};
  }
  // separa a série do jogador
  const meuPar=pares.find(({par})=>par[0]?.meu||par[1]?.meu);
  const outros=pares.filter(x=>x!==meuPar);
  const faseNome=["Quartas de final","Semifinal","Grande Final"][P.fase];
  if(meuPar){
    const [a,b]=meuPar.par;const meu=a.meu?a:b,adv=a.meu?b:a;
    fechar("playoffOverlay");
    abrirPartida(meu,adv,3,`${faseNome} · Playoffs · melhor de 3`,(venc,placar)=>{
      // placar vem como [vMeu, vAdv]; mapeia pra ordem [a,b] do par do bracket
      const [vMeu,vAdv]=placar;
      const pa=(a.meu?vMeu:vAdv),pb=(b.meu?vMeu:vAdv);
      P.res[meuPar.key]={vencedorNome:venc.nome,placarSerie:[pa,pb],vencedorSeed:venc};
      outros.forEach(({par,key})=>{P.res[key]=jogar(par[0],par[1]);});
      aplicar();renderBracket();
      const meuPerdeu=venc!==meu;
      if(meuPerdeu&&TG.campanha){TG.campanha.fim="eliminado";telaFinal();}
      else if(P.campeao&&P.campeao.meu){TG.campanha.fim="campeao";telaFinal();}
      else abrir("playoffOverlay");
    });
  }else{
    outros.forEach(({par,key})=>{P.res[key]=jogar(par[0],par[1]);});
    aplicar();renderBracket();
  }
}
function serieEl(a,b,key,fase,faseAtual){
  const P=TG.playoffs,r=P&&P.res[key];
  const pendente=!a||!b;
  const aWin=r&&r.vencedorSeed===a,bWin=r&&r.vencedorSeed===b;
  const ativa=!pendente&&!r&&fase===faseAtual;
  return `<div class="series${(a?.meu||b?.meu)?" mine":""}${r?" done":""}${ativa?" ativa":""}">
    <div class="series-row${aWin?" win":""}${r&&!aWin?" lose":""}">${chip(a)}<span class="sc">${r?r.placarSerie[0]:""}</span></div>
    <div class="series-sep"></div>
    <div class="series-row${bWin?" win":""}${r&&!bWin?" lose":""}">${chip(b)}<span class="sc">${r?r.placarSerie[1]:""}</span></div></div>`;
}
function renderBracket(){
  const P=TG.playoffs;
  $("playoffSub").textContent=P.campeao?"· campeão coroado":["· quartas de final","· semifinais","· grande final"][P.fase]||"";
  $("bracketBoard").innerHTML=`
    <div class="bracket-round">
      <div class="bracket-round-title">Quartas</div>
      ${P.quartas.map((p,i)=>serieEl(p[0],p[1],"q"+i,0,P.fase)).join("")}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Semifinais</div>
      ${serieEl(P.semi[0],P.semi[1],"s0",1,P.fase)}
      ${serieEl(P.semi[2],P.semi[3],"s1",1,P.fase)}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Final</div>
      ${serieEl(P.final[0],P.final[1],"f",2,P.fase)}
    </div>
    <div class="bracket-round champ-col">
      <div class="bracket-round-title">Campeão</div>
      <div class="champion${P.campeao?" crowned":""}">
        ${P.campeao?`<div class="cup-tag">CAMPEÃO</div>${chip(P.campeao)}<div class="champ-tag">${P.campeao.meu?"VOCÊ É CAMPEÃO":"Campeão do Major"}</div>`
          :`<div class="cup-tag dim">—</div><div class="champ-wait">aguardando…</div>`}
      </div>
    </div>`;
  $("playoffAvancar").hidden=!!P.campeao;
}

function abrir(id){const el=$(id);if(el._fechando){clearTimeout(el._fechando);el._fechando=null;}el.classList.remove("fechando");el.hidden=false;document.body.style.overflow="hidden";}
function fechar(id){const el=$(id);document.body.style.overflow="";el.classList.add("fechando");if(el._fechando)clearTimeout(el._fechando);el._fechando=setTimeout(()=>{el.hidden=true;el.classList.remove("fechando");el._fechando=null;},190);}
// troca antessala<->scoreboard com fade-in
function mostrarTela(id){const el=$(id);el.classList.remove("is-hidden");el.classList.remove("tela-in");void el.offsetWidth;el.classList.add("tela-in");}
function abrirSuica(){if(!TG.times)iniciarTorneio();renderSwiss();abrir("suicaOverlay");}
function abrirPlayoffs(){garantirPlayoffs();renderBracket();fechar("suicaOverlay");abrir("playoffOverlay");}

$("suicabtn").onclick=abrirSuica;
$("suicaFechar").onclick=()=>fechar("suicaOverlay");
$("suicaAvancar").onclick=avancarSuica;
$("suicaPlayoffs").onclick=abrirPlayoffs;
$("playoffFechar").onclick=()=>fechar("playoffOverlay");
$("playoffAvancar").onclick=avancarPlayoff;
// mostra a seção do Major só quando o elenco estiver completo
/* ——— UI · reprodutor de partida (cinematográfico) ——— */
// ritmo dos rounds: pulso legível e mais pausado (rounds correm devagar pra acompanhar)
const RITMO={base:260,troca:1000,inicio:500};
const MP={ativo:false,timer:null,onFim:null,gen:0,jogo:null,ctx:""};

function monoChip(nome,cor){return `<div class="team-mono" style="background:${cor||"#888"}">${mono(nome)}</div>`;}

function reproduzirMapa(jogo,A,B,contexto){
  // invalida qualquer reprodução anterior: cancela timer e incrementa a geração
  clearTimeout(MP.timer);
  const meuGen=++MP.gen;
  MP.ativo=true;MP.jogo=jogo;MP.ctx=contexto;
  $("matchContinue").hidden=true;$("matchSkip").hidden=false;
  $("roundStrip").innerHTML="";
  const aMine=!!A.meu,bMine=!!B.meu;
  $("sbTeamA").className="sb-team sb-a"+(aMine?" mine":"");
  $("sbTeamB").className="sb-team sb-b"+(bMine?" mine":"");
  $("sbTeamA").innerHTML=monoChip(A.nome,A.cor)+`<div class="sb-info"><span class="sb-name">${esc(A.nome)}</span>${A.camp?`<span class="sb-camp">${esc(A.camp)}</span>`:""}<span class="sb-side ct" id="sideA">CT</span></div>`;
  $("sbTeamB").innerHTML=monoChip(B.nome,B.cor)+`<div class="sb-info"><span class="sb-name">${esc(B.nome)}</span>${B.camp?`<span class="sb-camp">${esc(B.camp)}</span>`:""}<span class="sb-side tr" id="sideB">TR</span></div>`;
  $("sbScoreA").textContent="0";$("sbScoreB").textContent="0";
  $("sbMap").textContent=jogo.mapa;$("sbProgress").style.width="0%";
  const bm=$("manchetePosMapa");if(bm){bm.hidden=true;bm.innerHTML="";} // manchete é do mapa FECHADO
  montarScoreboard(jogo); // tabela inicial dos 10 jogadores (zerada)
  // cacheia os elementos quentes do loop (evita $() por round)
  const elProg=$("sbProgress"),elRS=$("roundStrip"),elScA=$("sbScoreA"),elScB=$("sbScoreB"),elSideA=$("sideA"),elSideB=$("sideB");
  const total=jogo.rounds.length;
  let i=0;
  const passo=()=>{
    if(meuGen!==MP.gen||!MP.ativo)return; // timer órfão de outra reprodução: ignora
    if(i>=total)return finalizarReproducao(jogo,meuGen);
    const rd=jogo.rounds[i];
    const ladoVenc=rd.venceA?rd.ladoA:rd.ladoB;
    if(rd.venceA)setScore(elScA,rd.pa,ladoVenc);else setScore(elScB,rd.pb,ladoVenc);
    elProg.style.width=Math.round((i+1)/total*100)+"%";
    addCelula(rd,ladoVenc,elRS);
    Audio.roundWin(rd.venceA?aMine:bMine);
    if(rd.troca){elSideA.className="sb-side tr";elSideA.textContent="TR";
      elSideB.className="sb-side ct";elSideB.textContent="CT";}
    atualizarScoreboard(jogo,rd); // atualiza K-D e pulsa quem fragou
    if(rd.destaque)Audio.impacto(false);
    i++;
    MP.timer=setTimeout(passo,rd.troca?RITMO.troca:RITMO.base);
  };
  MP.timer=setTimeout(passo,RITMO.inicio);
}
function setScore(elOrId,val,lado){const el=typeof elOrId==="string"?$(elOrId):elOrId;el.textContent=val;
  el.classList.remove("bump","flash-ct","flash-tr");void el.offsetWidth;
  el.classList.add("bump",lado==="CT"?"flash-ct":"flash-tr");}
function addCelula(rd,lado,strip){
  const s=strip||$("roundStrip");const c=document.createElement("div");
  c.className=`rs-cell pop ${lado==="CT"?"ct":"tr"}${rd.destaque?" key":""}`;
  s.appendChild(c);
}
// monta a tabela inicial do scoreboard (10 jogadores, K-D zerado)
function montarScoreboard(jogo){
  const linha=(s,meu)=>`<div class="ls-row${meu?" mine":""}" data-nick="${esc(s.nick)}">
    <span class="ls-nick">${esc(s.nick)}</span>
    <span class="ls-kd-val"><b>0</b> <s>/</s> 0</span>
    <span class="ls-kast">–</span>
    <span class="ls-adr">–</span>
    <span class="ls-rate">–</span></div>`;
  const head=(nome,meu,lado,cor)=>`<div class="ls-head">
    <span class="ls-team-id"><span class="ls-mono" style="background:${esc(cor||"#888")}">${esc(mono(nome))}</span><span class="ls-team">${esc(nome)}</span><span class="ls-side-tag ${lado}">${lado.toUpperCase()}</span></span>
    <span class="ls-col">K–D</span>
    <span class="ls-col">KAST</span>
    <span class="ls-col">ADR</span>
    <span class="ls-col">Rating</span></div>`;
  $("lsSideA").className="ls-side"+(jogo.meuA?" mine":"");
  $("lsSideB").className="ls-side"+(jogo.meuB?" mine":"");
  $("lsSideA").innerHTML=head(jogo.nomeA,jogo.meuA,"ct",jogo.corA)+jogo.statsA.map(s=>linha(s,jogo.meuA)).join("");
  $("lsSideB").innerHTML=head(jogo.nomeB,jogo.meuB,"tr",jogo.corB)+jogo.statsB.map(s=>linha(s,jogo.meuB)).join("");
  // cacheia linhas e células uma vez (evita re-query a cada round)
  const cacheLado=sideId=>[...$(sideId).querySelectorAll(".ls-row")].map(r=>({row:r,kd:r.querySelector(".ls-kd-val"),kast:r.querySelector(".ls-kast"),adr:r.querySelector(".ls-adr"),rate:r.querySelector(".ls-rate")}));
  MP.sb={A:cacheLado("lsSideA"),B:cacheLado("lsSideB")};
}
// atualiza o K-D do scoreboard até o round atual e pulsa quem fragou
function atualizarScoreboard(jogo,rd){
  if(!MP.sb)return;
  const upd=(cells,stats,snap)=>{
    snap.forEach((s,idx)=>{
      const c=cells[idx];if(!c)return;
      c.kd.innerHTML=`<b>${s.k}</b> <s>/</s> ${s.d}`;
      if(stats[idx].nick===rd.destaque){c.row.classList.remove("frag");void c.row.offsetWidth;c.row.classList.add("frag");}
    });
  };
  upd(MP.sb.A,jogo.statsA,rd.snapA);
  upd(MP.sb.B,jogo.statsB,rd.snapB);
}
function finalizarReproducao(jogo,meuGen){
  if(meuGen!==MP.gen)return; // reprodução já substituída
  MP.ativo=false;
  $("sbScoreA").textContent=jogo.placar[0];$("sbScoreB").textContent=jogo.placar[1];
  $("sbProgress").style.width="100%";
  Audio.fimJogo(!!jogo.vencedor.meu);
  // scoreboard com os stats finais (K-D completo)
  const ult=jogo.rounds[jogo.rounds.length-1];
  if(ult)atualizarScoreboard(jogo,ult);
  // rating + KAST + ADR do mapa: aparecem só agora, no fim (K–D já animou ao vivo)
  const preencheFinais=(cells,stats)=>{if(!cells)return;
    stats.forEach((st,idx)=>{const c=cells[idx];if(!c)return;
      if(c.kast)c.kast.textContent=Math.round((st.kast||0)*100)+"%";
      if(c.adr)c.adr.textContent=(st.adr!=null?st.adr:"–");
      if(c.rate){c.rate.textContent=st.rating.toFixed(2);c.rate.className="ls-rate "+(st.rating>=1.15?"r-top":st.rating>=0.95?"r-mid":"r-low");}});};
  if(MP.sb){preencheFinais(MP.sb.A,jogo.statsA);preencheFinais(MP.sb.B,jogo.statsB);}
  $("matchSkip").hidden=true;$("matchContinue").hidden=false;
  if(MP.onFim){const cb=MP.onFim;MP.onFim=null;cb();} // dispara só uma vez
}
// pula direto pro resultado do mapa em curso (renderiza tudo de uma vez)
function pularMapa(){
  if(!MP.ativo||!MP.jogo)return;
  const jogo=MP.jogo;clearTimeout(MP.timer);
  $("roundStrip").innerHTML="";
  jogo.rounds.forEach(rd=>addCelula(rd,rd.venceA?rd.ladoA:rd.ladoB));
  $("sbScoreA").textContent=jogo.placar[0];$("sbScoreB").textContent=jogo.placar[1];
  finalizarReproducao(jogo,MP.gen);
}
function pararReproducao(){MP.ativo=false;MP.gen++;clearTimeout(MP.timer);MATCH.rodando=false;}

/* ——— UI · orquestração da partida —————————————————— */
// MATCH guarda a série em andamento do jogador
const MATCH={A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null};
if(new window.URLSearchParams(location.search).get("e2e")==="1"){
  Object.defineProperty(window,"__DRAFT9_E2E__",{
    configurable:true,
    value:Object.freeze({srand,getMatch:()=>MATCH,forcaDoDia,simularMapa})
  });
}

function abrirPartida(meuTime,adversario,md,contexto,onSerieFim){
  pararReproducao(); // garante que nenhuma reprodução anterior continue rodando
  MATCH.A=meuTime;MATCH.B=adversario;MATCH.md=md;MATCH.mapaIdx=0;MATCH.vA=0;MATCH.vB=0;
  MATCH.contexto=contexto;MATCH.onSerieFim=onSerieFim;MATCH.rodando=false;
  mostrarAntessala();
  abrir("matchOverlay");
}
function mostrarAntessala(){
  $("livemap").classList.add("is-hidden");mostrarTela("prematch");
  const {A,B,contexto,md}=MATCH;
  if(!A||!B)return; // proteção: par incompleto
  $("prematchCtx").textContent=contexto+(md>1?" · melhor de "+md:" · 1 mapa");
  const teamCard=(t)=>`<div class="team-mono" style="background:${t.cor||"#888"};width:74px;height:74px;font-size:1.5rem;border-radius:18px">${mono(t.nome)}</div>
    <div class="pm-name">${esc(t.nome)}</div>${t.camp?`<div class="pm-camp">${esc(t.camp)}</div>`:""}<div class="pm-ef">força <b>${t.ef}</b></div>`;
  $("pmTeamA").className="pm-team"+(A.meu?" mine":"");$("pmTeamA").innerHTML=teamCard(A);
  $("pmTeamB").className="pm-team"+(B.meu?" mine":"");$("pmTeamB").innerHTML=teamCard(B);
}
function iniciarMapaDaSerie(){
  if(MATCH.rodando)return; // já tem um mapa em curso — ignora clique repetido
  MATCH.rodando=true;
  Audio.init();
  $("prematch").classList.add("is-hidden");mostrarTela("livemap");
  const {A,B}=MATCH;
  const fdA=forcaDoDia(A.ef,A.quim),fdB=forcaDoDia(B.ef,B.quim);
  const tA={...A.time,nome:A.nome,cor:A.cor,meu:A.meu},tB={...B.time,nome:B.nome,cor:B.cor,meu:B.meu};
  const jogo=simularMapa(tA,tB,fdA,fdB);
  MP.onFim=()=>{ // ao fim do mapa: contabiliza a série e libera o botão Continuar
    if(jogo.vencedorNome===A.nome)MATCH.vA++;else MATCH.vB++;
    if(typeof registrarPartida==="function"&&(jogo.meuA||jogo.meuB))registrarPartida(jogo);
    MATCH.rodando=false;
  };
  reproduzirMapa(jogo,tA,tB,MATCH.contexto);
}
function continuarPartida(){
  if(MATCH.rodando)return; // mapa ainda rolando — ignora
  const need=Math.ceil(MATCH.md/2);
  if(MATCH.vA>=need||MATCH.vB>=need){ // série acabou
    const cb=MATCH.onSerieFim;MATCH.onSerieFim=null; // dispara só uma vez
    fechar("matchOverlay");
    if(cb)cb(MATCH.vA>MATCH.vB?MATCH.A:MATCH.B,[MATCH.vA,MATCH.vB]);
  }else{ // próximo mapa da série (sem antessala)
    MATCH.mapaIdx++;
    iniciarMapaDaSerie();
  }
}
$("prematchStart").onclick=iniciarMapaDaSerie;
$("matchContinue").onclick=continuarPartida;
$("matchSkip").onclick=pularMapa;
$("matchClose").onclick=()=>{pararReproducao();fechar("matchOverlay");};
function jogarNovamente(){
  ["finalOverlay","playoffOverlay","suicaOverlay","matchOverlay"].forEach(fechar);
  pararReproducao();pararAnimacao();
  // zera torneio e partida
  TG.times=null;TG.rodada=0;TG.classificados=[];TG.eliminados=[];TG.playoffs=null;TG.campanha=null;
  Object.assign(MATCH,{A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null,rodando:false});
  Object.values(POOL).forEach(p=>{delete p._formaCamp;}); // nova run sorteia forma de campanha de novo
  // zera o elenco do zero — é o recomeço, sem confirmação
  Object.assign(S,{jogadores:Array(5).fill(null),treinador:null,drawn:null,sel:null,spinning:false});
  S.taken.clear();
  limparHighlights();renderLineup();renderPicks();idleTrack();updateSpinUI();atualizarMajorUI();renderResultado();
  hint("Sorteie um time e comece uma nova campanha rumo ao 9-0.");
  window.scrollTo(0,0);
}
$("finalVoltar").onclick=jogarNovamente;
/* ─── HALL DA FAMA — render + wiring (lê PROGRESSO; nunca simula nada) ─── */
function renderHall(){
  const P=PROGRESSO.dados,c=P.contadores;
  $("hallContadores").innerHTML=[[c.titulos,"títulos"],[c.invictos,"9-0 invictos"],[c.campanhas,"campanhas"]]
    .map(([v,l])=>`<div class="rec"><span class="rec-v">${v}</span><span class="rec-l">${l}</span></div>`).join("");
  const tits=[...P.titulos].reverse();
  $("hallTitulos").innerHTML=tits.length
    ?`<div class="sec-lbl">TÍTULOS</div>`+tits.map(t=>`<div class="hall-titulo">
        <span class="hall-selos">🏆${t.invicto?"<b class=\"hall-inv\">💎 9-0</b>":""}</span>
        <span class="hall-info"><b>${esc(t.placar)}</b> · ${esc(t.data||"")}${t.mvp?` · MVP ${esc(t.mvp.nick)} (${t.mvp.media.toFixed(2)})`:""}</span>
        <span class="hall-elenco">${(t.elenco||[]).map(esc).join(" · ")}${t.treinador?` — coach ${esc(t.treinador)}`:""}</span>
      </div>`).join("")
    :`<div class="hall-vazio">Sua história começa no primeiro título. A roleta está esperando.</div>`;
  const recs=Object.entries(P.recordes);
  $("hallRecordes").innerHTML=recs.length
    ?`<div class="sec-lbl">RECORDES DO CLUBE</div><div class="hall-recgrid">`+recs.map(([chave,r])=>
      `<div class="hall-rec"><span class="hall-rec-v">${chave==="rating"?r.v.toFixed(2):r.v}</span><span class="hall-rec-l">${esc(RECORDE_LABELS[chave]||chave)}</span><span class="hall-rec-m">${r.nick?esc(r.nick)+" · ":""}vs ${esc(r.adv||"?")}${r.mapa?" · "+esc(r.mapa):""}${r.data?" · "+esc(r.data):""}</span></div>`).join("")+`</div>`
    :"";
}
$("hallBtn").onclick=e=>{e.preventDefault();renderHall();abrir("hallOverlay");};
$("hallFechar").onclick=()=>fechar("hallOverlay");
$("hallExportar").onclick=()=>PROGRESSO.exportar();
$("hallImportar").onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
  const r=new window.FileReader();
  r.onload=()=>{if(PROGRESSO.importar(String(r.result))){renderHall();hint("Progresso importado.");}else hint("Arquivo de progresso inválido.");e.target.value="";};
  r.readAsText(f);};
function atualizarMajorUI(){
  const pronto=elencoCheio();
  $("majorTag").hidden=!pronto;
  $("majorSection").hidden=!pronto;
  if(!pronto){TG.times=null;TG.playoffs=null;fechar("suicaOverlay");fechar("playoffOverlay");}
}

// desbloqueia o áudio (iOS/Safari) no primeiro gesto do usuário, em qualquer lugar da página
["pointerdown","touchstart","touchend","mousedown","click","keydown"].forEach(ev=>document.addEventListener(ev,()=>Audio.init(),{once:true,passive:true}));

idleTrack();
renderLineup();
renderPicks();
updateSpinUI();
