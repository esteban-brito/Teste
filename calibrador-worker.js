/* calibrador-worker.js
 * Roda a busca do Calibrador Inteligente fora da thread principal, em paralelo com outros
 * workers iguais a este. NAO duplica a logica do motor/calibrador: importa a API
 * pública e busca o próprio sandbox.html para reaproveitar o script do calibrador.
 * O worker roda o MESMO código-fonte, só que numa cópia isolada,
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
  const engineUrl = self.__engineModuleUrl ||
    "./src/public/simulation-api.mjs?nc=" + Date.now();
  const [E, sandboxRes] = await Promise.all([
    import(engineUrl),
    fetch("sandbox.html?nc=" + Date.now())
  ]);
  if (!sandboxRes.ok) throw new Error("sandbox.html nao carregou (" + sandboxRes.status + ")");
  const sandboxSrc = await sandboxRes.text();

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
