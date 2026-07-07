#!/usr/bin/env node
/* tools/add-team.js - adiciona um time ao jogo a partir de texto simples.

   Uso:
     node tools/add-team.js caminho/do/time.txt
     node tools/add-team.js -   (le do stdin)
     node tools/add-team.js --dry-run caminho/do/time.txt

   Formato:
     NOME | CAMPEONATO | Colocacao: Final | Treinador: kakafu | Pais (Treinador): AUT | Cor: #e9edf3
     tabseN — Pais: GER | Rating: 1.18 | IGL: Nao | Stats: FP: 90, EN: 33, TR: 13, OP: 82, CL: 46, SN: 84, UT: 89
*/
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");
const {ROOT,ATTRS}=require("../bancada/common");

const GAME=path.join(ROOT,"game.js");
const PLAYER_ANCHOR="  //@jogadores";
const TEAM_ANCHOR="  //@times";
const FALLBACK_COLORS=["#5b8cff","#ff8a3d","#c86bff","#00c2a8","#ff5aa8","#7bd23c","#f0c020","#33c0ff","#ff6a5a","#9aa7b8"];
const COUNTRY_ALIASES={UK:"GBR",ENG:"GBR",UAE:"ARE",POR:"PRT",HOL:"NLD",NED:"NLD"};

function usage(){
  console.error("uso: node tools/add-team.js [--dry-run] <arquivo.txt | ->");
}

function normalizeCountry(value){
  const code=String(value||"").trim().toUpperCase();
  return COUNTRY_ALIASES[code]||code;
}

function normalizePlacement(value){
  const text=String(value||"").toLowerCase();
  if(/campe|winner|1º|1st/.test(text)&&!/vice/.test(text))return "Campeao";
  if(/vice|final|runner|2º|2nd/.test(text))return "Final";
  if(/semi|top ?4|3º|4º|3rd|4th/.test(text))return "Top4";
  if(/quart|top ?8|5º|6º|7º|8º/.test(text))return "Top8";
  return "Grupos";
}

function parseBool(value){
  return /^(sim|s|yes|y|true|1)$/i.test(String(value||"").trim());
}

function slug(value){
  return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"")||"t";
}

function quote(value){
  return `"${String(value).replace(/"/g,'\\"')}"`;
}

function parseKeyValues(parts){
  const out={};
  parts.forEach(part=>{
    const index=part.indexOf(":");
    if(index>0)out[part.slice(0,index).trim().toLowerCase()]=part.slice(index+1).trim();
  });
  return out;
}

function pick(map,...needles){
  for(const needle of needles){
    for(const key of Object.keys(map)){
      if(key.includes(needle))return map[key];
    }
  }
  return "";
}

function parseStats(text){
  const stats={};
  String(text||"").split(",").forEach(part=>{
    const match=part.match(/([a-z]{2})\s*:\s*(\d+)/i);
    if(match)stats[match[1].toLowerCase()]=+match[2];
  });
  return stats;
}

function splitPlayerLine(line){
  const match=line.match(/^(.*?)\s+(?:—|–|-|\?)\s+(.*)$/);
  if(!match)throw new Error(`linha de jogador sem separador "—": ${line}`);
  return [match[1].trim(),match[2].trim()];
}

function parseTeamLine(line){
  const parts=line.split("|").map(part=>part.trim());
  const meta=parseKeyValues(parts.slice(2));
  return {
    nome:parts[0],
    camp:parts[1]||"",
    colocacao:normalizePlacement(pick(meta,"coloca")),
    coach:pick(meta,"treina","coach")||null,
    coachPais:normalizeCountry(
      pick(meta,"país (trein","pais (trein","país do trein","pais do trein")||
      pick(meta,"país trein","pais trein")
    ),
    cor:String(pick(meta,"cor","color")||"").trim()
  };
}

function parsePlayerLine(line){
  const [nick,rest]=splitPlayerLine(line);
  const meta=parseKeyValues(rest.split("|").map(part=>part.trim()));
  return {
    nick,
    pais:normalizeCountry(meta["país"]||meta.pais),
    rating:parseFloat(meta.rating),
    isIGL:parseBool(meta.igl),
    stats:parseStats(meta.stats)
  };
}

function parse(text){
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length)throw new Error("entrada vazia");
  return {
    time:parseTeamLine(lines[0]),
    jogadores:lines.slice(1).map(parsePlayerLine)
  };
}

function validateInput(time,players,warnings){
  if(!time.nome)throw new Error("nome do time vazio");
  if(players.length!==5)warnings.push(`${players.length} jogadores (esperado 5)`);
  if(!players.some(player=>player.isIGL))warnings.push("nenhum IGL marcado");

  players.forEach(player=>{
    ATTRS.forEach(attr=>{
      const value=player.stats[attr];
      if(typeof value!=="number"||value<0||value>100){
        throw new Error(`${player.nick}: atributo ${attr.toUpperCase()}=${value} inválido (0–100)`);
      }
    });
    if(!(player.rating>=0.5&&player.rating<=2.0)){
      warnings.push(`${player.nick}: rating ${player.rating} fora de 0.5–2.0`);
    }
  });
}

function existingPlayerIds(game){
  return new Set([...game.matchAll(/\{(?:id:"([^"]+)",)?nome:"([^"]+)"/g)].map(match=>match[1]||match[2]));
}

function assignPlayerKeys(players,teamName,game,warnings){
  const existing=existingPlayerIds(game);
  const teamSlug=slug(teamName);
  return players.map(player=>{
    let key=player.nick;
    if(existing.has(key)){
      key=`${slug(player.nick)}_${teamSlug}`;
      warnings.push(`nick "${player.nick}" já existe → id "${key}"`);
    }
    existing.add(key);
    player._key=key;
    return key;
  });
}

function chooseColor(time,game,warnings){
  if(time.cor)return;
  const used=new Set([...game.matchAll(/cor:"(#[0-9a-fA-F]{3,6})"/g)].map(match=>match[1].toLowerCase()));
  time.cor=FALLBACK_COLORS.find(color=>!used.has(color.toLowerCase()))||FALLBACK_COLORS[0];
  warnings.push(`sem Cor: informada → escolhida ${time.cor}`);
}

function playerLine(player,time){
  const stats=player.stats;
  const idPrefix=player._key!==player.nick?`id:${quote(player._key)},`:"";
  return `  {${idPrefix}nome:${quote(player.nick)},pais:${quote(player.pais)},fp:${stats.fp},en:${stats.en},tr:${stats.tr},op:${stats.op},cl:${stats.cl},sn:${stats.sn},ut:${stats.ut},rating:${player.rating},colocacao:${quote(time.colocacao)},isIGL:${player.isIGL}},`;
}

function teamLine(time,keys){
  const coach=time.coach?`coach:${quote(time.coach)},coachPais:${quote(time.coachPais||"—")},`:"coach:null,";
  return `  {nome:${quote(time.nome)},cor:${quote(time.cor)},${coach}camp:${quote(time.camp)},colocacao:${quote(time.colocacao)},jogadores:[${keys.map(quote).join(",")}]},`;
}

function inject(game,time,players,keys){
  if(!game.includes(PLAYER_ANCHOR)||!game.includes(TEAM_ANCHOR)){
    throw new Error("âncoras //@jogadores / //@times não encontradas no game.js");
  }
  const playersBlock=players.map(player=>playerLine(player,time)).join("\n");
  const teamBlock=teamLine(time,keys);
  return game
    .replace(PLAYER_ANCHOR,`  // ——— ${time.nome} · ${time.camp} (${time.colocacao}) ———\n${playersBlock}\n${PLAYER_ANCHOR}`)
    .replace(TEAM_ANCHOR,`${teamBlock}\n${TEAM_ANCHOR}`);
}

function runPostChecks(){
  execFileSync(process.execPath,["--check",GAME],{stdio:"inherit"});
  execFileSync(process.execPath,[path.join(ROOT,"bancada","roster.js")],{stdio:"inherit"});
  console.log("");
  try{
    execFileSync(process.execPath,[path.join(ROOT,"bancada","times.js")],{stdio:"inherit"});
  }catch(error){
    // O lint ja imprime o motivo; mantemos a execucao para mostrar avisos do parser.
  }
}

function parseArgs(argv){
  const args=[...argv];
  const dryRun=args.includes("--dry-run");
  const filtered=args.filter(arg=>arg!=="--dry-run");
  return {dryRun,inputPath:filtered[0]};
}

function main(){
  const {dryRun,inputPath}=parseArgs(process.argv.slice(2));
  if(!inputPath){
    usage();
    process.exit(2);
  }

  const input=inputPath==="-"?fs.readFileSync(0,"utf8"):fs.readFileSync(inputPath,"utf8");
  const {time,jogadores}=parse(input);
  const warnings=[];
  validateInput(time,jogadores,warnings);

  let game=fs.readFileSync(GAME,"utf8");
  const keys=assignPlayerKeys(jogadores,time.nome,game,warnings);
  chooseColor(time,game,warnings);
  game=inject(game,time,jogadores,keys);

  if(dryRun){
    console.log(`✓ dry-run: ${time.nome} parseado com ${jogadores.length} jogadores; nenhum arquivo alterado.`);
    if(warnings.length){
      console.log("\n⚠ avisos:");
      warnings.forEach(warning=>console.log("  · "+warning));
    }
    return;
  }

  fs.writeFileSync(GAME,game);

  runPostChecks();

  if(warnings.length){
    console.log("\n⚠ avisos:");
    warnings.forEach(warning=>console.log("  · "+warning));
  }
  console.log(`\n✓ ${time.nome} adicionado. Revise o resumo acima; depois: bancadas + smoke + deploy.`);
}

main();
