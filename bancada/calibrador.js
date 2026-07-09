/* bancada/calibrador.js - valida o Calibrador Inteligente (sandbox.html) contra o motor real.
   Carrega game.js + o <script> de sandbox.html do mesmo jeito que o navegador faria
   (fetch->new Function na pagina; aqui, leitura de arquivo->new Function), sem duplicar
   nenhuma logica - mesma tecnica usada por calibrator-worker.js.
   Cobre 2 regressoes ja corrigidas (deltasFor vazando teto, compareCalibration ignorando
   custo ponderado) e roda uma bateria pequena de buscas ponta-a-ponta pra garantir que
   nunca lanca excecao e que "ok=true" bate o objetivo de verdade.
   Uso: node bancada/calibrador.js
        CALIB_MS=9000 node bancada/calibrador.js   (busca "de verdade", bem mais lenta)
*/
const fs=require("fs");
const path=require("path");
const {ROOT,okMark}=require("./common");

const GAME_PATH=path.join(ROOT,"game.js");
const SANDBOX_PATH=path.join(ROOT,"sandbox.html");

function loadCalibrator(){
  const gameSrc=fs.readFileSync(GAME_PATH,"utf8");
  const sandboxSrc=fs.readFileSync(SANDBOX_PATH,"utf8");
  const linhas=gameSrc.split("\n");
  let cut=linhas.findIndex(l=>l.includes("// === UI START ==="));
  if(cut<0)cut=linhas.findIndex(l=>l.includes("document.getElementById"));
  if(cut<0)throw new Error("marcador de UI nao encontrado em game.js");
  const engineSlice=linhas.slice(0,cut).join("\n");
  const E=new Function(engineSlice+"\nreturn {avaliarJogador,aplicarAvaliacaoContextual,curvaOVR,distribuirRoles,forcaTime,ovrUnificado,rolePairReality,roleStyleReality,CFG_AVALIACAO,ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,STYLE_ROLE_FIT,STYLE_CONTRA,MAPAS_POOL,MAPA_LADO,srand,simularMapa,forcaDoDia,TEAMS,nmOVR,roleAfinidade,NM_DEF,NM_COR,STYLE_LABEL,PLAYSTYLE_IDS};")();

  const m=sandboxSrc.match(/<script>([\s\S]*)<\/script>/);
  if(!m)throw new Error("nao encontrei o <script> do sandbox.html");
  let core=m[1];
  const iifeIdx=core.lastIndexOf("(async()=>{");
  if(iifeIdx>=0)core=core.slice(0,iifeIdx);
  core+=`
return {
  setup(engine){
    E=engine; ({nmOVR,STYLE_LABEL,PLAYSTYLE_IDS}=E);
    POOLRAW=[]; poolBySlot=new Map();
    E.TEAMS.forEach((t,ti)=>t.jogadores.forEach((j,pi)=>{const e=j._eng;
      const idx=POOLRAW.length;
      poolBySlot.set(\`\${ti}:\${pi}\`,idx);
      POOLRAW.push({...e,time:t.nome,ti,pi,isIGL:!!e.isIGL,colocacao:e.colocacao||"Campeao"});
    }));
  },
  loadByName(nome){
    loadedIdx=POOLRAW.findIndex(p=>p.nome===nome);
    if(loadedIdx<0)throw new Error("jogador nao encontrado no pool: "+nome);
    const p=POOLRAW[loadedIdx];
    Object.assign(state,{nome:p.nome,fp:p.fp,en:p.en,tr:p.tr,op:p.op,cl:p.cl,sn:p.sn,ut:p.ut,rating:p.rating,isIGL:p.isIGL,colocacao:p.colocacao});
  },
  setMode(mode){ calibMode=mode; },
  overrideBudget(ms){ Object.values(CALIB_STRATEGIES).forEach(s=>{ if(ms)s.maxMs=ms; }); },
  findCalibration, renderCalibResult, rolePairParts, deltasFor, compareCalibration, CALIB_STRATEGIES,
  get STYLE_LABEL(){ return STYLE_LABEL; }
};
`;
  const fakeDocument={getElementById:()=>null,createElement:()=>({}),querySelectorAll:()=>[]};
  const build=new Function("document","navigator","performance",core);
  const api=build(fakeDocument,{},performance);
  api.setup(E);
  return api;
}

let failures=0;
function check(ok,label){
  console.log(`  ${okMark(ok)} ${label}`);
  if(!ok)failures++;
}

console.log("— CALIBRADOR INTELIGENTE (sandbox.html) —");
const api=loadCalibrator();

// achado #1 (corrigido): deltasFor nao pode devolver deltas acima do teto pedido.
{
  const over=api.deltasFor(0.12).filter(d=>d>0.12+1e-9);
  check(over.length===0,`deltasFor(0.12) respeita o teto (vazou: ${over.join(",")||"nenhum"})`);
}

// achado #4 (corrigido): compareCalibration decide por custo total primeiro; prioridade so
// desempata quando os custos estao quase empatados. Antes, 1 colateral a mais bastava pra
// perder mesmo com custo 4x menor.
{
  const strategy=api.CALIB_STRATEGIES.ia;
  const pior={cost:50,costInfo:{collateralRoleChanges:0,teamChanges:5,rareWorsened:3,realityPenalty:2,ovrImpact:10,styleChanges:1,deltaCost:8,changed:6}};
  const melhor={cost:12,costInfo:{collateralRoleChanges:1,teamChanges:0,rareWorsened:0,realityPenalty:0,ovrImpact:1,styleChanges:0,deltaCost:1,changed:1}};
  const melhorVence=api.compareCalibration(pior,melhor,strategy)>0;
  check(melhorVence,"compareCalibration escolhe o custo total menor mesmo com 1 colateral a mais");
}

// bateria ponta-a-ponta: nunca lanca excecao; quando ok=true, o resultado bate o goal de
// verdade (revalidado contra rolePairParts/STYLE_LABEL, nao so confiando no proprio "ok").
const CASOS=[
  {nome:"yuurih",mode:"ia",goal:{r1:"",r2:"",style:"Ancora"}},
  {nome:"Boombl4",mode:"ia",goal:{r1:"",r2:"Entry",style:""}},
  {nome:"karrigan",mode:"realista",goal:{r1:"IGL",r2:"Entry",style:""}},
  {nome:"NiKo",mode:"realista",goal:{r1:"",r2:"",style:"Cerebral"}},
];
const budgetMs=+(process.env.CALIB_MS||1500);
api.overrideBudget(budgetMs);

(async()=>{
  for(const caso of CASOS){
    api.loadByName(caso.nome);
    api.setMode(caso.mode);
    let result=null,err=null;
    try{ result=await api.findCalibration(caso.goal,null); }
    catch(e){ err=e; }
    check(!err,`${caso.nome} [${caso.mode}] nao lanca excecao${err?": "+err.message:""}`);
    if(!err&&result.ok){
      const parts=api.rolePairParts(result.after);
      const styleLabel=api.STYLE_LABEL(result.after.playstyle);
      const bateR1=!caso.goal.r1||parts.r1===caso.goal.r1;
      const bateR2=!caso.goal.r2||parts.r2===caso.goal.r2;
      const bateStyle=!caso.goal.style||styleLabel===caso.goal.style;
      check(bateR1&&bateR2&&bateStyle,`${caso.nome} [${caso.mode}] ok=true realmente bate o objetivo`);
      let renderErr=null;
      try{ api.renderCalibResult(result,caso.goal); }
      catch(e){ renderErr=e; }
      check(!renderErr,`${caso.nome} [${caso.mode}] renderCalibResult nao lanca excecao${renderErr?": "+renderErr.message:""}`);
    }
  }
  console.log(failures?`✗ ${failures} checagem(ns) do calibrador falharam`:"✓ calibrador ok");
  process.exitCode=failures?1:0;
})();
