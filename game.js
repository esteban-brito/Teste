/* game.js — aplicação, estado e interface do draft9-0.
   Dados, avaliação e simulação entram exclusivamente pela API pública. */
import * as PublicEngine from "./src/public/simulation-api.mjs";
import {Audio} from "./src/application/audio.mjs";
import {setCardFlipped} from "./src/application/card-face.mjs";
import {createDraftState,resetDraftState} from "./src/application/draft/draft-state.mjs";
import {createMajorState,resetMajorState} from "./src/application/major/major-state.mjs";
import {createMapPlaybackState,createMatchState,resetMatchState} from "./src/application/match/match-state.mjs";
import {normalizarNomeDoTime,colideComCatalogo} from "./src/application/team-identity.mjs";
import {estiloDoMapa} from "./src/ui/shared/map-identity.mjs";
import {PROGRESSO} from "./src/infrastructure/persistence/progress-store.mjs";
import {escapeHtml as esc} from "./src/ui/shared/html.mjs";
import {createCardView} from "./src/ui/game/card-view.mjs";
import {construirCartao} from "./src/ui/game/build-summary-view.mjs";
import {liveTeamHeaderHtml,prematchTeamHtml,aplicarLado,estiloDoTime} from "./src/ui/game/team-view.mjs";
import {swissBoardHtml,bracketSubtitle,bracketBoardHtml} from "./src/ui/game/tournament-view.mjs";
import {escolherMomentos,falasDoRound,falaFechamento}
  from "./src/domain/narrative/live-commentary.mjs";
import {scoreboardSideHtml} from "./src/ui/game/match-view.mjs";
import {headlineHtml,campaignFinalView,campaignScoreHtml,hallView} from "./src/ui/game/history-view.mjs";
const {TEAMS,POOL,forcaTime,simularMapa,simularSerie,forcaDoDia,
  sortearFormaCampanha,distribuirRoles,STYLE_LABEL,STYLE_ID,STYLE_RECIPE,COACH_RECIPE,CFG_SIM,
  logistica,srand,rndF,coletarMarcos,atualizarRecordes,manchete,narrativaMVP,
  RECORDE_LABELS,MAPAS_POOL}=PublicEngine;
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

/* `ocioso` zera o padding lateral do trilho para que as fitas encham a roleta em
   repouso; sem ela a fita 0 nasce no centro e sobra meia caixa vazia. O padding
   volta em `sortear()`, que é quem precisa dele para centralizar o vencedor. */
function idleTrack(){
  pararAnimacao();
  track.style.transform="translate3d(0,0,0)";
  track.classList.add("ocioso");
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
  hint(`Time sorteado: ${time.nome}${time.camp?" · "+time.camp:""}. Arraste 1 carta.`);
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
  track.classList.remove("ocioso");   // o giro precisa do padding de volta
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
      style="animation-delay:${i*55}ms">${cardHTML(p)}</div>`;
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

/* ELENCO ALEATÓRIO — 5 + 1 de uma vez, sem passar pela roleta.
   POR QUE POOL EMBARALHADO E NÃO TENTATIVA-E-ERRO: são 85 jogadores para 77
   nicks, ou seja, o mesmo jogador aparece em eras diferentes. Sortear ao acaso e
   repetir enquanto o nick colidir termina quase sempre — mas "quase sempre" num
   laço sem teto é como o produto trava. Embaralhar uma vez e varrer garante
   término em uma passada, e mantém a regra de nick único que o draft manual já
   cobra em `colocarEm`. */
function sortearElencoCompleto(){
  if(S.spinning)return;
  pararAnimacao();
  resetDraftState(S);
  limparFlips();
  limparHighlights();

  const pool=TEAMS.flatMap(t=>t.jogadores||[]);
  for(let i=pool.length-1;i>0;i--){const j=rnd(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  const nicks=new Set();
  let n=0;
  for(const j of pool){
    if(n>=5)break;
    if(!j||nicks.has(j.nick))continue;
    nicks.add(j.nick);
    S.jogadores[n++]=j;
    S.taken.add(j.id);
  }
  const tr=pick(TEAMS.map(t=>t.treinador).filter(Boolean));
  if(tr){S.treinador=tr;S.taken.add(tr.id);}

  renderLineup();
  renderPicks();
  idleTrack();
  updateSpinUI();
  hint(elencoCheio()
    ?"Elenco aleatório montado. Boa sorte no campeonato invicto."
    :"Elenco aleatório montado.");
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
  hint("Sorteie um time e arraste 1 jogador por rodada.");
}

$("rollbtn").onclick=sortear;
$("mutebtn").onclick=e=>{Audio.init();Audio.mudo=!Audio.mudo;
  e.currentTarget.textContent=Audio.mudo?"🔇":"🔊";
  e.currentTarget.classList.toggle("muted",Audio.mudo);
  if(!Audio.mudo)Audio.tick();};
$("respinbtn").onclick=abortarSpin;
$("resetbtn").onclick=resetar;
$("randombtn").onclick=sortearElencoCompleto;

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
  /* A seleção nativa começa no `pointerdown`, ANTES de sabermos que o gesto é um
     arrasto — só o limiar de 8 px decide isso. Então além de travar a seleção
     daqui em diante, é preciso desfazer a que o navegador já iniciou. */
  document.body.classList.add("arrastando-carta");
  const sel=window.getSelection&&window.getSelection();
  if(sel&&!sel.isCollapsed)sel.removeAllRanges();
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
  document.body.classList.remove("arrastando-carta");
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

/* O GIRO NÃO CONGELA O ELENCO — 06/08/2026, a pedido do responsável: "quero que
   dê pra mexer nas coisas enquanto a roleta tá sorteando, mas não dá pra fazer
   nada". A trava aqui era `if(S.spinning)return`, e valia para TODA carta —
   inclusive as que já estão na sua line, que não têm relação nenhuma com o
   sorteio em curso. Trocar posição ou virar uma carta escalada é seguro durante
   o giro: `revelarTime` só mexe em `#picks`.
   Para as cartas do sorteio a trava era redundante: `#picks` fica VAZIO enquanto
   gira — `sortear()` limpa antes de começar — e o ramo `ehPick` logo abaixo já
   exige `S.drawn`, que só existe depois que a fita para. */
document.addEventListener("pointerdown",e=>{
  if(e.button)return;                       // só o botão principal arrasta
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
  /* Sem trava de giro pelo mesmo motivo do `pointerdown`: virar uma carta já
     escalada não toca no sorteio, e no `#picks` não há carta para virar. */
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
/* NOME DO CLUBE — vive no progresso e vale para a campanha inteira.
   Lido uma vez por partida montada, nunca cacheado em variável de módulo: o
   jogador pode renomear entre um Major e outro, e o Hall guarda títulos com o
   nome que valia no dia. */
const nomeDoMeuTime=()=>normalizarNomeDoTime(PROGRESSO.dados?.nomeDoTime);
function definirNomeDoMeuTime(bruto){
  const nome=normalizarNomeDoTime(bruto);
  /* Guarda o CRU normalizado, não o padrão: se o jogador apagar tudo, o campo
     volta a ficar vazio e o placeholder reaparece — gravar "SEU TIME" ali faria
     o padrão parecer uma escolha dele.
     O teste é só a entrada em branco: entrada em branco JÁ cai em `NOME_PADRAO`
     dentro de `normalizarNomeDoTime`, então comparar o resultado com o padrão
     era uma condição sempre verdadeira nesse ramo — e custava mais duas
     normalizações por gravação. */
  PROGRESSO.dados.nomeDoTime=String(bruto??"").trim()?nome:"";
  PROGRESSO.salvar();
  return nome;
}

// monta o objeto-time do jogador a partir do elenco montado
function montarMeuTime(){
  const cartas=S.jogadores.filter(Boolean);
  // cópias dos _eng + distribuição no contexto do SEU time (cap 2 + AWP) — não corrompe os times-fonte.
  // o sim lê cada carta._eng, então as cartas do time apontam pras cópias com as funções do contexto.
  const js=distribuirRoles(cartas.map(p=>({...p._eng})));
  const cartasSim=cartas.map((c,i)=>({...c,_eng:js[i]}));
  const r=forcaTime(js,S.treinador?.carac||null,S.treinador?.ovr||null);
  const nome=nomeDoMeuTime();
  /* PRETO, a pedido do responsável em 07/08/2026. O ciano anterior era idêntico
     ao do Outsiders e vizinho do Cloud9; preto não colide com nenhum dos 17 e
     dá 21:1 com a sigla branca. O que precisa de luz — número da força, faixa,
     barra — usa `--time-traco`, derivado em `estiloDoTime`. */
  const COR_DO_JOGADOR="#000000";
  return {time:{nome,cor:COR_DO_JOGADOR,jogadores:cartasSim},nome,cor:COR_DO_JOGADOR,camp:"",
    ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[],meu:true};
}
function iniciarTorneio(){
  // sorteia 15 dos times (Fisher-Yates) → Major de 16 com o seu time; campo varia a cada run
  const npc=TEAMS.slice();
  for(let i=npc.length-1;i>0;i--){const j=Math.floor(rndF()*(i+1));[npc[i],npc[j]]=[npc[j],npc[i]];}
  /* COLISÃO DE NOME SAI PRIMEIRO — 07/08/2026, com o nome de clube escolhível.
     O quadro do Major mostra os dois times pelo NOME, e o jogador não teria como
     distinguir o seu clube de um homônimo do catálogo na tabela da Suíça nem no
     bracket. Enquanto o nome era fixo isso não podia acontecer; agora pode, e é
     o jogador quem escolhe.
     Cabe no orçamento que já existe: são 17 elencos para 15 vagas de NPC, então
     dá para tirar DOIS sem faltar time. Nenhuma chamada de RNG é adicionada —
     isto filtra a lista já embaralhada, não sorteia de novo. */
  const meuNome=nomeDoMeuTime();
  const homonimos=npc.filter(t=>colideComCatalogo(meuNome,[t]));
  for(const t of homonimos)if(npc.length>15)npc.splice(npc.indexOf(t),1);

  /* O time NPC que mais compartilha jogadores com o SEU elenco sai do Major —
     melhor esforço contra "donk vs donk"; empate resolve pelo embaralhamento
     acima. É a SEGUNDA exclusão, e ela só acontece se a folga sobrou: com o nome
     do clube colidindo com dois elencos do catálogo, o orçamento de 17→15 já foi
     todo gasto acima e o overlap fica para a próxima run. Nomear o clube tem
     precedência porque o homônimo confunde a leitura de TODA a campanha. */
  const meusNicks=new Set(S.jogadores.filter(Boolean).map(p=>p.nick));
  const overlap=t=>t.jogadores.reduce((n,j)=>n+(meusNicks.has(j.nick)?1:0),0);
  if(npc.length>15){
    let fora=npc.length-1,melhor=0;
    npc.forEach((t,i)=>{const o=overlap(t);if(o>melhor){melhor=o;fora=i;}});
    npc.splice(fora,1);
  }
  const base=npc.slice(0,15).map(t=>{const r=efT(t);         // teto de 15 NPC (independe de quantos times existam) → Major sempre 16
    return {time:t,nome:t.nome,cor:t.cor,camp:t.camp,ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[]};});
  base.push(montarMeuTime());
  TG.times=base;TG.rodada=0;TG.classificados=[];TG.eliminados=[];TG.playoffs=null;
  // campanha do jogador: acumula mapas e rating por jogador ao longo do Major
  TG.campanha={mapasV:0,mapasD:0,ratings:{},jornada:[],fim:null};
  sortearFormaCampanha(TG.times); // semeia o "humor" da run: cada Major joga diferente
}
PROGRESSO.carregar();

/* PORTÃO DO NOME DO CLUBE — 07/08/2026.
   Ele vive na entrada do Major, não na tela inicial: ali o campo passava
   despercebido e as pessoas entravam no torneio sem nomear o time. Aqui é
   obrigatório, e o botão só habilita com um nome válido.
   O aviso é CONTÍNUO, não só na confirmação: quem digita "NAVI" descobre na
   hora que existe um elenco com esse nome, em vez de depois de confirmar. */
function abrirPortaoDoNome(){
  const campo=$("teamName");
  campo.value=PROGRESSO.dados?.nomeDoTime||"";
  campo.dispatchEvent(new Event("input")); // reavalia botão e aviso pelo mesmo caminho
  abrir("nomeOverlay");
  /* Foca o CAMPO, e não o contêiner: aqui o primeiro controle é justamente o que
     o jogador precisa usar, e não há ação destrutiva por perto — o caso que a
     regra 25 protege é o `finalOverlay`, cujo primeiro botão reinicia a
     campanha. O `setTimeout` espera o overlay sair de `hidden`. */
  setTimeout(()=>campo.focus(),0);
}
{
  const campo=$("teamName"),botao=$("nomeConfirmar"),aviso=$("nomeAviso");
  const cru=()=>String(campo.value||"").trim();
  const avaliar=()=>{
    const vazio=!cru();
    botao.disabled=vazio;
    if(vazio){aviso.textContent="";aviso.className="gate-aviso";return;}
    const nome=normalizarNomeDoTime(campo.value);
    if(colideComCatalogo(nome,TEAMS)){
      aviso.textContent=`"${nome}" também é um elenco do jogo — ele fica de fora do seu Major.`;
      aviso.className="gate-aviso gate-aviso--alerta";
    }else{aviso.textContent="";aviso.className="gate-aviso";}
  };
  campo.addEventListener("input",avaliar);
  campo.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!botao.disabled){e.preventDefault();botao.click();}
  });
  botao.onclick=()=>{
    if(!cru())return; // trava dupla: o disabled já barra, mas Enter/AT podem chegar aqui
    definirNomeDoMeuTime(campo.value);
    fechar("nomeOverlay");
    abrirSuica();
  };
}
const dataHoje=()=>new Date().toISOString().slice(0,10);
// banner de manchete + celebração de recordes no fim do mapa (some no início do próximo)
/* NO MODO LIMPO A MANCHETE TAMBÉM SAI — 06/08/2026: "o modo normal não vai ter
   narração nenhuma nem no início nem no fim, zerado, limpo". A manchete é a única
   voz que o jogo tinha no fim do mapa, então mantê-la deixaria o modo limpo a
   meio caminho. Os recordes continuam sendo REGISTRADOS nos dois modos — o que
   muda é só a celebração na tela. */
function mostrarManchete(jogo,novosRecordes){
  const el=$("manchetePosMapa");if(!el)return;
  if(!MATCH.narrado){el.hidden=true;el.innerHTML="";return;}
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
    /* Contexto em PARTES, não em frase: a antessala dá pesos diferentes a cada
       uma, e uma string única obrigava a ler tudo para achar o que importa. */
    const ctx={fase:"Fase Suíça",rodada:String(TG.rodada),situacao:`${meu.v}-${meu.d}`,decisivo:md===3};
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
    abrirPartida(meu,adv,3,{fase:faseNome,etapa:"Playoffs",decisivo:true},(venc,placar)=>{
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
   Os seis overlays declaram `aria-modal="true"`, o que promete que o resto da
   página está inerte. Até 04/08/2026 a promessa era vazia: o foco continuava no
   fundo ao abrir, sete botões do `.wrap` seguiam alcançáveis por Tab e Escape não
   fechava nada. `inert` no `.wrap` cumpre a promessa de verdade — é o navegador
   tirando o fundo da ordem de foco, não um laço de JS tentando prendê-lo. */
const OVERLAYS=["nomeOverlay","suicaOverlay","playoffOverlay","matchOverlay","finalOverlay","hallOverlay"];
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

/* O Major passa pelo PORTÃO DO NOME. Só depois de nomear o time é que a Suíça
   abre — foi o pedido: "deixe impossível da pessoa passar sem escolher o nome". */
$("suicabtn").onclick=abrirPortaoDoNome;
$("suicaFechar").onclick=()=>fechar("suicaOverlay");
$("suicaAvancar").onclick=avancarSuica;
$("suicaPlayoffs").onclick=abrirPlayoffs;
$("playoffFechar").onclick=()=>fechar("playoffOverlay");
$("playoffAvancar").onclick=avancarPlayoff;
// mostra a seção do Major só quando o elenco estiver completo
/* ——— UI · reprodutor de partida (cinematográfico) ——— */
// ritmo dos rounds: pulso legível e mais pausado (rounds correm devagar pra acompanhar)
/* `base` é o ritmo do mapa correndo; os quatro de narração são o ritmo de quem
   FALA, e são muito mais lentos de propósito. Um round narrado não é um round
   com legenda: ele PARA, ganha destaque e é comentado — 260 ms não dão tempo de
   ler nem meia frase. */
/* CURVA DE RITMO — 07/08/2026: "o inicio de uma partida tem q passa um pouco
   mais lento do que o meio, e o final mesma coisa […] pra ficar mais tranquilo,
   fluido".
   `base` é o miolo do mapa; `ponta` é o quanto se acrescenta nas bordas. A curva
   é senoidal e não linear porque uma rampa reta se percebe como três velocidades
   (lento, rápido, lento); o seno não tem quina, então a aceleração é contínua e
   o olho lê como respiração, não como troca de marcha.
   Custo por round: um `Math.sin`. Nada aqui toca layout ou pintura, então a
   fluidez não sai do orçamento de quadro. */
const RITMO={base:240,ponta:380,troca:1000,inicio:500,
  narrPre:520,      // respiro entre o round acontecer e a primeira voz entrar
  narrMin:1250,     // piso de leitura: abaixo disso a fala curta pisca
  narrFala:2600,    // TETO por fala — o tempo real vem de `tempoDaFala()`
  narrPos:1100,   // silêncio depois da última fala, antes de o mapa voltar a correr
  narrFecho:4200};// o painel de fim de mapa fala e SAI, liberando o placar
const MP=createMapPlaybackState();

/* ——— UI · narração ao vivo (só no modo opt-in) ————————————————
   `Math.random` aqui é DELIBERADO e é o mesmo canal que a roleta do draft já usa:
   fora do Mulberry32 da simulação. Sortear os rounds narrados com o RNG do motor
   deslocaria todas as chamadas seguintes e mudaria o resultado do mapa — o
   sintoma apareceria em golden e snapshot, longe da causa. */
/* Lento nas pontas, ágil no miolo. `sin(pos·π)` vale 0 nas bordas e 1 no centro,
   então `1−sin` é o peso da lentidão — máximo no primeiro e no último round,
   zero na metade. Mapa de um round só não divide por zero: cai no ritmo cheio. */
function ritmoDoRound(indice,total){
  if(total<=1)return RITMO.base+RITMO.ponta;
  const pos=indice/(total-1);
  /* A curva ganhou EXPOENTE em 07/08/2026, a pedido de "mais fluido".
     `1-sin(pos·π)` sozinha desacelera cedo demais: já no round 3 de 24 o passo
     está 30% acima do miolo, e o mapa demora a "engatar". Elevar a curva a 1,6
     mantém as pontas lentas — que é o efeito dramático que se quer no começo e
     na reta final — e faz o miolo chegar antes e ficar mais tempo, que é onde a
     reprodução tem de correr. O seno continua sendo a base porque não tem quina;
     rampa reta se percebe como três velocidades. */
  const lentidao=(1-Math.sin(pos*Math.PI))**1.6;
  return Math.round(RITMO.base+lentidao*RITMO.ponta);
}

const NARRA={ativa:false,rounds:new Set(),ctx:null};
/* Os dois NARRAM: um abre a jogada, o outro grita a situação. O rótulo antigo
   da segunda voz era "Análise", e análise foi justamente o que o responsável
   recusou — o nome prometia o que a narração não faz mais. */
const NOME_VOZ={pbp:"Narração",cor:"Comentário"};
function limparNarracao(){
  const el=$("narracao");if(el)el.innerHTML="";
  fecharPalco();
}
/* O RÓTULO DO MOMENTO. Diz em duas palavras por que ESTE round parou o jogo —
   sem ele o painel abre e o espectador não sabe o que foi que valeu a pena. */
function tagDoRound(rd){
  if(rd.clutchX>0&&rd.clutchWon)return `clutch 1v${rd.clutchX}`;
  if(rd.clutchX>0)return `1v${rd.clutchX}`;
  if(rd.troca)return "virada de lado";
  if(rd.buyA==="eco"||rd.buyA==="pistol"||rd.buyB==="eco"||rd.buyB==="pistol")return "eco round";
  if(rd.plantado)return "bomba plantada";
  return "";
}
/* `hidden` é a ÚNICA fonte de verdade do palco: a entrada e a saída são do CSS,
   via `@starting-style` e `transition-behavior:allow-discrete`. Não há classe de
   estado nem `setTimeout` espelhando a duração da animação — que era o jeito
   antigo e desincronizava toda vez que um timer era cancelado no meio. */
function abrirPalco(rd){
  const palco=$("narracaoPalco");if(!palco)return;
  $("npNum").textContent=rd.r??"—";
  $("npPlacar").textContent=`${rd.pa}-${rd.pb}`;
  $("npTag").textContent=tagDoRound(rd);
  $("narracao").innerHTML="";
  palco.hidden=false;
}
function fecharPalco(){
  const palco=$("narracaoPalco");if(palco)palco.hidden=true;
}
const falaHtml=f=>
  `<div class="fala fala--${esc(f.voz)}"><span class="fala-quem">${esc(NOME_VOZ[f.voz]||"")}</span>`+
  `<span class="fala-txt">${esc(f.texto)}</span></div>`;
/* Abertura e fechamento do MAPA também usam o palco, sem número de round: são
   os dois únicos momentos em que a dupla fala fora de um round sorteado. */
function dizer(falas,rotulo){
  const el=$("narracao");if(!el||!NARRA.ativa||!falas||!falas.length)return;
  const palco=$("narracaoPalco");
  if(palco){
    palco.hidden=false;
    const num=$("npNum"),pl=$("npPlacar"),tag=$("npTag");
    if(num)num.textContent="—";
    if(pl)pl.textContent="";
    if(tag)tag.textContent=rotulo||"";
  }
  el.innerHTML=falas.map(falaHtml).join("");
}
/* Acrescenta UMA fala, como quem toma a palavra. A faixa guarda no máximo três:
   ela é uma janela de transmissão, não histórico — deixar acumular empurraria a
   tabela de stats para fora da tela no meio da leitura. */
function dizerUma(f){
  const el=$("narracao");if(!el||!NARRA.ativa)return;
  el.insertAdjacentHTML("beforeend",falaHtml(f));
  while(el.children.length>3)el.removeChild(el.firstElementChild);
}
/* O ROUND NARRADO CONGELA. Sem isso a fala entra e sai antes de ser lida — o
   mapa continua correndo a 260 ms por round enquanto alguém tenta acompanhar
   duas frases. Congelar é o que transforma legenda em transmissão. */
/* O PAINEL NUNCA ABRE VAZIO. A primeira versão abria o palco e só então esperava
   `narrPre` para falar — meio segundo de retângulo em branco, medido em 5 de 73
   amostras, e foi isso que o responsável viu como "bugada quando aparece o
   retângulo". O respiro agora acontece ANTES de abrir: quando o painel entra,
   a primeira fala já está nele. */
/* Tempo de leitura de uma fala. `narrFala` deixou de ser a duração e passou a ser
   o TETO: nenhuma fala segura o mapa além dele, por mais longa que seja. */
function tempoDaFala(fala){
  const texto=String(fala?.texto||"");
  return Math.min(RITMO.narrFala,RITMO.narrMin+texto.length*17);
}
function narrarRound(rd,ant,cel,gen,aoFim){
  const falas=falasDoRound(rd,ant,NARRA.ctx,Math.random);
  if(cel){cel.classList.add("narrando");cel.setAttribute("data-r",rd.r!=null?rd.r:"");}
  let k=0;
  const proxima=()=>{
    if(gen!==MP.gen||!MP.ativo)return;   // pulou o mapa ou trocou de reprodução
    if(k>=falas.length){
      if(cel)cel.classList.remove("narrando");
      fecharPalco();
      MP.timer=setTimeout(aoFim,RITMO.narrPos);
      return;
    }
    const fala=falas[k++];
    dizerUma(fala);
    /* CADA FALA FICA O TEMPO DELA — 07/08/2026, a pedido de "narração mais
       fluida". Os 2.600 ms eram fixos: uma frase de quatro palavras ficava
       parada tanto quanto uma de vinte, e é essa espera vazia que faz a
       transmissão arrastar. Agora o tempo é de leitura — um piso para a fala
       curta não piscar, mais o texto a ~17 ms por caractere, com teto para que
       uma fala longa não trave o mapa. */
    MP.timer=setTimeout(proxima,tempoDaFala(fala));
  };
  MP.timer=setTimeout(()=>{
    if(gen!==MP.gen||!MP.ativo)return;
    abrirPalco(rd);
    proxima();
  },RITMO.narrPre);
}
function prepararNarracao(jogo,A,B){
  NARRA.ativa=!!MATCH.narrado;
  NARRA.ctx={nomeA:A.nome,nomeB:B.nome,mapa:jogo.mapa,
    /* os nicks vêm na MESMA ordem de snapA/snapB — é isso que liga o delta de
       kills ao nome de quem fragou */
    nicksA:(jogo.statsA||[]).map(x=>x.nick),nicksB:(jogo.statsB||[]).map(x=>x.nick),
    /* quem é o time DELE: a pontuação de emoção pesa a favor do usuário, e a
       narração fica do lado de quem está torcendo */
    meuA:!!A.meu,meuB:!!B.meu};
  /* SELEÇÃO POR MÉRITO, não sorteio: até 3 momentos, e nenhum se o mapa foi
     morno. Não consome aleatoriedade — o mesmo mapa destaca sempre os mesmos. */
  NARRA.rounds=NARRA.ativa?escolherMomentos(jogo.rounds,NARRA.ctx):new Set();
  limparNarracao();
  /* A PARTIDA NÃO ABRE FALANDO — 07/08/2026: "a partida ta abrindo com a
     narracao na tela nao quero isso". O palco só entra quando há momento. */
}

function reproduzirMapa(jogo,A,B,contexto){
  // invalida qualquer reprodução anterior: cancela timer e incrementa a geração
  clearTimeout(MP.timer);
  const meuGen=++MP.gen;
  MP.ativo=true;MP.jogo=jogo;MP.ctx=contexto;
  $("matchContinue").hidden=true;$("matchSkip").hidden=false;
  $("roundStrip").innerHTML="";
  /* Mapa novo começa com os lados na origem e sem aviso na tela: o segundo mapa
     de uma série herdaria a virada do primeiro, e o aviso herdaria o timer. */
  esconderAvisoVirada();
  const aMine=!!A.meu,bMine=!!B.meu;
  $("sbTeamA").className="sb-team sb-a"+(aMine?" mine":"");
  $("sbTeamB").className="sb-team sb-b"+(bMine?" mine":"");
  $("sbTeamA").innerHTML=liveTeamHeaderHtml(A,"ct","sideA");
  $("sbTeamB").innerHTML=liveTeamHeaderHtml(B,"tr","sideB");
  $("sbScoreA").textContent="0";$("sbScoreB").textContent="0";
  /* A MARCA DO MAPA ENTRA NA PARTIDA, não só na antessala: o pedido é que a
     pessoa saiba onde está jogando "sem nem ler". A tela do mapa recebe a cor em
     variáveis próprias, e quem quiser tingir mais regiões usa as mesmas. */
  $("sbMap").innerHTML=`<span class="sb-map-nome">${esc(jogo.mapa)}</span>`;
  $("sbMap").setAttribute("style",estiloDoMapa(jogo.mapa));
  $("livemap").setAttribute("style",estiloDoMapa(jogo.mapa));
  $("sbProgress").style.width="0%";
  const bm=$("manchetePosMapa");if(bm){bm.hidden=true;bm.innerHTML="";} // manchete é do mapa FECHADO
  prepararNarracao(jogo,A,B);
  montarScoreboard(jogo); // tabela inicial dos 10 jogadores (zerada)
  /* Cacheia os elementos quentes do laço (evita `$()` por round). Os chips de
     lado saíram do cache: eles são tocados UMA vez por mapa, na virada, e
     `definirLados` precisa resolvê-los por id de qualquer forma — quem pula o
     mapa chama a mesma função sem passar por aqui. */
  const elProg=$("sbProgress"),elRS=$("roundStrip"),elScA=$("sbScoreA"),elScB=$("sbScoreB");
  const total=jogo.rounds.length;
  let i=0;
  const passo=()=>{
    if(meuGen!==MP.gen||!MP.ativo)return; // timer órfão de outra reprodução: ignora
    if(i>=total)return finalizarReproducao(jogo,meuGen);
    const rd=jogo.rounds[i];
    const ladoVenc=rd.venceA?rd.ladoA:rd.ladoB;
    if(rd.venceA)setScore(elScA,rd.pa,ladoVenc);else setScore(elScB,rd.pb,ladoVenc);
    /* A BARRA ANDA DURANTE O ROUND, não depois dele: recebe a duração REAL do
       passo que vem a seguir, então chega ao fim junto com o round terminando.
       Com o `.3s` fixo de antes ela vivia atrasada no miolo do mapa, onde o
       round dura 241 ms — e atraso constante lê como engasgo. */
    const duracaoDoPasso=rd.troca?RITMO.troca:ritmoDoRound(i,total);
    elProg.style.setProperty("--passo",`${duracaoDoPasso}ms`);
    elProg.style.width=Math.round((i+1)/total*100)+"%";
    const cel=addCelula(rd,ladoVenc,elRS,rd.venceA?aMine:bMine);
    Audio.roundWin(rd.venceA?aMine:bMine);
    if(rd.troca)virarLados();
    atualizarScoreboard(jogo,rd); // atualiza K-D e pulsa quem fragou
    if(rd.destaque)Audio.impacto(false);
    const narrarEste=NARRA.ativa&&NARRA.rounds.has(i);
    i++;
    if(narrarEste)narrarRound(rd,jogo.rounds[i-2]||null,cel,meuGen,passo);
    else MP.timer=setTimeout(passo,rd.troca?RITMO.troca:ritmoDoRound(i-1,total));
  };
  MP.timer=setTimeout(passo,RITMO.inicio);
}
/* A VIRADA DE LADO, ANUNCIADA — 07/08/2026.
   Medido antes: o evento mais importante do mapa mudava 686 px² da tela, 0,05%
   dela, trocando "CT" por "TR" num texto de 9,28 px. Não havia aviso nenhum, e a
   tabela nem virava. Agora os QUATRO chips viram juntos e um aviso curto passa
   pela tela dizendo o que o jogador vai fazer a partir dali.
   O aviso fala de ESTADO ("agora você defende"), nunca de decisão do motor — a
   fronteira da §11-bis é entre resultado e mecanismo, e lado é resultado.

   E UM lugar só define o lado dos QUATRO chips. Era a existência de dois
   caminhos — o topo virava aqui, a tabela era pintada em `montarScoreboard` e
   nunca mais tocada — que deixava a tela com duas respostas para a mesma
   pergunta a partir do round 13. */
function definirLados(ladoA,ladoB){
  aplicarLado($("sideA"),ladoA);aplicarLado($("sideB"),ladoB);
  /* O BLOCO INTEIRO do scoreboard veste a cor do lado e troca junto. É a
     substituição do chip que existia aqui: área vale mais que rótulo, e na
     virada o jogador vê os dois blocos trocarem de cor de uma vez. */
  pintarBlocoDoLado($("lsSideA"),ladoA);
  pintarBlocoDoLado($("lsSideB"),ladoB);
}
function pintarBlocoDoLado(el,lado){
  if(!el)return;
  el.classList.remove("ct","tr");
  el.classList.add(lado);
}
function virarLados(){
  /* O lado novo sai do lado ATUAL do chip, não de contar rounds: o `data-lado`
     é o estado real da tela, e é ele que precisa ser invertido. */
  const novoA=$("sideA")?.dataset.lado==="ct"?"tr":"ct";
  const novoB=novoA==="ct"?"tr":"ct";
  definirLados(novoA,novoB);
  anunciarVirada(MP.jogo?.meuA?novoA:MP.jogo?.meuB?novoB:null);
}
const esconderAvisoVirada=()=>{
  clearTimeout(MP.avisoTimer);
  const el=$("viradaAviso");if(el)el.hidden=true;
};
function anunciarVirada(meuLado){
  const el=$("viradaAviso");
  if(!el)return;
  el.textContent=meuLado
    ? `Troca de lado · agora você ${meuLado==="ct"?"defende":"ataca"}`
    : "Troca de lado";
  el.hidden=false;
  clearTimeout(MP.avisoTimer);
  /* Fecha por timer próprio: se ele morresse junto com o passo do round, pular o
     mapa deixaria o aviso preso na tela — foi assim que o painel da narração
     ficou preso em 06/08, e o padrão é o mesmo. */
  MP.avisoTimer=setTimeout(()=>{el.hidden=true;},2600);
}
function setScore(elOrId,val,lado){const el=typeof elOrId==="string"?$(elOrId):elOrId;el.textContent=val;
  el.classList.remove("bump","flash-ct","flash-tr");void el.offsetWidth;
  el.classList.add("bump",lado==="CT"?"flash-ct":"flash-tr");}
/* A TIRA PASSOU A DIZER DE QUEM É O ROUND — 07/08/2026.
   Ela guardava só o LADO vencedor, e os lados trocam no round 13: a mesma cor
   significava times DIFERENTES nas duas metades do mapa. Quem olhasse a tira não
   conseguia contar os próprios rounds — que é a única pergunta que se faz a ela.
   A cor continua sendo o lado, porque é a convenção do CS; o que muda é o PESO:
   round seu vem em cheio, round do adversário vem apagado. À distância, a tira
   vira a sua campanha no mapa. */
function addCelula(rd,lado,strip,meu){
  const s=strip||$("roundStrip");const c=document.createElement("div");
  c.className=`rs-cell pop ${lado==="CT"?"ct":"tr"}`
    +(meu?" mine":"")+(rd.destaque?" key":"");
  c.setAttribute("aria-hidden","true"); // o placar já é anunciado; a tira é redundante para AT
  s.appendChild(c);
  return c;   // a narração precisa da célula para destacá-la enquanto fala
}
// monta a tabela inicial do scoreboard (10 jogadores, K-D zerado)
function montarScoreboard(jogo){
  /* `ct`/`tr` entram já na montagem: A começa CT e B começa TR, e `definirLados`
     cuida da virada. Sem isso o bloco nasceria sem cor de lado e só se pintaria
     no round 13. */
  $("lsSideA").className="ls-side ct"+(jogo.meuA?" mine":"");
  $("lsSideB").className="ls-side tr"+(jogo.meuB?" mine":"");
  $("lsSideA").innerHTML=scoreboardSideHtml({name:jogo.nomeA,mine:jogo.meuA,color:jogo.corA,stats:jogo.statsA});
  $("lsSideB").innerHTML=scoreboardSideHtml({name:jogo.nomeB,mine:jogo.meuB,color:jogo.corB,stats:jogo.statsB});
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
  /* O FECHAMENTO FALA E SAI DE CENA. Deixar o painel aberto no fim tapava o
     placar e a tabela — o resultado é o que o jogador veio ver, e a narração não
     pode ficar por cima dele. Era este o "buga na transição do melhor momento
     pra simulação": o palco reabria aqui e nada mais o fechava. */
  if(NARRA.ativa){
    dizer(falaFechamento(NARRA.ctx,jogo.placar,Math.random),"fim de mapa");
    const g=MP.gen;
    setTimeout(()=>{if(g===MP.gen)fecharPalco();},RITMO.narrFecho);
  }
  $("matchSkip").hidden=true;$("matchContinue").hidden=false;
  if(MP.onFim){const cb=MP.onFim;MP.onFim=null;cb();} // dispara só uma vez
}
// pula direto pro resultado do mapa em curso (renderiza tudo de uma vez)
function pularMapa(){
  if(!MP.ativo||!MP.jogo)return;
  const jogo=MP.jogo;clearTimeout(MP.timer);
  /* PULAR NO MEIO DE UM ROUND NARRADO deixava o palco preso na tela por cima do
     resultado — a "transição do melhor momento pra simulação" bugando. O timer
     que fecharia o painel acabou de ser cancelado, então quem pula tem de
     fechá-lo. Medido: palco aberto em 100% das vezes que se pulava narrando. */
  fecharPalco();
  document.querySelectorAll(".rs-cell.narrando").forEach(c=>c.classList.remove("narrando"));
  $("roundStrip").innerHTML="";
  jogo.rounds.forEach(rd=>addCelula(rd,rd.venceA?rd.ladoA:rd.ladoB,null,
    rd.venceA?jogo.meuA:jogo.meuB));
  $("sbScoreA").textContent=jogo.placar[0];$("sbScoreB").textContent=jogo.placar[1];
  /* PULAR TAMBÉM VIRA OS LADOS. O salto reconstrói placar e strip, mas os chips
     ficavam no lado da PRIMEIRA metade: quem pulava um mapa que passou do round
     13 terminava vendo o lado errado, e o erro sobrevivia na tela de resultado.
     O lado final vem do último round jogado, que é a fonte real — não de contar
     rounds e supor onde foi a troca. */
  const fim=jogo.rounds.at(-1);
  if(fim)definirLados(String(fim.ladoA).toLowerCase(),String(fim.ladoB).toLowerCase());
  esconderAvisoVirada();
  finalizarReproducao(jogo,MP.gen);
}
/* PARAR PARA TUDO, inclusive o aviso da virada. `MP.timer` já morria aqui, mas o
   `MP.avisoTimer` não — fechar a partida com o aviso na tela deixava um timer
   correndo por até 2,6 s depois do overlay sumir. Hoje ele não chega a aparecer
   porque `reproduzirMapa` limpa na entrada, mas é exatamente a forma do defeito
   que a regra 38 cobra: todo timer precisa poder desistir, e quem desliga a
   reprodução tem de desligar os DOIS. */
function pararReproducao(){MP.ativo=false;MP.gen++;clearTimeout(MP.timer);
  esconderAvisoVirada();MATCH.rodando=false;}

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
  MATCH.mapas=sortearMapasDaSerie(md); // a série inteira, sem repetir mapa
  mostrarAntessala();
  abrir("matchOverlay");
}
/* OS MAPAS DA SÉRIE SÃO SORTEADOS DE UMA VEZ — 07/08/2026.
   A antessala mostra todos os mapas do confronto, então eles têm de existir
   antes do primeiro play; e sortear de uma vez é o que permite garantir que
   NÃO SE REPITAM, exatamente como `simularSerie` faz no motor desde sempre. A
   UI, que chamava `simularMapa` sem `mapaForcado`, podia jogar Nuke duas vezes
   no mesmo MD3.

   SOBRE O RNG, declarado sem rodeio: a ordem de consumo MUDA. Era
   `fdA · fdB · mapa` a cada mapa; passa a ser os `md` sorteios de mapa na
   abertura da série e depois `fdA · fdB` por mapa jogado. Não é uma constante
   nova nem um viés: as mesmas grandezas continuam saindo da mesma fonte, com a
   mesma distribuição. É consequência necessária de mostrar o mapa antes de
   jogá-lo — o que foi pedido duas vezes — e está registrado aqui porque ninguém
   deve descobrir isso lendo um diff. */
function sortearMapasDaSerie(md){
  const pool=MAPAS_POOL.slice(),mapas=[];
  for(let i=0;i<md&&pool.length;i++)
    mapas.push(pool.splice(Math.floor(rndF()*pool.length),1)[0]);
  return mapas;
}
/* CONFRONTO DE FORÇA — a mesma força efetiva dos cards, em forma comparável.
   A barra é proporcional à PARTICIPAÇÃO de cada time na soma das duas forças,
   não à força absoluta: o que se quer ler é "quem é favorito e por quanto", e
   uma barra que fosse de 0 a 100 mostraria dois blocos quase iguais em qualquer
   confronto real — as forças do jogo vivem entre 60 e 99, então a diferença
   sumiria justamente onde ela importa.
   O texto continua sendo o número exato, para quem quer a grandeza e para quem
   não lê a barra. */
function montarConfrontoDeForca(A,B){
  const caixa=$("pmForca");if(!caixa)return;
  const efA=Number(A?.ef)||0,efB=Number(B?.ef)||0,total=efA+efB;
  if(!total){caixa.hidden=true;return;}
  caixa.hidden=false;
  const pctA=efA/total*100;
  /* `setAttribute("style")` de uma vez, e não `style.width` antes: o atributo
     inteiro é reescrito com a cor do time, então qualquer largura posta antes
     dele seria apagada na mesma linha. Havia duas dessas, mortas. */
  $("pmForcaA").setAttribute("style",`${estiloDoTime(A)};width:${pctA}%`);
  $("pmForcaB").setAttribute("style",`${estiloDoTime(B)};width:${100-pctA}%`);
  const dif=Math.abs(efA-efB);
  /* "Equilibrado" tem de ter piso, senão 1 ponto de diferença já nomearia um
     favorito — e no jogo 1 ponto não decide nada. */
  const veredito=dif<=3?"Equilibrado"
    :`${esc((efA>efB?A:B).nome)} favorito por ${dif}`;
  $("pmForcaLeg").innerHTML=
    `<span class="pm-forca-n">${efA}</span>`
    +`<span class="pm-forca-v">${veredito}</span>`
    +`<span class="pm-forca-n">${efB}</span>`;
}
function mostrarAntessala(){
  $("livemap").classList.add("is-hidden");mostrarTela("prematch");
  const {A,B,contexto,md}=MATCH;
  if(!A||!B)return; // proteção: par incompleto
  /* DESTAQUE ANTES DE DETALHE — 07/08/2026, a pedido: "a pessoa tem que bater o
     olho e já entender, não tem que ficar lendo nada". A linha única de antes
     dava o mesmo peso tipográfico a quatro informações; agora a FASE é o que se
     lê de relance, o resto vira apoio, e "decisivo" ganha selo em vez de virar
     mais um item da mesma frase. */
  /* A FAIXA DE CONTEXTO É UMA SÓ, EM CHIPS PADRONIZADOS — 07/08/2026, a pedido:
     *"aquelas infos em cima do bloco do meio, tem que ser tudo padronizado e bem
     organizado"*. Antes eram duas peças de formatos diferentes: uma pílula com
     título, selo e subtítulo dentro, e outra com rótulo mais número. Formas
     diferentes para informações do mesmo nível é o que fazia a faixa parecer
     bagunçada.
     Agora todo item é o MESMO objeto — rótulo pequeno em cima, valor embaixo —,
     e a diferença entre eles é só ênfase: o formato da série vem destacado,
     porque é o que muda o tamanho do confronto. */
  const {fase,rodada,situacao,etapa,decisivo}=contexto||{};
  const chip=(rot,val,classe="")=>
    `<div class="pm-chip ${classe}"><span class="pm-chip-r">${esc(rot)}</span>`
    +`<b class="pm-chip-v">${esc(val)}</b></div>`;
  /* "MELHOR DE N" é a escrita que o responsável pediu, e é também a do CS —
     quem joga lê "melhor de 3" sem traduzir. */
  const itens=[chip("Fase",fase||"Partida")];
  if(rodada)itens.push(chip("Rodada",rodada));
  if(etapa)itens.push(chip("Etapa",etapa));
  if(situacao)itens.push(chip("Você está",situacao));
  itens.push(chip("Série",`Melhor de ${md<=1?1:md}`,"pm-chip--serie"));
  if(decisivo)itens.push(chip("Vale","Mata-mata","pm-chip--alerta"));
  $("prematchCtx").innerHTML=itens.join("");
  $("pmTeamA").className="pm-lado pm-lado--a"+(A.meu?" mine":"");$("pmTeamA").innerHTML=prematchTeamHtml(A);
  $("pmTeamB").className="pm-lado pm-lado--b"+(B.meu?" mine":"");$("pmTeamB").innerHTML=prematchTeamHtml(B);
  $("pmTeamA").setAttribute("style",estiloDoTime(A));
  $("pmTeamB").setAttribute("style",estiloDoTime(B));
  montarConfrontoDeForca(A,B);
  /* A ANTESSALA VESTE O AMBIENTE DO MAPA DA VEZ: é ele que vai ser jogado agora,
     e chegar à partida com o fundo já naquele clima é o que faz a transição
     parecer contínua em vez de um corte. */
  $("prematch").setAttribute("style",estiloDoMapa(MATCH.mapas[0]||""));
  /* TODOS os mapas da série ficam aqui embaixo, inclusive num MD1 — a faixa
     dentro do palco saiu. Um lugar só para a mesma informação, seja um mapa ou
     três; o primeiro é o que vai ser jogado agora e vem em cheio, os outros
     apagados. */
  $("pmMapa").hidden=!MATCH.mapas.length;
  $("pmMapa").innerHTML=MATCH.mapas.map((mapa,i)=>
    `<div class="pm-mapa${i===0?" pm-mapa--agora":""}" style="${estiloDoMapa(mapa)}">`
    +`<span class="pm-mapa-nome">${esc(mapa)}</span>`
    +`</div>`).join("");
}
function iniciarMapaDaSerie(){
  if(MATCH.rodando)return; // já tem um mapa em curso — ignora clique repetido
  MATCH.rodando=true;
  Audio.init();
  $("prematch").classList.add("is-hidden");mostrarTela("livemap");
  const {A,B}=MATCH;
  const fdA=forcaDoDia(A.ef,A.quim),fdB=forcaDoDia(B.ef,B.quim);
  const tA={...A.time,nome:A.nome,cor:A.cor,meu:A.meu},tB={...B.time,nome:B.nome,cor:B.cor,meu:B.meu};
  /* O mapa vem da lista sorteada na abertura da série — é o mesmo que a
     antessala mostrou. O `||undefined` mantém o comportamento antigo (sorteio
     dentro de `simularMapa`) caso a lista falte, para que uma série sem
     antessala nunca fique sem mapa. */
  const jogo=simularMapa(tA,tB,fdA,fdB,MATCH.mapas[MATCH.mapaIdx]||undefined);
  MP.onFim=()=>{ // ao fim do mapa: contabiliza a série e libera o botão Continuar
    /* IDENTIDADE POR REFERÊNCIA, não por nome — 07/08/2026. Isto era
       `jogo.vencedorNome===A.nome`, e o nome do clube passou a ser escolhido pelo
       jogador: um time chamado como o adversário fazia TODO mapa contar para o
       lado A. A Suíça já resolvia assim desde antes ("robusto a nomes iguais: 2
       Spirit/FURIA"); a série é que tinha ficado para trás.
       `simularMapa` devolve `vencedor` como o próprio objeto que recebeu, então a
       comparação é exata e não depende de texto nenhum. */
    if(jogo.vencedor===tA)MATCH.vA++;else MATCH.vB++;
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
/* A escolha vale para o MAPA que vai começar, e a antessala reaparece a cada
   mapa da série — foi o pedido: perguntar sempre, sem preferência salva. */
$("prematchStart").onclick=()=>{MATCH.narrado=false;iniciarMapaDaSerie();};
$("prematchNarrado").onclick=()=>{MATCH.narrado=true;iniciarMapaDaSerie();};
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
