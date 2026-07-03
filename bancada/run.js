/* bancada/run.js — roda a suíte inteira de validação dos motores.
   Uso: node bancada/run.js        (rápido: N reduzido)
        N=1500 node bancada/run.js (profundo)
   Sai com código ≠0 se qualquer bancada falhar (dá pra usar em CI). */
const {execFileSync}=require("child_process"),path=require("path");
const suites=["realismo.js","rating.js"];
let falhas=0;
console.log("════════════════════════════════════════════");
console.log(" BANCADA draft9-0 — validação dos motores");
console.log("════════════════════════════════════════════");
for(const s of suites){
  const t0=Date.now();
  try{execFileSync(process.execPath,[path.join(__dirname,s)],{stdio:"inherit",env:process.env});}
  catch(e){falhas++;}
  console.log(`  (${s} em ${((Date.now()-t0)/1000).toFixed(1)}s)\n`);
}
console.log(falhas?`✗ ${falhas} suíte(s) falharam`:"✓ TODAS as suítes passaram");
process.exit(falhas?1:0);
