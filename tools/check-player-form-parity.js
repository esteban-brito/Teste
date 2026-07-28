/* Prova que a MARÉ extraída reproduz o motor legado — VALOR E CONSUMO DE AZAR.
   ══════════════════════════════════════════════════════════════════════════
   Este é o primeiro checador do bloco de simulação, e ele prova algo que os
   anteriores não precisavam: que o módulo chama o RNG o MESMO número de vezes,
   na MESMA ordem.

   COMO. O RNG é mulberry32 com estado global: `srand(s)` fixa a semente e cada
   `rndF()` avança o estado. Então, depois de rodar os dois caminhos a partir da
   MESMA semente, basta comparar o PRÓXIMO valor do gerador: se ele bate, os dois
   deixaram o estado no mesmo ponto — ou seja, consumiram exatamente a mesma
   quantidade de azar. Uma chamada a mais ou a menos aparece imediatamente.

   O módulo recebe o gerador por parâmetro justamente para isso: os dois caminhos
   compartilham o MESMO gerador, então não há dois estados para sincronizar. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;
const SEMENTE=20260728;

function perto(atual,esperado,mensagem){
  assert.ok(Number.isFinite(atual),`${mensagem}: valor não finito (${atual})`);
  assert.ok(Math.abs(atual-esperado)<PRECISAO,`${mensagem}: ${atual} ≠ ${esperado}`);
}

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","simulation","player-form.mjs")).href;
  const M=await import(url);

  const jogadores=Object.values(X.POOL);

  /* ── tierDe: puro, sobre os 85 + casos de borda ───────────────────────── */
  const bordas=[
    {ovr:21,fp:60,primario:"Rifler"},{ovr:20,fp:60,primario:"Rifler"},
    {ovr:18,fp:60,primario:"Rifler"},{ovr:16,fp:60,primario:"Rifler"},
    {ovr:15,fp:60,primario:"Rifler"},
    // a regra por FUNÇÃO: IGL/Support de pouco fogo é Role mesmo com OVR alto
    {ovr:17,fp:54,primario:"IGL"},{ovr:17,fp:55,primario:"IGL"},
    {ovr:17,fp:54,primario:"Support"},{ovr:18,fp:54,primario:"IGL"},
    {}
  ];
  let comparacoes=0;
  [...jogadores,...bordas].forEach((j,i)=>{
    assert.equal(M.tierDe(j),X.tierDe(j),`tierDe do caso ${i}`);
    comparacoes++;
  });

  /* ── funções de forma: puras ──────────────────────────────────────────── */
  for(let v=-2;v<=4;v+=.25){
    perto(M.formaPositiva(v),v>=.05?v:.05*Math.exp(v/.05-1),`formaPositiva(${v})`);
    comparacoes++;
  }
  for(let ovr=5;ovr<=22;ovr++){
    perto(M.centroOVR(ovr),Math.max(.53,Math.min(1.44,0.277+(ovr-5)*0.064)),`centroOVR(${ovr})`);
    comparacoes++;
  }

  /* ── formaDoDia: valor E consumo de azar ──────────────────────────────── */
  const amostra=jogadores.slice(0,30);

  X.srand(SEMENTE);
  const legado=amostra.map(j=>X.formaDoDia(j));
  const estadoLegado=X.rndF();          // primeiro valor APÓS o legado

  X.srand(SEMENTE);
  const meu=amostra.map(j=>M.formaDoDia(j,X.gaussF?X.gaussF:null));
  const estadoMeu=X.rndF();

  amostra.forEach((j,i)=>{
    perto(meu[i],legado[i],`formaDoDia de ${j.id}`);
    comparacoes++;
  });
  assert.equal(estadoMeu,estadoLegado,
    "CONSUMO DE AZAR divergiu em formaDoDia: o módulo chamou o RNG um número "+
    "diferente de vezes que o motor legado");
  comparacoes++;

  /* ── sortearFormaCampanha: muta, e consome azar por time E por jogador ── */
  const clonarTimes=()=>X.TEAMS.map(t=>({
    nome:t.nome,jogadores:t.jogadores.map(j=>({...(j._eng||j)}))
  }));

  const timesLegado=clonarTimes();
  X.srand(SEMENTE);
  X.sortearFormaCampanha(timesLegado);
  const aposLegado=X.rndF();

  const timesMeu=clonarTimes();
  X.srand(SEMENTE);
  M.sortearFormaCampanha(timesMeu,X.gaussF);
  const aposMeu=X.rndF();

  timesLegado.forEach((t,ti)=>{
    t.jogadores.forEach((j,ji)=>{
      perto(timesMeu[ti].jogadores[ji]._formaCamp,j._formaCamp,
        `_formaCamp de ${t.nome}/${j.nome}`);
      comparacoes++;
    });
  });
  assert.equal(aposMeu,aposLegado,
    "CONSUMO DE AZAR divergiu em sortearFormaCampanha");
  comparacoes++;

  /* ── invariantes de domínio ───────────────────────────────────────────── */
  // a forma nunca é negativa nem zero, por construção (piso sem parede)
  X.srand(SEMENTE);
  const muitas=[];
  for(let i=0;i<2000;i++)muitas.push(M.formaDoDia(jogadores[i%jogadores.length],X.gaussF));
  assert.ok(muitas.every(v=>v>0),"a forma do dia nunca pode ser <= 0");
  assert.ok(muitas.some(v=>v>1.2)&&muitas.some(v=>v<0.9),
    "a forma precisa oscilar dos dois lados");

  // estrela oscila MENOS que role player — é a razão de existir do PERFIL_TIER
  assert.ok(M.PERFIL_TIER.Lenda.piso>M.PERFIL_TIER.Role.piso,
    "lenda precisa ter piso mais alto que role player");

  console.log(`player form parity: ok (${comparacoes} comparações · consumo de azar conferido)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
