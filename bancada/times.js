/* bancada/times.js — LINT do elenco: valida todos os times e imprime um resumo.
   Pega a classe de bug que só aparece "no time N" (IDs colididos, atributo fora de
   faixa, treinador sem país, pool pequeno demais pro Major). Roda em <1s.
   Uso: node bancada/times.js   (sai ≠0 se houver erro duro) */
const {X}=require("./motor");
const A=X.ATRIBUTOS,POOL=X.POOL,TEAMS=X.TEAMS,DEF=X.TIMES_DEF;
let erros=0,avisos=0;
const err=m=>{console.log("  ✗ "+m);erros++;};
const avi=m=>{console.log("  ⚠ "+m);avisos++;};
const ATTRS=["fp","en","tr","op","cl","sn","ut"];

console.log("── LINT DE TIMES ──");

// 1) IDs únicos no ATRIBUTOS (POOL[id] clobbra silenciosamente duplicatas)
const vistos={};
A.forEach(p=>{const id=p.id||p.nome;if(vistos[id])err(`ID duplicado no ATRIBUTOS: "${id}" (use um id: explícito)`);vistos[id]=1;});

// 2) cada jogador: atributos 0..100 inteiros, rating plausível, colocação válida
const COLOC=["Campeao","Final","Top4","Top8","Grupos"];
A.forEach(p=>{const id=p.id||p.nome;
  ATTRS.forEach(a=>{const v=p[a];if(typeof v!=="number"||v<0||v>100||v%1!==0)err(`${id}.${a}=${v} (esperado inteiro 0–100)`);});
  if(typeof p.rating!=="number"||p.rating<0.5||p.rating>2.0)avi(`${id}: rating ${p.rating} fora de 0.5–2.0`);
  if(!COLOC.includes(p.colocacao))err(`${id}: colocação "${p.colocacao}" inválida (${COLOC.join("/")})`);
  if(typeof p.isIGL!=="boolean")err(`${id}: isIGL deve ser true/false`);
});

// 3) cada time do TIMES_DEF: 5 jogadores existentes, ≥1 IGL, treinador com país, OVRs sãos
DEF.forEach(t=>{
  if(!t.jogadores||t.jogadores.length!==5)err(`${t.nome}: ${t.jogadores?t.jogadores.length:0} jogadores (esperado 5)`);
  (t.jogadores||[]).forEach(n=>{if(!POOL[n])err(`${t.nome}: jogador "${n}" não existe no ATRIBUTOS`);});
  const igls=(t.jogadores||[]).filter(n=>POOL[n]&&POOL[n].isIGL).length;
  if(igls===0)avi(`${t.nome}: nenhum IGL marcado (o time perde bônus de comando)`);
  if(igls>1)avi(`${t.nome}: ${igls} IGLs marcados`);
  if(t.coach){const pais=t.coachPais||null;if(!pais)avi(`${t.nome}: treinador "${t.coach}" sem coachPais inline (caindo no PAISES_MAP)`);}
});

// 4) OVRs computados sem NaN
TEAMS.forEach(t=>{t.jogadores.forEach(j=>{const o=j._eng&&j._eng.ovr;
  if(typeof o!=="number"||Number.isNaN(o))err(`${t.nome}/${j._eng&&j._eng.nome}: OVR inválido (${o})`);});
  if(t.treinador&&(typeof t.treinador.ovr!=="number"))err(`${t.nome}: OVR de treinador inválido`);});

// 5) invariante do Major: precisa de ao menos 16 times pra montar o campo (15 NPC + você)
if(TEAMS.length<16)err(`só ${TEAMS.length} times — o Major precisa de ≥16 (15 NPC + você)`);

// ── resumo por time (revisão rápida) ──
console.log(`\n── ${TEAMS.length} times · ${A.length} jogadores ──`);
[...TEAMS].map(t=>({t,avg:t.jogadores.reduce((s,j)=>s+j._eng.ovr,0)/t.jogadores.length}))
  .sort((a,b)=>b.avg-a.avg)
  .forEach(({t,avg})=>{
    const js=t.jogadores.map(j=>`${j._eng.nome}(${j._eng.ovr}${j._eng.isIGL?"·IGL":""})`).join(" ");
    console.log(`  ${avg.toFixed(1)}  ${t.nome.padEnd(11)} ${js}`);
  });

console.log(`\n${erros?`✗ ${erros} erro(s)`:"✓ sem erros"}${avisos?` · ${avisos} aviso(s)`:""}`);
process.exit(erros?1:0);
