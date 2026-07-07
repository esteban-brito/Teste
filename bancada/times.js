/* bancada/times.js - lint de elenco: valida dados, IDs, times e OVRs. */
const {X}=require("./motor");
const {ATTRS,COLOCACOES,mean}=require("./common");

const A=X.ATRIBUTOS;
const POOL=X.POOL;
const TEAMS=X.TEAMS;
const DEF=X.TIMES_DEF;

let errors=0;
let warnings=0;

function err(message){
  console.log("  ✗ "+message);
  errors++;
}

function warn(message){
  console.log("  ⚠ "+message);
  warnings++;
}

function playerId(player){
  return player.id||player.nome;
}

function validateUniqueIds(){
  const seen=new Set();
  A.forEach(player=>{
    const id=playerId(player);
    if(seen.has(id))err(`ID duplicado no ATRIBUTOS: "${id}" (use um id: explícito)`);
    seen.add(id);
  });
}

function validatePlayers(){
  A.forEach(player=>{
    const id=playerId(player);
    ATTRS.forEach(attr=>{
      const value=player[attr];
      if(typeof value!=="number"||value<0||value>100||value%1!==0){
        err(`${id}.${attr}=${value} (esperado inteiro 0–100)`);
      }
    });
    if(typeof player.rating!=="number"||player.rating<0.5||player.rating>2.0){
      warn(`${id}: rating ${player.rating} fora de 0.5–2.0`);
    }
    if(!COLOCACOES.includes(player.colocacao)){
      err(`${id}: colocação "${player.colocacao}" inválida (${COLOCACOES.join("/")})`);
    }
    if(typeof player.isIGL!=="boolean")err(`${id}: isIGL deve ser true/false`);
  });
}

function validateTeamDef(team){
  if(!team.jogadores||team.jogadores.length!==5){
    err(`${team.nome}: ${team.jogadores?team.jogadores.length:0} jogadores (esperado 5)`);
  }

  (team.jogadores||[]).forEach(name=>{
    if(!POOL[name])err(`${team.nome}: jogador "${name}" não existe no ATRIBUTOS`);
  });

  const igls=(team.jogadores||[]).filter(name=>POOL[name]&&POOL[name].isIGL).length;
  if(igls===0)warn(`${team.nome}: nenhum IGL marcado (o time perde bônus de comando)`);
  if(igls>1)warn(`${team.nome}: ${igls} IGLs marcados`);

  if(team.coach&&!team.coachPais){
    warn(`${team.nome}: treinador "${team.coach}" sem coachPais inline (caindo no PAISES_MAP)`);
  }
}

function validateComputedTeams(){
  TEAMS.forEach(team=>{
    team.jogadores.forEach(player=>{
      const engine=player._eng||{};
      if(typeof engine.ovr!=="number"||Number.isNaN(engine.ovr)){
        err(`${team.nome}/${engine.nome}: OVR inválido (${engine.ovr})`);
      }
    });
    if(team.treinador&&typeof team.treinador.ovr!=="number"){
      err(`${team.nome}: OVR de treinador inválido`);
    }
  });
}

function printSummary(){
  console.log(`\n── ${TEAMS.length} times · ${A.length} jogadores ──`);
  [...TEAMS]
    .map(team=>({team,avg:mean(team.jogadores.map(player=>player._eng.ovr))}))
    .sort((a,b)=>b.avg-a.avg)
    .forEach(({team,avg})=>{
      const players=team.jogadores
        .map(player=>`${player._eng.nome}(${player._eng.ovr}${player._eng.isIGL?"·IGL":""})`)
        .join(" ");
      console.log(`  ${avg.toFixed(1)}  ${team.nome.padEnd(11)} ${players}`);
    });
}

console.log("── LINT DE TIMES ──");
validateUniqueIds();
validatePlayers();
DEF.forEach(validateTeamDef);
validateComputedTeams();
if(TEAMS.length<16)err(`só ${TEAMS.length} times — o Major precisa de ≥16 (15 NPC + você)`);

printSummary();
console.log(`\n${errors?`✗ ${errors} erro(s)`:"✓ sem erros"}${warnings?` · ${warnings} aviso(s)`:""}`);
process.exit(errors?1:0);
