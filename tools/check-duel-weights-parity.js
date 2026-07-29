/* Prova que os dois pesos de combate extraídos reproduzem o motor legado, e que
   eles continuam DESACOPLADOS — que é a razão de existirem separados. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;

function perto(atual,esperado,mensagem){
  assert.ok(Number.isFinite(atual),`${mensagem}: valor não finito (${atual})`);
  assert.ok(Math.abs(atual-esperado)<PRECISAO,`${mensagem}: ${atual} ≠ ${esperado}`);
}

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","simulation","duel-weights.mjs")).href;
  const M=await import(url);

  const jogadores=Object.values(X.POOL);
  const sinteticos=[
    {},{ovr:5,fp:0},{ovr:22,fp:100},
    {ovr:22,fp:0,primario:"IGL",secundario:"Support"},   // decisivo sem fragar
    {ovr:13,fp:100,primario:"Entry"},                    // fraga sem decidir
    {ovr:17,fp:60,primario:"AWPer"},{ovr:17,fp:60,primario:"Support"},
    {ovr:17,fp:60,primario:"Lurker"},{ovr:17,fp:60,primario:"Rifler"}
  ];
  const casos=[...jogadores,...sinteticos];

  let comparacoes=0;
  casos.forEach((j,i)=>{
    const rotulo=j.id||j.nome||`caso ${i}`;
    const perfil=X.combatProfile(j);
    perto(M.skillDuelo(j,perfil),X.skillDuelo(j),`skillDuelo de ${rotulo}`);
    perto(M.fragPeso(j,perfil),X.fragPeso(j),`fragPeso de ${rotulo}`);
    comparacoes+=2;
  });

  /* ── invariante: os eixos são DESACOPLADOS ────────────────────────────── */
  const perfilDe=j=>X.combatProfile(j);
  const iglForte={ovr:22,fp:2,primario:"IGL",secundario:"Support",combatRole:"Support"};
  const entryFraco={ovr:13,fp:100,primario:"Entry"};

  assert.ok(M.skillDuelo(iglForte,perfilDe(iglForte))>M.skillDuelo(entryFraco,perfilDe(entryFraco)),
    "OVR alto precisa vencer no eixo de DUELO, mesmo com fogo baixo");
  assert.ok(M.fragPeso(entryFraco,perfilDe(entryFraco))>M.fragPeso(iglForte,perfilDe(iglForte)),
    "firepower alto precisa vencer no eixo de FRAG, mesmo com OVR baixo");

  // a sobreposição entre bandas de OVR precisa existir: OVR 15 supera OVR 20 às vezes
  const ovr15={ovr:15,fp:95,primario:"Entry"},ovr20={ovr:20,fp:45,primario:"AWPer"};
  assert.ok(M.fragPeso(ovr15,perfilDe(ovr15))>M.fragPeso(ovr20,perfilDe(ovr20)),
    "sobreposição entre bandas de OVR sumiu — FRAG_OVR_MULT ficou dominante demais");

  console.log(`duel weights parity: ok (${comparacoes} comparações · ${casos.length} casos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
