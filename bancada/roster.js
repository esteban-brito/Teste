/* bancada/roster.js — regenera os dados embutidos na Base de Elencos (elencos.html)
   a partir do estado atual dos motores (game.js). Fonte única: os motores.
   Uso:  node bancada/roster.js        (reescreve o const DATA=[...] no elencos.html)
         require("./roster").build()   (só devolve o array, sem escrever)
   Chamado automaticamente pelo tools/add-team.js. Roda em ~1s. */
const fs=require("fs"),path=require("path");
const {X}=require("./motor");
const g=(o,...k)=>{for(const kk of k)if(o&&o[kk]!==undefined)return o[kk];};

// extrai o snapshot que a página consome (mesma forma/ordem que a UI espera)
function build(){
  const out=X.TEAMS.map(t=>{
    const players=t.jogadores.map(j=>{const e=j._eng||{};
      return {n:g(e,"nome","nick"),o:e.ovr,r1:e.primario,r2:e.secundario,sf:e.secForte!==false,
        sub:e.sub&&e.sub.nome,st:!!e.estrela,igl:!!g(e,"isIGL"),pa:g(e,"pais"),rt:g(e,"rating"),
        s:{fp:e.fp,op:e.op,cl:e.cl,ut:e.ut,en:e.en,tr:e.tr,sn:e.sn}};
    }).sort((a,b)=>b.o-a.o||b.rt-a.rt);                          // jogadores por OVR desc (empate: rating)
    const c=t.treinador?{n:g(t.treinador,"nick"),o:t.treinador.ovr,ca:t.treinador.carac,pa:g(t.treinador,"pais")}:null;
    return {n:t.nome,cor:t.cor,camp:t.camp,coloc:t.coloc,p:players,c};
  });
  // times por OVR médio desc (do mais forte ao mais fraco)
  const avg=t=>t.p.reduce((s,p)=>s+p.o,0)/t.p.length;
  out.sort((a,b)=>avg(b)-avg(a));
  return out;
}

// reescreve o const DATA=[...] dentro do elencos.html
function inject(){
  const p=path.join(__dirname,"..","elencos.html");
  let html=fs.readFileSync(p,"utf8");
  if(!/const DATA=\[.*?\];\n/s.test(html))throw new Error("elencos.html: marcador `const DATA=[...]` não encontrado");
  html=html.replace(/const DATA=\[.*?\];\n/s,"const DATA="+JSON.stringify(build())+";\n");
  fs.writeFileSync(p,html);
  return build().length;
}

module.exports={build,inject};
if(require.main===module){
  const n=inject();
  console.log(`✓ elencos.html regenerado a partir dos motores · ${n} times`);
}
