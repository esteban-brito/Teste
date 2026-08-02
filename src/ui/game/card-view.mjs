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
/* Mesma pergunta que o time já fazia — "as duas primeiras letras deste nome" —
   então a regra é reusada em vez de ganhar uma segunda cópia. */
import {teamMonogram as monograma} from "./team-view.mjs";

const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",
  en:"Entrada",tr:"Trade",sn:"AWP"};
const DEFAULT_BACK_STATS=["fp","op","cl","ut"];
const COMPLEMENTARY_STATS=[...DEFAULT_BACK_STATS,"en","tr","sn"];
const AXIS_ATTRIBUTE={fogo:"fp",ent:"en",ab:"op",tr:"tr",cl:"cl",ut:"ut"};
const COLOCACAO_LABEL={Campeao:"Campeão",Final:"Vice",Top4:"Top 4",Top8:"Top 8",Grupos:"Grupos"};
/* A frase diz o QUE a característica faz; os números vêm do motor logo abaixo.
   Até 31/07/2026 ela também trazia os valores escritos à mão — "15%", "30%",
   "5%", "18%", "4%" — todos duplicando constantes de `CFG_QUIMICA.CARAC`.
   Rebalancear a química deixava a carta mentindo em silêncio, sem guarda nenhuma
   reprovando. Aqui não entra número. */
const COACH_DESCRIPTION={
  Gestor:"Sustenta mais uma estrela e abranda a briga por espaço.",
  Desenvolvedor:"Abranda a penalidade de elenco cru e lapida os verdes.",
  Estrategista:"Abranda as penalidades de estrutura e de comando.",
  Motivador:"Abranda as penalidades de cobertura e saturação."};

/* O motor é dono dos números; a carta é dona das palavras. Cada linha aponta
   para a chave real de `CFG_QUIMICA.CARAC`, lida viva por `coachRecipe`.

   São sempre DUAS linhas, nas quatro características, porque a silhueta do verso
   não pode depender de quantas alavancas a química deu a cada uma. Motivador tem
   um único corte, e ele de fato incide sobre cobertura e saturação: as duas
   linhas dizem a verdade, não repetem por enfeite. */
const COACH_EFFECT_ROWS={
  Gestor:[["Teto de estrelas","tetoEstrelasBonus","sinal"],
    ["Penalidade por extra","estrelaExtraPen","pct"]],
  Desenvolvedor:[["Corte por jogador cru","cruPorJogador","pct"],
    ["Teto do corte","cruTeto","pct"]],
  Estrategista:[["Corte de estrutura","corteEstrutura","pct"],
    ["Corte de comando","corteComando","pct"]],
  Motivador:[["Corte de cobertura","cortePenalidade","pct"],
    ["Corte de saturação","cortePenalidade","pct"]]};

/* `pct` arredonda para inteiro porque a química não usa fração de ponto
   percentual em nenhuma das quatro; `sinal` marca o bônus como acréscimo. */
const formatarEfeito=(valor,formato)=>{
  if(!Number.isFinite(valor))return "—";
  if(formato==="sinal")return `${valor>0?"+":""}${valor}`;
  return `${Math.round(valor*100)}%`;
};

/* Seis faixas por OVR: 5 · 39 · 24 · 11 · 2 · 4 jogadores. */
const tierOf=ovr=>ovr>=22?"tier-6":ovr>=21?"tier-5":ovr>=20?"tier-4"
  :ovr>=18?"tier-3":ovr>=15?"tier-2":"tier-1";
const slugFuncao=role=>String(role||"").toLowerCase().replace(/[^a-z]/g,"")||"rifler";

/* Ajuste exclusivo do rótulo de característica; nicks usam o corpo universal. */
/* A grade é única; só o corpo do rótulo longo reduz para preservar a mesma
   caixa. Os fatores compensam a largura extra de Estrategista/Desenvolvedor.

   Revistos em 31/07/2026: a 0,77 o `Estrategista` do treinador media 5,6% da
   altura da carta contra 7,3% do `Playmaker` do jogador, e o verso do treinador
   parecia uma versão encolhida do outro em vez da mesma carta. `Estrategista`
   O teto NÃO é a largura da caixa no Windows: o CI Linux mede o mesmo
   `Estrategista` cerca de 10,8 px mais largo a 120 px, e foi assim que 0,9
   passou aqui e reprovou lá com 5,4 px de estouro. A régua é a folga medida na
   largura mais apertada (120 px), que precisa cobrir esse delta com sobra:
   0,80 deixa ~15,6 px e 0,70 deixa ~11 px, contra os 5,4 px que falharam.
   Aumentar mais exige encolher o corpo por faixa de densidade, não por nick. */
const escalaCarac=texto=>texto.length<=10?1:texto.length<=12?.8:.7;

/* MONOGRAMA DO CAMPO VAZIO.

   Sem retrato, o campo da foto é a maior área da carta em preto quase liso — e é
   o estado de 80 dos 85 jogadores e de 14 dos 15 treinadores. O monograma dá
   marca a essa área e, tingido pela raridade, devolve a leitura da escada onde o
   retrato não existe: sem ele, as seis faixas viram seis retângulos pretos
   separados por um tint fraco.

   Ele NÃO é emitido quando há foto. Não é uma regra de exceção no CSS: o HTML
   simplesmente não cria o nó. O centro pertence ao retrato — foi por isso que os
   emblemas de função saíram, e o monograma não pode reabrir essa disputa. */
const camadasDeFundo=card=>`<div class="c-foto"></div>`+
  (fotoStyle(card)?"":`<div class="c-mono" aria-hidden="true">${esc(monograma(card.nick||""))}</div>`)+
  `<div class="c-vinheta"></div>`;
const bandeiraHtml=pais=>{
  const fonte=bandeiraDe(pais);
  return fonte?`<div class="c-flag" style="background-image:url('${esc(fonte)}')" title="${esc(pais)}"></div>`:"";
};
/* O ID, e não um caminho arbitrário, cruza a fronteira dado → CSS. */
const fotoStyle=card=>{
  const id=card.foto||card._eng?.foto||"";
  return /^[a-zA-Z0-9_-]+$/.test(id)?`--foto:url('fotos/${id}.webp')`:"";
};

export function createCardView({styleId,styleLabel,styleRecipe,coachRecipe}){
  const teamCardHTML=(team,extra="")=>`<div class="tcard ${extra}" data-team="${esc(team.id)}" style="--col:${esc(team.cor)}">
  <div class="tcoloc">${esc(team.coloc)}</div><div class="tname">${esc(team.nome)}</div><div class="tcamp">${esc(team.camp)}</div></div>`;

  /* Raridade pinta a estrutura; função colore somente sua informação textual. */
  const cardClass=card=>card.tipo==="coach"
    ?`coachcard coach-${card.caracSlug}`
    :`card ${tierOf(card.ovr)} fn-${slugFuncao(card.prim)}`;

  const frenteHtml=(card,rotulo,destaque,contexto,tipo,extra="")=>`${camadasDeFundo(card)}
  <div class="c-fio"></div><div class="c-placa"></div>
  <div class="c-ovr">${card.ovr}<small>${rotulo}</small></div>
  <div class="c-identidade c-identidade--${tipo}">
    ${bandeiraHtml(card.pais)}
    <div class="c-nick">${esc(card.nick)}</div>
    <div class="c-func">${esc(destaque)}</div>
    <div class="c-meta"><span class="c-role2${contexto[0]?` c-role2--${slugFuncao(contexto[0])}`:""}">${esc(contexto[0])}</span><span class="c-team">${esc(contexto[1])}</span></div>
  </div>${extra}
  <div class="c-grao"></div>`;

  const playerFront=card=>frenteHtml(card,"Overall",card.prim,[card.sec||"",card.time],"player");

  /* A frente do treinador é a MESMA do jogador, com uma linha a menos.

     Ela já foi três coisas: a grade de três linhas do jogador, depois uma réplica
     do bloco do verso (§19.5, sem bandeira), e agora a grade do jogador de novo —
     desta vez com duas linhas, por decisão do responsável em 01/08/2026:
     nick + bandeira na primeira, característica + time na segunda. O jogador põe
     o time na terceira porque tem função secundária; o treinador não tem, então
     o time sobe uma linha. Essa é a única diferença real entre as duas frentes.

     Por isso aqui não há template próprio: `frenteHtml` serve as duas, e o
     treinador só passa a característica no lugar da função, uma função
     secundária vazia e a faixa cromada como extra. Enquanto isso for verdade,
     qualquer refino da frente do jogador chega ao treinador de graça. */
  const coachFront=card=>frenteHtml(card,"Overall",card.carac||"",["",card.time||""],
    "coach",`\n  <div class="c-cat">Treinador</div>`);

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

  /* Ausência de receita não pode virar carta quebrada: sem a tabela, as linhas
     simplesmente não saem e a frase continua de pé. */
  const efeitosDoCoach=carac=>{
    const receita=coachRecipe?coachRecipe(carac):null;
    if(!receita)return "";
    const linhas=(COACH_EFFECT_ROWS[carac]||[])
      .map(([rotulo,chave,formato])=>`<div class="c-vef"><i>${esc(rotulo)}</i>`+
        `<b>${esc(formatarEfeito(receita[chave],formato))}</b></div>`).join("");
    return linhas?`<div class="c-vefeitos">${linhas}</div>`:"";
  };

  const backCoach=card=>`<div class="c-vfio"></div><div class="c-vfaixa"></div>
  <div class="c-vnick">${esc(card.nick)}</div>
  <div class="c-vid"><b>Treinador</b><span>${esc(card.time||"")}</span></div>
  <div class="c-vestilo"><small>Característica</small><b>${esc(card.carac)}</b></div>
  <div class="c-vdesc"><p>${esc(COACH_DESCRIPTION[card.carac]||"")}</p>${efeitosDoCoach(card.carac)}</div>
  ${rodapeVerso(card)}
  <div class="c-grao"></div>`;

  const cardHTML=card=>{
    const coach=card.tipo==="coach";
    const estilos=[fotoStyle(card)];
    if(coach)estilos.push(`--carac-esc:${escalaCarac(rotuloVerso(card))}`);
    const inline=estilos.filter(Boolean);
    return `<div class="cfaces"${inline.length?` style="${inline.join(";")}"`:""}>`+
      `<div class="cface cfront" aria-hidden="false">${coach?coachFront(card):playerFront(card)}</div>`+
      `<div class="cface cback" aria-hidden="true">${coach?backCoach(card):backPlayer(card)}</div></div>`;
  };

  return {teamCardHTML,cardClass,cardHTML};
}
