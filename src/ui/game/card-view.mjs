import {escapeHtml as esc} from "../shared/html.mjs";

const ROLE_COLOR={IGL:"var(--r-igl)",AWPer:"var(--r-awper)",Entry:"var(--r-entry)",
  Rifler:"var(--r-rifler)",Lurker:"var(--r-lurker)",Support:"var(--r-support)"};
const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",en:"Entrada",tr:"Trade",sn:"AWP"};
const DEFAULT_BACK_STATS=["fp","op","cl","ut"];
const AXIS_ATTRIBUTE={fogo:"fp",ent:"en",ab:"op",tr:"tr",cl:"cl",ut:"ut"};
const COACH_DESCRIPTION={
  Gestor:"Tolera +1 estrela no elenco. Penalidade por estrela extra: 7% → 4%.",
  Desenvolvedor:"Reduz penalidades de elenco cru: 5% por jogador de OVR ≤14, até 18%.",
  Estrategista:"Reduz penalidades de estrutura em 15% e de comando (IGL) em 30%.",
  Motivador:"Reduz em 30% as penalidades de cobertura e saturação do elenco."};

const tierOf=ovr=>ovr>=22?"tier-h":ovr>=21?"tier-s":ovr>=18?"tier-1":ovr>=15?"tier-2":"tier-3";

export function createCardView({styleId,styleLabel,styleRecipe}){
  const teamCardHTML=(team,extra="")=>`<div class="tcard ${extra}" data-team="${esc(team.id)}" style="--col:${esc(team.cor)}">
  <div class="tcoloc">${esc(team.coloc)}</div><div class="tname">${esc(team.nome)}</div><div class="tcamp">${esc(team.camp)}</div></div>`;

  const cardClass=card=>card.tipo==="coach"?"coachcard coach-"+card.caracSlug:"card "+tierOf(card.ovr);

  const playerHTML=card=>`<div class="cmeta"><span>${esc(card.pais)}</span><span>${esc(card.time)}</span></div>
  <div class="ccore"><div class="ovr">${card.ovr}</div><div class="nick">${esc(card.nick)}</div><div class="starsig">${card.estrela?"STAR ★ PLAYER":""}</div></div>
  <div class="roles"><span class="role prim" style="--rc:${ROLE_COLOR[card.prim]}">${esc(card.prim)}</span><span class="role sec${card.secForte?" forte":""}" style="--rc:${ROLE_COLOR[card.sec]}" title="${card.secForte?"Segunda função de verdade: cobre o pilar por inteiro na química":"Segunda função nominal: cobre o pilar só em parte"}">${esc(card.sec)}</span></div>`;

  const coachHTML=card=>`<div class="coach-seal">Treinador</div>
  <div class="cmeta"><span>${esc(card.pais)}</span><span>${esc(card.time)}</span></div>
  <div class="ccore"><div class="ovr">${card.ovr}</div><div class="nick">${esc(card.nick)}</div></div>
  <div class="carac">${esc(card.carac)}</div>`;

  /* Firepower permanece primeiro. As outras estatísticas são ordenadas pela
     contribuição peso × valor usada na classificação do playstyle. */
  const statsDoEstilo=(id,enginePlayer)=>{
    const recipe=id==="joker"?null:styleRecipe(id);
    if(!recipe)return DEFAULT_BACK_STATS;
    const weights=recipe.ovrW||recipe.w;
    return Object.entries(weights)
      .map(([axis,weight])=>({attr:AXIS_ATTRIBUTE[axis],contrib:weight*((enginePlayer&&enginePlayer[AXIS_ATTRIBUTE[axis]])||0)}))
      .filter(item=>item.attr)
      .sort((a,b)=>b.contrib-a.contrib)
      .map(item=>item.attr);
  };
  const statBar=(label,value)=>`<div class="statbar"><span class="sb-lab">${esc(label)}</span><span class="sb-val">${Math.round(value||0)}</span></div>`;
  const backPlayer=card=>{const enginePlayer=card._eng||{};const id=styleId(enginePlayer.playstyle);
    const base=statsDoEstilo(id,enginePlayer);
    const keys=["fp",...base.filter(key=>key!=="fp")].slice(0,4);
    return `<div class="cb-head">${esc(enginePlayer.playstyle?styleLabel(id):(card.prim||""))}</div>`+
      `<div class="cb-stats">${keys.map(key=>statBar(STAT_LABEL[key],enginePlayer[key])).join("")}</div>`;};
  const backCoach=card=>`<div class="cb-desc">${esc(COACH_DESCRIPTION[card.carac]||"")}</div>`;
  const cardHTML=card=>{const back=card.tipo==="coach"?backCoach(card):backPlayer(card);const front=card.tipo==="coach"?coachHTML(card):playerHTML(card);
    return `<div class="cfaces"><div class="cface cfront">${front}</div><div class="cface cback">${back}</div></div>`;};

  return {teamCardHTML,cardClass,cardHTML};
}
