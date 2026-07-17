/* Casos pesados do calibrador em processo isolado: estabilidade multi-seed + arquétipo. */
const {loadCalibrator}=require("./calibrador-loader");
const fs=require("fs");
const path=require("path");
const {okMark}=require("./common");
let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

console.log("— CALIBRADOR: CASOS PESADOS ISOLADOS —");
{
  const sandbox=fs.readFileSync(path.join(__dirname,"..","sandbox.html"),"utf8");
  check(sandbox.includes("break archetypeSearch"),"orçamento de arquétipo encerra a busca aninhada inteira");
}
(async()=>{
  {
    const api=loadCalibrator(),stabilityMs=3000;
    api.overrideBudget(stabilityMs);
    const runs=[];
    for(const seed of [17,7919,15838]){
      api.resetAll();api.loadByName("b1t");api.setMode("ia");api.setSeed(seed);
      // Callback vazio força os yields cooperativos do mesmo caminho usado pela UI/worker e evita
      // monopolizar o event loop no runner de Node durante milhares de avaliações.
      runs.push(await api.findCalibration({r1:"Rifler",style:"Trader"},()=>{},{skipRefinement:true,firstValid:true}));
    }
    const all=runs.every(r=>r&&r.ok&&api.rolePairParts(r.after).r1==="Rifler"&&api.STYLE_LABEL(r.after.playstyle)==="Trader");
    check(all,`multiobjetivo permanece solucionável em 3 seeds (${runs.map(r=>r?.ok?"ok":"falha").join(", ")})`);
  }
  {
    const api=loadCalibrator();api.loadByName("Jame");api.setMode("ia");
    let r=null,err=null;try{r=await api.reformulateStyleFromArchetype("Closer",{},null);}catch(e){err=e;}
    check(!err&&r&&r.ok&&api.STYLE_LABEL(r.after.playstyle)==="Closer",`Jame como arquétipo reaprende Closer${err?": "+err.message:r&&r.message?": "+r.message:""}`);
    if(r&&r.ok){
      check((r.archetypeInfo?.synthetic||0)>=.5&&r.archetypeInfo?.lost<=3,`arquétipo valida robustez sintética e preserva Closers (synth ${Math.round((r.archetypeInfo?.synthetic||0)*100)}%, perdidos ${r.archetypeInfo?.lost})`);
      const recipe=r.archetypeInfo?.afterRecipe||{},sum=Object.values(recipe).reduce((a,b)=>a+b,0);
      const noPin=(r.changes||[]).every(c=>["nm","stylecontra","cfg","rating","ovrparam","nmover"].includes(c.type));
      check(Math.abs(sum-1)<1e-3&&noPin,`arquétipo produz receita normalizada (Σ=${sum.toFixed(3)}) e zero pin individual`);
    }
  }
  console.log(failures?`✗ ${failures} caso(s) pesado(s) falharam`:"✓ casos pesados do calibrador ok");
  process.exitCode=failures?1:0;
})();
