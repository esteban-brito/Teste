/* bancada/abertura.js — o peso do duelo de abertura não pode ser negativo.

   `pick()` (game.js) sorteia somando pesos, sem piso: `tot=Σw` e depois `r=rndF()*tot`.
   Um peso negativo não vira "chance zero" — ele subtrai da soma, desloca o sorteio dos
   companheiros e pode escolher o último do array por exaustão. Nada nisso lança erro, e
   nenhuma métrica agregada denuncia: o volume de aberturas continua o mesmo, só passa a ser
   distribuído errado.

   Era exatamente o que impedia o balanceamento registrado nos docs como "AGR_ABRE ≈ 1,8":
   o fator antigo era LINEAR em styleAgr, que é negativo para âncora e baiter. Esta suíte
   prova que o fator atual é positivo por construção para toda a população, e mede em que
   ganho a forma antiga teria quebrado — para que ninguém a reintroduza sem ver o preço. */
const assert=require("node:assert/strict");
const {X}=require("./motor");

const LADOS=["CT","TR"];
const jogadores=Object.values(X.POOL);
const AGR_ABRE=X.CFG_SIM.AGR_ABRE;

assert.ok(Number.isFinite(AGR_ABRE)&&AGR_ABRE>=0,
  `AGR_ABRE deve ser um ganho não negativo (expoente da exposição): ${AGR_ABRE}`);

/* ─── 1. o fator atual é positivo e finito para todo jogador, em ambos os lados ─── */
let menor=Infinity,maior=0,menorNick="",maiorNick="";
const fatores=[];
jogadores.forEach(jogador=>{
  const exposicao=X.exposureProfile(jogador).opening;
  LADOS.forEach(lado=>{
    const fator=Math.pow(exposicao[lado],AGR_ABRE);
    assert.ok(Number.isFinite(fator),`fator de abertura não finito: ${jogador.nick}/${lado} = ${fator}`);
    assert.ok(fator>0,`fator de abertura não positivo: ${jogador.nick}/${lado} = ${fator}`);
    fatores.push(fator);
    if(fator<menor){menor=fator;menorNick=`${jogador.nick}/${lado}`;}
    if(fator>maior){maior=fator;maiorNick=`${jogador.nick}/${lado}`;}
  });
});

/* ─── 2. o sorteio continua sendo uma distribuição de probabilidade ───────────────
   Cinco jogadores quaisquer: toda fração tem que ficar em (0,1) e somar 1. Com peso
   negativo, uma fração passaria de 1 ou ficaria abaixo de zero. */
const extremos=[...jogadores].sort((a,b)=>
  X.exposureProfile(b).opening.TR-X.exposureProfile(a).opening.TR);
const time=[...extremos.slice(0,3),...extremos.slice(-2)];   // os mais e os menos expostos juntos
LADOS.forEach(lado=>{
  const pesos=time.map(j=>Math.pow(X.exposureProfile(j).opening[lado],AGR_ABRE));
  const total=pesos.reduce((soma,peso)=>soma+peso,0);
  assert.ok(total>0,`soma de pesos não positiva no lado ${lado}: ${total}`);
  pesos.forEach((peso,i)=>{
    const fracao=peso/total;
    assert.ok(fracao>0&&fracao<1,`fração inválida para ${time[i].nick}/${lado}: ${fracao}`);
  });
});

/* ─── 3. quanto custava a forma antiga ────────────────────────────────────────────
   Fator antigo: 1 + ganho·styleAgr(j). Procura o menor ganho que produz peso negativo em
   alguém da população — abaixo do valor que os docs propunham como correção. */
const agressoes=jogadores.map(j=>X.styleAgr(j));
const maisNegativa=Math.min(...agressoes);
const ganhoQueQuebra=Math.abs(1/maisNegativa);
assert.ok(maisNegativa<0,"a população não tem mais agressão negativa: o teste perdeu o sentido");
assert.ok(ganhoQueQuebra<1.8,
  `a forma linear só quebraria em ${ganhoQueQuebra.toFixed(2)}, acima do 1,8 registrado nos docs`);
const pesoAntigoEm18=1+1.8*maisNegativa;
assert.ok(pesoAntigoEm18<0,`a forma linear em 1,8 não seria negativa (${pesoAntigoEm18.toFixed(3)})`);

console.log("— ABERTURA: PESO DO SORTEIO —");
console.log(`  ✓ ${fatores.length} fatores positivos e finitos (${jogadores.length} jogadores × ${LADOS.length} lados)`);
console.log(`  ✓ AGR_ABRE ${AGR_ABRE} · menor ${menor.toFixed(3)} (${menorNick}) · maior ${maior.toFixed(3)} (${maiorNick}) · razão ${(maior/menor).toFixed(2)}×`);
console.log(`  ✓ sorteio permanece uma distribuição: toda fração em (0,1) nos dois lados`);
console.log(`  ✓ a forma linear anterior viraria negativa a partir de ganho ${ganhoQueQuebra.toFixed(2)} (em 1,8 daria ${pesoAntigoEm18.toFixed(3)})`);
console.log("✓ nenhum peso negativo pode entrar em pick() na abertura");
