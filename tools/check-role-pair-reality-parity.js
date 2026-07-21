/* Compara a primeira função extraída do PRISMA com o legado para jogadores
   reais e perfis sintéticos próximos dos limites de todas as regras. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const ROLES=[undefined,"IGL","AWPer","Rifler","Entry","Lurker","Support"];
const ATTRIBUTES=["fp","en","tr","op","cl","sn","ut"];
const BOUNDARIES=[0,1,47,48,49,50,51,52,54,55,56,58,60,61,62,64,65,66,99,100];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function syntheticProfiles(){
  const base=Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,50]));
  const profiles=[
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,0])),
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,100])),
    {...base},
    {...base,en:65,tr:47,ut:54},
    {...base,en:55,op:65,sn:64},
    {...base,cl:55,op:55,fp:54,tr:54}
  ];
  ATTRIBUTES.forEach(attribute=>BOUNDARIES.forEach(value=>{
    profiles.push({...base,[attribute]:value});
  }));
  return profiles;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","evaluation","role-pair-reality.mjs")).href;
  const {rolePairReality}=await import(moduleUrl);
  const profiles=[...plain(X.ATRIBUTOS),...syntheticProfiles()];
  let comparisons=0;

  profiles.forEach((player,playerIndex)=>ROLES.forEach(primary=>ROLES.forEach(secondary=>{
    const before=JSON.stringify(player);
    const expected=plain(X.rolePairReality(primary,secondary,player));
    const actual=rolePairReality(primary,secondary,player);
    assert.deepEqual(actual,expected,`divergência no perfil ${playerIndex}: ${primary}/${secondary}`);
    assert.equal(JSON.stringify(player),before,`perfil ${playerIndex} foi alterado`);
    comparisons++;
  })));

  console.log(`role pair parity: ok (${comparisons} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
