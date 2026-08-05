/* TÁTICA — a composição que o motor consome, uma por mapa.
   ══════════════════════════════════════════════════════════════════════════════

   Reúne identidade, repertório de jogada, os dois modelos de oponente e a
   decisão de round num objeto só, para que `map-simulation.mjs` não precise
   conhecer as peças. O motor faz duas chamadas por round e nada mais:

     planejarRound(...)  antes do combate  → os empurrões nos botões existentes
     registrarRound()    depois do combate → cada lado observa o que o outro fez

   CADA TIME TEM O SEU MODELO DO OUTRO, e eles não se falam. `modeloDeA` é o que
   A acredita sobre B; `modeloDeB` é o que B acredita sobre A. Um modelo
   compartilhado seria onisciência disfarçada de leitura.

   NÃO SE ESQUECE NO INTERVALO, de propósito. A memória já é por LADO: o que B
   fez de TR no primeiro tempo fica guardado como "B de TR". Quando os lados
   trocam, a consulta passa a ser pela memória de CT de B, que está vazia e
   começa a encher — que é exatamente o que acontece com um time real ao ver o
   adversário do outro lado pela primeira vez. Esquecer no intervalo jogaria
   fora informação legítima e ainda quebraria o overtime.

   OS EMPURRÕES SÃO PEQUENOS E LIMITADOS. Eles entram nos botões que o motor já
   tem — aresta de abertura, ritmo de contato e plant — e nunca criam um modelo
   paralelo de combate. `docs/ciclos/tatica-baseline-2026-08-04.md` explica por
   que quatro dos cinco eixos de identidade NÃO podem render aqui: eles já
   rendem no motor, e contá-los de novo seria balanceamento disfarçado de
   realismo. O que a camada acrescenta é `leitura` e a interação plano ×
   contra-plano.

   ─────────────────────────────────────────────────────────────────────────────
   O QUE SE OBSERVA É A JOGADA, DIRETO — e voltar a isso foi possível porque o
   vocabulário mudou. Com `direcao` A|B a distribuição MARGINAL de todo time era
   50/50 mesmo quando ele repetia 56% das vezes, então contar frequência não
   enxergava nada, e a leitura foi usada em 0,0% de 558 mil rounds. A saída de
   então foi observar a TRANSIÇÃO ("ele repetiu?") e reconstruir a direção.

   Com tipos de jogada a marginal deixa de ser plana: o repertório do elenco a
   inclina sozinho, e a moda de um time real vale 32,7% contra 16,7% de uniforme.
   O rodeio da repetição saiu junto com o problema que ele resolvia. */
import {teamIdentity} from "./team-identity.mjs";
import {playStyleProfile,TIPOS_JOGADA} from "./play-style.mjs";
import {criarModeloOponente,observar,crenca} from "./opponent-model.mjs";
import {planejarRound,confrontoDePlanos} from "./round-plan.mjs";
import {CFG_TATICA} from "./tactics-config.mjs";

const DIMENSAO="jogada";
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** O que este lado acredita que o outro vai rodar. `null` quando não viu nada —
    e quem consome DEVE tratar isso como "não sei", nunca como palpite. */
function preverJogada(modelo,ladoDoOutro,leitura){
  const c=crenca(modelo,ladoDoOutro,DIMENSAO,leitura,undefined,TIPOS_JOGADA.length);
  return c.moda===null?null:c;
}

/** Um mapa em curso: quem é quem, o que cada um sabe fazer e o que acredita. */
export function iniciarMapaTatico(timeA,timeB,referencias,cfgTatica=CFG_TATICA){
  const elencoA=timeA?.jogadores||timeA?.js||[];
  const elencoB=timeB?.jogadores||timeB?.js||[];
  const refId=referencias&&referencias.identidade;
  const refJogada=referencias&&referencias.jogada;
  return {
    cfg:cfgTatica,
    identidadeA:teamIdentity(elencoA,refId),
    identidadeB:teamIdentity(elencoB,refId),
    jogadaA:perfilDeJogada(elencoA,refJogada),
    jogadaB:perfilDeJogada(elencoB,refJogada),
    modeloDeA:criarModeloOponente(),   // o que A acredita sobre B
    modeloDeB:criarModeloOponente(),   // o que B acredita sobre A
    ultimo:null,
    // o próprio jogo de cada um no round anterior, para o "run it back"
    inerciaA:null,inerciaB:null
  };
}

/** Repertório no formato que `planejarRound` consome. `forma` fica de fora de
    propósito: ela carrega força, e `tools/check-tactics-layer.js` reprova
    qualquer módulo da camada que a leia. */
function perfilDeJogada(elenco,referencia){
  const perfil=playStyleProfile(elenco,referencia);
  return {repertorio:perfil.pesos,assinatura:perfil.assinatura,moda:perfil.moda,
    vantagem:perfil.vantagem};
}

/* Pressão do round, entre −1 e 1: negativa quando se está confortável, positiva
   quando o placar aperta. Não é "estar perdendo o mapa" — é a urgência de fazer
   algo diferente, que é o que muda a decisão de um time real. */
export function pressaoDoRound(meus,dele,alvo=13){
  return clamp((dele-meus)/Math.max(1,alvo),-1,1);
}

/** Decide o round dos dois lados e devolve os empurrões já orientados ao time A.

    `ladoA` diz quem é CT. `contexto` traz placar e economia de cada lado. O
    gerador é o fluxo TÁTICO, nunca o do combate. */
export function planejarRoundTatico(estado,{ladoA,placarA,placarB,ecoA,ecoB,random}){
  const aEhCT=ladoA==="CT";
  const ladoDeA=aEhCT?"CT":"TR",ladoDeB=aEhCT?"TR":"CT";

  /* Cada um consulta o que acredita sobre o OUTRO, na superfície em que o outro
     está jogando agora. Sem crença, `preverJogada` devolve null e o plano cai
     para uniforme — o time não finge saber. */
  const crencaDeA=preverJogada(estado.modeloDeA,ladoDeB,estado.identidadeA.leitura);
  const crencaDeB=preverJogada(estado.modeloDeB,ladoDeA,estado.identidadeB.leitura);

  // A ordem das duas chamadas é contrato: elas consomem o gerador tático em
  // sequência, e inverter mudaria toda a partida a partir daqui.
  const planoA=planejarRound({identidade:estado.identidadeA,jogada:estado.jogadaA,
    lado:ladoDeA,crenca:crencaDeA,
    contexto:{eco:!!ecoA,pressao:pressaoDoRound(placarA,placarB),ultimo:estado.inerciaA},random});
  const planoB=planejarRound({identidade:estado.identidadeB,jogada:estado.jogadaB,
    lado:ladoDeB,crenca:crencaDeB,
    contexto:{eco:!!ecoB,pressao:pressaoDoRound(placarB,placarA),ultimo:estado.inerciaB},random});

  const planoT=aEhCT?planoB:planoA,planoCT=aEhCT?planoA:planoB;
  const confronto=confrontoDePlanos(planoT,planoCT);

  estado.ultimo={planoA,planoB,ladoDeA,ladoDeB,confronto};

  /* Os empurrões saem orientados ao time A, que é a referência do motor. A
     vantagem é do lado T por construção; se A é CT, ela entra com sinal
     invertido. Confundir isso inverteria a leitura no mapa inteiro. */
  const sinalA=aEhCT?-1:1;
  return {
    ajusteOpenEdgeA:sinalA*confronto.vantagemAberturaT,
    /* `pEdge` age em TODO contato do round, não só na abertura — é por isso que
       o canal de execução entra aqui e não em `openEdge`: ser empurrado para
       fora do próprio jogo estraga o round inteiro, não o primeiro duelo. */
    ajustePEdgeA:sinalA*confronto.vantagemExecucaoT,
    plantBonusT:confronto.vantagemPlantT,
    ritmoBonus:confronto.ritmoContato,
    ctAcertou:confronto.ctAcertou,
    planoA,planoB
  };
}

/** Depois do round: cada lado registra a jogada que o outro rodou, na
    superfície dele, e cada um guarda a própria para o "run it back".

    `venceuA` é necessário porque repetir depende de ter dado certo — é
    comportamento real, e hoje é só um resíduo: o padrão que existe para ser
    lido vem do repertório do elenco, não daqui. */
export function registrarRoundTatico(estado,venceuA){
  const ultimo=estado.ultimo;
  if(!ultimo)return estado;
  observar(estado.modeloDeB,ultimo.ladoDeA,{[DIMENSAO]:ultimo.planoA.jogada},
    estado.identidadeB.leitura);
  observar(estado.modeloDeA,ultimo.ladoDeB,{[DIMENSAO]:ultimo.planoB.jogada},
    estado.identidadeA.leitura);
  estado.inerciaA={jogada:ultimo.planoA.jogada,venceu:!!venceuA};
  estado.inerciaB={jogada:ultimo.planoB.jogada,venceu:!venceuA};
  estado.ultimo=null;
  return estado;
}
