/* Carta canônica — frente e verso em HTML puro.
   A frente usa uma grade fixa para nick, role principal, bandeira, role
   secundário e time. O verso usa quatro slots fixos: Firepower, atributos mais
   relevantes ao playstyle e, quando necessário, o melhor atributo complementar.

   Jogadores nunca recebem fonte, offset ou recorte individual. O dado cru pode
   declarar um ID de foto; sem ele, o mesmo componente renderiza o fallback
   gráfico. Treinadores compartilham o esqueleto, mas mantêm escala própria para
   nomes de característica porque são outra categoria de carta. */
import {escapeHtml as esc} from "../shared/html.mjs";
import {bandeiraDe} from "../shared/flags.mjs";

const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",
  en:"Entrada",tr:"Trade",sn:"AWP"};
const DEFAULT_BACK_STATS=["fp","op","cl","ut"];
const COMPLEMENTARY_STATS=[...DEFAULT_BACK_STATS,"en","tr","sn"];
const AXIS_ATTRIBUTE={fogo:"fp",ent:"en",ab:"op",tr:"tr",cl:"cl",ut:"ut"};
const COLOCACAO_LABEL={Campeao:"Campeão",Final:"Vice",Top4:"Top 4",Top8:"Top 8",Grupos:"Grupos"};
const COACH_DESCRIPTION={
  Gestor:"Tolera +1 estrela no elenco. Penalidade por estrela extra: 7% → 4%.",
  Desenvolvedor:"Reduz penalidades de elenco cru: 5% por jogador de OVR ≤14, até 18%.",
  Estrategista:"Reduz penalidades de estrutura em 15% e de comando (IGL) em 30%.",
  Motivador:"Reduz em 30% as penalidades de cobertura e saturação do elenco."};

/* Seis faixas por OVR: 5 · 39 · 24 · 11 · 2 · 4 jogadores. */
const tierOf=ovr=>ovr>=22?"tier-6":ovr>=21?"tier-5":ovr>=20?"tier-4"
  :ovr>=18?"tier-3":ovr>=15?"tier-2":"tier-1";
const slugFuncao=role=>String(role||"").toLowerCase().replace(/[^a-z]/g,"")||"rifler";

/* Ajustes exclusivos do treinador; jogadores usam corpos universais no CSS. */
const escalaNick=nome=>nome.length<=6?1:nome.length<=9?.825:nome.length<=12?.675:.5625;
const escalaCarac=texto=>texto.length<=10?1:texto.length<=12?.88:.8;

const camadasDeFundo=`<div class="c-foto"></div><div class="c-vinheta"></div>`;
const bandeiraHtml=pais=>{
  const fonte=bandeiraDe(pais);
  return fonte?`<div class="c-flag" style="background-image:url('${esc(fonte)}')" title="${esc(pais)}"></div>`:"";
};
/* O ID, e não um caminho arbitrário, cruza a fronteira dado → CSS. */
const fotoStyle=card=>{
  const id=card.foto||card._eng?.foto||"";
  return /^[a-zA-Z0-9_-]+$/.test(id)?`--foto:url('fotos/${id}.webp')`:"";
};

export function createCardView({styleId,styleLabel,styleRecipe}){
  const teamCardHTML=(team,extra="")=>`<div class="tcard ${extra}" data-team="${esc(team.id)}" style="--col:${esc(team.cor)}">
  <div class="tcoloc">${esc(team.coloc)}</div><div class="tname">${esc(team.nome)}</div><div class="tcamp">${esc(team.camp)}</div></div>`;

  /* Raridade pinta a estrutura; função colore somente sua informação textual. */
  const cardClass=card=>card.tipo==="coach"
    ?`coachcard coach-${card.caracSlug}`
    :`card ${tierOf(card.ovr)} fn-${slugFuncao(card.prim)}`;

  const frenteHtml=(card,rotulo,destaque,contexto,tipo)=>`${camadasDeFundo}
  <div class="c-fio"></div><div class="c-placa"></div>
  <div class="c-ovr">${card.ovr}<small>${rotulo}</small></div>
  <div class="c-identidade c-identidade--${tipo}">
    ${bandeiraHtml(card.pais)}
    <div class="c-nick">${esc(card.nick)}</div>
    <div class="c-func">${esc(destaque)}</div>
    <div class="c-meta"><span class="c-role2${contexto[0]?` c-role2--${slugFuncao(contexto[0])}`:""}">${esc(contexto[0])}</span><span class="c-team">${esc(contexto[1])}</span></div>
  </div>
  <div class="c-grao"></div>`;

  const playerFront=card=>frenteHtml(card,"Overall",card.prim,[card.sec||"",card.time],"player");
  const coachFront=card=>frenteHtml(card,"Treinador",card.carac,["",card.time],"coach");

  /* Firepower permanece primeiro. A receita ordena os seguintes por contribuição
     real (peso × valor); um atributo complementar completa o quarto slot. */
  const statsDoEstilo=(id,enginePlayer)=>{
    const recipe=id==="joker"?null:styleRecipe(id);
    if(!recipe)return null;
    const weights=recipe.ovrW||recipe.w;
    const ordenadas=Object.entries(weights)
      .map(([axis,weight])=>({attr:AXIS_ATTRIBUTE[axis],weight,
        contrib:weight*((enginePlayer&&enginePlayer[AXIS_ATTRIBUTE[axis]])||0)}))
      .filter(item=>item.attr)
      .sort((a,b)=>b.contrib-a.contrib);
    const chaves=[...new Set(["fp",...ordenadas.map(item=>item.attr)])].slice(0,4);
    const complementares=COMPLEMENTARY_STATS.filter(attr=>!chaves.includes(attr))
      .sort((a,b)=>((enginePlayer&&enginePlayer[b])||0)-((enginePlayer&&enginePlayer[a])||0));
    chaves.push(...complementares.slice(0,Math.max(0,4-chaves.length)));
    return chaves.map(attr=>({attr}));
  };

  const statHtml=({attr},enginePlayer)=>{
    const valor=Math.round(enginePlayer[attr]||0);
    return `<div class="c-st"><i>${esc(STAT_LABEL[attr])}</i><b>${valor}</b>`+
      `<div class="c-trilho"><u style="width:${valor}%"></u></div></div>`;
  };

  const rotuloVerso=card=>{
    if(card.tipo==="coach")return card.carac||"";
    const enginePlayer=card._eng||{};
    return enginePlayer.playstyle?styleLabel(styleId(enginePlayer.playstyle)):(card.prim||"");
  };

  /* `camp` já é a string canônica de evento + ano; a UI não a reinterpreta. */
  const rodapeVerso=card=>`<div class="c-vrod"><b>${esc(card.camp||"")}</b>`+
    `<span>${esc(COLOCACAO_LABEL[card.coloc]||card.coloc||"")}</span></div>`;

  const backPlayer=card=>{
    const enginePlayer=card._eng||{};
    const id=styleId(enginePlayer.playstyle);
    const receita=statsDoEstilo(id,enginePlayer);
    /* Coringa não tem receita por definição e usa o conjunto padrão. */
    const linhas=(receita||DEFAULT_BACK_STATS.map(attr=>({attr})))
      .map(item=>statHtml(item,enginePlayer)).join("");
    /* A faixa superior do verso guardava só o nick e sobrava vazia. A linha de
       identidade a preenche e torna o verso autossuficiente: virada a carta,
       ainda se sabe QUEM joga e por QUEM. Função na cor dela, ecoando a frente. */
    return `<div class="c-vfio"></div><div class="c-vfaixa"></div>
  <div class="c-vnick">${esc(card.nick)}</div>
  <div class="c-vid"><b>${esc(card.prim||"")}</b><span>${esc(card.time||"")}</span></div>
  <div class="c-vestilo"><small>Playstyle</small><b>${esc(rotuloVerso(card))}</b></div>
  <div class="c-vstats">${linhas}</div>
  ${rodapeVerso(card)}
  <div class="c-grao"></div>`;
  };

  const backCoach=card=>`<div class="c-vfio"></div><div class="c-vfaixa"></div>
  <div class="c-vnick">${esc(card.nick)}</div>
  <div class="c-vestilo"><small>Característica</small><b>${esc(card.carac)}</b></div>
  <div class="c-vdesc">${esc(COACH_DESCRIPTION[card.carac]||"")}</div>
  ${rodapeVerso(card)}
  <div class="c-grao"></div>`;

  const cardHTML=card=>{
    const coach=card.tipo==="coach";
    const estilos=[fotoStyle(card)];
    if(coach)estilos.push(`--nick-esc:${escalaNick(card.nick)}`,
      `--carac-esc:${escalaCarac(rotuloVerso(card))}`);
    const inline=estilos.filter(Boolean);
    return `<div class="cfaces"${inline.length?` style="${inline.join(";")}"`:""}>`+
      `<div class="cface cfront" aria-hidden="false">${coach?coachFront(card):playerFront(card)}</div>`+
      `<div class="cface cback" aria-hidden="true">${coach?backCoach(card):backPlayer(card)}</div></div>`;
  };

  return {teamCardHTML,cardClass,cardHTML};
}
