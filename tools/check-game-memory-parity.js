/* Prova que a memória/narrativa extraída preserva valores, mutação controlada
   dos recordes e o contrato de não consumir RNG. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X,T}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const plain=value=>JSON.parse(JSON.stringify(value));

async function main(){
  const M=await import(pathToFileURL(path.join(ROOT,"src/domain/narrative/game-memory.mjs")).href);
  const fixture={placar:[13,10],half1:[4,8],mapa:"Inferno",totalRounds:23,
    nomeA:"Meu Time",nomeB:"Rivais",meuA:true,meuB:false,
    rounds:[{venceA:true,clutchX:3,clutchWon:true},{venceA:false,clutchX:4,clutchWon:true}],
    statsA:[{nick:"alfa",k:30,d:14,a:5,rating:1.52,kast:.8,adr:101},
      {nick:"beta",k:12,d:15,a:9,rating:.98,kast:.7,adr:64}],
    statsB:[{nick:"x",k:20,d:20,a:4,rating:1.1,kast:.7,adr:80}]};
  for(const game of [fixture,{...fixture,meuA:false},{...fixture,rounds:[]},
    {...fixture,rounds:[],totalRounds:27},{...fixture,rounds:[],half1:[7,5],placar:[13,3]}]){
    assert.deepEqual(plain(M.coletarMarcos(game)),plain(X.coletarMarcos(game)),"marcos divergiram");
    assert.deepEqual(plain(M.manchete(game)),plain(X.manchete(game)),"manchete divergiu");
  }
  const milestone=X.coletarMarcos(fixture),legacyRecords={},moduleRecords={};
  const legacyNews=X.atualizarRecordes(legacyRecords,milestone,{data:"2026-07-28"});
  const moduleNews=M.atualizarRecordes(moduleRecords,milestone,{data:"2026-07-28"});
  assert.deepEqual(plain(moduleNews),plain(legacyNews),"novos recordes divergiram");
  assert.deepEqual(plain(moduleRecords),plain(legacyRecords),"mutação dos recordes divergiu");
  const campaign={mapasV:9,mapasD:0,ratings:{
    alfa:{r:[1.5,1.3,1.6],k:80,d:50,a:12},beta:{r:[1,1.1,.9],k:40,d:55,a:20}}};
  assert.deepEqual(plain(M.narrativaMVP(campaign)),plain(X.narrativaMVP(campaign)),"MVP divergiu");
  assert.equal(M.narrativaMVP({ratings:{}}),X.narrativaMVP({ratings:{}}),"campanha vazia divergiu");

  X.srand(20260728);
  const game=X.simularMapa({...plain(T[0]),meu:true},plain(T[1]),null,null,"Nuke",false);
  const before=X.rndF();M.coletarMarcos(game);M.manchete(game);M.narrativaMVP(campaign);const after=X.rndF();
  X.srand(20260728);X.simularMapa({...plain(T[0]),meu:true},plain(T[1]),null,null,"Nuke",false);
  const expectedBefore=X.rndF(),expectedAfter=X.rndF();
  assert.equal(before,expectedBefore,"estado anterior do RNG divergiu");
  assert.equal(after,expectedAfter,"memória consumiu RNG");
  console.log("game memory parity: ok (marcos · recordes · manchetes · MVP · zero RNG)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
