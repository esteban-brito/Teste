/* bancada/snapshot.js — trava a classificação APROVADA de todos os jogadores (elenco inteiro).
   Substitui pins frágeis espalhados nos testes: em vez de "drop=Entry" cravado no código, o
   estado inteiro fica num JSON aprovado. O teste acusa qualquer DERIVA (jogador que mudou de
   função/estilo/OVR sem você querer). Numa tunagem INTENCIONAL, regenere: npm run snapshot:update.

   Uso:  node bancada/snapshot.js            (compara com o aprovado — entra no bench)
         node bancada/snapshot.js --update   (regrava o aprovado com o estado atual) */
const fs=require("fs");
const path=require("path");
const {ROOT,okMark}=require("./common");

const SNAP=path.join(__dirname,"roster-snapshot.json");
const src=fs.readFileSync(path.join(ROOT,"game.js"),"utf8").split("\n");
const cut=src.findIndex(l=>l.includes("// === UI START ==="));
const E=new Function(src.slice(0,cut).join("\n")+"\nreturn {avaliarJogador,STYLE_LABEL,ATRIBUTOS,TEAMS};")();

const current={};
const labels={};
let cardCount=0;
E.TEAMS.forEach(t=>t.jogadores.forEach(j=>{
  const p=j._eng,playerId=p.id||p.nome,ev=E.avaliarJogador({...p});
  cardCount++;
  if(Object.prototype.hasOwnProperty.call(current,playerId)){
    throw new Error(`ID duplicado no snapshot: "${playerId}" (${labels[playerId]} e ${t.nome}/${p.nome})`);
  }
  labels[playerId]=`${t.nome}/${p.nome}`;
  current[playerId]=`${ev.role1||ev.combatRole}/${ev.role2||ev.secundario}·${E.STYLE_LABEL(ev.playstyle)}·${Math.round(ev.ovr)}`;
}));

const rawIds=new Set(E.ATRIBUTOS.map(p=>p.id||p.nome));
if(rawIds.size!==E.ATRIBUTOS.length){
  throw new Error(`ATRIBUTOS contém IDs duplicados: ${rawIds.size}/${E.ATRIBUTOS.length} únicos`);
}
if(cardCount!==E.ATRIBUTOS.length||Object.keys(current).length!==cardCount){
  throw new Error(`cobertura incompleta do snapshot: ${Object.keys(current).length}/${cardCount}/${E.ATRIBUTOS.length} (snapshot/cards/atributos)`);
}

if(process.argv.includes("--update")){
  fs.writeFileSync(SNAP,JSON.stringify(current,null,1)+"\n");
  console.log(`✓ snapshot atualizado (${Object.keys(current).length} jogadores) — ${path.relative(ROOT,SNAP)}`);
  process.exit(0);
}

console.log("— SNAPSHOT DO ELENCO (deriva não-intencional) —");
if(!fs.existsSync(SNAP)){console.log("  ✗ sem snapshot aprovado — rode: npm run snapshot:update");process.exit(1);}
const approved=JSON.parse(fs.readFileSync(SNAP,"utf8"));
const keys=new Set([...Object.keys(approved),...Object.keys(current)]);
let drift=0;
for(const k of keys){
  if(approved[k]!==current[k]){drift++;console.log(`  ✗ ${labels[k]||k}: ${approved[k]||"(novo)"} -> ${current[k]||"(sumiu)"}`);}
}
console.log(drift?`\n✗ ${drift} jogador(es) derivaram do aprovado — se foi intencional: npm run snapshot:update`
  :`${okMark(true)} elenco idêntico ao aprovado (${Object.keys(current).length} jogadores)`);
process.exit(drift?1:0);
