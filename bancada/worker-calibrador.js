/* bancada/worker-calibrador.js - exercita o Web Worker real do calibrador em worker_threads.
   Valida bootstrap, isolamento, partição do espaço e cancelamento cooperativo sem duplicar
   a lógica do calibrador. O wrapper só adapta self/fetch/postMessage para o Node. */
const path=require("path");
const {pathToFileURL}=require("url");
const {Worker}=require("worker_threads");
const {ROOT,okMark}=require("./common");

const WRAPPER=`
const {parentPort,workerData}=require("worker_threads");
const fs=require("fs");
const path=require("path");
const {pathToFileURL}=require("url");
const {performance}=require("perf_hooks");
global.self=globalThis;
self.navigator={hardwareConcurrency:2};
self.performance=performance;
self.postMessage=message=>parentPort.postMessage(message);
self.__engineModuleUrl=pathToFileURL(path.join(workerData.root,"src","public","simulation-api.mjs")).href;
global.fetch=async url=>{
  const file=String(url).split("?")[0];
  try{return new Response(fs.readFileSync(path.join(workerData.root,file)),{status:200});}
  catch(error){return new Response(String(error),{status:404});}
};
try{
  const source=fs.readFileSync(path.join(workerData.root,"calibrador-worker.js"),"utf8");
  new Function("require",source)(require);
  parentPort.on("message",data=>self.onmessage({data}));
  parentPort.postMessage({type:"ready"});
}catch(error){parentPort.postMessage({type:"boot-error",error:error.stack||String(error)});}
`;

function engineSlot(teams,nick){
  let found=null;
  teams.some((team,ti)=>team.jogadores.some((player,pi)=>{
    if(player._eng.nick!==nick)return false;
    found={ti,pi,state:{...player._eng}};
    return true;
  }));
  if(!found)throw new Error(`jogador não encontrado: ${nick}`);
  return found;
}

function spawnWorker(){
  const worker=new Worker(WRAPPER,{eval:true,workerData:{root:ROOT}});
  worker.ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("worker não inicializou")),5000);
    const onMessage=message=>{
      if(message?.type==="boot-error"){
        clearTimeout(timer);worker.off("message",onMessage);reject(new Error(message.error));return;
      }
      if(message?.type!=="ready")return;
      clearTimeout(timer);worker.off("message",onMessage);resolve();
    };
    worker.on("message",onMessage);
    worker.once("error",error=>{clearTimeout(timer);reject(error);});
  });
  return worker;
}

function runJob(worker,job,timeoutMs=12000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`job expirou: ${job.jobId}`)),timeoutMs);
    const onMessage=message=>{
      if(!message||message.jobId!==job.jobId||message.type!=="done")return;
      clearTimeout(timer);worker.off("message",onMessage);
      if(message.ok)resolve(message.result);else reject(new Error(message.error||"worker falhou"));
    };
    worker.on("message",onMessage);
    worker.postMessage(job);
  });
}

let failures=0;
function check(value,label){
  console.log(`  ${okMark(!!value)} ${label}`);
  if(!value)failures++;
}

(async()=>{
  console.log("— WEB WORKERS DO CALIBRADOR —");
  const {TEAMS}=await import(pathToFileURL(path.join(ROOT,"src","public","evaluation-api.mjs")).href);
  const b1tPartition=engineSlot(TEAMS,"b1t");
  const workers=[spawnWorker(),spawnWorker()];
  try{
    await Promise.all(workers.map(worker=>worker.ready));
    const jobId="partition-"+Date.now();
    const results=await Promise.all(workers.map((worker,index)=>runJob(worker,{
      jobId,ti:b1tPartition.ti,pi:b1tPartition.pi,state:b1tPartition.state,
      goal:{r1:"Rifler",style:"Trader"},mode:"ia",seedSalt:(index+1)*7919,
      partitionIndex:index,partitionCount:workers.length,
      strategyOverride:{maxMs:2500,maxTests:9000,randomCandidates:900,convergenceWindow:35}
    })));
    check(results.every(result=>result&&result.searchStats),"dois workers completam jobs particionados");
    check(results.every(result=>(result.searchStats?.partitionSkipped||0)>0),"cada partição realmente pula candidatos da outra");
    check(results.some(result=>result.ok),"ao menos uma partição encontra solução válida");
  }finally{
    await Promise.all(workers.map(worker=>worker.terminate()));
  }

  const b1t=engineSlot(TEAMS,"b1t"),cancelWorker=spawnWorker();
  try{
    await cancelWorker.ready;
    const jobId="cancel-"+Date.now();
    const promise=runJob(cancelWorker,{
      jobId,ti:b1t.ti,pi:b1t.pi,state:b1t.state,
      goal:{r1:"AWPer",style:"Closer",ovr:21},mode:"ia",seedSalt:13,
      partitionIndex:0,partitionCount:1
    });
    setTimeout(()=>cancelWorker.postMessage({type:"cancel",jobId}),10);
    const result=await promise;
    check(result?.cancelled&&result.searchStats?.cancelled,"cancelamento cooperativo interrompe a busca ativa");
    check(!result.searchStats?.truncated,"cancelamento é distinguido de estouro de orçamento");
  }finally{
    await cancelWorker.terminate();
  }

  console.log(failures?`✗ ${failures} checagem(ns) de worker falharam`:"✓ workers do calibrador ok");
  process.exitCode=failures?1:0;
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
