/* MARCA VISUAL DE CADA MAPA — 07/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   PEDIDO: *"cada mapa ter seu próprio estilo visual, sua marca, que vai ficar
   explícito tanto na antessala quanto dentro da partida, pra pessoa já saber que
   mapa é sem nem ler."*

   O critério é esse: **sem nem ler**. Então a marca precisa funcionar como
   mancha de cor à distância, e o nome vira confirmação, não a informação.

   POR QUE COR, E NÃO ARTE. O repositório não tem arte de mapa e criar sete
   ilustrações é outro ofício; além disso, `docs/card-portraits.md` já estabelece
   que asset novo entra por protocolo, normalizado e com guarda. Cor é dado puro:
   viaja em CSS, escala para qualquer tamanho, sobrevive a
   `prefers-reduced-motion` e não pesa um byte de rede.

   A SIGLA DE DUAS LETRAS FOI REMOVIDA em 07/08/2026, no mesmo dia em que entrou.
   Ela obrigava a desenhar um quadradinho dentro da placa do mapa, e o
   responsável recusou: *"não gostei do quadradinho com a sigla do mapa 2 letras
   […] tem um bloco dentro do outro, tipo um retângulo dentro do outro"*. Sem
   consumidor, ela seria código morto — então saiu, em vez de ficar "por via das
   dúvidas". O nome do mapa cabe inteiro na placa e diz mais que "AB".

   AS CORES SAEM DO LUGAR REAL — é o que faz a associação grudar sem legenda:
   Inferno é o tijolo de Nuke Town, Nuke é o concreto industrial azul-frio,
   Ancient é a selva, Anubis o ouro do deserto, Dust2 a areia, Mirage o terracota
   de Marrocos, Cache o cinza-verde de Chernobyl.

   E ELAS PRECISAM SER DISTINGUÍVEIS ENTRE SI, não só bonitas: a marca só serve
   se sete manchas lado a lado não se confundirem. `tools/check-map-identity.js`
   mede a distância entre todos os pares e o contraste de cada tinta — a regra 46
   deste projeto nasceu de um contraste que só reprovava para dois times
   sorteados, e aqui o domínio inteiro cabe numa varredura. */

import {tintaLegivel,canais,clarearAte} from "./contrast.mjs";

/* CADA MAPA TRANSFORMA A INTERFACE, não só carimba um chip — 07/08/2026.
   O pedido foi corrigido pelo responsável depois da primeira versão: *"era mais
   sobre o mapa transformar a interface, o fundo, etc… tanto da antessala quanto
   da partida"*. Sigla e cor sozinhas eram um rótulo; ambiente é o fundo mudar.

   Por isso cada mapa carrega TRÊS cores, e não uma:
     · `cor`   — a marca, usada em cheio na placa do mapa e nas bordas;
     · `ceu`   — o alto do ambiente, para onde o fundo puxa;
     · `chao`  — a base, mais escura e mais saturada de terra.
   O gradiente entre `ceu` e `chao` é o que dá a sensação de LUGAR: Nuke é frio e
   cinza-azulado, Anubis puxa areia quente, Ancient é úmido e verde.

   AS COMPOSIÇÕES SÃO ESCURAS DE PROPÓSITO. O jogo inteiro é um tema escuro com
   texto claro, e ambientar não pode custar legibilidade: `check-map-identity`
   mede o contraste do texto do corpo sobre `ceu` e sobre `chao` de cada mapa. */
export const MAPA_MARCA={
  /* Os três mapas de areia — Mirage, Anubis e Dust2 — são o caso difícil: a
     primeira versão deu a Mirage e Dust2 ambientes a 2,4 de distância, ou seja,
     duas telas indistinguíveis. A guarda reprovou, e a saída foi puxar cada um
     para o que ele REALMENTE é: Mirage é terracota (vermelho), Anubis é ouro
     (âmbar), Dust2 é poeira sob sol alto (oliva claro). */
  /* MIRAGE FICA ONDE ESTAVA, e isto é registro de uma tentativa que falhou.
     Em 08/08/2026 ela foi empurrada para `#d9633a` porque chegava à tela a 6,1
     de croma de Anubis. O resultado: colidiu com INFERNO, que é vermelho-tijolo,
     a 10,8 em Lab — abaixo do piso de 18. O espaço de matiz quente já tem
     quatro mapas (Inferno, Mirage, Anubis, Dust2) e não comporta mais um.
     A CAUSA nunca foi a cor: as sete separam a 23 em Lab nos tokens e chegavam
     a 6 na tela. Quem achatava era o FILTRO. Corrigir a identidade para
     compensar o filtro seria calibrar contra a régua errada — a mesma armadilha
     que este repositório já registrou cinco vezes. */
  Mirage: {cor:"#e08a3c",ceu:"#2c1c0c",chao:"#160e06"}, // terracota de Marrocos
  Inferno:{cor:"#c4472f",ceu:"#2a0f0b",chao:"#170806"}, // tijolo e telha
  Nuke:   {cor:"#5b8fb9",ceu:"#131c25",chao:"#0b1116"}, // concreto industrial frio
  Ancient:{cor:"#3f8f5e",ceu:"#0d2113",chao:"#07140b"}, // pedra e selva úmida
  Anubis: {cor:"#d4a83a",ceu:"#282108",chao:"#151105"}, // areia e ouro do deserto
  Dust2:  {cor:"#c9a86a",ceu:"#1e2016",chao:"#10120c"}, // poeira sob sol alto
  Cache:  {cor:"#93a6ad",ceu:"#101c20",chao:"#0a1215"}, // aço frio de Chernobyl
};

/* Mapa desconhecido não pode quebrar a tela: um mapa novo entrando no pool sem
   passar por aqui aparece em cinza neutro. O checador reprova nesse caso, mas o
   jogador nunca vê uma placa sem cor. */
const NEUTRO={cor:"#6b788c",ceu:"#151b24",chao:"#0b0f15"};

export function marcaDoMapa(mapa){
  const base=MAPA_MARCA[mapa]||{...NEUTRO};
  return {...base,
    tinta:tintaLegivel(base.cor),
    /* `nome` é a marca usada como TEXTO sobre o ambiente do próprio mapa —
       cor e fundo saem do mesmo par e se aproximam por natureza. Inferno dava
       3,66:1 com a cor pura. Clarear preserva o matiz e sobe só a luminância,
       que é o que o contraste cobra; a marca cheia continua valendo onde ela é
       FUNDO, com `tinta` por cima. Clareia contra o `ceu`, que é o extremo mais
       claro do gradiente e portanto o pior caso — clarear contra o `chao`
       deixava Inferno em 4,17:1 no topo da tela. */
    nome:clarearAte(base.cor,base.ceu)};
}

/** Canais da cor, em "r,g,b" — a forma que `rgba(var(--x),a)` consome. */
export function canaisDoMapa(mapa){
  return canais(marcaDoMapa(mapa).cor).join(",");
}

/* A ARTE DO MAPA — 08/08/2026.
   ══════════════════════════════════════════════════════════════════════════════
   O bloco "POR QUE COR, E NÃO ARTE" no topo deste arquivo dizia que o
   repositório não tinha arte de mapa e que criar sete ilustrações era outro
   ofício. Continua verdade sobre ILUSTRAR; deixou de ser sobre TER: o
   responsável forneceu sete capturas do próprio CS2 em 08/08/2026, e
   `tools/build-map-art.js` as normaliza.

   A COR NÃO FOI SUBSTITUÍDA. `cor`, `ceu` e `chao` continuam governando a
   atmosfera, a placa e as bordas — a arte ACRESCENTA a camada que faltava:
   estrutura de luz real para o vidro refratar. Um mapa sem arte cai no ambiente
   de gradiente e a tela não quebra; é o mesmo contrato de fallback do `NEUTRO`.

   O SLUG É MINÚSCULO porque `Dust2.webp` funciona no Windows e some no CI
   Linux. `tools/check-map-art.js` prova os dois lados. */
const ARTE_DIR="assets/mapas";

/** Caminho do asset de arte, ou `null` para mapa sem arte declarada. */
export function arteDoMapa(mapa){
  return MAPA_MARCA[mapa]?`${ARTE_DIR}/${String(mapa).toLowerCase()}.webp`:null;
}

/* Variáveis CSS da marca, para quem pinta um elemento com ela.
   O RGB VIAJA JUNTO porque translucidez neste projeto se faz com
   `rgba(var(--x-rgb),a)`, nunca com `color-mix(...,transparent)`: as duas são
   iguais na álgebra e o Chromium arredonda diferente — 21 de 21 capturas
   deslocadas em 1/255, medido em 02–03/08/2026 e registrado em `docs/testing.md`. */
export function estiloDoMapa(mapa){
  const {cor,tinta,ceu,chao,nome}=marcaDoMapa(mapa);
  const arte=arteDoMapa(mapa);
  return `--mapa-cor:${cor};--mapa-tinta:${tinta};--mapa-rgb:${canaisDoMapa(mapa)}`
    +`;--mapa-ceu:${ceu};--mapa-chao:${chao};--mapa-nome:${nome}`
    /* Sem arte, a variável fica em `none` em vez de ausente: assim a regra de
       CSS é uma só e o fallback é o próprio valor, não um seletor a mais.

       AS ASPAS SÃO SIMPLES, e isto não é estilo — 08/08/2026. Esta string vai
       para dentro de `style="..."` em `innerHTML` (as pílulas de mapa e as
       faixas de fundo), e `url("...")` com aspas duplas FECHA o atributo no
       parser de HTML: o estilo inteiro se perde e o elemento aparece sem cor e
       sem foto. O `#prematch` não sofria porque recebe o valor por
       `setAttribute`, que não passa por parser — o mesmo dado, dois caminhos, e
       só um deles quebrava. */
    +`;--mapa-arte:${arte?`url('${arte}')`:"none"}`;
}
