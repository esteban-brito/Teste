/* bancada/run.js - roda a suite inteira de validacao dos motores.
   Uso: node bancada/run.js        (rapido)
        N=1500 node bancada/run.js (profundo) */
const {execFileSync}=require("child_process");
const path=require("path");
const {secondsSince}=require("./common");

// Os E2E usam Playwright/Chromium reais. A dependência e o browser são obrigatórios: ausência
// de infraestrutura deve falhar de forma visível, nunca converter falta de cobertura em sucesso.
const SUITE_GROUPS={
  data:["times.js"],
  regression:["auditoria.js","snapshot.js","drop-reform.js"],
  calibrator:["calibrador.js","calibrador-heavy.js","worker-calibrador.js"],
  benchmark:["realismo.js","assists.js","kda.js","rating.js"],
  e2e:["e2e-intent.js","e2e-simulation.js","e2e-game-flow.js"]
};
SUITE_GROUPS.all=[
  ...SUITE_GROUPS.data,
  ...SUITE_GROUPS.regression,
  ...SUITE_GROUPS.calibrator,
  ...SUITE_GROUPS.benchmark,
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
    execFileSync(process.execPath,[path.join(__dirname,file)],{stdio:"inherit",env:process.env});
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
