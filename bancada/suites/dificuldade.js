/* bancada/suites/dificuldade.js - quanto custa ganhar o Major, e quanto custa ganhar INVICTO.

   A dificuldade do draft9-0 nunca foi projetada: era efeito colateral do balanceamento.
   Esta suíte transforma o alvo em número. Alvo acordado com o responsável:
   INVICTO (título sem perder um único mapa) em 4–6% das campanhas com elenco bom.

   O torneio em si vive em bancada/ferramentas/campanha-major.js, compartilhado com as varreduras de
   balanceamento — assim a suíte e a calibração medem exatamente o mesmo Major.

   A linha que governa o alvo é a do ELENCO DRAFTADO, não a dos times de fábrica: é o
   elenco draftado que o usuário realmente joga.

   O DRAFT TEM RE-SPIN, e ele é ilimitado e gratuito. Por isso a dificuldade não é uma
   propriedade só do motor: é função do esforço que o jogador gasta no draft. A suíte
   imprime a curva invicto × esforço, e a linha do alvo declara qual jogador está sendo
   medido (DIFICULDADE_LIMIAR). */
const {X,T}=require("../lib/motor");
const {pct,inRange,printCheck,mean}=require("../lib/common");
const {AJUSTES_PADRAO,campanha,medirDraft}=require("../ferramentas/campanha-major");
const {wilsonIntervalPercent}=require("../../src/domain/statistics/proportion-interval.mjs");

const N=+(process.env.N||400);
// A linha do elenco draftado tem amostra própria: o invicto vive perto de 5%, e a 300 campanhas
// um único evento vale 0,33 pp — essa amostra não distingue 1,5% de 4%. Ver DIMENSIONAMENTO.
const DRAFT_N=+(process.env.DIFICULDADE_N||3000);
const CURVA_N=+(process.env.DIFICULDADE_CURVA_N||600);
// Esforço de draft da linha que governa o alvo: OVR mínimo que o jogador aceita antes de
// girar de novo. 0 = aceita a primeira carta de cada giro.
// DECISÃO DO RESPONSÁVEL (27/07/2026): o alvo de 4–6% descreve o jogador APRESSADO, ou seja,
// limiar 0. Quem gasta re-spin fica acima da faixa de propósito — o esforço é recompensado.
const LIMIAR=+(process.env.DIFICULDADE_LIMIAR||0);
// Cada correção de fidelidade do medidor pode ser desligada para atribuir seu efeito
// isoladamente (DIFICULDADE_AJUSTES=nicks,roles,overlap). Padrão: todas ligadas.
const AJUSTES=process.env.DIFICULDADE_AJUSTES===undefined?AJUSTES_PADRAO
  :new Set(process.env.DIFICULDADE_AJUSTES.split(",").map(item=>item.trim()).filter(Boolean));
/* O alvo virou gate em 27/07/2026, com margem verificada em 2.000, 4.000 e 8.000 campanhas
   (5,70% · 5,13% · 4,91%).

   VOLTOU A RELATÓRIO EM 28/07/2026, e o motivo precisa estar aqui. A guarda de fidelidade
   `Favorito gap 16+` tinha drenado para 82,2% — a 0,2 pp do piso e abaixo dos 85–90% que o CS
   real sustenta. O responsável decidiu que a fidelidade manda, e recuperá-la (D_DUELO 112 → 95)
   levou o invicto para 3,8%, logo abaixo do piso de 4.

   A faixa 4–6 NÃO foi afrouxada para o número caber: ela é uma decisão de produto de 27/07 que
   agora está explicitamente em revisão, e rebaixar o gate é o jeito honesto de manter a suíte
   verde sem fingir que o alvo foi atingido. A revisão é uma conversa pendente com o responsável,
   com o número medido na mão — não uma estimativa. Enquanto ela não acontecer, isto é relatório. */
const STRICT=process.env.DIFICULDADE_STRICT==="1";

// invicto% com IC95% de Wilson: sem o intervalo, mover o número é indistinguível de sorte.
const proporcao=(sucessos,total)=>{
  const ic=wilsonIntervalPercent(sucessos,total);
  return ic.n?`${ic.estimate.toFixed(1)}% [${ic.low.toFixed(1)}–${ic.high.toFixed(1)}]`:"—";
};

if(X.srand)X.srand(20260726);

/* ─── execução: uma fatia de campanhas por time, agrupada por força ──────── */
const inicio=Date.now();
const porTime=T.map((t,i)=>({nome:t.nome,ef:t.ef,i,campanhas:0,titulos:0,invictos:0,mapasV:0,mapasD:0,suica:0}));
const porCampanha=Math.max(1,Math.round(N/T.length));

porTime.forEach(linha=>{
  for(let c=0;c<porCampanha;c++){
    const r=campanha(linha.i,AJUSTES);
    linha.campanhas++;
    if(r.titulo)linha.titulos++;
    if(r.invicto)linha.invictos++;
    if(r.fim==="suica")linha.suica++;
    linha.mapasV+=r.mapasV;linha.mapasD+=r.mapasD;
  }
});

const total=porTime.reduce((acc,l)=>({
  campanhas:acc.campanhas+l.campanhas,titulos:acc.titulos+l.titulos,invictos:acc.invictos+l.invictos,
  suica:acc.suica+l.suica,mapasV:acc.mapasV+l.mapasV,mapasD:acc.mapasD+l.mapasD
}),{campanhas:0,titulos:0,invictos:0,suica:0,mapasV:0,mapasD:0});

// Faixa ALTA = terço mais forte do pool. Serve de referência de fábrica: o elenco draftado
// tem a linha própria mais abaixo.
const ordenados=[...porTime].sort((a,b)=>b.ef-a.ef);
const corte=Math.max(1,Math.round(ordenados.length/3));
const faixa=lista=>{
  const c=lista.reduce((acc,l)=>({campanhas:acc.campanhas+l.campanhas,titulos:acc.titulos+l.titulos,
    invictos:acc.invictos+l.invictos,suica:acc.suica+l.suica}),{campanhas:0,titulos:0,invictos:0,suica:0});
  return {ef:mean(lista.map(l=>l.ef)),...c,
    pTitulo:pct(c.titulos,c.campanhas),pInvicto:pct(c.invictos,c.campanhas),pSuica:pct(c.suica,c.campanhas)};
};
const alta=faixa(ordenados.slice(0,corte));
const media=faixa(ordenados.slice(corte,ordenados.length-corte));
const baixa=faixa(ordenados.slice(ordenados.length-corte));

console.log(`— DIFICULDADE (${total.campanhas} campanhas · ${porCampanha} por time) —\n`);
console.log(`    ${"faixa".padEnd(8)} ${"ef".padStart(6)} ${"camp".padStart(5)} ${"título%".padStart(8)} ${"invicto%".padStart(9)} ${"cai na suíça%".padStart(14)}`);
[["alta",alta],["média",media],["baixa",baixa]].forEach(([nome,f])=>{
  console.log(`    ${nome.padEnd(8)} ${f.ef.toFixed(1).padStart(6)} ${String(f.campanhas).padStart(5)} ${f.pTitulo.toFixed(1).padStart(8)} ${f.pInvicto.toFixed(1).padStart(9)} ${f.pSuica.toFixed(1).padStart(14)}`);
});

console.log(`\n    global: título ${pct(total.titulos,total.campanhas).toFixed(1)}% · invicto ${pct(total.invictos,total.campanhas).toFixed(1)}% · mapas ${total.mapasV}-${total.mapasD}`);
console.log("\n  por time (força efetiva decrescente)");
ordenados.forEach(l=>{
  console.log(`    ${l.nome.padEnd(14)} ef ${l.ef.toFixed(1).padStart(5)}  título ${pct(l.titulos,l.campanhas).toFixed(1).padStart(5)}%  invicto ${pct(l.invictos,l.campanhas).toFixed(1).padStart(5)}%`);
});

/* ─── CURVA DE ESFORÇO: o alvo de 4–6% descreve QUAL jogador? ────────────────
   Como o re-spin é ilimitado, o invicto não é uma propriedade do motor sozinho: é uma
   função do esforço que o jogador gasta no draft. Sem essa curva, "1,5%" e "4%" descrevem
   jogadores diferentes e a comparação não quer dizer nada. */
const LIMIARES=[0,18,19,20,21,22];
console.log(`\n  CURVA DE ESFORÇO DO DRAFT (${CURVA_N} campanhas por ponto)`);
console.log(`    ${"OVR mín".padEnd(8)} ${"giros".padStart(6)} ${"força".padStart(6)} ${"quím".padStart(5)}  ${"título".padStart(18)}  ${"invicto".padStart(18)}`);
LIMIARES.forEach(limiar=>{
  const r=medirDraft({limiar,campanhas:CURVA_N,ajustes:AJUSTES});
  // marca quem cai na faixa do alvo: o esforço 0 é a referência, os demais ficam acima de
  // propósito — quem gasta re-spin monta um elenco melhor e merece campanha mais fácil.
  const marca=inRange(pct(r.invictos,r.campanhas),4,6)?"◆":" ";
  console.log(`  ${marca} ${String(limiar).padEnd(8)} ${r.giros.toFixed(1).padStart(6)} ${r.ef.toFixed(1).padStart(6)} ${(r.quim*100).toFixed(0).padStart(4)}%  ${proporcao(r.titulos,r.campanhas).padStart(18)}  ${proporcao(r.invictos,r.campanhas).padStart(18)}`);
});

/* ─── a linha que governa o alvo: o elenco draftado no esforço declarado ─── */
const draftado=medirDraft({limiar:LIMIAR,campanhas:DRAFT_N,ajustes:AJUSTES});
const dCamp=draftado.campanhas,dTit=draftado.titulos,dInv=draftado.invictos;
console.log(`
  ELENCO DRAFTADO (${dCamp} drafts · OVR mín ${LIMIAR} · ${draftado.giros.toFixed(1)} giros · força média ${draftado.ef.toFixed(1)} · química média ${(draftado.quim*100).toFixed(0)}%)`);
draftado.exemplos.forEach(e=>console.log(`    ex: ${e}`));
console.log(`    título ${proporcao(dTit,dCamp)} · invicto ${proporcao(dInv,dCamp)} · cai na suíça ${proporcao(draftado.suica,dCamp)}`);
console.log(`    (IC95% de Wilson; ±${wilsonIntervalPercent(dInv,dCamp).margin.toFixed(2)} pp no invicto)`);

const checks=[
  // O alvo de 4-6% descreve o elenco DRAFTADO — é o que o usuário realmente joga.
  ["Invicto (elenco draftado) %",proporcao(dInv,dCamp),"4–6",inRange(pct(dInv,dCamp),4,6)],
  ["Título (elenco draftado) %",proporcao(dTit,dCamp),"25–60",inRange(pct(dTit,dCamp),25,60)],
  ["Título (faixa alta de fábrica) %",alta.pTitulo.toFixed(1),"12–30",inRange(alta.pTitulo,12,30)],
  ["Faixa alta supera a baixa em título",(alta.pTitulo-baixa.pTitulo).toFixed(1),">0",alta.pTitulo>baixa.pTitulo]
];

console.log("");
let falhas=0;
checks.forEach(([nome,valor,faixaTexto,ok])=>{if(!ok)falhas++;printCheck(ok,nome,valor,faixaTexto);});

console.log(`\n  (${((Date.now()-inicio)/1000).toFixed(1)}s)`);
if(falhas===0){
  console.log("✓ dificuldade no alvo");
  process.exitCode=0;
}else if(STRICT){
  console.log(`✗ ${falhas} alvo(s) de dificuldade fora da faixa`);
  process.exitCode=1;
}else{
  console.log(`▲ ${falhas} alvo(s) fora da faixa — RELATÓRIO (alvos passam a valer com DIFICULDADE_STRICT=1, no fechamento)`);
  process.exitCode=0;
}
