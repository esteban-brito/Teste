/* bancada/serie.js — quanto o vencedor do mapa 1 vence a MD3, e quanto disso é só o formato.

   Escrito para decidir se o simulador precisava de MEMÓRIA DE SÉRIE (o mapa 2 reagir ao que
   aconteceu no mapa 1). A resposta foi NÃO, e a medição é o registro dessa decisão.

   O ponto que a medição existe para separar: o formato MD3 sozinho já dá vantagem enorme a
   quem vence o mapa 1 — ele precisa de 1 dos 2 seguintes, o outro precisa dos 2. Com times
   iguais e mapas independentes isso dá exatamente 75%. Qualquer número acima é (a) seleção de
   força, porque vencer o mapa 1 é evidência de ser o time melhor, ou (b) alguma persistência
   real. Medir por faixa de diferença de força separa os dois: em |Δ|≤3 a seleção quase some.

   Medição de 28/07/2026, 3.758 séries:

     equilibrado |Δ|≤3   79,2% [75,7–82,3]
     |Δ| 4-9             81,1%
     |Δ| 10-15           82,3%
     |Δ| 16+             85,5%
     geral               81,9%   ·   2-0 em 64% das séries

   Os 79,2% dos equilibrados ficam ACIMA dos 75% do formato: já existe persistência, e ela vem
   da forma de campanha, sorteada uma vez e mantida pelos mapas da run. O gradiente por força
   (79% → 85%) é emergente e está na direção certa.

   Como não há lacuna medida nem fonte publicada dizendo que o número deveria ser outro, nenhuma
   faixa foi criada e nenhuma mecânica foi adicionada — regra 11 de docs/next-steps.md. Este
   arquivo NÃO é suíte e não entra no run.js: é bancada de trabalho, como classificacao.js.

   Uso:  node bancada/serie.js          (4.000 sorteios de confronto)
         N=20000 node bancada/serie.js  (amostra profunda) */
const {X,T}=require("./motor");
const {wilsonIntervalPercent}=require("../src/domain/statistics/proportion-interval.mjs");

const N=+(process.env.N||4000);
const FORMATO=75.0; // referência analítica: times iguais, mapas independentes
const FAIXAS=[["|Δ|≤3 (equilibrado)",0,3],["|Δ| 4-9",4,9],["|Δ| 10-15",10,15],["|Δ| 16+",16,99]];

const zero=()=>({n:0,acertou:0,md3:0});
const porFaixa=new Map(FAIXAS.map(([rotulo])=>[rotulo,zero()]));
const geral=zero();

if(X.srand)X.srand(20260728);
for(let i=0;i<N;i++){
  const a=T[Math.floor(X.rndF()*T.length)],b=T[Math.floor(X.rndF()*T.length)];
  if(a===b)continue;
  X.sortearFormaCampanha(T);
  // modo leve: só o placar interessa aqui, e a série inteira roda milhares de vezes
  const serie=X.simularSerie(a,b,()=>X.forcaDoDia(a.ef,a.quim),()=>X.forcaDoDia(b.ef,b.quim),3,true);
  const acertou=serie.mapas[0].vencedor===serie.vencedor;
  const contar=alvo=>{alvo.n++;if(acertou)alvo.acertou++;if(serie.mapas.length===3)alvo.md3++;};
  contar(geral);
  const diff=Math.abs(a.ef-b.ef);
  const faixa=FAIXAS.find(([,lo,hi])=>diff>=lo&&diff<=hi);
  if(faixa)contar(porFaixa.get(faixa[0]));
}

const linha=(rotulo,o)=>{
  if(!o.n)return console.log(`  ${rotulo.padEnd(22)}sem amostra`);
  const ic=wilsonIntervalPercent(o.acertou,o.n);
  console.log(`  ${rotulo.padEnd(22)}${String(o.n).padStart(5)} séries   `
    +`${ic.estimate.toFixed(1).padStart(5)}% [${ic.low.toFixed(1)}–${ic.high.toFixed(1)}]`
    +`   foi a 3 mapas: ${(100*o.md3/o.n).toFixed(0)}%`);
};

console.log("— VENCEDOR DO MAPA 1 × VENCEDOR DA SÉRIE —\n");
console.log(`  referência analítica: só o formato, times iguais e mapas independentes = ${FORMATO.toFixed(1)}%\n`);
linha("GERAL",geral);
console.log("");
FAIXAS.forEach(([rotulo])=>linha(rotulo,porFaixa.get(rotulo)));

const equilibrado=porFaixa.get(FAIXAS[0][0]);
if(equilibrado.n){
  const ic=wilsonIntervalPercent(equilibrado.acertou,equilibrado.n);
  const acima=ic.estimate-FORMATO;
  console.log(`\n  em confrontos equilibrados o jogo fica ${acima>=0?"+":""}${acima.toFixed(1)} pp acima do formato puro.`);
  console.log("  essa diferença é a persistência que JÁ existe: a forma de campanha vale a run inteira.");
}
console.log("  nenhuma faixa-alvo foi criada aqui — não há fonte publicada para o número real.");
