/* tools/run-checks.js - roda os checadores estruturais do `npm run check`.

   POR QUE ISTO EXISTE. A lista vivia numa única string de `package.json`, ligada
   por `&&`. Isso faz o primeiro vermelho esconder todos os checadores seguintes:
   quem quebrava `check-game-state` não descobria, no mesmo ciclo, que
   `check-doc-links` também tinha caído — e voltava ao trabalho achando que só
   havia um problema. Aqui cada checador roda até o fim e o relatório sai
   completo, no mesmo molde já provado por `bancada/run.js`.

   ORDEM. É a ordem histórica da string original — do mais próximo do motor ao
   mais próximo da documentação. Mantenha-a: quem lê o log aprende a topologia
   do repositório de graça.

   O QUE ELE NÃO FAZ. Não descobre checador sozinho. Um arquivo novo entra nesta
   lista à mão, de propósito: descoberta por glob transformaria um arquivo mal
   nomeado em cobertura silenciosamente ausente, que é o defeito que nenhuma
   guarda deste repositório aceita. */
const {execFileSync}=require("node:child_process");
const path=require("node:path");

const ROOT=path.join(__dirname,"..");
const segundosDesde=inicio=>((Date.now()-inicio)/1000).toFixed(1);

/* `node --check game.js` não é um script de tools/: é o parser do Node provando
   que o entrypoint continua sintaticamente válido. Fica declarado com argumentos
   próprios para não virar exceção escondida dentro do laço. */
const CHECADORES=[
  {nome:"game.js (sintaxe)",args:["--check","game.js"]},
  {nome:"check-game-entrypoint",args:["tools/check-game-entrypoint.js"]},
  {nome:"check-game-state",args:["tools/check-game-state.js"]},
  {nome:"check-audio-module",args:["tools/check-audio-module.js"]},
  {nome:"check-progress-store",args:["tools/check-progress-store.js"]},
  {nome:"check-game-view-modules",args:["tools/check-game-view-modules.js"]},
  {nome:"check-public-evaluation-api",args:["tools/check-public-evaluation-api.js"]},
  {nome:"check-public-simulation-api",args:["tools/check-public-simulation-api.js"]},
  {nome:"check-tactics-layer",args:["tools/check-tactics-layer.js"]},
  {nome:"check-live-commentary",args:["tools/check-live-commentary.js"]},
  {nome:"check-team-identity",args:["tools/check-team-identity.js"]},
  {nome:"check-map-identity",args:["tools/check-map-identity.js"]},
  {nome:"check-glass-system",args:["tools/check-glass-system.js"]},
  {nome:"check-sandbox-engine",args:["tools/check-sandbox-engine.js"]},
  {nome:"check-sandbox-syntax",args:["tools/check-sandbox-syntax.js"]},
  {nome:"check-data-catalog",args:["tools/check-data-catalog.js"]},
  {nome:"check-card-portraits",args:["tools/check-card-portraits.js"]},
  {nome:"check-doc-links",args:["tools/check-doc-links.js"]},
  {nome:"check-doc-measurements",args:["tools/check-doc-measurements.js"]},
  {nome:"check-design-tokens",args:["tools/check-design-tokens.js"]},
  {nome:"check-roster-sync",args:["tools/check-roster-sync.js"]},
  {nome:"check-add-team-sync",args:["tools/check-add-team-sync.js"]},
  {nome:"check-random-source-contract",args:["tools/check-random-source-contract.js"]},
  {nome:"check-sample-summary-parity",args:["tools/check-sample-summary-parity.js"]}
];

function rodar({args}){
  const inicio=Date.now();
  try{
    execFileSync(process.execPath,args,{cwd:ROOT,stdio:"inherit",env:process.env});
    return {ok:true,segundos:segundosDesde(inicio)};
  }catch{
    return {ok:false,segundos:segundosDesde(inicio)};
  }
}

console.log("════════════════════════════════════════════");
console.log(` CHECAGENS ESTRUTURAIS draft9-0 — ${CHECADORES.length} checador(es)`);
console.log("════════════════════════════════════════════");

const falhas=[];
for(const checador of CHECADORES){
  const {ok,segundos}=rodar(checador);
  if(!ok)falhas.push(`${checador.nome} (${segundos}s)`);
}

if(falhas.length){
  console.error(`\n✗ ${falhas.length} de ${CHECADORES.length} checador(es) falharam:`);
  for(const falha of falhas)console.error(`    ${falha}`);
  process.exit(1);
}
console.log(`\n✓ TODOS os ${CHECADORES.length} checadores passaram`);
