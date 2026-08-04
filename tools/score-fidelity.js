/* CLI somente leitura para calcular ou inspecionar o contrato IFCS. */
const fs=require("fs");
const path=require("path");
const F=require("../bancada/lib/fidelity-score");

function usage(){
  console.log("Uso:");
  console.log("  npm run score:fidelity -- caminho/observacoes.json");
  console.log("  npm run score:fidelity -- --catalog");
  console.log("  npm run score:fidelity -- --template");
}

const arg=process.argv[2];
if(!arg){usage();process.exitCode=2;}
else if(arg==="--catalog"){
  console.log(JSON.stringify({methodologyVersion:F.METHODOLOGY_VERSION,dimensions:F.DIMENSIONS,metrics:F.METRICS},null,2));
}else if(arg==="--template"){
  console.log(JSON.stringify(F.inputTemplate(),null,2));
}else{
  try{
    const file=path.resolve(process.cwd(),arg);
    const input=JSON.parse(fs.readFileSync(file,"utf8"));
    const report=F.scoreFidelityReport(input);
    console.log(JSON.stringify(report,null,2));
    if(!report.valid)process.exitCode=1;
  }catch(error){
    console.error(`IFCS não calculado: ${error.message}`);
    process.exitCode=1;
  }
}
