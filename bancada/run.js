/* bancada/run.js - roda a suite inteira de validacao dos motores.
   Uso: node bancada/run.js        (rapido)
        N=1500 node bancada/run.js (profundo) */
const {execFileSync}=require("child_process");
const path=require("path");
const {secondsSince}=require("./lib/common");

/* As suítes vivem em `suites/`; `lib/` guarda o que elas importam, `golden/` os
   arquivos congelados de comparação e `ferramentas/` as bancadas de trabalho que
   NÃO entram no run — `classificacao.js` e `serie.js` se declaram assim no
   cabeçalho de propósito, e não estarem aqui não é esquecimento. */
const SUITES_DIR="suites";

// Os E2E usam Playwright/Chromium reais. A dependência e o browser são obrigatórios: ausência
// de infraestrutura deve falhar de forma visível, nunca converter falta de cobertura em sucesso.
const SUITE_GROUPS={
  data:["times.js"],
  regression:["auditoria.js","snapshot.js","drop-reform.js","simulation-golden.js","r5-comparison.js","r5-tails.js","sweep.test.js","abertura.js","memoria.js"],
  calibrator:["calibrador.js","calibrador-heavy.js","worker-calibrador.js"],
  benchmark:["realismo.js","assists.js","kda.js","rating.js","perfis.js","dificuldade.js"],
  fidelity:["fidelity-score.test.js","fidelity-corpus.test.js"],
  e2e:["e2e-intent.js","e2e-simulation.js","e2e-game-flow.js","e2e-cartas.js"]
};
SUITE_GROUPS.all=[
  ...SUITE_GROUPS.data,
  ...SUITE_GROUPS.regression,
  ...SUITE_GROUPS.calibrator,
  ...SUITE_GROUPS.benchmark,
  ...SUITE_GROUPS.fidelity,
  ...SUITE_GROUPS.e2e
];

function selectedGroup(argv){
  const index=argv.indexOf("--group");
  const group=index>=0?argv[index+1]:"all";
  if(!SUITE_GROUPS[group]){
    const names=Object.keys(SUITE_GROUPS).join(", ");
    throw new Error(`grupo de testes inválido: "${group}" (use: ${names})`);
  }
  return group;
}

function runSuite(file){
  const started=Date.now();
  try{
    execFileSync(process.execPath,[path.join(__dirname,SUITES_DIR,file)],{stdio:"inherit",env:process.env});
    return {ok:true,seconds:secondsSince(started)};
  }catch{
    return {ok:false,seconds:secondsSince(started)};
  }
}

console.log("════════════════════════════════════════════");
const group=selectedGroup(process.argv.slice(2));
const suites=SUITE_GROUPS[group];

console.log(` BANCADA draft9-0 — grupo ${group} (${suites.length} suíte(s))`);
console.log("════════════════════════════════════════════");

let failures=0;
for(const suite of suites){
  const result=runSuite(suite);
  if(!result.ok)failures++;
  console.log(`  (${suite} em ${result.seconds}s)\n`);
}

console.log(failures?`✗ ${failures} suíte(s) falharam`:"✓ TODAS as suítes passaram");
process.exit(failures?1:0);
