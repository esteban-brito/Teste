/* Vetores congelados depois da prova bit a bit contra o Mulberry32 legado.
   Protegem a sequência uniforme, Box-Muller, normalização de seed e isolamento. */
const assert=require("node:assert/strict");
const {createMulberry32}=require("../src/domain/simulation/random-source.mjs");

const CASES=[
  {seed:1,
    uniform:[0.6270739405881613,0.002735721180215478,0.5274470399599522,0.9810509674716741,
      0.9683778982143849,0.281103502959013,0.6128388606011868,0.7207431411370635],
    gaussian:[0.9659740590152261,1.1231041937525543,-0.049227862786499016,-0.1808915033144518]},
  {seed:17,
    uniform:[0.6771502960473299,0.19265692122280598,0.5313839064911008,0.1654723146930337,
      0.08778517786413431,0.76082274899818,0.28212139988318086,0.5464509064331651],
    gaussian:[0.31131072930854836,0.5695513541368098,0.14988441715048012,-1.5235832627056087]},
  {seed:4294967295,
    uniform:[0.8964226141106337,0.189478256739676,0.7156526781618595,0.9440599093213677,
      0.8452364315744489,0.5391399988438934,0.6804977387655526,0.4755720964167267],
    gaussian:[0.1735739876211159,0.7679884283523308,-0.5624472353170806,-0.8671028727257102]}
];

for(const {seed,uniform,gaussian} of CASES){
  const direct=createMulberry32(seed),normal=createMulberry32(seed);
  assert.deepEqual(Array.from({length:uniform.length},()=>direct.rndF()),uniform,
    `sequência uniforme da seed ${seed} mudou`);
  assert.deepEqual(Array.from({length:gaussian.length},()=>normal.gaussF()),gaussian,
    `sequência gaussiana da seed ${seed} mudou`);
}

for(const equivalent of [0,0x100000000,NaN]){
  const normalized=createMulberry32(equivalent),one=createMulberry32(1);
  for(let index=0;index<16;index++)assert.equal(normalized.rndF(),one.rndF(),
    `seed ${equivalent} não normalizou para 1 no passo ${index}`);
}

const direct=createMulberry32(7919),reset=createMulberry32();reset.srand(7919);
for(let index=0;index<32;index++)assert.equal(direct.rndF(),reset.rndF(),
  "seed do construtor divergiu de srand");
const left=createMulberry32(31337),right=createMulberry32(31337),reference=createMulberry32(31337);
left.rndF();left.rndF();
assert.equal(right.rndF(),reference.rndF(),"instâncias de RNG compartilharam estado");

console.log("random source contract: ok (vetores congelados · estado isolado)");
