/* Compara roleStyleReality extraído com o legado para jogadores reais e perfis
   sintéticos próximos dos limites de todas as regras. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const ROLES=[undefined,"IGL","AWPer","Rifler","Entry","Lurker","Support","desconhecida"];
const STYLES=[
  undefined,null,"Coringa","joker","desconhecido",
  "aggressive","spacetaker","trader","playmaker","infiltrator","baiter","clutcher","support","cerebral","anchor",
  "Opener","Spacetaker","Trader","Playmaker","Infiltrador","Baiter","Closer","Facilitador","Cerebral","Ancora"
];
const ATTRIBUTES=["fp","en","tr","op","cl","sn","ut"];
const BOUNDARIES=[0,1,49,50,51,52,54,55,56,59,60,61,99,100];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function syntheticProfiles(){
  const base=Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,50]));
  const profiles=[
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,0])),
    Object.fromEntries(ATTRIBUTES.map(attribute=>[attribute,100])),
    {...base},
    {...base,en:54,cl:59,ut:54,tr:49},
    {...base,en:55,cl:60,ut:55,tr:50},
    {...base,en:60,cl:50,ut:54,tr:52,sn:59}
  ];
  ATTRIBUTES.forEach(attribute=>BOUNDARIES.forEach(value=>{
    profiles.push({...base,[attribute]:value});
  }));
  return profiles;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","evaluation","role-style-reality.mjs")).href;
  const {roleStyleReality}=await import(moduleUrl);
  const profiles=[...plain(X.ATRIBUTOS),...syntheticProfiles()];
  let comparisons=0;

  profiles.forEach((player,playerIndex)=>ROLES.forEach(role=>STYLES.forEach(style=>{
    const before=JSON.stringify(player);
    const expected=plain(X.roleStyleReality(role,style,player));
    const actual=roleStyleReality(role,style,player);
    assert.deepEqual(actual,expected,`divergência no perfil ${playerIndex}: ${role}/${style}`);
    assert.equal(JSON.stringify(player),before,`perfil ${playerIndex} foi alterado`);
    comparisons++;
  })));

  console.log(`role style parity: ok (${comparisons} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
