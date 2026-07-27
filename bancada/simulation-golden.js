/* bancada/simulation-golden.js - caracteriza o simulador atual por seed.
   O fixture protege comportamento observavel; nao declara que o balanceamento atual e ideal.

   Uso: node bancada/simulation-golden.js
        node bancada/simulation-golden.js --update */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {loadEngines,buildCombatTeams}=require("./motor");
const {okMark}=require("./common");

const FIXTURE_PATH=path.join(__dirname,"simulation-golden.json");
const SCHEMA_VERSION=1;

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function rawPlayerId(card){
  return card?._eng?.id||card?._eng?.nome||card?.nick||"?";
}

function combatTeam(X,teams,index,userControlled=false){
  return {...teams[index],cor:X.TEAMS[index].cor,meu:userControlled};
}

function projectStats(stats,team){
  return stats.map((row,index)=>({
    id:rawPlayerId(team.jogadores[index]),
    nick:row.nick,
    kills:row.k,
    deaths:row.d,
    assists:row.a,
    rating:row.rating,
    kast:row.kast,
    adr:row.adr
  }));
}

function projectSnapshot(snapshot,team){
  if(snapshot===null)return null;
  return snapshot.map((row,index)=>({id:rawPlayerId(team.jogadores[index]),kills:row.k,deaths:row.d}));
}

function winnerSide(result,a){
  return result.vencedor===a?"A":"B";
}

function projectMap(result,a,b){
  return {
    map:result.mapa,
    score:result.placar,
    firstHalf:result.half1,
    totalRounds:result.totalRounds,
    winnerSide:winnerSide(result,a),
    winnerName:result.vencedorNome,
    identity:{
      names:[result.nomeA,result.nomeB],
      colors:[result.corA??null,result.corB??null],
      userControlled:[result.meuA,result.meuB]
    },
    rounds:result.rounds.map(round=>({
      number:round.r,
      score:[round.pa,round.pb],
      winnerSide:round.venceA?"A":"B",
      sides:[round.ladoA,round.ladoB],
      sideSwitch:round.troca,
      planted:round.plantado,
      buys:[round.buyA,round.buyB],
      clutch:round.clutchX?{opponents:round.clutchX,won:round.clutchWon}:null,
      highlight:round.destaque,
      scoreboard:{
        a:projectSnapshot(round.snapA,a),
        b:projectSnapshot(round.snapB,b)
      }
    })),
    players:{a:projectStats(result.statsA,a),b:projectStats(result.statsB,b)}
  };
}

function projectInput(a,b,aIndex,bIndex){
  const team=(value,index)=>({index,name:value.nome,players:value.jogadores.map(rawPlayerId)});
  return {a:team(a,aIndex),b:team(b,bIndex)};
}

function fixedMapScenario({id,seed,aIndex,bIndex,map,expectedScore}){
  const X=loadEngines(),teams=buildCombatTeams(X);
  const a=combatTeam(X,teams,aIndex,true),b=combatTeam(X,teams,bIndex);
  X.srand(seed);
  const result=X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim),map,false);
  assert.equal(result.placar.join(","),expectedScore.join(","),`${id}: ancora de placar mudou antes de atualizar o fixture`);
  return {id,kind:"fixed-map",seed,input:{...projectInput(a,b,aIndex,bIndex),map},output:projectMap(result,a,b)};
}

function campaignSeriesScenario(){
  // Seed 4: a única razão de este cenário existir é exercitar o MAPA DECISIVO, que uma varrida
  // 2-0 nunca alcança. A 4 devolve a série 1-2 em três mapas distintos, mesma cobertura.
  const id="campaign-best-of-three",seed=4,aIndex=4,bIndex=9;
  const X=loadEngines(),teams=buildCombatTeams(X);
  X.srand(seed);
  X.sortearFormaCampanha(teams);
  const a=combatTeam(X,teams,aIndex,true),b=combatTeam(X,teams,bIndex);
  const result=X.simularSerie(a,b,()=>X.forcaDoDia(a.ef,a.quim),()=>X.forcaDoDia(b.ef,b.quim),3,false);
  // Série de três mapas: cobre o mapa decisivo, que uma varrida 2-0 nunca alcança. A sequência
  // de mapas acompanha o novo sorteio de RNG; a cobertura é a mesma.
  assert.equal(result.placarSerie.join(","),"1,2",`${id}: ancora da serie mudou antes de atualizar o fixture`);
  assert.equal(result.mapas.map(map=>map.mapa).join(","),"Anubis,Ancient,Nuke",`${id}: sequencia de mapas mudou antes de atualizar o fixture`);
  return {
    id,kind:"campaign-series",seed,
    input:{...projectInput(a,b,aIndex,bIndex),bestOf:3,campaignForm:true},
    output:{
      score:result.placarSerie,
      winnerSide:winnerSide(result,a),
      winnerName:result.vencedorNome,
      maps:result.mapas.map(map=>projectMap(map,a,b))
    }
  };
}

function buildCurrent(){
  const current={
    schemaVersion:SCHEMA_VERSION,
    rngContract:"mulberry32-v1",
    scenarios:[
      // Âncoras revisadas em 28/07/2026 pelo MOMENTUM INTRA-MAPA: quem já está por cima passa a
      // levar mais das kills seguintes, o que muda quem fraga em cada duelo e portanto a
      // recompensa por arma, a compra do round seguinte e todo o stream de RNG a partir daí.
      // As seeds são reescolhidas para preservar a FORMA do cenário, nunca para encobrir a
      // diferença: a seed 20 devolve o mesmo mapa competitivo de 23 rounds com as quatro classes
      // de compra e clutch vencido.
      fixedMapScenario({id:"economy-and-clutches",seed:20,aIndex:0,bIndex:1,map:"Nuke",expectedScore:[13,10]}),
      // Este cenário cobre o OT REPETÍVEL (alvo 13→16→19→22), caminho que só executa com duas ou
      // mais prorrogações. Ele é frágil por natureza: qualquer balanceamento reembaralha o RNG e a
      // seed antiga deixa de ir para o overtime. A regra ao mexer aqui é procurar uma seed que
      // volte a produzir 2+ prorrogações — nunca aceitar um placar de tempo normal, que esvaziaria
      // o teste. A seed 132 reproduz 22-20 em 42 rounds — três prorrogações, mesma forma do
      // 22-19 em 41 rounds que a 456 dava antes do momentum.
      // Histórico da seed: 129 → 349 → 515 → 200 → 456 → 132.
      fixedMapScenario({id:"repeated-overtime",seed:132,aIndex:0,bIndex:1,map:"Nuke",expectedScore:[22,20]}),
      campaignSeriesScenario()
    ]
  };
  // Valores saem de um contexto vm; JSON remove prototipos cross-realm sem arredondar numeros.
  return plain(current);
}

function validateMap(map,id){
  assert.equal(map.rounds.length,map.totalRounds,`${id}: timeline incompleta`);
  assert.equal(map.score[0]+map.score[1],map.totalRounds,`${id}: placar e rounds divergem`);
  map.rounds.forEach((round,index)=>assert.equal(round.number,index+1,`${id}: numeracao de round invalida`));
  assert.deepEqual(map.rounds.at(-1).score,map.score,`${id}: ultimo placar acumulado diverge`);
  const players=[...map.players.a,...map.players.b];
  assert.equal(players.length,10,`${id}: mapa completo precisa de dez jogadores`);
  assert.equal(new Set(players.map(player=>player.id)).size,10,`${id}: IDs de jogador repetidos`);
  players.forEach(player=>{
    [player.kills,player.deaths,player.assists,player.rating,player.kast,player.adr]
      .forEach(value=>assert.ok(Number.isFinite(value),`${id}: estatistica invalida de ${player.id}`));
  });
  const last=map.rounds.at(-1).scoreboard;
  if(last.a&&last.b){
    const finalKd=side=>map.players[side].map(player=>({id:player.id,kills:player.kills,deaths:player.deaths}));
    assert.deepEqual(last.a,finalKd("a"),`${id}: placar ao vivo A nao fecha com stats finais`);
    assert.deepEqual(last.b,finalKd("b"),`${id}: placar ao vivo B nao fecha com stats finais`);
  }
}

function validateCurrent(current){
  current.scenarios.forEach(scenario=>{
    if(scenario.kind==="campaign-series")scenario.output.maps.forEach((map,index)=>validateMap(map,`${scenario.id}/map-${index+1}`));
    else validateMap(scenario.output,scenario.id);
  });
  const economy=current.scenarios.find(scenario=>scenario.id==="economy-and-clutches").output;
  const buys=new Set(economy.rounds.flatMap(round=>round.buys));
  ["pistol","eco","force","full"].forEach(buy=>assert.ok(buys.has(buy),`economy-and-clutches: compra ${buy} ausente`));
  assert.ok(economy.rounds.some(round=>round.clutch?.won),"economy-and-clutches: nenhum clutch vencido");
  const overtime=current.scenarios.find(scenario=>scenario.id==="repeated-overtime").output;
  assert.ok(overtime.totalRounds>=30,"repeated-overtime: prorrogação repetida nao foi exercitada");
}

function competitiveCore(map){
  return {
    map:map.map,score:map.score,firstHalf:map.firstHalf,totalRounds:map.totalRounds,
    winnerSide:map.winnerSide,winnerName:map.winnerName,
    rounds:map.rounds.map(round=>({
      number:round.number,score:round.score,winnerSide:round.winnerSide,sides:round.sides,
      sideSwitch:round.sideSwitch,planted:round.planted,buys:round.buys,clutch:round.clutch,highlight:round.highlight
    }))
  };
}

function numericPlayerCore(map){
  const copy=plain(map);
  copy.rounds.forEach(round=>{delete round.highlight;});
  for(const side of ["a","b"])copy.players[side].forEach(player=>{delete player.nick;});
  return copy;
}

function validateNameInvariance(){
  const X=loadEngines();
  const raw=X.ATRIBUTOS.find(player=>(player.id||player.nome)==="s1mple");
  const original=X.avaliarJogador({...raw});
  const renamed=X.avaliarJogador({...raw,nome:"Jogador sem curadoria",nick:"Jogador sem curadoria"});
  const identity=player=>({role1:player.role1,role2:player.role2,playstyle:player.playstyle,ovr:player.ovr,estrela:player.estrela});
  assert.deepEqual(plain(identity(renamed)),plain(identity(original)),"nome alterou a avaliacao calculada");

  const teams=buildCombatTeams(X),a=combatTeam(X,teams,0,true),b=combatTeam(X,teams,1);
  const renamedA={...a,jogadores:a.jogadores.map((card,index)=>index?card:{...card,_eng:{...card._eng,nick:"Jogador sem curadoria"}})};
  const run=team=>{
    X.srand(20260720);
    return numericPlayerCore(projectMap(X.simularMapa(team,b,a.ef,b.ef,"Nuke",false),team,b));
  };
  assert.deepEqual(run(renamedA),run(a),"nome alterou combate, placar ou estatisticas");
}

function validateLightParity(){
  const run=light=>{
    const X=loadEngines(),teams=buildCombatTeams(X),a=combatTeam(X,teams,0,true),b=combatTeam(X,teams,1);
    X.srand(1);
    return projectMap(X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim),"Nuke",light),a,b);
  };
  const full=plain(run(false)),light=plain(run(true));
  assert.deepEqual(competitiveCore(light),competitiveCore(full),"modo leve alterou o resultado competitivo");
  assert.deepEqual(light.players,{a:[],b:[]},"modo leve calculou stats que deveria omitir");
  assert.ok(light.rounds.every(round=>round.scoreboard.a===null&&round.scoreboard.b===null),"modo leve criou snapshots de placar");
}

function validateTelemetryParity(){
  const run=enabled=>{
    const X=loadEngines(),teams=buildCombatTeams(X),a=combatTeam(X,teams,0,true),b=combatTeam(X,teams,1);
    X.srand(20260723);
    const primary=plain(X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim),"Nuke",false,enabled?{telemetry:true}:undefined));
    const followUp=plain(X.simularMapa(a,b,50,50,"Inferno",false));
    return {primary,followUp};
  };
  const baseRun=run(false),tracedRun=run(true),base=baseRun.primary,traced=tracedRun.primary,telemetry=traced.telemetry;
  assert.ok(telemetry&&telemetry.schemaVersion===1,"telemetria ausente ou sem versao");
  assert.equal(telemetry.rounds.length,traced.totalRounds,"telemetria nao cobre todos os rounds");
  telemetry.rounds.forEach((round,index)=>{
    assert.equal(round.round,index+1,"telemetria fora de ordem");
    assert.equal(round.players.A.length,5,"telemetria A sem cinco jogadores");
    assert.equal(round.players.B.length,5,"telemetria B sem cinco jogadores");
    const players=[...round.players.A,...round.players.B];
    assert.equal(new Set(players.map(player=>player.id)).size,10,"telemetria repetiu ID no round");
    players.forEach(player=>{
      const components=player.kastComponents;
      assert.equal(Boolean(player.kastCredit),components.kill||components.assist||components.survived||components.traded,"componentes KAST divergem do credito");
      if(player.saved){
        const playerTeam=round.players.A.includes(player)?"A":"B";
        assert.equal(player.survived,true,"save creditado a jogador morto");
        assert.equal(round.result.saveTeam,playerTeam,"save creditado ao time errado");
      }
    });
    assert.equal(players.reduce((total,player)=>total+player.kills,0),round.events.length,"kills do round divergem dos eventos");
    assert.equal(players.reduce((total,player)=>total+player.deaths,0),round.events.length,"deaths do round divergem dos eventos");
  });
  for(const [teamKey,statsKey] of [["A","statsA"],["B","statsB"]]){
    const totals=Array.from({length:5},()=>({k:0,d:0,a:0,kast:0,dmg:0}));
    telemetry.rounds.forEach(round=>round.players[teamKey].forEach((player,index)=>{
      totals[index].k+=player.kills;totals[index].d+=player.deaths;totals[index].a+=player.assists;
      totals[index].kast+=player.kastCredit;totals[index].dmg+=player.damage;
    }));
    traced[statsKey].forEach((player,index)=>{
      assert.deepEqual([totals[index].k,totals[index].d,totals[index].a],[player.k,player.d,player.a],`totais da telemetria divergiram em ${teamKey}/${index}`);
      assert.equal(+(totals[index].kast/traced.totalRounds).toFixed(3),player.kast,`KAST da telemetria divergiu em ${teamKey}/${index}`);
      assert.equal(Math.round(totals[index].dmg/traced.totalRounds),player.adr,`ADR da telemetria divergiu em ${teamKey}/${index}`);
    });
  }
  delete traced.telemetry;
  assert.deepEqual(traced,base,"ativar telemetria alterou o resultado observado");
  assert.deepEqual(tracedRun.followUp,baseRun.followUp,"ativar telemetria alterou o estado posterior do RNG");
}

function firstDifference(expected,actual,pathName="$"){
  if(Object.is(expected,actual))return null;
  if(typeof expected!==typeof actual||expected===null||actual===null)return {path:pathName,expected,actual};
  if(Array.isArray(expected)||Array.isArray(actual)){
    if(!Array.isArray(expected)||!Array.isArray(actual)||expected.length!==actual.length)return {path:pathName+".length",expected:expected.length,actual:actual.length};
    for(let i=0;i<expected.length;i++){const diff=firstDifference(expected[i],actual[i],`${pathName}[${i}]`);if(diff)return diff;}
    return null;
  }
  if(typeof expected==="object"){
    const keys=[...new Set([...Object.keys(expected),...Object.keys(actual)])].sort();
    for(const key of keys){
      if(!Object.hasOwn(expected,key)||!Object.hasOwn(actual,key))return {path:`${pathName}.${key}`,expected:expected[key],actual:actual[key]};
      const diff=firstDifference(expected[key],actual[key],`${pathName}.${key}`);if(diff)return diff;
    }
    return null;
  }
  return {path:pathName,expected,actual};
}

function short(value){
  const json=JSON.stringify(value);
  return json&&json.length>180?json.slice(0,177)+"...":json;
}

console.log("— GOLDEN DO SIMULADOR (seed + timeline completa) —");
const current=buildCurrent();
validateCurrent(current);
validateLightParity();
validateTelemetryParity();
validateNameInvariance();
assert.deepEqual(buildCurrent(),current,"mesmos inputs e seeds nao repetiram o resultado");

if(process.argv.includes("--update")){
  fs.writeFileSync(FIXTURE_PATH,JSON.stringify(current,null,2)+"\n");
  console.log(`${okMark(true)} fixture atualizado explicitamente: ${path.basename(FIXTURE_PATH)}`);
  process.exit(0);
}

if(!fs.existsSync(FIXTURE_PATH))throw new Error("fixture ausente; revise os cenarios antes de executar --update");
const approved=JSON.parse(fs.readFileSync(FIXTURE_PATH,"utf8"));
const difference=firstDifference(approved,current);
if(difference){
  console.error(`  ${okMark(false)} primeira diferenca em ${difference.path}`);
  console.error(`    aprovado: ${short(difference.expected)}`);
  console.error(`    atual:    ${short(difference.actual)}`);
  process.exit(1);
}
console.log(`  ${okMark(true)} 3 cenarios identicos ao aprovado`);
console.log(`  ${okMark(true)} repeticao deterministica em motor novo`);
console.log(`  ${okMark(true)} modo leve preserva placar e timeline`);
console.log(`  ${okMark(true)} telemetria preserva resultado e consumo de RNG`);
console.log(`  ${okMark(true)} nomes nao alteram avaliacao nem resultado esportivo`);
console.log(`${okMark(true)} contrato Mulberry32 protegido por resultados observaveis`);
