/* TÁTICA — o que um time SABE FAZER, e com que assinatura.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. Na primeira versão da camada, `direcao` era A ou B: dois
   rótulos vazios. O CT queria coincidir e o T queria divergir, o que é *matching
   pennies* — jogo cujo equilíbrio é 50/50 com ganho zero POR CONSTRUÇÃO. Medido:
   o CT acertava 50,1% dos rounds, e a transmissão ao resultado era −0,0004 pp.
   Não era calibração: `ACERTO_ABERTURA` a oito vezes o valor de projeto continuou
   dando nada, porque qualquer escala multiplicada por uma taxa travada em 50% dá
   zero. Reproduza com `bancada/ferramentas/tatica-baseline.js --canais`.

   Este módulo troca os dois rótulos vazios por TIPOS DE JOGADA com afinidade
   derivada dos atributos. Isso quebra a simetria: o T deixa de sortear uniforme e
   passa a preferir o que sabe fazer, então existe padrão a ser lido. Medido sobre
   os 17 elencos, com `BETA` em 3, a moda do T vale 32,7% contra uma base uniforme
   de 16,7% — dezesseis pontos de acerto disponíveis onde antes havia 0,1.

   ─────────────────────────────────────────────────────────────────────────────
   A RESTRIÇÃO QUE GOVERNA O ARQUIVO: AFINIDADE ABSOLUTA NÃO PODE PAGAR.

   Três encodings independentes foram testados, e os três falharam igual:

     atributo cru, autocentrado por time      forma[rush] × força = 0,779
     z-score por atributo sobre os 85         forma[rush] × força = 0,751
     resíduo do jogador contra ele mesmo      forma[rush] × força = 0,782

   Não é defeito de codificação, é acoplamento real do motor: forma de atributo
   determina distribuição de função, e função já tem preço em `DUEL_CONVERSION`
   (Support .92, IGL .90) e `FRAG_ROLE`. Um elenco com forma de `executada` vira
   Supports e é genuinamente mais fraco — o `r = −0,508` dele é o `.92`
   aparecendo, não ruído. Premiar "fazer o que se faz bem" com estas receitas
   pagaria força duas vezes, que é exatamente o que
   `docs/ciclos/tatica-baseline-2026-08-04.md` proíbe.

   Por isso o módulo exporta a DISTRIBUIÇÃO (`pesos`), não o escore. Um peso de
   sorteio não pode ser somado a `openEdgeA` por descuido; um escore pode. A
   única grandeza medida como neutra em força é `assinatura` — r = −0,118 —, e é
   ela, não a afinidade, que pode virar aposta. `forma` sai daqui rotulada como
   diagnóstico e não deve entrar em nenhuma conta do combate.

   ─────────────────────────────────────────────────────────────────────────────
   O Z-SCORE É NECESSÁRIO E INSUFICIENTE, e a distinção importa. Ele não resolve
   a neutralidade de força (ver acima), mas sem ele os tipos não são comparáveis:
   `sn` tem desvio 37,4 e `ut` tem 18,3, então `pick` dominaria a variância só
   pela escala do dado. A escala sai do POOL recebido, nunca de constante
   escrita — um time novo muda a liga, e a referência tem de mudar com ela.

   ESTADO: NENHUM CONSUMIDOR. Como em `team-identity.mjs`, a peça é construída e
   não ligada, para que golden e snapshot sigam idênticos enquanto o desenho é
   revisado. `tools/check-tactics-layer.js` cobra isso. */

/** Ordem canônica dos tipos. Como em `PLAYSTYLE_IDS` e `ROLES_COMBATE`, a ordem
    é contrato: ela desempata moda com afinidade igual. Não reordene. */
export const TIPOS_JOGADA=["rush","executada","default","pick","split","lurk"];

/* RECEITAS. Três atributos cada, na escada .50/.30/.20 que `ROLE_PERFIL` e
   `NM_DEF` já usam — e, como `MAP_PROFILES`, elas são JULGAMENTO DECLARADO, não
   medição. O que a medição sustenta é que elas separam: sobre os 17 elencos, os
   seis tipos são o melhor de alguém (default 5 · split 3 · rush 3 · pick 2 ·
   lurk 2 · executada 2), então nenhum é decorativo. */
export const RECEITAS={
  rush:      {en:.50,op:.30,fp:.20},   // velocidade: chegar primeiro e ganhar o duelo
  executada: {ut:.50,tr:.30,en:.20},   // granada abre o espaço, a dupla ocupa
  default:   {cl:.50,ut:.30,op:.20},   // controle lento, informação, decidir tarde
  pick:      {sn:.50,op:.30,cl:.20},   // um duelo caro de AWP e recuar
  split:     {tr:.50,en:.30,ut:.20},   // dois grupos, coordenação e refrag
  lurk:      {cl:.50,fp:.30,tr:.20}    // um isolado decide o round atrasado
};

/** Os sete atributos crus, na ordem do catálogo. */
export const ATRIBUTOS=["fp","en","tr","op","cl","sn","ut"];

export const CFG_PADRAO={
  /* Quanto a afinidade concentra o sorteio do T. 0 = uniforme (o estado de
     hoje, e o que torna o time ilegível); quanto maior, mais o time repete o
     que sabe fazer, e mais ele pode ser lido. Medido sobre os 17 elencos:
     β 2 → 27,1% de moda · β 3 → 32,7% · β 4 → 38,1%, contra base 16,7%.
     Escolher o valor final é balanceamento e exige comparação pareada. */
  BETA:3
};

const media=valores=>valores.reduce((soma,v)=>soma+v,0)/Math.max(1,valores.length);
const cru=jogador=>jogador?._eng||jogador||{};

/** Desvio-padrão populacional, com piso: atributo constante não divide por zero. */
function desvio(valores){
  if(valores.length<2)return 1;
  const m=media(valores);
  return Math.sqrt(media(valores.map(v=>(v-m)**2)))||1;
}

/** Média e desvio de cada atributo na população recebida. Sai do POOL, nunca de
    constante: adicionar um time muda a liga, e a referência acompanha. */
export function escalaDosAtributos(jogadores){
  const js=(jogadores||[]).filter(Boolean).map(cru);
  const escala={};
  for(const chave of ATRIBUTOS){
    const valores=js.map(j=>j[chave]??0);
    escala[chave]={media:media(valores),desvio:desvio(valores)};
  }
  return escala;
}

const zDe=(jogador,chave,escala)=>{
  const ref=escala&&escala[chave];
  if(!ref)return 0;
  return ((jogador[chave]??0)-ref.media)/ref.desvio;
};

/** Afinidade ABSOLUTA do elenco por cada tipo, antes de descontar a liga. */
export function playStyleRaw(jogadores,escala,cfg=CFG_PADRAO){
  void cfg;
  const js=(jogadores||[]).filter(Boolean).map(cru);
  const saida={};
  for(const tipo of TIPOS_JOGADA){
    const receita=RECEITAS[tipo];
    saida[tipo]=js.length
      ?media(js.map(j=>{
        let soma=0;
        for(const chave in receita)soma+=receita[chave]*zDe(j,chave,escala);
        return soma;
      }))
      :0;
  }
  return saida;
}

/** Referência da liga: a escala dos atributos e a média de cada tipo, numa
    passada só. Memoize por sessão — recalcular por mapa custaria caro num
    benchmark de 45 mil mapas, como já acontece com as médias de identidade. */
export function computePlayStyleReference(elencos,cfg=CFG_PADRAO){
  const listas=(elencos||[]).map(e=>(e||[]).filter(Boolean));
  const escala=escalaDosAtributos(listas.flat());
  const perfis=listas.map(elenco=>playStyleRaw(elenco,escala,cfg));
  const medias={};
  for(const tipo of TIPOS_JOGADA)medias[tipo]=media(perfis.map(p=>p[tipo]));
  return {escala,medias};
}

/** Distribuição de sorteio a partir da forma. Softmax estável (subtrai o
    máximo antes de exponenciar) para que β alto não estoure em Infinity. */
function pesosDaForma(forma,beta){
  const valores=TIPOS_JOGADA.map(tipo=>beta*(forma[tipo]??0));
  const teto=Math.max(...valores);
  const exps=valores.map(v=>Math.exp(v-teto));
  const total=exps.reduce((soma,v)=>soma+v,0)||1;
  const pesos={};
  TIPOS_JOGADA.forEach((tipo,i)=>{pesos[tipo]=exps[i]/total;});
  return pesos;
}

/** O perfil de jogada de um elenco.

    `pesos` é o que a decisão de round deve consumir: uma distribuição, que não
    pode ser somada a nada do combate por acidente.

    `assinatura` é o quanto o time tem uma jogada preferida — a única grandeza
    aqui medida como neutra em força (r = −0,118). É ela que diz quanto está em
    jogo: um time de assinatura forte rende mais quando acerta e apanha mais
    quando é lido. Um time equilibrado é ILEGÍVEL, e isso é conclusão do elenco,
    não uma constante: a NAVI de Estocolmo fica em ~0,10 e a moda dela não passa
    de 19% nem com β alto.

    `vantagem` é o quanto CADA jogada serve a este time, AUTOCENTRADA NELE
    MESMO: soma exatamente zero sobre o próprio repertório. É essa centragem que
    a torna utilizável onde `forma` é proibida — ela não compara times, só
    responde "o time rodou o que sabe fazer, ou foi empurrado para fora?".
    Medida sobre os 17 elencos: vantagem esperada × força = −0,067.

    É o canal que o CS real usa. Um bom CT não vence adivinhando o site; vence
    tirando de você o que você faz bem — e quem não tem assinatura não tem o que
    lhe seja tirado. A NAVI de Estocolmo espera 0,004 aqui; a FaZe, 0,286.

    `forma` sai como DIAGNÓSTICO. Não a some a `openEdgeA`, `pPlant` ou ritmo:
    ela carrega força (ver o cabeçalho), e usá-la como bônus pagaria talento
    duas vezes. */
export function playStyleProfile(jogadores,referencia,cfg=CFG_PADRAO){
  const escala=referencia&&referencia.escala;
  const medias=(referencia&&referencia.medias)||null;
  const bruto=playStyleRaw(jogadores,escala,cfg);
  const forma={};
  for(const tipo of TIPOS_JOGADA)forma[tipo]=bruto[tipo]-((medias&&medias[tipo])||0);

  const valores=TIPOS_JOGADA.map(tipo=>forma[tipo]);
  const assinatura=Math.max(...valores)-Math.min(...valores);

  let moda=TIPOS_JOGADA[0];
  for(const tipo of TIPOS_JOGADA)if(forma[tipo]>forma[moda])moda=tipo;

  /* AUTOCENTRAGEM NO PRÓPRIO TIME. Sem ela isto seria `forma`, que prevê elenco
     bom (r = 0,78) e transformaria "rodar o próprio jogo" num bônus de talento.
     Com ela a soma sobre o repertório é zero: o que sobra é só a diferença
     entre a jogada rodada e a média das que este time saberia rodar. */
  const centro=media(valores);
  const vantagem={};
  for(const tipo of TIPOS_JOGADA)vantagem[tipo]=forma[tipo]-centro;

  return {pesos:pesosDaForma(forma,cfg.BETA),assinatura,moda,vantagem,forma};
}
