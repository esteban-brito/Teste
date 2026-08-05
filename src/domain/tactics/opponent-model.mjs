/* TÁTICA — o que o time acredita que o adversário vai fazer.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. É a peça que faz a simulação PARECER inteligente. Sem ela
   o round 20 não sabe nada do round 3, e o jogo vira uma sequência de sorteios
   independentes. Com ela, o CT começa a fechar o lado que você vem batendo — e o
   T sente isso e troca. É a leitura e a contra-leitura, que é onde mora a maior
   parte do Counter-Strike que não é mira.

   TRÊS DECISÕES DE MODELAGEM, e as três importam mais que os números:

   1. A MEMÓRIA É POR LADO. Tendência de TR não vale no CT — são jogos
      diferentes, com mapas mentais diferentes. Um modelo único misturaria as
      duas metades e diria que o time "gosta do A" quando ele só defende ali.

   2. A CONFIANÇA VEM DA AMOSTRA, NÃO DE UM NÚMERO ESCRITO. Duas observações não
      autorizam ninguém a apostar. A confiança sai do tamanho efetivo da amostra
      acumulada — `n/(n+k)`, o encolhimento clássico — e por isso ela sobe
      sozinha conforme o mapa avança, sem nenhuma tabela.

   3. O MODELO PRECISA PODER ESTAR ERRADO, e isso é uma FUNCIONALIDADE. Contra um
      adversário imprevisível a crença fica achatada e a confiança na moda cai:
      quem mistura de verdade não é lido, exatamente como no jogo real. E quando
      o adversário MUDA de padrão, o decaimento faz a crença antiga apodrecer em
      poucos rounds. Um modelo que nunca erra seria mais um bônus para o time
      forte, não uma leitura.

   SEM ALEATORIEDADE. Este módulo observa e conclui; ele não sorteia. O acaso de
   agir ou não sobre a leitura pertence à decisão de round, com fluxo de RNG
   próprio — é isso que mantém o golden do combate intacto.

   ESTADO: NENHUM CONSUMIDOR (Fase 0). Ver o cabeçalho de `team-identity.mjs`. */

/** Pesos do modelo. Mutáveis num lugar só, para o calibrador poder tunar. */
/* A MEMÓRIA É ANCORADA NO MEIO-TEMPO, e o número mudou junto com o vocabulário.

   `MEIA_VIDA:4` foi calibrada quando a dimensão observada era binária, e ali ela
   funcionava: seis rounds de amostra efetiva resolvem uma escolha entre duas.
   Com seis tipos de jogada a mesma memória dá 1,05 observação POR JOGADA, e
   medido no motor a confiança do CT estacionava em 0,19 já no round 3 e não
   subia mais até o fim do mapa — a moda era ruído, e o acerto ficava em 19,5%
   contra 16,7% de acaso. É a mesma classe de erro que o alfabeto de `nitidez`:
   parâmetro afinado para dois símbolos não transfere para seis.

   O valor novo tem âncora, não é busca: `MEIA_VIDA:8` dá amostra efetiva de
   ~12 rounds, exatamente um meio-tempo. E há razão esportiva para a memória ser
   mais longa agora — o que se observa deixou de ser "em que site ele bateu",
   que muda a cada round, e passou a ser QUE TIPO DE ROUND ELE RODA, que é traço
   de time e muda em escala de mapa. Medir um traço lento com memória rápida é
   ler ruído. */
export const CFG_PADRAO={
  MEIA_VIDA:8,            // rounds até uma observação valer metade (~1 meio-tempo)
  MEIA_VIDA_MIN:3,        // piso: nem o melhor IGL reage a um round só
  MEIA_VIDA_MAX:16,       // teto: nem o pior time esquece tudo
  LEITURA_MEIA_VIDA:4.0,  // quanto o eixo `leitura` encurta a meia-vida
  CONFIANCA_K:3,          // amostra efetiva em que a confiança chega a 50%
  LEITURA_CONFIANCA:.30,  // quanto `leitura` levanta a confiança já formada
  /* ANTI-STRAT — o que o time já sabia ANTES do primeiro round.
     Sem isto, `leitura` não tinha por onde agir: medido em 27.200 mapas, quem
     lia bem e quem lia mal acertavam IGUAL (20,8% os dois), porque os dois
     observavam os mesmos rounds e concluíam a mesma coisa. O eixo mudava só a
     FREQUÊNCIA de apostar, nunca a QUALIDADE — e por isso continuava nulo.
     Um IGL bom não lê melhor por prestar mais atenção durante o mapa; ele lê
     melhor porque chegou preparado. Demo review é a explicação padrão de um
     time "ter o número" do outro, e é isto aqui.
     `leitura` vai de −0,458 a +0,454 no acervo. A escala abaixo dá ZERO ao pior
     leitor da liga — ele entra sem relatório nenhum, que é o significado
     honesto de não ter quem estude — e ~8,4 rounds ao melhor, contra ~12 de
     amostra efetiva ao vivo: o prior manda cedo e é diluído pelo que se vê.

     O VALOR É O DO JOELHO DA CURVA, medido, não escolhido no escuro:

       PRIOR_BASE  PRIOR_LEITURA   diferenciação entre bom e mau leitor
                0              0   0,84 pp   (sem anti-strat)
                4              8   1,24 pp
                2             14   2,24 pp   ← aqui
                0             20   2,23 pp
                0             40   2,99 pp   (melhor leitor com 18 rounds!)

     O mecanismo SATURA perto de 3 pp: a observação ao vivo dilui o prior e os
     dois lados convergem para a mesma crença. Dobrar a escala de novo compraria
     0,7 pp ao preço de um scouting maior que o mapa inteiro, o que não é CS. */
  PRIOR_BASE:2,
  PRIOR_LEITURA:14
};

export const LADOS=["CT","TR"];

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Estado vazio. A identidade do objeto é preservada por `esquecerTudo`, no
    mesmo espírito do `Set` de `S.taken`: quem guardou a referência continua
    olhando para o mesmo modelo depois de um reset. */
export function criarModeloOponente(){
  return {CT:Object.create(null),TR:Object.create(null),rounds:{CT:0,TR:0}};
}

/** Zera o conteúdo SEM trocar o objeto. Usado na virada de lado e entre mapas. */
export function esquecerTudo(modelo){
  for(const lado of LADOS){
    for(const dim of Object.keys(modelo[lado]))delete modelo[lado][dim];
    modelo.rounds[lado]=0;
  }
  return modelo;
}

/** Massa de anti-strat que este time traz para o mapa, em rounds equivalentes.
    Zero para quem não tem quem estude o adversário — e o piso é duro, porque
    prior negativo seria "saber menos que nada". */
export function massaAntiStrat(leitura=0,cfg=CFG_PADRAO){
  return Math.max(0,cfg.PRIOR_BASE+cfg.PRIOR_LEITURA*leitura);
}

/** Semeia a memória com o que se estudou ANTES do mapa.

    São PSEUDO-CONTAGENS, não um atalho: elas entram na mesma urna que a
    observação ao vivo, decaem no mesmo ritmo e são diluídas pelo que realmente
    acontece. Um adversário que joga diferente do que a demo mostrava desmente o
    relatório em poucos rounds — que é exatamente o que se quer, e o que
    diferencia scouting de onisciência.

    A distribuição semeada é o REPERTÓRIO DERIVADO do elenco adversário, nunca
    uma tabela por nome: `tools/check-tactics-layer.js` reprova a camada inteira
    se algum módulo ramificar por nick. */
export function semear(modelo,lado,dimensao,distribuicao,massa,cfg=CFG_PADRAO){
  void cfg;
  if(!modelo||!LADOS.includes(lado)||!distribuicao||!(massa>0))return modelo;
  const memoria=modelo[lado];
  const contagem=memoria[dimensao]||(memoria[dimensao]=Object.create(null));
  let total=0;
  for(const valor in distribuicao)total+=Math.max(0,distribuicao[valor]||0);
  if(!(total>0))return modelo;
  for(const valor in distribuicao){
    const parte=Math.max(0,distribuicao[valor]||0)/total;
    contagem[String(valor)]=(contagem[String(valor)]||0)+parte*massa;
  }
  modelo.rounds[lado]+=massa;
  return modelo;
}

/* Meia-vida efetiva: quem lê melhor reage mais rápido ao que vê. O clamp existe
   para os dois extremos serem plausíveis — um IGL excepcional não vira vidente,
   e um time sem capitão não fica com memória infinita, ele fica com memória
   RUIM, que é diferente. */
export function meiaVidaEfetiva(leitura=0,cfg=CFG_PADRAO){
  return clamp(cfg.MEIA_VIDA-cfg.LEITURA_MEIA_VIDA*leitura,
    cfg.MEIA_VIDA_MIN,cfg.MEIA_VIDA_MAX);
}

/** Registra um round do adversário. `evento` é `{dimensao: valor}`; qualquer
    dimensão é aceita, porque quem define o vocabulário é a decisão de round. */
export function observar(modelo,lado,evento,leitura=0,cfg=CFG_PADRAO){
  if(!modelo||!LADOS.includes(lado)||!evento)return modelo;
  const decaimento=Math.pow(.5,1/meiaVidaEfetiva(leitura,cfg));
  const memoria=modelo[lado];

  // Decai TUDO antes de somar o novo: o passado envelhece a cada round, mesmo
  // nas dimensões que este round não observou.
  for(const dim of Object.keys(memoria)){
    const contagem=memoria[dim];
    for(const valor of Object.keys(contagem))contagem[valor]*=decaimento;
  }
  for(const dim of Object.keys(evento)){
    const valor=String(evento[dim]);
    const contagem=memoria[dim]||(memoria[dim]=Object.create(null));
    contagem[valor]=(contagem[valor]||0)+1;
  }
  modelo.rounds[lado]=modelo.rounds[lado]*decaimento+1;
  return modelo;
}

/** O que o time acredita sobre uma dimensão, agora.

    `massa` é o tamanho EFETIVO da amostra depois do decaimento — não é a
    contagem de rounds. `confianca` combina essa massa com o quanto a
    distribuição realmente aponta para algum lado: um adversário 50/50 dá
    confiança baixa por mais rounds que se observe, e é assim que tem de ser.

    `alfabeto` é o tamanho do vocabulário POSSÍVEL da dimensão. Ele existe
    porque medir nitidez contra o alfabeto OBSERVADO superestima a leitura no
    começo do mapa: com seis jogadas possíveis e três vistas até aqui, o
    uniforme seria 1/3 em vez de 1/6, e um adversário perfeitamente imprevisível
    pareceria legível pelos primeiros rounds. É a mesma armadilha que a versão
    anterior deste arquivo já tinha achado no caso de valor único; com dimensão
    binária ela não aparecia, com seis valores aparece em todo round inicial.
    Zero mantém o comportamento histórico: usar o que se observou. */
export function crenca(modelo,lado,dimensao,leitura=0,cfg=CFG_PADRAO,alfabeto=0){
  const vazio={distribuicao:Object.create(null),moda:null,massa:0,nitidez:0,confianca:0};
  if(!modelo||!LADOS.includes(lado))return vazio;
  const contagem=modelo[lado][dimensao];
  if(!contagem)return vazio;

  const chaves=Object.keys(contagem);
  const massa=chaves.reduce((soma,k)=>soma+contagem[k],0);
  if(massa<=0)return vazio;

  const distribuicao=Object.create(null);
  let moda=null,pMax=0;
  for(const k of chaves){
    const p=contagem[k]/massa;
    distribuicao[k]=p;
    if(p>pMax){pMax=p;moda=k;}
  }

  /* NITIDEZ: o quanto a moda se destaca do que seria puro acaso. Com duas
     opções, 50/50 dá 0 e 75/25 dá 0,5. Sem esse termo, observar dez rounds de um
     adversário perfeitamente imprevisível daria confiança alta numa moda que
     não significa nada.

     UM VALOR SÓ É NITIDEZ MÁXIMA, não mínima. A primeira versão devolvia 0 aqui
     e a guarda pegou na primeira execução: um adversário que SEMPRE faz a mesma
     coisa é o mais legível que existe, e o modelo dizia não saber nada dele. O
     erro era medir a nitidez contra o alfabeto OBSERVADO em vez do possível.
     Quem protege contra a amostra pequena é o termo `daAmostra`, não este. */
  const possiveis=Math.max(chaves.length,alfabeto||0);
  const uniforme=1/possiveis;
  const nitidez=possiveis>1?clamp((pMax-uniforme)/(1-uniforme),0,1):1;

  const daAmostra=massa/(massa+cfg.CONFIANCA_K);
  const confianca=clamp(daAmostra*nitidez*(1+cfg.LEITURA_CONFIANCA*leitura),0,1);
  return {distribuicao,moda,massa,nitidez,confianca};
}

/** Atalho de leitura: o valor mais esperado e o quanto se aposta nele. `null`
    quando não há evidência — e quem consome DEVE tratar isso como "não sei",
    nunca como um palpite qualquer. */
export function palpite(modelo,lado,dimensao,leitura=0,cfg=CFG_PADRAO,alfabeto=0){
  const c=crenca(modelo,lado,dimensao,leitura,cfg,alfabeto);
  return c.moda===null?null:{valor:c.moda,confianca:c.confianca,distribuicao:c.distribuicao};
}
