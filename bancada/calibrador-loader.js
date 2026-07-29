/* bancada/calibrador-loader.js - carrega o calibrador real de sandbox.html em Node.
   Injeta a API pública de avaliação no <script> do sandbox, sem recortar game.js e sem
   duplicar lógica. A simulação do sandbox continua no E2E até a migração da Fase 6.
   Cobre 2 regressoes ja corrigidas (deltasFor vazando teto, compareCalibration ignorando
   custo ponderado) e roda uma bateria pequena de buscas ponta-a-ponta pra garantir que
   nunca lanca excecao e que "ok=true" bate o objetivo de verdade.
   Uso: node bancada/calibrador.js
        CALIB_MS=9000 node bancada/calibrador.js   (busca "de verdade", bem mais lenta)
*/
const fs=require("fs");
const path=require("path");
const {pathToFileURL}=require("url");
const {ROOT}=require("./common");

const SANDBOX_PATH=path.join(ROOT,"sandbox.html");
let calibratorPromise=null;

async function buildCalibrator(){
  const E=await import(pathToFileURL(path.join(ROOT,"src","public","evaluation-api.mjs")).href);
  const sandboxSrc=fs.readFileSync(SANDBOX_PATH,"utf8");

  const m=sandboxSrc.match(/<script>([\s\S]*)<\/script>/);
  if(!m)throw new Error("nao encontrei o <script> do sandbox.html");
  let core=m[1];
  const iifeIdx=core.lastIndexOf("(async()=>{");
  if(iifeIdx>=0)core=core.slice(0,iifeIdx);
  core+=`
return {
  setup(engine){
    E=engine; DEF={ROLE:clone(E.ROLE_PERFIL),NM:clone(E.NM_DEF),NM_COR:clone(E.NM_COR),CONTRA:clone(E.ROLE_CONTRA),IGL:clone(E.IGL_ROLE_AFIN),RULES:clone(E.ROLE_RULES),STYLE_CONTRA:clone(E.STYLE_CONTRA),CFG:clone(E.CFG_AVALIACAO)};
    ({nmOVR,STYLE_LABEL,PLAYSTYLE_IDS}=E);
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
    setEditorStateFrom(playerAt(loadedIdx));
  },
  setMode(mode){ calibMode=mode; },
  setSeed(seed){ searchSeedSalt=seed||0; },
  setStats(values){
    Object.assign(state,values||{});
    const edited=editorValues(state),original=editorValues(POOLRAW[loadedIdx]);
    if(editorFieldDiff(original,edited).length)playerOverrides.set(loadedIdx,edited);else playerOverrides.delete(loadedIdx);
    editorDrafts.delete(loadedIdx);invalidateAllTeamEval();
  },
  overrideBudget(ms){ Object.values(CALIB_STRATEGIES).forEach(s=>{ if(ms)s.maxMs=ms; }); },
  info(nome){ const p=POOLRAW.find(x=>x.nome===nome); if(!p)throw new Error("nao achei: "+nome);
    const ev=E.avaliarJogador({...p}); return {isIGL:!!ev.isIGL,ovr:Math.round(ev.ovr),style:STYLE_LABEL(ev.playstyle),r1:ev.role1||ev.combatRole,r2:ev.role2||ev.secundario}; },
  findCalibration, reformulateStyleFromArchetype, renderCalibResult, rolePairParts, deltasFor, scaleChanges, compareCalibration, summarizeDiff, calibrationMetrics, diffSnapshots, CALIB_STRATEGIES,
  getCurrent(){return mainPlayer();},
  ratingWeight(style){return E.NM_DEF[style]?.ratingWeight;},
  withChanges(changes,fn){const snap=configSnapshot();try{applyCalibChanges(changes);return fn(mainPlayer());}finally{restoreConfig(snap);}},
  applyChanges(changes){applyCalibChanges(changes||[]);invalidateAllTeamEval();},
  applyResult(result){applyCalibChanges(result.changes||[]);registerCalibrationApplication(result);invalidateAllTeamEval();},
  regressions(){return sessionRegressions();},
  resetAll(){
    copyInto(E.ROLE_PERFIL,DEF.ROLE);copyInto(E.NM_DEF,DEF.NM);copyInto(E.NM_COR,DEF.NM_COR);
    copyInto(E.ROLE_CONTRA,DEF.CONTRA);copyInto(E.IGL_ROLE_AFIN,DEF.IGL);copyInto(E.ROLE_RULES,DEF.RULES);
    copyInto(E.STYLE_CONTRA,DEF.STYLE_CONTRA);copyInto(E.CFG_AVALIACAO,DEF.CFG);
    playerOverrides.clear();editorDrafts.clear();
    if(loadedIdx!=null)setEditorStateFrom(POOLRAW[loadedIdx]);
    baseline=null;calibSession=null;calibLast=null;invalidateAllTeamEval();
  },
  get STYLE_LABEL(){ return STYLE_LABEL; }
};
`;
  const fakeDocument={getElementById:()=>null,createElement:()=>({}),querySelectorAll:()=>[]};
  const build=new Function("document","navigator","performance",core);
  const api=build(fakeDocument,{},performance);
  api.setup(E);
  return api;
}

// Os módulos públicos são singletons por processo; uma única sessão torna esse
// compartilhamento explícito e evita criar wrappers que parecem isolados sem ser.
function loadCalibrator(){
  if(!calibratorPromise)calibratorPromise=buildCalibrator();
  return calibratorPromise;
}

module.exports={loadCalibrator};
