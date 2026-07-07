/* bancada/auditoria.js - relatorio curto de roles, playstyles e margens.
   Uso: node bancada/auditoria.js */
const {X}=require("./motor");
const {compactStats,countBy,sortedCountEntries,teamNameFor}=require("./common");

const PLAYSTYLE_ORDER=[
  "spacetaker","infiltrator","playmaker","aggressive","support",
  "trader","anchor","clutcher","cerebral","joker","baiter"
];

function printCount(title,count,order=null){
  console.log(`\n-- ${title} --`);
  sortedCountEntries(count,order)
    .forEach(([key,total])=>console.log(`  ${String(total).padStart(2)} ${label(key)}`));
}

function label(style){
  return X.STYLE_LABEL?X.STYLE_LABEL(style):style;
}

function roleMargin(player){
  const scores=X.afinidades(player);
  const rows=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return {rows,gap:rows[0][1]-rows[1][1]};
}

function printLowMargins(players){
  console.log("\n-- Margens baixas de role --");
  players
    .map(player=>({player,...roleMargin(player)}))
    .sort((a,b)=>a.gap-b.gap)
    .slice(0,15)
    .forEach(({player,rows,gap})=>{
      const top=rows.slice(0,3).map(([role,score])=>`${role}:${score.toFixed(1)}`).join(" ");
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(player.primario+"/"+player.secundario).padEnd(16)} gap ${gap.toFixed(1).padStart(4)}  ${top}`);
    });
}

function printStylePlayers(players,style){
  const selected=players.filter(player=>player.playstyle===style);
  console.log(`\n-- ${label(style)} (${selected.length}) --`);
  selected.forEach(player=>{
    console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(player.primario+"/"+player.secundario).padEnd(16)} rt ${String(player.rating).padEnd(4)} ${compactStats(player)}`);
  });
}

const players=Object.values(X.POOL);

console.log("AUDITORIA PRISMA");
console.log(`${players.length} jogadores`);
printCount("Roles",countBy(players,player=>player.primario));
printCount("Playstyles",countBy(players,player=>player.playstyle),PLAYSTYLE_ORDER);
printLowMargins(players);
printStylePlayers(players,"baiter");
printStylePlayers(players,"support");
