/* Compara secondaryScore extraído com o legado para jogadores reais, perfis
   sintéticos e mapas de afinidade próximos dos valores relevantes da fórmula. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const ROLES=[undefined,"IGL","AWPer","Rifler","Entry","Lurker","Support"];
const COMBAT_ROLES=["AWPer","Rifler","Entry","Lurker","Support"];
const ATTRIBUTES=["fp","en","tr","op","cl","sn","ut"];
const ATTRIBUTE_BOUNDARIES=[0,1,47,48,49,50,51,52,54,55,56,58,60,61,62,64,65,66,99,100];
const SCORE_BOUNDARIES=[null,-1,0,1,17,18,19,49,50,51,99,100];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function syntheticPlayers(){
  const base=Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,50]));
  const players=[
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,0])),
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,100])),
    {...base},
    {...base,en:65,tr:47,ut:54},
    {...base,en:55,op:65,sn:64},
    {...base,cl:55,op:55,fp:54,tr:54}
  ];
  ATTRIBUTES.forEach(attribute=>ATTRIBUTE_BOUNDARIES.forEach(value=>{
    players.push({...base,[attribute]:value});
  }));
  return players;
}

function scoreProfiles(){
  const profiles=[
    {},
    Object.fromEntries(COMBAT_ROLES.map(role=>[role,0])),
    Object.fromEntries(COMBAT_ROLES.map(role=>[role,100])),
    {AWPer:11,Rifler:22,Entry:33,Lurker:44,Support:55}
  ];
  COMBAT_ROLES.forEach(role=>SCORE_BOUNDARIES.forEach(value=>{
    profiles.push({[role]:value});
  }));
  return profiles;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","evaluation","secondary-score.mjs")).href;
  const {secondaryScore}=await import(moduleUrl);
  const players=[...plain(X.ATRIBUTOS),...syntheticPlayers()];
  const scoresList=scoreProfiles();
  let comparisons=0;

  players.forEach((player,playerIndex)=>scoresList.forEach((scores,scoresIndex)=>{
    ROLES.forEach(primary=>ROLES.forEach(secondary=>{
      const playerBefore=JSON.stringify(player);
      const scoresBefore=JSON.stringify(scores);
      const expected=X.secondaryScore(primary,secondary,player,scores);
      const actual=secondaryScore(primary,secondary,player,scores);
      assert.strictEqual(actual,expected,`divergência no perfil ${playerIndex}, scores ${scoresIndex}: ${primary}/${secondary}`);
      assert.equal(JSON.stringify(player),playerBefore,`perfil ${playerIndex} foi alterado`);
      assert.equal(JSON.stringify(scores),scoresBefore,`scores ${scoresIndex} foram alterados`);
      comparisons++;
    }));
  }));

  console.log(`secondary score parity: ok (${comparisons} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
