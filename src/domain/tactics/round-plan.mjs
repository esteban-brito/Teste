/* TÁTICA — a intenção de um round, e o que acontece quando duas se encontram.
   ══════════════════════════════════════════════════════════════════════════════

   É aqui que identidade e crença viram DECISÃO. Este é o único módulo da camada
   autorizado a sortear, e por um motivo: escolher sob incerteza é a decisão em
   si. Identidade descreve, modelo conclui, plano aposta.

   O GERADOR ENTRA POR PARÂMETRO, e tem de ser o fluxo PRÓPRIO da tática — nunca
   o Mulberry32 do combate. É essa separação que permite ligar a camada e ainda
   provar que a sequência de duelos continua byte a byte igual: com a tática
   desligada, o combate não perde nem ganha uma amostra.

   QUATRO EIXOS, todos ocultos do jogador (decisão de produto de 04/08: nenhuma
   complexidade nova cobra clique):

     tempo           rapido | padrao | lento
     comprometimento split  | padrao | stack
     jogada          um dos seis TIPOS de `play-style.mjs`
     utilitaria      gastar | guardar

   POR QUE `jogada` NÃO É MAIS `direcao` A|B. Com dois rótulos vazios, o CT
   queria coincidir e o T queria divergir: *matching pennies*, cujo equilíbrio é
   50/50 com ganho zero POR CONSTRUÇÃO. Medido, o CT acertava 50,1% e a
   transmissão ao resultado era −0,0004 pp — e `ACERTO_ABERTURA` a oito vezes o
   valor de projeto continuou dando nada, porque qualquer escala vezes zero é
   zero. Com tipos de jogada o T deixa de sortear uniforme: ele prefere o que
   sabe fazer, e é isso que cria padrão a ser lido.

   O SENTIDO CONTINUA MUDANDO COM O LADO, só que agora sem inverter nada: o T
   sorteia do PRÓPRIO repertório, o CT sorteia do que ACREDITA sobre o T. Errar,
   para o CT, é montar contra a jogada que não veio.

   TRÊS PROPRIEDADES QUE FAZEM ISSO SER IA E NÃO MAIS UM MULTIPLICADOR:

   1. o plano pode ser LIDO — e quem é mais legível é quem tem assinatura forte;
   2. o plano pode FALHAR na execução. `estrutura` decide se o que foi decidido
      é o que acontece — é o problema do time de cinco estrelas sem sistema;
   3. quem lê bem também MISTURA bem. `leitura` achata a própria distribuição,
      porque quem entende que é lido se protege.

   ESTADO: a chave `CFG_TATICA.ATIVA` continua em 0. Ver `tactics-config.mjs`. */
import {TIPOS_JOGADA} from "./play-style.mjs";

/** Pesos num lugar só, mutáveis, para o calibrador tunar como faz com CFG_SIM. */
export const CFG_PADRAO={
  RITMO_W:1.10,          // quanto o eixo `ritmo` inclina tempo rápido
  RITMO_PRESSAO:.18,     // pressão do placar/economia sobre o tempo
  ESTRUTURA_FIDELIDADE:.55,  // quanto `estrutura` protege a execução do plano
  FIDELIDADE_BASE:.72,   // fidelidade de um time mediano
  MIX_BASE:.22,          // o quanto um time mediano achata o próprio repertório
  MIX_LEITURA:.12,       // quem entende leitura se protege mais
  MIX_MIN:.08,MIX_MAX:.45,
  COMPROMISSO_W:.85,     // `estrutura` + confiança inclinam para stack
  UTIL_W:1.0,            // `utilitaria` inclina gastar
  UTIL_ECO:.45,          // eco segura utilitária
  /* CONTRA-LEITURA DO T: quanto ele evita a jogada que acredita estar coberta.
     É o espelho da leitura do CT, com a mesma máquina — e é o que impede que o
     modelo vire "o CT lê e o T é passivo". */
  EVITA_COBERTA:.55,
  /* RUN IT BACK. Repetir o que deu certo é comportamento real, e sobreviveu à
     troca de vocabulário — mas deixou de ser LOAD-BEARING. Na versão A|B a
     inércia era a única fonte de padrão: sem ela todo time jogava 50/50, e sem
     padrão nenhuma crença se formava (a leitura foi usada em 0,0% de 557.941
     rounds). Hoje o padrão vem do repertório do elenco, e isto é só o resíduo
     comportamental que ele não captura. */
  INERCIA_VITORIA:.16,
  CONF_MIN:.15,          // abaixo disso a crença não move nada
  /* ACERTO_ABERTURA é o custo de o CT ACERTAR, para o T. O ganho do T quando o
     CT erra sai daqui dividido por (n−1) — ver `confrontoDePlanos`. */
  ACERTO_ABERTURA:.055,
  /* PLANT — o comprometimento de utilitária mexe em plantar/retomar, e isso é
     fiel: quem gasta granada planta mais. Mas o empurrão é SIMÉTRICO num
     processo de PRIMEIRO SUCESSO, e `1−∏(1−pᵢ)` é côncava: ruído simétrico
     ABAIXA a média. A .045 isso custava 2,3 pontos de `Plant%`, gate em 46–60
     que o ciclo de 04/08 pagou caro para tirar da borda — e o canal foi medido
     como NÃO sendo de leitura (contribuição corrigida −0,07 pp). Gastava margem
     e não comprava inteligência. A .025 a decisão continua valendo e a queda cai
     para ~0,7 ponto, porque o efeito de Jensen escala com o QUADRADO do
     empurrão. */
  ACERTO_PLANT:.025,
  RITMO_CONTATO:.16,     // teto do efeito do tempo sobre o ritmo de contato
  /* EXECUÇÃO — o canal que faz a leitura valer, e o único aqui que NÃO é soma
     zero. Adivinhar a jogada é quase soma zero por natureza; ser empurrado para
     fora do próprio repertório custa caro tenha o adversário adivinhado ou não.
     É o que um CT bom faz no CS real: não acerta o site, tira de você o que você
     faz bem. Medido, um time que enfrenta leitor muito melhor roda jogadas de
     afinidade 0,0727 contra 0,0926 — a fuga já existia sem recompensa. */
  EXECUCAO_W:.03,
  EXECUCAO_MAX:.03       // teto do empurrão em `pEdge`, que age em TODO contato
};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const sigmoide=x=>1/(1+Math.exp(-x));

/** Escolhe uma chave por peso. Consome UMA amostra — a contagem é contrato. */
function sortear(pesos,random){
  const chaves=Object.keys(pesos);
  let total=0;
  for(const k of chaves)total+=Math.max(0,pesos[k]);
  const alvo=random()*(total||1);
  let acumulado=0;
  for(const k of chaves){
    acumulado+=Math.max(0,pesos[k]);
    if(alvo<acumulado)return k;
  }
  return chaves[chaves.length-1];
}

/** Imprevisibilidade deliberada: quem entende que é lido se protege mais.
    Achata o próprio repertório na direção do uniforme. */
export function mixagem(identidade,cfg=CFG_PADRAO){
  return clamp(cfg.MIX_BASE+cfg.MIX_LEITURA*(identidade?.leitura??0),cfg.MIX_MIN,cfg.MIX_MAX);
}

/** Fidelidade de execução: o plano decidido é mesmo o que acontece? */
export function fidelidade(identidade,cfg=CFG_PADRAO){
  return clamp(cfg.FIDELIDADE_BASE+cfg.ESTRUTURA_FIDELIDADE*(identidade?.estrutura??0),.35,.97);
}

/** A distribuição de jogada de um lado, já com mixagem, contra-leitura e inércia.

    O T parte do PRÓPRIO repertório; o CT parte do que acredita sobre o T e cai
    para uniforme quando não sabe nada — não finge saber. Devolve um objeto de
    pesos na ordem canônica de `TIPOS_JOGADA`, cuja ordem desempata sorteio. */
function pesosDeJogada({lado,repertorio,crenca,identidade,contexto,compromisso,cfg}){
  const n=TIPOS_JOGADA.length,uniforme=1/n;
  const temCrenca=!!(crenca&&crenca.moda!=null);
  const confianca=temCrenca?clamp(crenca.confianca??0,0,1):0;
  const usaLeitura=confianca>=cfg.CONF_MIN;

  const base={};
  if(lado==="CT"){
    /* O CT REAL NÃO ESCOLHE UM SITE POR ROUND. Ele monta um default que cobre
       tudo razoavelmente, e só às vezes o IGL chama um stack em cima de uma
       leitura. As duas coisas são UMA chamada — por isso a nitidez da leitura
       aqui é o mesmo `compromisso` que decide stack × split, e não um botão
       separado.

       Um CT que faz split joga a crença espalhada: ele se inclina para onde
       acha que vem, sem abrir mão do resto. Um CT que stacka concentra na moda
       e aceita o buraco do outro lado. É por isso que `confrontoDePlanos` já
       cobrava pesoCT 1 no stack e .55 no split: o castigo de acertar sempre
       dependeu de quanto se apostou.

       O efeito colateral é a parte boa: só stacka quem tem ESTRUTURA e
       CONFIANÇA, então a leitura é GANHA e não distribuída. Um elenco sem
       capitão nunca chega ao comprometimento que a torna valiosa. */
    const c=clamp(compromisso??0,0,1);
    for(const tipo of TIPOS_JOGADA){
      if(!usaLeitura||!crenca.distribuicao){base[tipo]=uniforme;continue;}
      const esperado=crenca.distribuicao[tipo]??0;
      const naModa=tipo===crenca.moda?1:0;
      base[tipo]=(1-c)*esperado+c*naModa;
    }
  }else{
    for(const tipo of TIPOS_JOGADA)base[tipo]=repertorio?.[tipo]??uniforme;
  }

  // MIXAGEM: achata na direção do uniforme. Quem lê bem sabe que é lido.
  const mix=mixagem(identidade,cfg);
  for(const tipo of TIPOS_JOGADA)base[tipo]=(1-mix)*base[tipo]+mix*uniforme;

  /* CONTRA-LEITURA do T: ele evita a jogada que acredita coberta. O CT não tem
     este termo porque a crença dele JÁ é a distribuição inteira — para o CT,
     ler é escolher; para o T, ler é fugir. */
  if(lado!=="CT"&&usaLeitura){
    const coberta=crenca.moda;
    if(base[coberta]!=null)base[coberta]*=Math.max(0,1-cfg.EVITA_COBERTA*confianca);
  }

  /* RUN IT BACK: repetir o que venceu. Resíduo comportamental, não a fonte do
     padrão — ver o comentário de INERCIA_VITORIA. */
  const ultimo=contexto&&contexto.ultimo;
  if(ultimo&&ultimo.venceu&&base[ultimo.jogada]!=null){
    base[ultimo.jogada]*=1+cfg.INERCIA_VITORIA*(1-mix);
  }

  let total=0;
  for(const tipo of TIPOS_JOGADA)total+=Math.max(0,base[tipo]);
  const pesos={};
  for(const tipo of TIPOS_JOGADA)pesos[tipo]=total>0?Math.max(0,base[tipo])/total:uniforme;
  return {pesos,usaLeitura,confianca};
}

/** A intenção do round.

    `jogada.repertorio` é a distribuição de `playStyleProfile`: o que ESTE time
    sabe fazer. `crenca` é o que ele acredita sobre o adversário na dimensão da
    jogada — `{moda,confianca,distribuicao}` ou `null` para "não sei". `null`
    não é palpite neutro: é ausência de informação, e o plano cai para uniforme.

    `contexto` traz `{lado, eco, pressao, ultimo}`. `pressao` é o aperto do
    placar e da economia, já normalizado por quem chama, entre −1 e 1. */
export function planejarRound(entrada,cfg=CFG_PADRAO){
  const {identidade={},jogada=null,lado="TR",crenca=null,contexto={},random}=entrada||{};
  if(typeof random!=="function")throw new Error("planejarRound exige o gerador da tática");
  const pressao=clamp(contexto.pressao??0,-1,1);

  /* TEMPO — o que o time QUER. `ritmo` já mistura intenção do playstyle e
     capacidade de entrada; a pressão empurra para os extremos. */
  const pRapido=sigmoide(cfg.RITMO_W*(identidade.ritmo??0)+cfg.RITMO_PRESSAO*pressao);
  const tempo=sortear({rapido:pRapido,lento:1-pRapido},random)==="rapido"?"rapido":"lento";

  /* COMPROMETIMENTO — quanto do time vai junto. Estrutura e confiança empurram
     para stack; a dúvida empurra para split, que é o jeito de não errar feio.
     A PROBABILIDADE é calculada aqui, antes da jogada, porque ela também governa
     a nitidez da leitura do CT — no CS a chamada é uma só. O SORTEIO continua
     depois da jogada: a ordem de consumo do gerador é contrato, e mudá-la
     mudaria toda a partida a partir daqui. */
  /* Crença SEM moda não é crença: `{moda:null,confianca:.9}` chega quando o
     modelo tem massa mas nada a apontar, e tratá-la como confiança real faria o
     time stackar em cima de nada. */
  const confianca=crenca&&crenca.moda!=null?clamp(crenca.confianca??0,0,1):0;
  const pStack=sigmoide(cfg.COMPROMISSO_W*((identidade.estrutura??0)+confianca-.35));

  /* JOGADA — onde a leitura entra. A ordem das chamadas ao gerador é contrato:
     tempo, jogada, comprometimento, utilitária, execução. */
  const dist=pesosDeJogada({lado,repertorio:jogada&&jogada.repertorio,
    crenca,identidade,contexto,compromisso:pStack,cfg});
  const escolhida=sortear(dist.pesos,random);

  const comprometimento=sortear({stack:pStack,split:1-pStack},random)==="stack"?"stack":"split";

  /* UTILITÁRIA — gastar agora ou guardar para o retake. Eco segura. */
  const pGastar=sigmoide(cfg.UTIL_W*(identidade.utilitaria??0)-(contexto.eco?cfg.UTIL_ECO:0));
  const utilitaria=sortear({gastar:pGastar,guardar:1-pGastar},random)==="gastar"?"gastar":"guardar";

  /* Quanto esta jogada serve a ESTE time, já autocentrado no próprio repertório
     por `play-style.mjs`. Zero quando não há repertório: um time sem perfil não
     é ajudado nem punido por rodar qualquer coisa. */
  const vantagemExecucao=(jogada&&jogada.vantagem&&jogada.vantagem[escolhida])||0;

  const intencao={tempo,comprometimento,jogada:escolhida,utilitaria,vantagemExecucao,
    leituraUsada:dist.usaLeitura,confianca:dist.confianca,
    assinatura:(jogada&&jogada.assinatura)||0};

  /* EXECUÇÃO — o plano decidido nem sempre é o que acontece. Um time sem
     estrutura degrada para o padrão: não é o oposto do plano, é a AUSÊNCIA
     dele, que é o que se vê num time que não repete o que treinou. */
  if(random()>=fidelidade(identidade,cfg)){
    return {...intencao,tempo:"padrao",comprometimento:"padrao",executou:false};
  }
  return {...intencao,executou:true};
}

/* Como dois planos se encontram. A saída é DELIBERADAMENTE pequena e limitada:
   são empurrões nos botões que o motor já tem — `openEdge`, ritmo de contato,
   plant e retake —, nunca um modelo paralelo de combate.

   SOMA ZERO NA TAXA-BASE, e este é o ponto que mais fácil se erra. Com dois
   rótulos o CT acertava metade das vezes e o ± se cancelava sozinho. Com seis
   jogadas o CT erra cinco vezes em cada seis, então premiar o T em todo erro
   com a mesma magnitude do castigo daria ao T uma vantagem sistemática de
   +2/3 do canal — e `CT-round win%` é gate em 47–54.

   A correção é fazer o acerto valer (n−1) vezes o erro: o CT que acerta dói
   cinco vezes mais do que o CT que erra alivia. Em cima de um CT UNIFORME a
   esperança é exatamente zero, então tudo o que sobra vem de ler melhor que o
   acaso — que é precisamente o efeito que a camada existe para produzir. */
export function confrontoDePlanos(planoT,planoCT,cfg=CFG_PADRAO){
  const vazio={ctAcertou:false,vantagemAberturaT:0,vantagemPlantT:0,ritmoContato:0,
    vantagemExecucaoT:0};
  if(!planoT||!planoCT)return vazio;

  const n=TIPOS_JOGADA.length;
  const ctAcertou=planoCT.jogada===planoT.jogada;
  // Stack acertado dói mais; stack errado abre o outro lado na mesma medida.
  const pesoCT=planoCT.comprometimento==="stack"?1:.55;
  // acerto custa o canal inteiro; erro devolve 1/(n−1) dele
  const bruto=ctAcertou?-cfg.ACERTO_ABERTURA:cfg.ACERTO_ABERTURA/(n-1);
  const vantagemAberturaT=clamp(pesoCT*bruto,-cfg.ACERTO_ABERTURA,cfg.ACERTO_ABERTURA);

  // Utilitária gasta ajuda a plantar; guardada ajuda a retomar.
  const utilT=planoT.utilitaria==="gastar"?1:-1;
  const utilCT=planoCT.utilitaria==="guardar"?1:-1;
  const vantagemPlantT=clamp((utilT-utilCT)/2*cfg.ACERTO_PLANT,
    -cfg.ACERTO_PLANT,cfg.ACERTO_PLANT);

  const passo={rapido:1,padrao:0,lento:-1};
  const ritmoContato=clamp(((passo[planoT.tempo]??0)+(passo[planoCT.tempo]??0))/2*cfg.RITMO_CONTATO,
    -cfg.RITMO_CONTATO,cfg.RITMO_CONTATO);

  /* EXECUÇÃO — diferencial, orientado ao T como os outros. Os DOIS lados entram:
     um CT empurrado para uma montagem que não serve ao elenco dele sofre igual.
     Isso cria a tensão certa, e ela é real — ler bem às vezes obriga a montar de
     um jeito que não é o seu, e a decisão de fazê-lo tem preço. */
  const vantagemExecucaoT=clamp(
    ((planoT.vantagemExecucao||0)-(planoCT.vantagemExecucao||0))*cfg.EXECUCAO_W,
    -cfg.EXECUCAO_MAX,cfg.EXECUCAO_MAX);

  return {ctAcertou,vantagemAberturaT,vantagemPlantT,ritmoContato,vantagemExecucaoT};
}
