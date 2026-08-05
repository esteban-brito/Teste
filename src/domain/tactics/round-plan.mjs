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
     direcao         A | B — índice ABSTRATO, não geografia de mapa. Não
                     modelamos o apartamento da Mirage, e não vamos fingir que
                     modelamos; o que importa é se o CT adivinhou ou não.
     utilitaria      gastar | guardar

   O SENTIDO DE `direcao` MUDA COM O LADO. No T é por onde eu vou; no CT é onde
   eu concentro. Acertar, para o CT, é COINCIDIR; para o T, é DIVERGIR do que o
   CT concentrou. Confundir os dois inverteria o jogo inteiro.

   TRÊS PROPRIEDADES QUE FAZEM ISSO SER IA E NÃO MAIS UM MULTIPLICADOR:

   1. o plano pode ser LIDO. Um time que sempre faz a mesma coisa é punido;
   2. o plano pode FALHAR na execução. `estrutura` decide se o que foi decidido
      é o que acontece — é o problema do time de cinco estrelas sem sistema;
   3. quem lê bem também MISTURA bem. `leitura` alimenta a leitura do outro e a
      própria imprevisibilidade, porque quem entende que é lido se protege.

   ESTADO: NENHUM CONSUMIDOR (Fase 0). Ver `team-identity.mjs`. */

/** Pesos num lugar só, mutáveis, para o calibrador tunar como faz com CFG_SIM. */
export const CFG_PADRAO={
  RITMO_W:1.10,          // quanto o eixo `ritmo` inclina tempo rápido
  RITMO_PRESSAO:.18,     // pressão do placar/economia sobre o tempo
  ESTRUTURA_FIDELIDADE:.55,  // quanto `estrutura` protege a execução do plano
  FIDELIDADE_BASE:.72,   // fidelidade de um time mediano
  MIX_BASE:.22,          // imprevisibilidade deliberada de um time mediano
  MIX_LEITURA:.12,       // quem entende leitura se protege mais
  MIX_MIN:.08,MIX_MAX:.45,
  COMPROMISSO_W:.85,     // `estrutura` + confiança inclinam para stack
  UTIL_W:1.0,            // `utilitaria` inclina gastar
  UTIL_ECO:.45,          // eco segura utilitária
  /* INÉRCIA — a tendência própria do time, e a peça sem a qual o modelo inteiro
     não funciona. Na primeira versão não existia: sem crença todo time jogava
     50/50, jogando 50/50 ninguém tinha padrão, e sem padrão nenhuma crença
     jamais se formava. Um impasse de bootstrap perfeito — a leitura foi usada
     em 0,0% de 557.941 rounds. Quem cria o que há para ler é isto.

     Repetir o que se fez sobe com `estrutura` (o time roda o sistema dele) e com
     ter vencido (run it back), e desce com `mixagem` (quem sabe que é lido se
     protege). É a tensão real do CS: ser sistemático é ser legível. */
  INERCIA_BASE:.34,
  INERCIA_ESTRUTURA:.30,
  INERCIA_VITORIA:.16,
  INERCIA_MAX:.80,
  CONF_MIN:.15,          // abaixo disso a crença não move nada
  ACERTO_ABERTURA:.055,  // teto do efeito de acertar a leitura na abertura
  ACERTO_PLANT:.045,     // idem no plant/retake
  RITMO_CONTATO:.16      // teto do efeito do tempo sobre o ritmo de contato
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

/** Imprevisibilidade deliberada: quem entende que é lido se protege mais. */
export function mixagem(identidade,cfg=CFG_PADRAO){
  return clamp(cfg.MIX_BASE+cfg.MIX_LEITURA*(identidade?.leitura??0),cfg.MIX_MIN,cfg.MIX_MAX);
}

/** Fidelidade de execução: o plano decidido é mesmo o que acontece? */
export function fidelidade(identidade,cfg=CFG_PADRAO){
  return clamp(cfg.FIDELIDADE_BASE+cfg.ESTRUTURA_FIDELIDADE*(identidade?.estrutura??0),.35,.97);
}

/** A intenção do round.

    `crenca` é o que ESTE time acredita sobre o adversário na dimensão `direcao`
    — `{moda,confianca}` ou `null` para "não sei". `null` não é palpite neutro:
    é ausência de informação, e o plano cai para moeda honesta.

    `contexto` traz `{lado, eco, pressao}`. `pressao` é o aperto do placar e da
    economia, já normalizado por quem chama, entre −1 e 1. */
export function planejarRound(entrada,cfg=CFG_PADRAO){
  const {identidade={},lado="TR",crenca=null,contexto={},random}=entrada||{};
  if(typeof random!=="function")throw new Error("planejarRound exige o gerador da tática");
  const pressao=clamp(contexto.pressao??0,-1,1);

  /* TEMPO — o que o time QUER. `ritmo` já mistura intenção do playstyle e
     capacidade de entrada; a pressão empurra para os extremos. */
  const pRapido=sigmoide(cfg.RITMO_W*(identidade.ritmo??0)+cfg.RITMO_PRESSAO*pressao);
  const tempo=sortear({rapido:pRapido,lento:1-pRapido},random)==="rapido"?"rapido":"lento";

  /* DIREÇÃO — onde a leitura entra. Sem crença, ou com confiança abaixo do piso,
     é moeda honesta: o time não finge saber. Com crença, ele aposta na
     contra-jogada, temperada pela própria imprevisibilidade. */
  const temCrenca=!!(crenca&&crenca.moda!=null);
  const confianca=temCrenca?clamp(crenca.confianca??0,0,1):0;
  const usaLeitura=confianca>=cfg.CONF_MIN;
  const aposta=usaLeitura?confianca*(1-mixagem(identidade,cfg)):0;
  /* CT acerta COINCIDINDO com o que o T faz; T acerta DIVERGINDO do que o CT
     fecha. Sem crença, `alvo` é arbitrário e `aposta` é 0 — os dois pesos ficam
     em .5 e a escolha é moeda honesta. A primeira versão lia `crenca.moda`
     direto no ramo do CT e ESTOURAVA quando não havia crença; nenhum caso do
     checador cobria "CT sem leitura", que é o estado do round 1 de todo mapa. */
  const alvo=temCrenca?crenca.moda:"A";
  const contra=lado==="CT"?alvo:(alvo==="A"?"B":"A");
  const outro=contra==="A"?"B":"A";

  /* Duas forças na mesma escolha: a INÉRCIA, que é o time repetindo o próprio
     jogo, e a APOSTA, que é ele reagindo ao adversário. A inércia é o que cria
     padrão — sem ela não há o que ler. A aposta é o que responde ao padrão do
     outro. Um time estruturado e vencendo repete; um time que já sacou o
     adversário quebra a própria inércia para puni-lo. */
  const pesos={A:.5,B:.5};
  const ultimo=contexto.ultimo;
  if(ultimo&&(ultimo.direcao==="A"||ultimo.direcao==="B")){
    const inercia=clamp(cfg.INERCIA_BASE+cfg.INERCIA_ESTRUTURA*(identidade.estrutura??0)+
      cfg.INERCIA_VITORIA*(ultimo.venceu?1:-1)-mixagem(identidade,cfg),0,cfg.INERCIA_MAX);
    const outroLado=ultimo.direcao==="A"?"B":"A";
    pesos[ultimo.direcao]+=inercia/2;
    pesos[outroLado]-=inercia/2;
  }
  pesos[contra]+=aposta/2;
  pesos[outro]-=aposta/2;
  const direcao=sortear({A:Math.max(0,pesos.A),B:Math.max(0,pesos.B)},random);

  /* COMPROMETIMENTO — quanto do time vai junto. Estrutura e confiança empurram
     para stack; a dúvida empurra para split, que é o jeito de não errar feio. */
  const pStack=sigmoide(cfg.COMPROMISSO_W*((identidade.estrutura??0)+confianca-.35));
  const comprometimento=sortear({stack:pStack,split:1-pStack},random)==="stack"?"stack":"split";

  /* UTILITÁRIA — gastar agora ou guardar para o retake. Eco segura. */
  const pGastar=sigmoide(cfg.UTIL_W*(identidade.utilitaria??0)-(contexto.eco?cfg.UTIL_ECO:0));
  const utilitaria=sortear({gastar:pGastar,guardar:1-pGastar},random)==="gastar"?"gastar":"guardar";

  const intencao={tempo,comprometimento,direcao,utilitaria,
    leituraUsada:usaLeitura,confianca,aposta};

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
   plant e retake —, nunca um modelo paralelo de combate. É isso que mantém tudo
   comparável contra a baseline e as guardas atuais válidas. */
export function confrontoDePlanos(planoT,planoCT,cfg=CFG_PADRAO){
  const vazio={ctAcertou:false,vantagemAberturaT:0,vantagemPlantT:0,ritmoContato:0};
  if(!planoT||!planoCT)return vazio;

  const ctAcertou=planoCT.direcao===planoT.direcao;
  // Stack acertado dói mais; stack errado abre o outro lado na mesma medida.
  const pesoCT=planoCT.comprometimento==="stack"?1:.55;
  const sinal=ctAcertou?-1:1;
  const vantagemAberturaT=clamp(sinal*pesoCT*cfg.ACERTO_ABERTURA,
    -cfg.ACERTO_ABERTURA,cfg.ACERTO_ABERTURA);

  // Utilitária gasta ajuda a plantar; guardada ajuda a retomar.
  const utilT=planoT.utilitaria==="gastar"?1:-1;
  const utilCT=planoCT.utilitaria==="guardar"?1:-1;
  const vantagemPlantT=clamp((utilT-utilCT)/2*cfg.ACERTO_PLANT,
    -cfg.ACERTO_PLANT,cfg.ACERTO_PLANT);

  const passo={rapido:1,padrao:0,lento:-1};
  const ritmoContato=clamp(((passo[planoT.tempo]??0)+(passo[planoCT.tempo]??0))/2*cfg.RITMO_CONTATO,
    -cfg.RITMO_CONTATO,cfg.RITMO_CONTATO);

  return {ctAcertou,vantagemAberturaT,vantagemPlantT,ritmoContato};
}
