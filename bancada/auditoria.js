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

function pairText(player){
  return `${player.primario}/${player.secundario||player.combatRole||"-"}`;
}

function pairReality(player){
  return X.rolePairReality?X.rolePairReality(player.primario,player.secundario||player.combatRole,player):{cost:0,label:"natural",reasons:[]};
}

function styleReality(player){
  const role=player.primario==="IGL"?(player.combatRole||player.secundario):player.primario;
  return X.roleStyleReality?X.roleStyleReality(role,player.playstyle,player):{cost:0,label:"natural",reasons:[]};
}

function printRolePairs(players){
  console.log("\n-- Pares de roles --");
  sortedCountEntries(countBy(players,pairText))
    .forEach(([pair,total])=>console.log(`  ${String(total).padStart(2)} ${pair}`));
}

function printRarePairs(players){
  console.log("\n-- Pares raros por contexto --");
  players
    .map(player=>({player,real:pairReality(player)}))
    .filter(row=>row.real.cost>=.35)
    .sort((a,b)=>b.real.cost-a.real.cost||a.player.nick.localeCompare(b.player.nick))
    .slice(0,18)
    .forEach(({player,real})=>{
      const why=real.reasons.length?` · ${real.reasons.join("; ")}`:"";
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${pairText(player).padEnd(16)} ${real.label.padEnd(10)} cost ${real.cost.toFixed(2)} ${compactStats(player)}${why}`);
    });
}

function printRareStyles(players){
  console.log("\n-- Role/playstyle raros por contexto --");
  players
    .map(player=>({player,real:styleReality(player)}))
    .filter(row=>row.real.cost>=.28)
    .sort((a,b)=>b.real.cost-a.real.cost||a.player.nick.localeCompare(b.player.nick))
    .slice(0,18)
    .forEach(({player,real})=>{
      const role=player.primario==="IGL"?(player.combatRole||player.secundario):player.primario;
      const why=real.reasons.length?` · ${real.reasons.join("; ")}`:"";
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(role+"/"+label(player.playstyle)).padEnd(22)} ${real.label.padEnd(10)} cost ${real.cost.toFixed(2)} ${compactStats(player)}${why}`);
    });
}

const players=Object.values(X.POOL);

console.log("AUDITORIA PRISMA");
console.log(`${players.length} jogadores`);
printCount("Roles",countBy(players,player=>player.primario));
printCount("Playstyles",countBy(players,player=>player.playstyle),PLAYSTYLE_ORDER);
printRolePairs(players);
printRarePairs(players);
printRareStyles(players);
printLowMargins(players);
printStylePlayers(players,"baiter");
printStylePlayers(players,"support");
