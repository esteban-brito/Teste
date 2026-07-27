/* Prova que a identidade de combate extraída (agressão e afinidade de lado vindas do
   playstyle) reproduz o motor legado para todo o elenco e para entradas degeneradas. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;

// O motor legado roda em outro realm (vm), então objetos vindos dele têm outro
// prototype. Normalizar antes de comparar é o mesmo recurso das demais paridades.
function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function perto(actual,expected,mensagem){
  assert.ok(Number.isFinite(actual),`${mensagem}: valor não finito`);
  assert.ok(Math.abs(actual-expected)<PRECISAO,`${mensagem}: ${actual} ≠ ${expected}`);
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","evaluation","style-identity.mjs")).href;
  const {styleAggression,styleSideVector,styleId,styleTraits}=await import(moduleUrl);
  const players=Object.values(X.POOL);

  // Aceita id, rótulo e valores ausentes — o normalizador legado faz o mesmo.
  X.PLAYSTYLE_IDS.forEach(id=>{
    assert.equal(styleId(id),X.STYLE_ID(id),`id ${id} divergiu`);
    assert.equal(styleId(X.STYLE_LABEL(id)),X.STYLE_ID(X.STYLE_LABEL(id)),`rótulo de ${id} divergiu`);
    assert.deepEqual(plain(styleTraits(id)),plain(X.PLAYSTYLES[id].traits),`traços de ${id} divergiram`);
  });
  assert.deepEqual(plain(styleTraits("joker")),plain(styleTraits("Coringa")),"Coringa e joker divergiram");

  const sinteticos=[null,{},{playstyle:"joker"},{playstyle:"desconhecido"},
    {playstyle:"anchor"},{playstyle:"Ancora"},
    {playstyle:"aggressive",style:{matchMargin:0}},      // identidade difusa → piso
    {playstyle:"aggressive",style:{matchMargin:.5}},     // identidade nítida → teto
    ...players,...players.map(player=>({_eng:player}))
  ];

  sinteticos.forEach((player,index)=>{
    const antes=player==null?player:JSON.stringify(player);
    perto(styleAggression(player),X.styleAgr(player),`agressão ${index}`);

    // Afinidade de lado: compara só a PARCELA do estilo, isolando-a do resto de ladoFitRaw.
    const fonte=player?._eng||player||{};
    const traits=X.PLAYSTYLES[X.STYLE_ID(fonte.playstyle)]?.traits;
    const esperado=traits?[traits.ct*X.CFG_SIM.STYLE_LADO.ct,traits.t*X.CFG_SIM.STYLE_LADO.t]:[0,0];
    const obtido=styleSideVector(player);
    perto(obtido[0],esperado[0],`lado CT ${index}`);
    perto(obtido[1],esperado[1],`lado T ${index}`);

    if(player!=null)assert.equal(JSON.stringify(player),antes,`entrada ${index} foi alterada`);
  });

  // O estilo tem que separar quem joga na frente de quem segura.
  assert.ok(styleAggression({playstyle:"aggressive"})>styleAggression({playstyle:"anchor"}),
    "ritmo não separou Opener de Âncora");
  assert.ok(styleSideVector({playstyle:"anchor"})[0]>styleSideVector({playstyle:"spacetaker"})[0],
    "afinidade de CT não separou Âncora de Spacetaker");
  assert.equal(styleAggression({playstyle:"joker"}),0,"Coringa deveria ser neutro");

  console.log(`style identity parity: ok (${sinteticos.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
