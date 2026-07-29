const assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {X,T}=require("../bancada/motor"),{ROOT}=require("../bancada/common");
const plain=v=>JSON.parse(JSON.stringify(v));
async function main(){
  const M=await import(pathToFileURL(path.join(ROOT,"src/domain/simulation/series-simulation.mjs")).href);
  const casos=[[3,3,false],[17,1,true],[91,3,true],[211,5,false]];
  for(const [i,[seed,md,leve]] of casos.entries()){
    const a1=plain(T[i]),b1=plain(T[i+1]);X.srand(seed);
    const legado=plain(X.simularSerie(a1,b1,()=>X.forcaDoDia(a1.ef,a1.quim),()=>X.forcaDoDia(b1.ef,b1.quim),md,leve)),r1=X.rndF();
    const a2=plain(T[i]),b2=plain(T[i+1]);X.srand(seed);
    const resultado=M.simularSerie(a2,b2,()=>X.forcaDoDia(a2.ef,a2.quim),()=>X.forcaDoDia(b2.ef,b2.quim),md,leve,
      {mapasPool:X.MAPAS_POOL,random:X.rndF,simularMapa:X.simularMapa});
    const novo=plain(resultado),r2=X.rndF();
    assert.deepEqual(novo,legado,`simularSerie caso ${i}`);assert.equal(r2,r1,`RNG caso ${i}`);
    assert.equal(resultado.vencedor,novo.placarSerie[0]>novo.placarSerie[1]?a2:b2,`identidade do vencedor ${i}`);
    assert.equal(new Set(novo.mapas.map(m=>m.mapa)).size,novo.mapas.length,`mapa repetido ${i}`);
  }
  const ordem=[],timeA={nome:"A"},timeB={nome:"B"};
  M.simularSerie(timeA,timeB,()=>{ordem.push("A");return 1;},()=>{ordem.push("B");return 2;},1,true,
    {mapasPool:["Nuke"],random:()=>{ordem.push("R");return 0;},simularMapa:(a)=>{ordem.push("M");return {vencedor:a};}});
  assert.deepEqual(ordem,["A","B","R","M"],"ordem contratual da série mudou");
  console.log(`series simulation parity: ok (${casos.length} séries completas · RNG e ordem conferidos)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
