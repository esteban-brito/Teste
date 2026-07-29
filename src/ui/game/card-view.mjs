/* CARTA — frente e verso, HTML puro.
   ══════════════════════════════════════════════════════════════════════════════

   FRENTE: quem é e quanto vale.   VERSO: como joga.

   Três níveis de leitura na frente, e só três: OVR sozinho no canto, nick sobre
   uma placa sólida, função primária na cor da raridade. O rodapé (função
   secundária e time) é apagado de propósito — é contexto, não hierarquia.

   O nick sobre PLACA SÓLIDA, e não sobre degradê, porque o contraste de um
   degradê muda ao longo da própria palavra. É o que cartas de coleção reais
   fazem, e é o que sustenta o dia em que houver foto atrás.

   O VERSO tem o playstyle como espinha, com a receita visível: dá para ver POR
   QUE ele é aquele estilo, com os pesos que o motor usa de verdade. Firepower
   vem sempre primeiro; o resto por contribuição (peso × valor). Por isso o verso
   mostra 3 ou 4 estatísticas — 3 quando Firepower já está na receita — e o
   layout centraliza para absorver os dois casos sem reajuste.

   A CAMADA DE FOTO EXISTE E ESTÁ VAZIA. Hoje 0 de 85 jogadores têm retrato e não
   há campo para guardá-lo. O estado "sem foto" é declarado, não um remendo: a
   tinta da raridade sobe e a carta fica assumidamente gráfica. Quando as fotos
   existirem, é mudança de dado — não redesenho.

   O TREINADOR usa o MESMO esqueleto. A diferença é que a cor não vem da
   raridade e sim da característica dele, porque ele não disputa a escala de OVR
   dos jogadores; e a característica ocupa o lugar da função primária, já que é
   ela que descreve o que ele faz pelo time. */
import {escapeHtml as esc} from "../shared/html.mjs";
import {bandeiraDe} from "../shared/flags.mjs";
import {emblemaDe,EMBLEMA_TREINADOR,slugFuncao} from "../shared/role-emblems.mjs";

const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",en:"Entrada",tr:"Trade",sn:"AWP"};
const DEFAULT_BACK_STATS=["fp","op","cl","ut"];
const AXIS_ATTRIBUTE={fogo:"fp",ent:"en",ab:"op",tr:"tr",cl:"cl",ut:"ut"};
const COLOCACAO_LABEL={Campeao:"Campeão",Final:"Vice",Top4:"Top 4",Top8:"Top 8",Grupos:"Grupos"};
const COACH_DESCRIPTION={
  Gestor:"Tolera +1 estrela no elenco. Penalidade por estrela extra: 7% → 4%.",
  Desenvolvedor:"Reduz penalidades de elenco cru: 5% por jogador de OVR ≤14, até 18%.",
  Estrategista:"Reduz penalidades de estrutura em 15% e de comando (IGL) em 30%.",
  Motivador:"Reduz em 30% as penalidades de cobertura e saturação do elenco."};

/* Faixas de raridade, por OVR puro. A pirâmide anterior punha 87% dos 85
   jogadores em verde ou ouro, então a raridade quase não dizia nada — quatro
   cartas de um mesmo elenco saíam idênticas. Esta distribui de verdade:
   27 · 30 · 11 · 11 · 6 jogadores, do mais comum ao mais raro.
   Promover por `estrela` foi descartado por medição: a flag é exatamente
   ovr>=20, com zero discordâncias em 85 — não moveria uma única carta. */
const tierOf=ovr=>ovr>=21?"tier-h":ovr>=20?"tier-s":ovr>=19?"tier-1":ovr>=17?"tier-2":"tier-3";

/* Nome curto e nome longo ocupam a mesma caixa óptica. É RAZÃO, não tamanho:
   quem a aplica é o envelope das duas faces, então frente e verso encolhem
   juntos. Antes o nome era cortado com reticências na frente e tinha um ajuste
   por JavaScript no verso — mesma informação, dois comportamentos. */
const escalaNick=nome=>nome.length<=6?1:nome.length<=9?.825:nome.length<=12?.675:.5625;

const camadasDeFundo=`<div class="c-foto"></div><div class="c-tinta"></div><div class="c-vinheta"></div>`;
const bandeiraHtml=pais=>{const fonte=bandeiraDe(pais);
  return fonte?`<div class="c-flag" style="background-image:url('${fonte}')" title="${esc(pais)}"></div>`:"";};

export function createCardView({styleId,styleLabel,styleRecipe}){
  const teamCardHTML=(team,extra="")=>`<div class="tcard ${extra}" data-team="${esc(team.id)}" style="--col:${esc(team.cor)}">
  <div class="tcoloc">${esc(team.coloc)}</div><div class="tname">${esc(team.nome)}</div><div class="tcamp">${esc(team.camp)}</div></div>`;

  /* Duas classes, dois canais: `tier-*` pinta a moldura (raridade) e `fn-*`
     pinta o campo (função). Elas não se sobrepõem em nenhuma propriedade. */
  const cardClass=card=>card.tipo==="coach"
    ?`coachcard coach-${card.caracSlug}`
    :`card ${tierOf(card.ovr)} fn-${slugFuncao(card.prim)}`;

  /* Frente compartilhada. `rotulo` é o texto sob o OVR e serve de MARCADOR DE
     TIPO: é o único ponto da carta que nunca some por falta de espaço, então é
     ali que "Treinador" aparece. `destaque` é a função primária do jogador ou a
     característica do treinador; `contexto` é o par do rodapé. */
  const frenteHtml=(card,rotulo,destaque,contexto,emblema)=>`${camadasDeFundo}
  <div class="c-emblema">${emblema}</div>
  <div class="c-fio"></div><div class="c-placa"></div>
  <div class="c-ovr">${card.ovr}<small>${rotulo}</small></div>
  ${bandeiraHtml(card.pais)}
  <div class="c-nick">${esc(card.nick)}</div>
  <div class="c-func">${esc(destaque)}</div>
  <div class="c-meta"><span>${esc(contexto[0])}</span><span>${esc(contexto[1])}</span></div>
  <div class="c-grao"></div>`;

  const playerFront=card=>frenteHtml(card,"Overall",card.prim,[card.sec||"",card.time],emblemaDe(card.prim));
  const coachFront=card=>frenteHtml(card,"Treinador",card.carac,["",card.time],EMBLEMA_TREINADOR);

  /* Firepower permanece primeiro. As outras estatísticas são ordenadas pela
     contribuição peso × valor usada na classificação do playstyle. */
  const statsDoEstilo=(id,enginePlayer)=>{
    const recipe=id==="joker"?null:styleRecipe(id);
    if(!recipe)return null;
    const weights=recipe.ovrW||recipe.w;
    const ordenadas=Object.entries(weights)
      .map(([axis,weight])=>({attr:AXIS_ATTRIBUTE[axis],weight,
        contrib:weight*((enginePlayer&&enginePlayer[AXIS_ATTRIBUTE[axis]])||0)}))
      .filter(item=>item.attr)
      .sort((a,b)=>b.contrib-a.contrib);
    const pesoDe=attr=>{const achou=ordenadas.find(item=>item.attr===attr);return achou?achou.weight:null;};
    const chaves=["fp",...ordenadas.map(item=>item.attr).filter(attr=>attr!=="fp")].slice(0,4);
    return chaves.map(attr=>({attr,peso:pesoDe(attr)}));
  };

  /* min-width no trilho segura o caso real: chopper tem Firepower 2. Sem isso a
     barra some e parece defeito, quando na verdade ela É a informação. */
  const statHtml=({attr,peso},enginePlayer)=>{
    const valor=Math.round(enginePlayer[attr]||0);
    const pesoTexto=peso==null?"":String(Number(peso.toFixed(2))).replace(/^0\./,".");
    return `<div class="c-st"><i>${esc(STAT_LABEL[attr])}</i><em>${pesoTexto}</em><b>${valor}</b>`+
      `<div class="c-trilho"><u style="width:${valor}%"></u></div></div>`;
  };

  const backPlayer=card=>{
    const enginePlayer=card._eng||{};
    const id=styleId(enginePlayer.playstyle);
    const receita=statsDoEstilo(id,enginePlayer);
    /* Coringa não tem receita: é polivalente por definição. O verso diz isso em
       vez de mostrar barras vazias. */
    const linhas=receita
      ? receita.map(item=>statHtml(item,enginePlayer)).join("")
      : DEFAULT_BACK_STATS.map(attr=>statHtml({attr,peso:null},enginePlayer)).join("");
    const rating=typeof enginePlayer.rating==="number"?enginePlayer.rating.toFixed(2):"—";
    return `<div class="c-vfio"></div><div class="c-vfaixa"></div>
  <div class="c-vnick">${esc(card.nick)}</div>
  <div class="c-vovr"><b>${card.ovr}</b><small>RTG ${rating}</small></div>
  <div class="c-vestilo"><small>Playstyle</small><b>${esc(enginePlayer.playstyle?styleLabel(id):(card.prim||""))}</b></div>
  <div class="c-vstats">${linhas}</div>
  <div class="c-vrod"><b>${esc(card.camp||"")}</b><span>${esc(COLOCACAO_LABEL[card.coloc]||card.coloc||"")}</span></div>
  <div class="c-grao"></div>`;};

  const backCoach=card=>`<div class="c-vfio"></div><div class="c-vfaixa"></div>
  <div class="c-vnick">${esc(card.nick)}</div>
  <div class="c-vovr"><b>${card.ovr}</b><small>Overall</small></div>
  <div class="c-vestilo"><small>Característica</small><b>${esc(card.carac)}</b></div>
  <div class="c-vdesc">${esc(COACH_DESCRIPTION[card.carac]||"")}</div>
  <div class="c-grao"></div>`;

  const cardHTML=card=>{
    const coach=card.tipo==="coach";
    const front=coach?coachFront(card):playerFront(card);
    const back=coach?backCoach(card):backPlayer(card);
    return `<div class="cfaces" style="--nick-esc:${escalaNick(card.nick)}">`+
      `<div class="cface cfront">${front}</div><div class="cface cback">${back}</div></div>`;
  };

  return {teamCardHTML,cardClass,cardHTML};
}
