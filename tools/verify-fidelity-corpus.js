/* CLI somente leitura para selar e verificar manifestos de corpus IFCS. */
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const C=require("../bancada/fidelity-corpus");

function usage(){
  console.log("Uso:");
  console.log("  npm run corpus:fidelity -- --template");
  console.log("  npm run corpus:fidelity -- --seal caminho/manifest.json");
  console.log("  npm run corpus:fidelity -- caminho/manifest.json [--verify-files]");
}

const readJson=file=>JSON.parse(fs.readFileSync(file,"utf8"));

function hashFile(file){
  return new Promise((resolve,reject)=>{
    const hash=crypto.createHash("sha256"),stream=fs.createReadStream(file);
    stream.on("error",reject);stream.on("data",chunk=>hash.update(chunk));stream.on("end",()=>resolve(hash.digest("hex")));
  });
}

async function verifyFiles(manifest,manifestFile){
  const root=path.dirname(manifestFile),issues=[];
  for(const match of manifest.matches||[]){
    for(const map of match.maps||[]){
      if(map.status!=="valid")continue;
      const relative=map.demo?.localPath;
      if(!C.safeRelativePath(relative)){
        issues.push({mapId:map.id,reason:"caminho local inválido"});continue;
      }
      const file=path.resolve(root,...relative.split("/"));
      const relativeResolved=path.relative(root,file);
      if(relativeResolved.startsWith("..")||path.isAbsolute(relativeResolved)){
        issues.push({mapId:map.id,reason:"arquivo saiu da raiz do manifesto"});continue;
      }
      try{
        const stat=fs.statSync(file);
        if(!stat.isFile())issues.push({mapId:map.id,reason:"artefato não é arquivo"});
        else if(stat.size!==map.demo.bytes)issues.push({mapId:map.id,reason:`tamanho ${stat.size} diverge de ${map.demo.bytes}`});
        const digest=await hashFile(file);
        if(digest!==map.demo.sha256)issues.push({mapId:map.id,reason:"SHA-256 do arquivo diverge"});
      }catch(error){issues.push({mapId:map.id,reason:error.code||error.message});}
    }
  }
  return issues;
}

async function main(){
  const args=process.argv.slice(2);
  if(!args.length){usage();process.exitCode=2;return;}
  if(args[0]==="--template"){
    console.log(JSON.stringify(C.corpusTemplate(),null,2));return;
  }
  const seal=args[0]==="--seal",inputArg=seal?args[1]:args[0];
  if(!inputArg){usage();process.exitCode=2;return;}
  const file=path.resolve(process.cwd(),inputArg),manifest=readJson(file);
  if(seal){console.log(JSON.stringify(C.sealManifest(manifest),null,2));return;}
  const report=C.validateCorpusManifest(manifest);
  report.manifestReady=report.officialReady;
  if(args.includes("--verify-files"))report.fileIssues=await verifyFiles(manifest,file);
  report.filesVerified=args.includes("--verify-files")&&report.fileIssues.length===0;
  report.officialReady=report.manifestReady&&report.filesVerified;
  console.log(JSON.stringify(report,null,2));
  if(!report.valid||!report.officialReady||report.fileIssues?.length)process.exitCode=1;
}

main().catch(error=>{console.error(`Corpus IFCS não verificado: ${error.message}`);process.exitCode=1;});
