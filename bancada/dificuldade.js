/* bancada/dificuldade.js - quanto custa ganhar o Major, e quanto custa ganhar INVICTO.

   A dificuldade do draft9-0 nunca foi projetada: era efeito colateral do balanceamento.
   Esta suíte transforma o alvo em número. Alvo acordado com o responsável:
   INVICTO (título sem perder um único mapa) em 4–6% das campanhas com elenco bom.

   Replica fielmente o torneio da camada de UI (game.js: iniciarTorneio / avancarSuica /
   garantirPlayoffs / avancarPlayoff), porque a campanha vive na UI e não no motor:
     · Major de 16 — 15 NPC sorteados + o seu time;
     · suíça por buckets de campanha, anti-rematch, 3V classifica / 3D elimina;
     · o SEU jogo é simulado round a round; jogos entre NPCs são resolvidos por moeda
       ponderada (logistica sobre a força do dia), exatamente como no jogo;
     · jogo decisivo (alguém em 2V ou 2D) é MD3; o resto é MD1;
     · playoffs: top 8 por força efetiva, quartas/semi/final em MD3.

   Ressalva de leitura: aqui o "seu time" é um elenco de fábrica. No jogo real o usuário
   DRAFTA, escolhendo as melhores cartas de cada roleta — o elenco montado tende a ser
   mais forte que qualquer time de fábrica. Por isso a linha que vale para o alvo é a
   faixa de força ALTA, não a média de todos os times. */
const {X,T}=require("./motor");
const {pct,inRange,printCheck,mean}=require("./common");

const N=+(process.env.N||400);
const STRICT=process.env.DIFICULDADE_STRICT==="1";

if(X.srand)X.srand(20260726);

// O sorteio do torneio TEM que consumir o mesmo RNG semeado do motor. Cair em Math.random()
// silenciosamente tornaria a medida não-reprodutível — melhor falhar aqui.
if(typeof X.rndF!=="function")throw new Error("motor não exportou rndF: a dificuldade não seria reprodutível");
const rnd=X.rndF;

/* ─── suíça ──────────────────────────────────────────────────────────────── */
function embaralhar(lista){
  for(let i=lista.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[lista[i],lista[j]]=[lista[j],lista[i]];}
  return lista;
}

const forcaDia=t=>X.forcaDoDia(t.ef,t.quim);
// jogo entre NPCs: moeda ponderada pela força do dia, igual a resolverPar da UI
function moeda(x,y){
  return rnd()<X.logistica(forcaDia(x),forcaDia(y),X.CFG_SIM.D_MAPA);
}
function resolverNpc(x,y,need){
  let wx=0,wy=0;
  while(wx<need&&wy<need)moeda(x,y)?wx++:wy++;
  const vencedor=wx>wy?x:y,perdedor=wx>wy?y:x;
  vencedor.v++;perdedor.d++;
}
// jogo do JOGADOR: simulado de verdade, round a round. Devolve mapas ganhos/perdidos.
function resolverMeu(meu,adv,need){
  const serie=X.simularSerie(meu.time,adv.time,()=>forcaDia(meu),()=>forcaDia(adv),need*2-1,true);
  const venci=serie.vencedor===meu.time;
  let ganhos=0,perdidos=0;
  serie.mapas.forEach(m=>{m.vencedor===meu.time?ganhos++:perdidos++;});
  (venci?meu:adv).v++;(venci?adv:meu).d++;
  return {venci,ganhos,perdidos};
}

const decisivo=(x,y)=>x.v===2||x.d===2||y.v===2||y.d===2;

function rodadaSuica(times,campanha){
  const ativos=times.filter(t=>t.vivo);
  const buckets={};
  ativos.forEach(t=>{const k=t.v+"-"+t.d;(buckets[k]=buckets[k]||[]).push(t);});
  const pares=[];let parDoJogador=null;
  const jaJogaram=(x,y)=>(x.opps||[]).includes(y);
  Object.values(buckets).forEach(grupo=>{
    const a=embaralhar([...grupo]);
    for(let i=0;i<a.length-1;i+=2){ // anti-rematch: troca com alguém à frente se já se enfrentaram
      if(jaJogaram(a[i],a[i+1]))for(let j=i+2;j<a.length;j++){if(!jaJogaram(a[i],a[j])){[a[i+1],a[j]]=[a[j],a[i+1]];break;}}
    }
    for(let i=0;i<a.length-1;i+=2){
      a[i].opps=a[i].opps||[];a[i+1].opps=a[i+1].opps||[];
      a[i].opps.push(a[i+1]);a[i+1].opps.push(a[i]);
      if(a[i].meu||a[i+1].meu)parDoJogador=[a[i],a[i+1]];else pares.push([a[i],a[i+1]]);
    }
    if(a.length%2)a[a.length-1]._bye=true;
  });
  if(parDoJogador){
    const [x,y]=parDoJogador,meu=x.meu?x:y,adv=x.meu?y:x;
    const r=resolverMeu(meu,adv,decisivo(meu,adv)?2:1);
    campanha.mapasV+=r.ganhos;campanha.mapasD+=r.perdidos;
  }
  pares.forEach(([x,y])=>resolverNpc(x,y,decisivo(x,y)?2:1));
  ativos.forEach(t=>{if(t._bye){t.v++;delete t._bye;}});
  times.forEach(t=>{
    if(t.vivo&&t.v>=3){t.vivo=false;t.classificado=true;}
    else if(t.vivo&&t.d>=3){t.vivo=false;t.eliminado=true;}
  });
}

/* ─── playoffs ───────────────────────────────────────────────────────────── */
function playoffs(times,campanha){
  const seeds=times.filter(t=>t.classificado).slice(0,8).sort((a,b)=>b.ef-a.ef);
  if(seeds.length<8)return null;
  let fase=[[seeds[0],seeds[7]],[seeds[3],seeds[4]],[seeds[1],seeds[6]],[seeds[2],seeds[5]]];
  while(fase.length>=1){
    const vencedores=[];
    for(const [x,y] of fase){
      if(x.meu||y.meu){
        const meu=x.meu?x:y,adv=x.meu?y:x;
        const r=resolverMeu(meu,adv,2);
        campanha.mapasV+=r.ganhos;campanha.mapasD+=r.perdidos;
        vencedores.push(r.venci?meu:adv);
      }else{
        let wx=0,wy=0;
        while(wx<2&&wy<2)moeda(x,y)?wx++:wy++;
        vencedores.push(wx>wy?x:y);
      }
    }
    if(vencedores.length===1)return vencedores[0];
    fase=[];
    for(let i=0;i<vencedores.length;i+=2)fase.push([vencedores[i],vencedores[i+1]]);
  }
  return null;
}

/* ─── uma campanha completa ──────────────────────────────────────────────── */
function campanha(meuIndice){
  const npc=embaralhar(T.filter((_,i)=>i!==meuIndice).slice()).slice(0,15);
  const times=npc.map(t=>({time:t,nome:t.nome,ef:t.ef,quim:t.quim,v:0,d:0,vivo:true,meu:false}));
  const meu=T[meuIndice];
  times.push({time:meu,nome:meu.nome,ef:meu.ef,quim:meu.quim,v:0,d:0,vivo:true,meu:true});
  X.sortearFormaCampanha(times.map(t=>t.time));
  const estado={mapasV:0,mapasD:0};
  const eu=times.find(t=>t.meu);

  let guarda=0;
  while(times.filter(t=>t.classificado).length<8&&times.some(t=>t.vivo)&&guarda++<12){
    rodadaSuica(times,estado);
    if(eu.eliminado)return {fim:"suica",titulo:false,invicto:false,...estado};
  }
  if(!eu.classificado)return {fim:"suica",titulo:false,invicto:false,...estado};

  const campeao=playoffs(times,estado);
  const titulo=!!campeao&&campeao.meu;
  return {fim:titulo?"campeao":"playoffs",titulo,invicto:titulo&&estado.mapasD===0,...estado};
}

/* ─── execução: uma fatia de campanhas por time, agrupada por força ──────── */
const inicio=Date.now();
const porTime=T.map((t,i)=>({nome:t.nome,ef:t.ef,i,campanhas:0,titulos:0,invictos:0,mapasV:0,mapasD:0,suica:0}));
const porCampanha=Math.max(1,Math.round(N/T.length));

porTime.forEach(linha=>{
  for(let c=0;c<porCampanha;c++){
    const r=campanha(linha.i);
    linha.campanhas++;
    if(r.titulo)linha.titulos++;
    if(r.invicto)linha.invictos++;
    if(r.fim==="suica")linha.suica++;
    linha.mapasV+=r.mapasV;linha.mapasD+=r.mapasD;
  }
});

const total=porTime.reduce((acc,l)=>({
  campanhas:acc.campanhas+l.campanhas,titulos:acc.titulos+l.titulos,invictos:acc.invictos+l.invictos,
  suica:acc.suica+l.suica,mapasV:acc.mapasV+l.mapasV,mapasD:acc.mapasD+l.mapasD
}),{campanhas:0,titulos:0,invictos:0,suica:0,mapasV:0,mapasD:0});

// Faixa ALTA = terço mais forte do pool. É a linha que representa um elenco DRAFTADO,
// e portanto a que o alvo de 4–6% governa.
const ordenados=[...porTime].sort((a,b)=>b.ef-a.ef);
const corte=Math.max(1,Math.round(ordenados.length/3));
const faixa=lista=>{
  const c=lista.reduce((acc,l)=>({campanhas:acc.campanhas+l.campanhas,titulos:acc.titulos+l.titulos,
    invictos:acc.invictos+l.invictos,suica:acc.suica+l.suica}),{campanhas:0,titulos:0,invictos:0,suica:0});
  return {ef:mean(lista.map(l=>l.ef)),...c,
    pTitulo:pct(c.titulos,c.campanhas),pInvicto:pct(c.invictos,c.campanhas),pSuica:pct(c.suica,c.campanhas)};
};
const alta=faixa(ordenados.slice(0,corte));
const media=faixa(ordenados.slice(corte,ordenados.length-corte));
const baixa=faixa(ordenados.slice(ordenados.length-corte));

console.log(`— DIFICULDADE (${total.campanhas} campanhas · ${porCampanha} por time) —\n`);
console.log(`    ${"faixa".padEnd(8)} ${"ef".padStart(6)} ${"camp".padStart(5)} ${"título%".padStart(8)} ${"invicto%".padStart(9)} ${"cai na suíça%".padStart(14)}`);
[["alta",alta],["média",media],["baixa",baixa]].forEach(([nome,f])=>{
  console.log(`    ${nome.padEnd(8)} ${f.ef.toFixed(1).padStart(6)} ${String(f.campanhas).padStart(5)} ${f.pTitulo.toFixed(1).padStart(8)} ${f.pInvicto.toFixed(1).padStart(9)} ${f.pSuica.toFixed(1).padStart(14)}`);
});

console.log(`\n    global: título ${pct(total.titulos,total.campanhas).toFixed(1)}% · invicto ${pct(total.invictos,total.campanhas).toFixed(1)}% · mapas ${total.mapasV}-${total.mapasD}`);
console.log("\n  por time (força efetiva decrescente)");
ordenados.forEach(l=>{
  console.log(`    ${l.nome.padEnd(14)} ef ${l.ef.toFixed(1).padStart(5)}  título ${pct(l.titulos,l.campanhas).toFixed(1).padStart(5)}%  invicto ${pct(l.invictos,l.campanhas).toFixed(1).padStart(5)}%`);
});

const checks=[
  ["Invicto (faixa alta) %",alta.pInvicto.toFixed(1),"4–6",inRange(alta.pInvicto,4,6)],
  ["Título (faixa alta) %",alta.pTitulo.toFixed(1),"12–30",inRange(alta.pTitulo,12,30)],
  ["Invicto global %",pct(total.invictos,total.campanhas).toFixed(1),"1–6",
    inRange(pct(total.invictos,total.campanhas),1,6)],
  ["Faixa alta supera a baixa em título",(alta.pTitulo-baixa.pTitulo).toFixed(1),">0",alta.pTitulo>baixa.pTitulo],
  ["Faixa baixa ainda ganha às vezes",baixa.pTitulo.toFixed(1),">0",baixa.pTitulo>0]
];

console.log("");
let falhas=0;
checks.forEach(([nome,valor,faixaTexto,ok])=>{if(!ok)falhas++;printCheck(ok,nome,valor,faixaTexto);});

console.log(`\n  (${((Date.now()-inicio)/1000).toFixed(1)}s)`);
if(falhas===0){
  console.log("✓ dificuldade no alvo");
  process.exitCode=0;
}else if(STRICT){
  console.log(`✗ ${falhas} alvo(s) de dificuldade fora da faixa`);
  process.exitCode=1;
}else{
  console.log(`▲ ${falhas} alvo(s) fora da faixa — RELATÓRIO (alvos passam a valer com DIFICULDADE_STRICT=1, no fechamento)`);
  process.exitCode=0;
}
