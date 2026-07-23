/* bancada/r5-tails.js - prova ausencia de pisos/tetos duros na forma e no rating. */
const assert=require("node:assert/strict");
const {X}=require("./motor");

const lethal={buyMatador:"eco",buyVitima:"full",estadoMeu:1,estadoInim:5,roundGanho:true};
const highRating=X.fallenAngels({totalRounds:1,kills:Array(5).fill(lethal),mortes:[],roundsKAST:1,
  multi:{5:1},opK:5,opD:0,dmg:600,tradeK:5,impacto:1.1,prim:"AWPer",ovr:22,ratingBase:1.75});
const lowRating=X.fallenAngels({totalRounds:1,kills:[],mortes:[{estadoMeu:1,estadoInim:1}],roundsKAST:0,
  multi:{},opK:0,opD:1,dmg:0,tradeK:0,impacto:.95,prim:"Support",ovr:12,ratingBase:.79});

assert.ok(Number.isFinite(highRating)&&highRating>3,`rating alto continuou limitado: ${highRating}`);
assert.ok(Number.isFinite(lowRating)&&lowRating>0&&lowRating<.3,`rating baixo continuou limitado: ${lowRating}`);

const samples=250000,players=Object.values(X.POOL);
let minimum=Infinity,maximum=-Infinity,oldFloorMass=0,oldCeilingMass=0,aboveOldCeiling=0,belowOldFloor=0;
X.srand(24680);
for(let index=0;index<samples;index++){
  const value=X.formaDoDia(players[index%players.length]);
  assert.ok(Number.isFinite(value)&&value>0,`forma invalida na amostra ${index}: ${value}`);
  minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
  if(value===.3)oldFloorMass++;
  if(value===2.2)oldCeilingMass++;
  if(value<.3)belowOldFloor++;
  if(value>2.2)aboveOldCeiling++;
}

assert.equal(oldFloorMass,0,"forma acumulou massa no piso antigo");
assert.equal(oldCeilingMass,0,"forma acumulou massa no teto antigo");
assert.ok(belowOldFloor>0,"amostra nao atravessou o piso antigo");
assert.ok(aboveOldCeiling>0,"amostra nao atravessou o teto antigo");

console.log("— R5.2: CAUDAS SEM CURADORIA —");
console.log(`  ✓ rating sintetico atravessa limites antigos: ${lowRating.toFixed(3)} / ${highRating.toFixed(3)}`);
console.log(`  ✓ ${samples} formas positivas e finitas · min ${minimum.toFixed(3)} · max ${maximum.toFixed(3)}`);
console.log(`  ✓ ${belowOldFloor} abaixo de 0.30 · ${aboveOldCeiling} acima de 2.20 · zero massa nas fronteiras`);
console.log("✓ nenhum piso ou teto duro permanece na forma/rating");
