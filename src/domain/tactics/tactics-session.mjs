/* TÁTICA — a composição que o motor consome, uma por mapa.
   ══════════════════════════════════════════════════════════════════════════════

   Reúne identidade, os dois modelos de oponente e a decisão de round num objeto
   só, para que `map-simulation.mjs` não precise conhecer as peças. O motor faz
   três chamadas por round e nada mais:

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
   que quatro dos cinco eixos NÃO podem render aqui: eles já rendem no motor, e
   contá-los de novo seria balanceamento disfarçado de realismo. O que a camada
   acrescenta é `leitura` e a interação plano × contra-plano. */
import {teamIdentity} from "./team-identity.mjs";
import {criarModeloOponente,observar,palpite} from "./opponent-model.mjs";
import {planejarRound,confrontoDePlanos} from "./round-plan.mjs";
import {CFG_TATICA} from "./tactics-config.mjs";

/* O QUE SE OBSERVA É A REPETIÇÃO, NÃO A DIREÇÃO — e a diferença derrubou a
   primeira versão inteira. O que torna um time legível aqui é a INÉRCIA: ele
   repete o próprio jogo, mais quando é estruturado e quando deu certo. Só que um
   time que repete 56% das vezes ainda vai em A e em B metade de cada no
   acumulado: a distribuição MARGINAL continua 50/50, e contar frequência de
   direção não enxerga nada. A leitura foi usada em 0,0% de 558 mil rounds.

   O padrão está na TRANSIÇÃO, então é a transição que se observa: "ele repetiu?"
   Com a crença sobre repetição mais a última direção conhecida do adversário —
   que se viu, não se adivinha —, a previsão de direção se reconstrói. É também
   o que um analista de verdade anota: não "eles gostam do A", mas "eles rodam a
   mesma coisa até apanhar". */
const DIMENSAO="repeticao";
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Reconstrói a previsão de DIREÇÃO a partir da crença sobre REPETIÇÃO. */
function preverDirecao(modelo,ladoDoOutro,ultimoDoOutro,leitura){
  if(!ultimoDoOutro)return null;                    // ainda não se viu nada dele
  const p=palpite(modelo,ladoDoOutro,DIMENSAO,leitura);
  if(!p)return null;
  const repete=p.valor==="sim";
  const oposta=ultimoDoOutro.direcao==="A"?"B":"A";
  return {moda:repete?ultimoDoOutro.direcao:oposta,confianca:p.confianca};
}

/** Um mapa em curso: quem é quem, o que cada um acredita e o que decidiu agora. */
export function iniciarMapaTatico(timeA,timeB,medias,cfgTatica=CFG_TATICA){
  return {
    cfg:cfgTatica,
    identidadeA:teamIdentity(timeA?.jogadores||timeA?.js||[],medias),
    identidadeB:teamIdentity(timeB?.jogadores||timeB?.js||[],medias),
    modeloDeA:criarModeloOponente(),   // o que A acredita sobre B
    modeloDeB:criarModeloOponente(),   // o que B acredita sobre A
    ultimo:null,
    // o próprio jogo de cada um no round anterior: é o que alimenta a inércia,
    // e sem inércia ninguém tem padrão para o outro ler
    inerciaA:null,inerciaB:null
  };
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
     está jogando agora. Sem crença, `palpite` devolve null e o plano cai para
     moeda honesta — o time não finge saber. */
  const crencaDeA=preverDirecao(estado.modeloDeA,ladoDeB,estado.inerciaB,estado.identidadeA.leitura);
  const crencaDeB=preverDirecao(estado.modeloDeB,ladoDeA,estado.inerciaA,estado.identidadeB.leitura);

  // A ordem das duas chamadas é contrato: elas consomem o gerador tático em
  // sequência, e inverter mudaria toda a partida a partir daqui.
  const planoA=planejarRound({identidade:estado.identidadeA,lado:ladoDeA,crenca:crencaDeA,
    contexto:{eco:!!ecoA,pressao:pressaoDoRound(placarA,placarB),ultimo:estado.inerciaA},random});
  const planoB=planejarRound({identidade:estado.identidadeB,lado:ladoDeB,crenca:crencaDeB,
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
    plantBonusT:confronto.vantagemPlantT,
    ritmoBonus:confronto.ritmoContato,
    ctAcertou:confronto.ctAcertou,
    planoA,planoB
  };
}

/** Depois do round: cada lado registra o que o outro fez, na superfície dele, e
    cada um guarda o próprio jogo para a inércia do round seguinte.

    `venceuA` é necessário porque repetir depende de ter dado certo — "run it
    back" é comportamento real, e é ele que faz o padrão durar o suficiente para
    ser lido. */
export function registrarRoundTatico(estado,venceuA){
  const ultimo=estado.ultimo;
  if(!ultimo)return estado;
  /* Só há repetição a observar a partir do SEGUNDO round de cada time: no
     primeiro não existe "anterior", e inventar um daria evidência falsa. */
  if(estado.inerciaA){
    observar(estado.modeloDeB,ultimo.ladoDeA,
      {[DIMENSAO]:ultimo.planoA.direcao===estado.inerciaA.direcao?"sim":"nao"},
      estado.identidadeB.leitura);
  }
  if(estado.inerciaB){
    observar(estado.modeloDeA,ultimo.ladoDeB,
      {[DIMENSAO]:ultimo.planoB.direcao===estado.inerciaB.direcao?"sim":"nao"},
      estado.identidadeA.leitura);
  }
  estado.inerciaA={direcao:ultimo.planoA.direcao,venceu:!!venceuA};
  estado.inerciaB={direcao:ultimo.planoB.direcao,venceu:!venceuA};
  estado.ultimo=null;
  return estado;
}
