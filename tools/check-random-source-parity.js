const assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor"),{ROOT}=require("../bancada/common");
async function main(){
  const {createMulberry32}=await import(pathToFileURL(path.join(ROOT,"src","domain","simulation","random-source.mjs")).href);
  const seeds=[0,1,2,17,0x6D2B79F5,0xFFFFFFFF,0x100000000,-123456789,NaN];
  let comparisons=0;
  for(const seed of seeds){
    const rng=createMulberry32();X.srand(seed);rng.srand(seed);
    for(let i=0;i<64;i++){
      const gaussian=i%7===0;
      const legacy=gaussian?X.gaussF():X.rndF();
      const modular=gaussian?rng.gaussF():rng.rndF();
      assert.equal(modular,legacy,`sequência divergiu na seed ${seed}, passo ${i}`);comparisons++;
    }
  }
  const direct=createMulberry32(7919),reset=createMulberry32();reset.srand(7919);
  for(let i=0;i<32;i++){assert.equal(direct.rndF(),reset.rndF(),"seed do construtor divergiu de srand");comparisons++;}
  const left=createMulberry32(31337),right=createMulberry32(31337),reference=createMulberry32(31337);
  left.rndF();left.rndF();
  assert.equal(right.rndF(),reference.rndF(),"instâncias de RNG compartilharam estado");comparisons++;
  console.log(`random source parity: ok (${comparisons} amostras · estado isolado)`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
