/* MOVIMENTO REDUZIDO — contrato executável, 09/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE. A folha honrava `prefers-reduced-motion` em alguns lugares e
   não em outros, e a divisão não era decisão: era o acaso de quem escreveu cada
   bloco. Medido em 09/08/2026, TRINTA declarações de `animation` viviam fora de
   qualquer guarda de movimento — os overlays, a entrada de tela, a narração, a
   tela final inteira, a tira de rounds, o placar, o HUD, a roleta e a manchete —
   e quatro delas eram INFINITAS, ou seja, nunca paravam enquanto a tela
   existisse.

   Pior que a lacuna era o SINAL TROCADO que ela produzia na antessala. Medido no
   navegador, com `.tela-in` aplicada:

     movimento normal   #prematch → luzPasseia   #livemap → telaIn
     movimento REDUZIDO #prematch → telaIn       #livemap → (nenhuma)

   O passeio da luz vive sob `no-preference` e tem a mesma especificidade de
   `.tela-in`, vindo depois. Com a preferência LIGADA aquela regra sumia,
   `.tela-in` deixava de ser atropelada, e a antessala virava a única tela da
   aplicação com fade de entrada: **a preferência de acessibilidade LIGAVA uma
   animação em vez de desligá-la.** Um defeito assim não aparece em captura nem
   em prova funcional — ele só existe para quem tem a preferência ligada, e
   ninguém do time tem.

   O QUE ESTE CHECADOR IMPEDE:

     1. a rede global sumir. Ela é a única coisa que cobre as trinta declarações
        de uma vez, e é ela que faz a preferência valer para telas que ainda nem
        foram escritas;
     2. a rede perder uma das três propriedades. `animation-duration` sozinha não
        desarma as infinitas — `seriesPulse`, `cupGlow`, `rsKeyGlow` e `glowPulse`
        continuariam repetindo, só que instantaneamente. É
        `animation-iteration-count` que as para;
     3. a rede deixar de ser a ÚLTIMA palavra. Ela ganha por ordem de fonte, não
        por especificidade: um `@media (prefers-reduced-motion:reduce)` escrito
        depois dela, ou uma regra de animação com `!important`, a desfaz em
        silêncio;
     4. `animation:none` voltar no lugar de duração desprezível. Várias animações
        desta folha carregam o estado FINAL no `fill-mode` (`both`, `forwards`) —
        `finRise`, `pmRevela`, `trophyRise`, as entradas do palco. Com `none` o
        elemento volta ao estilo base e o quadro final se perde; a tela final
        ficaria com o pódio invisível para quem pediu menos movimento.

   O QUE ELE NÃO FAZ. Não proíbe animação fora da guarda — a rede existe
   justamente para que um bloco novo não precise lembrar dela. Ele conta quantas
   estão descobertas e imprime o número, para que a próxima sessão saiba o que a
   rede está segurando. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");
const bruta=fs.readFileSync(path.join(RAIZ,"style.css"),"utf8");
/* Comentários fora antes de qualquer casamento: esta folha cita regras e
   propriedades em prosa o tempo todo, e um casador que os leia acusa defeito
   onde há arqueologia. É a regra 44, e a suíte da antessala já tropeçou nela. */
const folha=bruta.replace(/\/\*[\s\S]*?\*\//g,c=>c.replace(/[^\n]/g," "));

/** Faixas [início,fim) de cada bloco `@media` com a condição pedida. */
function blocos(condicao){
  const out=[];
  const re=new RegExp(`@media\\s*\\(prefers-reduced-motion:\\s*${condicao}\\)\\s*\\{`,"g");
  let m;
  while((m=re.exec(folha))){
    let i=m.index+m[0].length,profundidade=1;
    while(i<folha.length&&profundidade>0){
      if(folha[i]==="{")profundidade++;
      else if(folha[i]==="}")profundidade--;
      i++;
    }
    out.push([m.index,i]);
  }
  return out;
}

const semPreferencia=blocos("no-preference");
const reduzido=blocos("reduce");

/* 1 — A REDE EXISTE, E É UMA SÓ NO PAPEL DE REDE. */
assert.ok(reduzido.length>0,
  "não há nenhum `@media (prefers-reduced-motion:reduce)` na folha — "
  +"sem a rede global, cada bloco novo volta a decidir sozinho se honra a preferência");
const rede=reduzido[reduzido.length-1];
const corpoRede=folha.slice(rede[0],rede[1]);

/* 2 — ELA ALCANÇA TODO ELEMENTO, inclusive pseudo. Uma rede que só pega
   elementos deixa passar `.rs-cell.key::after`, que é uma das infinitas. */
assert.ok(/\*\s*,\s*\*::before\s*,\s*\*::after/.test(corpoRede),
  "a rede de movimento reduzido precisa alcançar `*`, `*::before` e `*::after` — "
  +"sem os pseudo-elementos, `rsKeyGlow` continua girando para sempre");

/* 3 — AS TRÊS PROPRIEDADES, cada uma com um trabalho distinto. */
const EXIGIDAS=[
  ["animation-duration","encurta a animação em vez de removê-la, preservando o `fill-mode`"],
  ["animation-iteration-count","é o que PARA as quatro animações infinitas da folha"],
  ["transition-duration","cobre o que é transição e não animação — o fundo do mapa, os botões"],
];
for(const [prop,porque] of EXIGIDAS)
  assert.ok(new RegExp(`${prop}\\s*:\\s*[^;]*!important`).test(corpoRede),
    `a rede não declara \`${prop}\` com !important — ${porque}`);

/* 4 — DURAÇÃO DESPREZÍVEL, NÃO `none`. Ver o item 4 do cabeçalho. */
assert.ok(!/animation\s*:\s*none/.test(corpoRede),
  "a rede usa `animation:none`, que descarta o quadro final das animações com "
  +"`fill-mode:both` — o pódio da tela final e a revelação da lâmina somem. "
  +"Use duração desprezível");

/* 5 — ELA É A ÚLTIMA PALAVRA. A rede ganha por ORDEM, não por especificidade. */
const ultimaAnimacao=(()=>{
  let ultimo=-1;
  for(const m of folha.matchAll(/animation(?:-[a-z-]+)?\s*:/g))
    if(m.index<rede[0]||m.index>=rede[1])ultimo=Math.max(ultimo,m.index);
  return ultimo;
})();
assert.ok(ultimaAnimacao<rede[0],
  `há declaração de animação DEPOIS da rede de movimento reduzido `
  +`(byte ${ultimaAnimacao} contra ${rede[0]}) — a rede ganha por ordem de fonte, `
  +"então qualquer coisa escrita abaixo dela a desfaz em silêncio");

/* 6 — E O NÚMERO QUE A REDE SEGURA, para a próxima sessão saber o tamanho da
   dependência. Não é assert: é diagnóstico. Contar declarações fora de
   `no-preference` diz quantas regras dependem exclusivamente da rede. */
const descobertas=[...folha.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)].filter(m=>{
  if(semPreferencia.some(([a,b])=>m.index>=a&&m.index<b))return false;
  if(m.index>=rede[0]&&m.index<rede[1])return false;
  return !/^\s*(none|inherit|unset|initial)/.test(m[1]);
}).length;

/* 7 — A ANTESSALA NÃO PODE TER ENTRADA GENÉRICA SÓ NO MODO REDUZIDO. É o
   defeito original, e ele volta se `.tela-in` sair da guarda de movimento. */
const regraTelaIn=folha.match(/\.tela-in\s*\{[^}]*\}/);
assert.ok(regraTelaIn,"`.tela-in` sumiu da folha — é ela que anima a troca de tela");
assert.ok(semPreferencia.some(([a,b])=>regraTelaIn.index>=a&&regraTelaIn.index<b),
  "`.tela-in` está FORA de `@media (prefers-reduced-motion:no-preference)`. "
  +"Ela é atropelada por `.prematch{animation:luzPasseia}` no modo normal e "
  +"RESSUSCITA quando o usuário pede menos movimento — a preferência passa a "
  +"ligar uma animação em vez de desligá-la");

console.log(`reduced motion: ok (rede global com ${EXIGIDAS.length} propriedades · alcança pseudo`
  +` · é a última palavra · ${descobertas} animação(ões) dependem dela · .tela-in sob guarda)`);
