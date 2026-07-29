/* Prova que a força diária de time extraída reproduz o motor legado — VALOR E
   CONSUMO DE AZAR. O próximo rndF precisa coincidir depois dos dois caminhos:
   assim uma chamada adicional ou ausente reprova mesmo que os valores testados
   por acaso permaneçam próximos. */
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
  const url=pathToFileURL(path.join(ROOT,"src","domain","simulation","team-form.mjs")).href;
  const M=await import(url);

  const casos=[
    {efetiva:0,quimica:.50,rotulo:"mínimos contratuais"},
    {efetiva:45.25,quimica:.49,rotulo:"química abaixo do piso"},
    {efetiva:68.75,quimica:.67,rotulo:"química intermediária"},
    {efetiva:82.5,quimica:1,rotulo:"química máxima"},
    {efetiva:100,quimica:1.01,rotulo:"química acima do teto"}
  ];

  X.srand(SEMENTE);
  const legado=casos.map(c=>X.forcaDoDia(c.efetiva,c.quimica));
  const estadoLegado=X.rndF();

  X.srand(SEMENTE);
  const extraido=casos.map(c=>M.forcaDoDia(c.efetiva,c.quimica,X.rndF));
  const estadoExtraido=X.rndF();

  casos.forEach((caso,i)=>{
    perto(extraido[i],legado[i],`forcaDoDia: ${caso.rotulo}`);
  });
  assert.equal(estadoExtraido,estadoLegado,
    "CONSUMO DE AZAR divergiu em forcaDoDia: o módulo chamou o RNG um número "+
    "diferente de vezes que o motor legado");

  let chamadas=0;
  const randomContado=()=>{chamadas++;return .75;};
  perto(M.forcaDoDia(70,.75,randomContado),73.575,
    "forcaDoDia com amostra uniforme controlada");
  assert.equal(chamadas,1,"forcaDoDia precisa consumir exatamente uma amostra uniforme");

  const cfg={AMP_MAX:20,AMP_CONSIST:.5};
  const cfgQuimica={QUIMICA_MIN:.40,QUIMICA_MAX:.80};
  perto(M.forcaDoDia(70,.60,()=>1,cfg,cfgQuimica),85,
    "forcaDoDia precisa honrar configurações injetadas");

  console.log(`team form parity: ok (${casos.length+2} comparações · consumo de azar conferido)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
