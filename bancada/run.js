/* bancada/run.js - roda a suite inteira de validacao dos motores.
   Uso: node bancada/run.js        (rapido)
        N=1500 node bancada/run.js (profundo) */
const {execFileSync}=require("child_process");
const path=require("path");
const {secondsSince}=require("./common");

const SUITES=["times.js","auditoria.js","calibrador.js","realismo.js","rating.js"];

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
console.log(" BANCADA draft9-0 — validação dos motores");
console.log("════════════════════════════════════════════");

let failures=0;
for(const suite of SUITES){
  const result=runSuite(suite);
  if(!result.ok)failures++;
  console.log(`  (${suite} em ${result.seconds}s)\n`);
}

console.log(failures?`✗ ${failures} suíte(s) falharam`:"✓ TODAS as suítes passaram");
process.exit(failures?1:0);
