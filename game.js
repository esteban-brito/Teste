/* game.js — aplicação, estado e interface do draft9-0.
   Dados, avaliação e simulação entram exclusivamente pela API pública. */
import * as PublicEngine from "./src/public/simulation-api.mjs";
import {Audio} from "./src/application/audio.mjs";
import {setCardFlipped} from "./src/application/card-face.mjs";
import {createDraftState,resetDraftState} from "./src/application/draft/draft-state.mjs";
import {createMajorState,resetMajorState} from "./src/application/major/major-state.mjs";
import {createMapPlaybackState,createMatchState,resetMatchState} from "./src/application/match/match-state.mjs";
import {PROGRESSO} from "./src/infrastructure/persistence/progress-store.mjs";
import {escapeHtml as esc} from "./src/ui/shared/html.mjs";
import {createCardView} from "./src/ui/game/card-view.mjs";
import {construirCartao} from "./src/ui/game/build-summary-view.mjs";
import {liveTeamHeaderHtml,prematchTeamHtml} from "./src/ui/game/team-view.mjs";
import {swissBoardHtml,bracketSubtitle,bracketBoardHtml} from "./src/ui/game/tournament-view.mjs";
import {scoreboardSideHtml} from "./src/ui/game/match-view.mjs";
import {headlineHtml,campaignFinalView,campaignScoreHtml,hallView} from "./src/ui/game/history-view.mjs";
const {TEAMS,POOL,forcaTime,simularMapa,simularSerie,forcaDoDia,
  sortearFormaCampanha,distribuirRoles,STYLE_LABEL,STYLE_ID,STYLE_RECIPE,COACH_RECIPE,CFG_SIM,
  logistica,srand,rndF,coletarMarcos,atualizarRecordes,manchete,narrativaMVP,
  RECORDE_LABELS}=PublicEngine;
const arred=value=>Math.floor(value+0.4);
const SPIN_MS=2700; // giro mais rápido (era 4000)
const WIN_INDEX=44;
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const {teamCardHTML,cardClass,cardHTML}=createCardView({
  styleId:STYLE_ID,styleLabel:STYLE_LABEL,styleRecipe:STYLE_RECIPE,coachRecipe:COACH_RECIPE,
});

const S=createDraftState();

let spinSession=0;

const $=id=>document.getElementById(id);
const roulette=$("roulette"),track=$("track"),picksEl=$("picks"),lineupEl=$("lineup"),lineupCoach=$("lineupCoach");
const hintEl=$("hint"),spinwrap=$("spinwrap"),picksTag=$("picksTag"),picksNote=$("picksNote"),winnerPill=$("winnerPill");
const hint=t=>{hintEl.textContent=t};

/* Não existe mais MODO virar. O botão "Virar cartas" existia porque clique já
   significava selecionar, e virar precisava de um modo global para caber no
   mesmo gesto. Com a colocação passando para o arrasto, o clique ficou livre:
   clicar VIRA, arrastar ESCALA. `limparFlips` sobrevive porque trocar o time
   sorteado precisa devolver as cartas à frente. */
const limparFlips=()=>document.querySelectorAll(".card.flipped,.coachcard.flipped").forEach(c=>setCardFlipped(c,false));

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
  atualizarMajorUI();
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
    ?`<div class="${cardClass(j)}${S.justPlaced===String(i)?" land":""}" data-move="${i}" data-face="front" role="button" tabindex="0">${cardHTML(j)}</div>`
    :`<div class="slot" data-slot="${i}"><span class="ph">+</span></div>`).join("");
  lineupCoach.innerHTML=S.treinador
    ?`<div class="${cardClass(S.treinador)}${S.justPlaced==="coach"?" land":""}" data-move="coach" data-face="front" role="button" tabindex="0">${cardHTML(S.treinador)}</div>`
    :`<div class="slot coach" data-slot="coach"><span class="ph">★</span></div>`;
  S.justPlaced=null;
  if(S.sel)iluminarSlots();
  updateHud();

}

function renderPicks(){
  if(!S.drawn){
    picksEl.innerHTML="";
    picksTag.hidden=true;
    picksNote.hidden=true;
    winnerPill.textContent="";
    limparFlips(); // o time saiu de cena: nenhuma carta fica virada para o próximo
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
    return`<div class="${cardClass(p)} deal${trava}" data-pick="${esc(p.id)}" data-face="front" role="button" ${preso||dup?'aria-disabled="true"':'tabindex="0"'}
      style="--sel:${esc(S.drawn.cor)};animation-delay:${i*55}ms">${cardHTML(p)}</div>`;
  }).join("");

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

/* `selecionar()` saiu com o clique-para-selecionar. Ela existia para o estado
   intermediário "carta escolhida, esperando o slot", que o arrasto elimina: o
   gesto começa e termina no mesmo movimento, e `S.sel` vive só enquanto o dedo
   está apertado. Um seletor pendurado entre dois cliques era, aliás, o que
   obrigava o botão de modo virar a existir. */

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
  resetDraftState(S);
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

/* ═══ CARTA: clicar VIRA, arrastar ESCALA ═══════════════════════════════════
   UMA VIA SÓ DE PONTEIRO. Mouse, caneta e toque entram pelo mesmo caminho, e o
   que separa "virar" de "arrastar" não é o dispositivo nem um modo global: é a
   DISTÂNCIA percorrida antes de soltar. Dois handlers separados (click para
   virar, HTML5 drag para escalar) seriam duas verdades sobre o mesmo gesto, e
   `dragstart` não existe em toque nenhum.

   O LIMIAR EXISTE PORQUE TOQUE NUNCA É IMÓVEL. Um toque de virar percorre 2–4 px
   sem intenção nenhuma; sem folga, metade das viradas viraria arrasto abortado.
   8 px é o mesmo patamar que o navegador usa para distinguir tap de scroll. */
const LIMIAR_ARRASTO=8;
let arrasto=null;

const arrastavel=el=>!el.classList.contains("taken")&&!el.classList.contains("dup");
const pickPorId=id=>[...S.drawn.jogadores,S.drawn.treinador].filter(Boolean).find(c=>c.id===id);

/** Por que esta carta NÃO pode entrar agora, ou null. As três regras são as
    mesmas de antes; só mudou o gesto que as dispara. */
function motivoBloqueio(carta){
  if(carta.tipo==="coach"&&S.treinador)return "Vaga de treinador já ocupada.";
  if(carta.tipo!=="coach"&&S.jogadores.some(j=>j&&j.nick===carta.nick))return `${carta.nick} já está na sua line.`;
  if(carta.tipo!=="coach"&&S.jogadores.every(Boolean))return "As 5 vagas estão cheias.";
  return null;
}
/* O ALVO SOB O PONTEIRO, ignorando o fantasma. `pointer-events:none` não basta:
   medido, `elementFromPoint` ainda devolvia a camada do fantasma, e o slot nunca
   acendia durante o arrasto — o pouso só acertava porque `encerrarArrasto`
   remove o fantasma ANTES de consultar. `elementsFromPoint` devolve a pilha
   inteira; o primeiro que não pertence ao fantasma é o alvo de verdade. */
function alvoSob(x,y){
  for(const el of document.elementsFromPoint(x,y)){
    if(el.closest(".fantasma"))continue;
    const alvo=el.closest(".slot.avail,.swp");
    if(alvo)return alvo;
  }
  return null;
}
const limparSobre=alvo=>document.querySelectorAll(".sobre")
  .forEach(n=>{if(n!==alvo)n.classList.remove("sobre");});

function iniciarArrasto(){
  arrasto.ativo=true;
  S.sel={origem:arrasto.origem,kind:arrasto.kind,card:arrasto.card};
  limparHighlights();iluminarSlots();
  arrasto.el.classList.add("arrastando");
  const r=arrasto.el.getBoundingClientRect();
  const g=arrasto.el.cloneNode(true);
  g.classList.add("fantasma");g.classList.remove("sel","arrastando","deal","land");
  g.removeAttribute("id");g.setAttribute("aria-hidden","true");g.removeAttribute("tabindex");
  g.style.width=r.width+"px";g.style.height=r.height+"px";
  arrasto.ghost=g;arrasto.dx=arrasto.x0-r.left;arrasto.dy=arrasto.y0-r.top;
  document.body.appendChild(g);
  moverFantasma(arrasto.x0,arrasto.y0);
}
function moverFantasma(x,y){
  if(arrasto.ghost)arrasto.ghost.style.transform=`translate(${x-arrasto.dx}px,${y-arrasto.dy}px)`;
}

/* ROLAGEM AUTOMÁTICA NA BORDA. Sem isto o arrasto é impossível no celular: a
   carta sorteada e os slots do time NÃO cabem na mesma tela. Medido a 390×844,
   a carta ficava em y=−89 e o slot em y=933 — 1.022 px de vão numa janela de
   844. Levar o dedo à borda tem de trazer o destino, como em qualquer lista
   arrastável de sistema.
   O alvo é reavaliado a cada quadro com a ÚLTIMA posição do ponteiro, porque
   durante a rolagem o dedo está parado e é a página que se move: sem isso o
   slot passaria por baixo do dedo sem nunca acender. */
let autoRolagem=0,autoQuadro=0;
function pulsoAutoRolagem(){
  if(!arrasto||!arrasto.ativo||!autoRolagem){autoQuadro=0;return;}
  window.scrollBy(0,autoRolagem);
  const alvo=alvoSob(arrasto.x,arrasto.y);
  limparSobre(alvo);
  if(alvo)alvo.classList.add("sobre");
  autoQuadro=requestAnimationFrame(pulsoAutoRolagem);
}
function ajustarAutoRolagem(y){
  const zona=Math.min(110,window.innerHeight*0.18);
  const passo=v=>Math.ceil(v/zona*20);
  autoRolagem=y<zona?-passo(zona-y)
    :y>window.innerHeight-zona?passo(y-(window.innerHeight-zona)):0;
  if(autoRolagem&&!autoQuadro)autoQuadro=requestAnimationFrame(pulsoAutoRolagem);
}
function pararAutoRolagem(){
  autoRolagem=0;
  if(autoQuadro)cancelAnimationFrame(autoQuadro);
  autoQuadro=0;
}
/** Fecha o gesto. Devolve `true` se foi arrasto — quem chama vira a carta quando
    não foi, e é essa a única diferença entre os dois gestos. */
function encerrarArrasto(x,y){
  const {el,ativo,ghost}=arrasto;
  pararAutoRolagem();
  el.classList.remove("arrastando");
  if(ghost)ghost.remove();
  arrasto=null;
  if(!ativo){limparSobre(null);return false;}
  const alvo=alvoSob(x,y);
  limparSobre(null);
  if(alvo&&alvo.classList.contains("slot"))colocarEm(alvo);
  else if(alvo&&alvo.classList.contains("swp"))trocarCom(alvo);
  else{S.sel=null;limparHighlights();hint("Solte a carta sobre um slot do seu time.");}
  return true;
}

document.addEventListener("pointerdown",e=>{
  if(e.button)return;                       // só o botão principal arrasta
  if(S.spinning)return;                     // trava interação durante o giro
  const el=e.target.closest(".card,.coachcard");
  if(!el)return;
  const ehPick=picksEl.contains(el)&&el.dataset.pick!==undefined;
  const ehLine=el.dataset.move!==undefined&&(lineupEl.contains(el)||lineupCoach.contains(el));
  if(!ehPick&&!ehLine)return;
  let origem,kind,card;
  if(ehPick){
    if(!S.drawn)return;
    card=pickPorId(el.dataset.pick);
    if(!card)return;
    origem="pick";kind=card.tipo==="coach"?"coach":"player";
  }else{
    const ehCoach=el.dataset.move==="coach";
    origem=el.dataset.move;kind=ehCoach?"coach":"player";
    card=ehCoach?S.treinador:S.jogadores[+el.dataset.move];
  }
  arrasto={el,origem,kind,card,ehPick,x0:e.clientX,y0:e.clientY,ativo:false,ghost:null};
});

document.addEventListener("pointermove",e=>{
  if(!arrasto)return;
  if(!arrasto.ativo){
    if(Math.hypot(e.clientX-arrasto.x0,e.clientY-arrasto.y0)<LIMIAR_ARRASTO)return;
    /* A trava vale no ARRASTO, não no clique: uma carta presa ou repetida ainda
       pode ser virada para leitura, ela só não pode ser escalada. */
    if(arrasto.ehPick&&!arrastavel(arrasto.el)){arrasto=null;return;}
    if(arrasto.ehPick){
      const motivo=motivoBloqueio(arrasto.card);
      if(motivo){hint(motivo);arrasto=null;return;}
    }
    iniciarArrasto();
  }
  e.preventDefault();                       // impede o scroll do toque durante o arrasto
  arrasto.x=e.clientX;arrasto.y=e.clientY;  // a auto-rolagem reavalia por aqui
  moverFantasma(e.clientX,e.clientY);
  ajustarAutoRolagem(e.clientY);
  const alvo=alvoSob(e.clientX,e.clientY);
  limparSobre(alvo);
  if(alvo)alvo.classList.add("sobre");
},{passive:false});

document.addEventListener("pointerup",e=>{
  if(!arrasto)return;
  const el=arrasto.el;
  if(!encerrarArrasto(e.clientX,e.clientY))
    setCardFlipped(el,!el.classList.contains("flipped"));
});
document.addEventListener("pointercancel",()=>{if(arrasto)encerrarArrasto(-1,-1);});

document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  if(S.spinning)return;
  /* Enter e Espaço VIRAM a carta: é a ação de botão que o `role="button"`
     promete, e espelha o clique. Escalar é gesto de arrasto, por decisão de
     produto de 06/08/2026. */
  const carta=e.target.closest(".card,.coachcard");
  if(carta){e.preventDefault();setCardFlipped(carta,!carta.classList.contains("flipped"));return;}
  /* `a[role=button]` promete comportamento de botão: o link responde a Enter por
     natureza, mas Espaço rolava a página em vez de abrir o Hall. */
  const link=e.target.closest("a[role=button]");
  if(link){e.preventDefault();link.click();}
});

/* ——— UI · telas de torneio (suíça + playoffs) —————— */
const efT=t=>forcaTime(t.jogadores.map(j=>j._eng),t.treinador?.carac,t.treinador?.ovr);
const TG=createMajorState();
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
PROGRESSO.carregar();
const dataHoje=()=>new Date().toISOString().slice(0,10);
// banner de manchete + celebração de recordes no fim do mapa (some no início do próximo)
function mostrarManchete(jogo,novosRecordes){
  const el=$("manchetePosMapa");if(!el)return;
  const h=manchete(jogo);
  el.innerHTML=headlineHtml(h,novosRecordes);
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
  const adv=MATCH.B?MATCH.B.nome:"???";
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
      treinador:(S.treinador&&S.treinador.nick)||null,
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
  const rt=Object.entries(c.ratings).map(([nick,e])=>({nick,r:e.r.reduce((a,b)=>a+b,0)/e.r.length,k:e.k,d:e.d,a:e.a||0,best:Math.max.apply(null,e.r)})).sort((a,b)=>b.r-a.r);
  const mvp=rt[0];
  const view=campaignFinalView({campaign:c,champion:campeao,ranking:rt,roster,
    narrative:mvp?narrativaMVP(c):null}); // arco da campanha em texto (puro, determinístico)
  $("finalTitulo").textContent=view.title;
  $("finalSelos").innerHTML=view.sealsHtml;
  if(view.mvpHtml!==null){
    $("finalMvpCard").style.display="";
    $("finalMvpCard").innerHTML=view.mvpHtml;
  } else $("finalMvpCard").style.display="none";
  registrarCampanhaNoProgresso(c,campeao,rt,roster); // MEMÓRIA: campanha entra no Hall da Fama
  $("finalJornada").innerHTML=view.journeyHtml;
  $("finalRatings").innerHTML=view.ratingsHtml;
  $("finalRec").innerHTML=view.recordsHtml;
  const ov=$("finalOverlay");ov.classList.remove("is-champ","is-elim");ov.classList.add(campeao?"is-champ":"is-elim");
  abrir("finalOverlay");
  Audio.init();campeao?Audio.fanfare():Audio.derrota();
  const pl=$("finalPlacar");const draw=v=>{pl.innerHTML=campaignScoreHtml(v,c.mapasD);};
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
  $("swissBoard").innerHTML=swissBoardHtml(TG);
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
function renderBracket(){
  const P=TG.playoffs;
  $("playoffSub").textContent=bracketSubtitle(P);
  $("bracketBoard").innerHTML=bracketBoardHtml(P);
  $("playoffAvancar").hidden=!!P.campeao;
}

/* ——— UI · diálogos modais —————————————————————————————
   Os cinco overlays declaram `aria-modal="true"`, o que promete que o resto da
   página está inerte. Até 04/08/2026 a promessa era vazia: o foco continuava no
   fundo ao abrir, sete botões do `.wrap` seguiam alcançáveis por Tab e Escape não
   fechava nada. `inert` no `.wrap` cumpre a promessa de verdade — é o navegador
   tirando o fundo da ordem de foco, não um laço de JS tentando prendê-lo. */
const OVERLAYS=["suicaOverlay","playoffOverlay","matchOverlay","finalOverlay","hallOverlay"];
const wrapEl=document.querySelector(".wrap");
let focoAnterior=null;
const overlayAberto=el=>el&&!el.hidden&&!el.classList.contains("fechando");
const overlaysAbertos=()=>OVERLAYS.map($).filter(overlayAberto);
function sincronizarModal(){
  const abertos=overlaysAbertos();
  if(abertos.length){wrapEl.setAttribute("inert","");document.body.style.overflow="hidden";}
  else{wrapEl.removeAttribute("inert");document.body.style.overflow="";}
  return abertos;
}
function abrir(id){
  const el=$(id);
  if(el._fechando){clearTimeout(el._fechando);el._fechando=null;}
  el.classList.remove("fechando");
  const jaAberto=overlayAberto(el);
  // só o PRIMEIRO diálogo guarda o foco de origem; aninhado devolve ao anterior
  if(!jaAberto&&!overlaysAbertos().length)focoAnterior=document.activeElement;
  el.hidden=false;
  sincronizarModal();
  // foca o CONTÊINER, não o primeiro botão: em `finalOverlay` o primeiro botão é
  // "Jogar novamente", e um Enter perdido reiniciaria a campanha.
  if(!jaAberto)el.focus({preventScroll:true});
}
function fechar(id){
  const el=$(id);
  const estavaAberto=overlayAberto(el);
  el.classList.add("fechando");
  if(el._fechando)clearTimeout(el._fechando);
  el._fechando=setTimeout(()=>{el.hidden=true;el.classList.remove("fechando");el._fechando=null;sincronizarModal();},190);
  const restantes=sincronizarModal();
  // `atualizarMajorUI` fecha overlays já fechados a cada giro: sem esta guarda,
  // devolver o foco roubaria o do jogador no meio do draft.
  if(estavaAberto&&!restantes.length&&focoAnterior&&focoAnterior.isConnected){
    focoAnterior.focus({preventScroll:true});
    focoAnterior=null;
  }
}
/* Escape fecha pelo MESMO caminho do mouse — clicando o botão de fechar que já
   existe. Por isso `finalOverlay` fica de fora: ele não tem botão de fechar, e o
   teclado não deve inventar uma saída que o mouse não oferece. */
const BOTAO_FECHAR={suicaOverlay:"suicaFechar",playoffOverlay:"playoffFechar",
  matchOverlay:"matchClose",hallOverlay:"hallFechar"};
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  const abertos=overlaysAbertos();
  const topo=abertos[abertos.length-1];
  const botao=topo&&BOTAO_FECHAR[topo.id];
  if(!botao)return;
  e.preventDefault();
  $(botao).click();
});
/* O diálogo troca de controle sob o pé do usuário: "Iniciar partida" some ao
   entrar no mapa, "Pular" vira "Continuar" ao terminar. Esconder o elemento
   focado joga o foco no <body> — fora do modal, e num fundo que está `inert`.
   Guardar a CLASSE do problema aqui vale mais que remendar cada troca: qualquer
   controle que suma leva o foco de volta ao diálogo. */
document.addEventListener("focusout",e=>{
  const abertos=overlaysAbertos();
  const topo=abertos[abertos.length-1];
  if(!topo)return;
  if(e.relatedTarget&&topo.contains(e.relatedTarget))return; // Tab normal dentro do diálogo
  window.queueMicrotask(()=>{
    if(!overlayAberto(topo)||topo.contains(document.activeElement))return;
    topo.focus({preventScroll:true});
  });
});
// troca antessala<->scoreboard com fade-in
function mostrarTela(id){
  const el=$(id);el.classList.remove("is-hidden");el.classList.remove("tela-in");void el.offsetWidth;el.classList.add("tela-in");
  /* Trocar de tela DENTRO do diálogo escondia o controle focado — "Iniciar
     partida" some ao entrar no mapa ao vivo — e o foco caía no <body>, fora do
     modal. Devolve SEMPRE ao contêiner: condicionar a `contains(activeElement)`
     não funciona porque o blur de um elemento que virou `display:none` só chega
     depois deste trecho, então a checagem ainda enxerga o botão que vai sumir. */
  const dialogo=el.closest("[role=dialog]");
  if(dialogo)dialogo.focus({preventScroll:true});
}
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
const MP=createMapPlaybackState();

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
  $("sbTeamA").innerHTML=liveTeamHeaderHtml(A,"ct","sideA");
  $("sbTeamB").innerHTML=liveTeamHeaderHtml(B,"tr","sideB");
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
  $("lsSideA").className="ls-side"+(jogo.meuA?" mine":"");
  $("lsSideB").className="ls-side"+(jogo.meuB?" mine":"");
  $("lsSideA").innerHTML=scoreboardSideHtml({name:jogo.nomeA,mine:jogo.meuA,side:"ct",color:jogo.corA,stats:jogo.statsA});
  $("lsSideB").innerHTML=scoreboardSideHtml({name:jogo.nomeB,mine:jogo.meuB,side:"tr",color:jogo.corB,stats:jogo.statsB});
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
const MATCH=createMatchState();
if(new window.URLSearchParams(location.search).get("e2e")==="1"){
  Object.defineProperty(window,"__DRAFT9_E2E__",{
    configurable:true,
    /* `getDraft` acompanha `getMatch`: a bancada precisa saber por que um gesto
       não pegou, e sem isso o diagnóstico vira adivinhação sobre estado privado. */
    value:Object.freeze({srand,getMatch:()=>MATCH,getDraft:()=>S,forcaDoDia,simularMapa})
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
  $("pmTeamA").className="pm-team"+(A.meu?" mine":"");$("pmTeamA").innerHTML=prematchTeamHtml(A);
  $("pmTeamB").className="pm-team"+(B.meu?" mine":"");$("pmTeamB").innerHTML=prematchTeamHtml(B);
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
    if(jogo.meuA||jogo.meuB)registrarPartida(jogo);
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
  resetMajorState(TG);
  resetMatchState(MATCH);
  Object.values(POOL).forEach(p=>{delete p._formaCamp;}); // nova run sorteia forma de campanha de novo
  // zera o elenco do zero — é o recomeço, sem confirmação
  resetDraftState(S);
  limparHighlights();renderLineup();renderPicks();idleTrack();updateSpinUI();atualizarMajorUI();renderResultado();
  hint("Sorteie um time e comece uma nova campanha rumo ao 9-0.");
  window.scrollTo(0,0);
}
$("finalVoltar").onclick=jogarNovamente;
/* ─── HALL DA FAMA — render + wiring (lê PROGRESSO; nunca simula nada) ─── */
function renderHall(){
  const view=hallView(PROGRESSO.dados,RECORDE_LABELS);
  $("hallContadores").innerHTML=view.countersHtml;
  $("hallTitulos").innerHTML=view.titlesHtml;
  $("hallRecordes").innerHTML=view.recordsHtml;
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
