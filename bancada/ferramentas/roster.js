/* bancada/ferramentas/roster.js - regenera os dados embutidos em elencos.html.
   Fonte única: composição pública carregada por bancada/lib/motor.js. */
const fs=require("fs");
const path=require("path");
const {X}=require("../lib/motor");
const {ROOT,mean}=require("../lib/common");

const ROSTER_PATH=path.join(ROOT,"elencos.html");
const DATA_RE=/const DATA=\[.*?\];\r?\n/s;

function firstDefined(object,...keys){
  for(const key of keys){
    if(object&&object[key]!==undefined)return object[key];
  }
  return undefined;
}

function playerSnapshot(player){
  const engine=player._eng||{};
  return {
    n:firstDefined(engine,"nome","nick"),
    o:engine.ovr,
    r1:engine.primario,
    r2:engine.secundario,
    sf:engine.secForte!==false,
    ps:engine.playstyle?X.STYLE_LABEL(X.STYLE_ID(engine.playstyle)):null, // identidade única (era o sub-arquétipo)
    st:!!engine.estrela,
    igl:!!firstDefined(engine,"isIGL"),
    pa:firstDefined(engine,"pais"),
    rt:firstDefined(engine,"rating"),
    s:{fp:engine.fp,op:engine.op,cl:engine.cl,ut:engine.ut,en:engine.en,tr:engine.tr,sn:engine.sn}
  };
}

function coachSnapshot(coach){
  if(!coach)return null;
  return {
    n:firstDefined(coach,"nick"),
    o:coach.ovr,
    ca:coach.carac,
    pa:firstDefined(coach,"pais")
  };
}

function teamSnapshot(team){
  const players=team.jogadores
    .map(playerSnapshot)
    .sort((a,b)=>b.o-a.o||b.rt-a.rt);
  return {
    n:team.nome,
    cor:team.cor,
    camp:team.camp,
    coloc:team.coloc,
    p:players,
    c:coachSnapshot(team.treinador)
  };
}

function build(){
  return X.TEAMS
    .map(teamSnapshot)
    .sort((a,b)=>mean(b.p.map(player=>player.o))-mean(a.p.map(player=>player.o)));
}

function inject(){
  const data=build();
  let html=fs.readFileSync(ROSTER_PATH,"utf8");
  if(!DATA_RE.test(html))throw new Error("elencos.html: marcador `const DATA=[...]` não encontrado");
  html=html.replace(DATA_RE,"const DATA="+JSON.stringify(data)+";\n");
  fs.writeFileSync(ROSTER_PATH,html);
  return data.length;
}

module.exports={build,inject};

if(require.main===module){
  const count=inject();
  console.log(`✓ elencos.html regenerado a partir dos motores · ${count} times`);
}
