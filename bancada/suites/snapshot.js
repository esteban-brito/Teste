/* bancada/suites/snapshot.js — trava a classificação APROVADA de todos os jogadores (elenco inteiro).
   Substitui pins frágeis espalhados nos testes: em vez de "drop=Entry" cravado no código, o
   estado inteiro fica num JSON aprovado. O teste acusa qualquer DERIVA (jogador que mudou de
   função/estilo/OVR sem você querer). Numa tunagem INTENCIONAL, regenere: npm run snapshot:update.

   Uso:  node bancada/suites/snapshot.js            (compara com o aprovado — entra no bench)
         node bancada/suites/snapshot.js --update   (regrava o aprovado com o estado atual) */
const fs=require("fs");
const path=require("path");
const {pathToFileURL}=require("node:url");
const {X}=require("../lib/motor");
const {ROOT,GOLDEN,okMark}=require("../lib/common");

const SNAP=path.join(GOLDEN,"roster-snapshot.json");

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","data","players.mjs")).href;
  const {ATRIBUTOS}=await import(moduleUrl);
  const current={};
  const labels={};
  let cardCount=0;
  X.TEAMS.forEach(t=>t.jogadores.forEach(j=>{
    const p=j._eng,playerId=p.id||p.nome,ev=X.avaliarJogador({...p});
    cardCount++;
    if(Object.prototype.hasOwnProperty.call(current,playerId)){
      throw new Error(`ID duplicado no snapshot: "${playerId}" (${labels[playerId]} e ${t.nome}/${p.nome})`);
    }
    labels[playerId]=`${t.nome}/${p.nome}`;
    current[playerId]=`${ev.role1||ev.combatRole}/${ev.role2||ev.secundario}·${X.STYLE_LABEL(ev.playstyle)}·${Math.round(ev.ovr)}`;
  }));

  const rawIds=new Set(ATRIBUTOS.map(p=>p.id||p.nome));
  if(rawIds.size!==ATRIBUTOS.length){
    throw new Error(`ATRIBUTOS contém IDs duplicados: ${rawIds.size}/${ATRIBUTOS.length} únicos`);
  }
  if(cardCount!==ATRIBUTOS.length||Object.keys(current).length!==cardCount){
    throw new Error(`cobertura incompleta do snapshot: ${Object.keys(current).length}/${cardCount}/${ATRIBUTOS.length} (snapshot/cards/atributos)`);
  }

  if(process.argv.includes("--update")){
    fs.writeFileSync(SNAP,JSON.stringify(current,null,1)+"\n");
    console.log(`✓ snapshot atualizado (${Object.keys(current).length} jogadores) — ${path.relative(ROOT,SNAP)}`);
    return;
  }

  console.log("— SNAPSHOT DO ELENCO (deriva não-intencional) —");
  if(!fs.existsSync(SNAP)){
    console.log("  ✗ sem snapshot aprovado — rode: npm run snapshot:update");
    process.exitCode=1;
    return;
  }
  const approved=JSON.parse(fs.readFileSync(SNAP,"utf8"));
  const keys=new Set([...Object.keys(approved),...Object.keys(current)]);
  let drift=0;
  for(const k of keys){
    if(approved[k]!==current[k]){drift++;console.log(`  ✗ ${labels[k]||k}: ${approved[k]||"(novo)"} -> ${current[k]||"(sumiu)"}`);}
  }
  console.log(drift?`\n✗ ${drift} jogador(es) derivaram do aprovado — se foi intencional: npm run snapshot:update`
    :`${okMark(true)} elenco idêntico ao aprovado (${Object.keys(current).length} jogadores)`);
  process.exitCode=drift?1:0;
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
