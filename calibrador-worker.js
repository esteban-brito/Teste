/* calibrador-worker.js
 * Roda a busca do Calibrador Inteligente fora da thread principal, em paralelo com outros
 * workers iguais a este. NAO duplica a logica do motor/calibrador: busca o proprio
 * sandbox.html (mesma origem) e reaproveita o script dele, exatamente como carregarMotores()
 * ja faz com game.js - o worker roda o MESMO codigo-fonte, so que numa cópia isolada,
 * evitando ter duas versoes da mesma logica pra manter sincronizadas.
 *
 * Protocolo (postMessage):
 *   pagina -> worker: {jobId, ti, pi, state, config, goal, mode, seedSalt}
 *   worker -> pagina: {type:"progress", jobId, tested, generated, valid, cost}
 *                    | {type:"done", jobId, ok:true, result}
 *                    | {type:"done", jobId, ok:false, error}
 */
let apiPromise = null;
const cancelledJobs = new Set();

async function bootstrap() {
  const [gameRes, sandboxRes] = await Promise.all([
    fetch("game.js?nc=" + Date.now()),
    fetch("sandbox.html?nc=" + Date.now()),
  ]);
  if (!gameRes.ok) throw new Error("game.js nao carregou (" + gameRes.status + ")");
  if (!sandboxRes.ok) throw new Error("sandbox.html nao carregou (" + sandboxRes.status + ")");
  const gameSrc = await gameRes.text();
  const sandboxSrc = await sandboxRes.text();

  const linhas = gameSrc.split("\n");
  let cut = linhas.findIndex((l) => l.includes("// === UI START ==="));
  if (cut < 0) cut = linhas.findIndex((l) => l.includes("document.getElementById"));
  if (cut < 0) throw new Error("nao encontrei o inicio da camada de UI em game.js");
  const engineSlice = linhas.slice(0, cut).join("\n");
  const E = new Function(
    engineSlice +
      "\nreturn {avaliarJogador,aplicarAvaliacaoContextual,distribuirRoles,forcaTime,ovrUnificado,rolePairReality,roleStyleReality,CFG_AVALIACAO,ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,STYLE_CONTRA,MAPAS_POOL,MAPA_LADO,srand,simularMapa,forcaDoDia,TEAMS,nmOVR,styleScoreTable,roleAfinidade,secondaryScore,NM_DEF,NM_COR,STYLE_LABEL,PLAYSTYLE_IDS,PLAYSTYLES,NM_AXES,STYLE_KEYS};"
  )();

  const m = sandboxSrc.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error("nao encontrei o <script> do sandbox.html");
  let core = m[1];
  const iifeIdx = core.lastIndexOf("(async()=>{");
  if (iifeIdx >= 0) core = core.slice(0, iifeIdx);
  core += `
return {
  setupEngine(engine){
    E=engine; DEF={ROLE:clone(E.ROLE_PERFIL),NM:clone(E.NM_DEF),NM_COR:clone(E.NM_COR),CONTRA:clone(E.ROLE_CONTRA),IGL:clone(E.IGL_ROLE_AFIN),RULES:clone(E.ROLE_RULES),STYLE_CONTRA:clone(E.STYLE_CONTRA),CFG:clone(E.CFG_AVALIACAO)}; // [21] CFG faltava (o sandbox principal inclui)
    ({nmOVR,STYLE_LABEL,PLAYSTYLE_IDS}=E);
    POOLRAW=[]; poolBySlot=new Map();
    E.TEAMS.forEach((t,ti)=>t.jogadores.forEach((j,pi)=>{const e=j._eng;
      const idx=POOLRAW.length;
      poolBySlot.set(\`\${ti}:\${pi}\`,idx);
      POOLRAW.push({...e,time:t.nome,ti,pi,isIGL:!!e.isIGL,colocacao:e.colocacao||"Campeao"});
    }));
  },
  runSearch(job){
    if(job.config)restoreConfig(job.config);
    // [21] worker é REUSADO entre jobs: zera o estado de sessão pra não vazar baseline/caches de uma
    // busca anterior (senão ensureBaseline mantém o baseline do job antigo e cumulativeInfo mede
    // contra ele → desempate [18]/[19] errado). Recalcula tudo contra a config recém-restaurada.
    baseline=null; calibSession=null; reportFallbackText=""; invalidateAllTeamEval();
    loadedIdx = poolBySlot.get(\`\${job.ti}:\${job.pi}\`);
    if(loadedIdx==null) throw new Error("jogador nao encontrado no worker: "+job.ti+":"+job.pi);
    Object.assign(state, job.state||{});
    calibMode = job.mode;
    searchSeedSalt = job.seedSalt||0;
    return findCalibration(job.goal, job.onProgress||null,{
      partitionIndex:job.partitionIndex||0,
      partitionCount:job.partitionCount||1,
      shouldCancel:job.shouldCancel||null,
      strategyOverride:job.strategyOverride||null
    });
  }
};
`;
  const fakeDocument = { getElementById: () => null, createElement: () => ({}), querySelectorAll: () => [] };
  const build = new Function("document", "navigator", "performance", core);
  const api = build(fakeDocument, self.navigator, self.performance);
  api.setupEngine(E);
  return api;
}

self.onmessage = async (ev) => {
  const job = ev.data||{};
  if(job.type==="cancel"){
    if(job.jobId)cancelledJobs.add(job.jobId);
    return;
  }
  try {
    if (!apiPromise) apiPromise = bootstrap();
    const api = await apiPromise;
    let lastPost = 0;
    const onProgress = (stats) => {
      const now = self.performance.now();
      if (now - lastPost < 200) return;
      lastPost = now;
      self.postMessage({ type: "progress", jobId: job.jobId, tested: stats.tested, generated: stats.generated, valid: stats.valid, partitionSkipped:stats.partitionSkipped||0 });
    };
    const result = await api.runSearch({ ...job, onProgress, shouldCancel:()=>cancelledJobs.has(job.jobId) });
    self.postMessage({ type: "done", jobId: job.jobId, ok: true, result });
  } catch (err) {
    self.postMessage({ type: "done", jobId: job.jobId, ok: false, error: String((err && err.message) || err) });
  } finally {
    if(job.jobId)cancelledJobs.delete(job.jobId);
  }
};
