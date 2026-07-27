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

   A linha que governa o alvo é a do ELENCO DRAFTADO, não a dos times de fábrica: é o
   elenco draftado que o usuário realmente joga. Ele é sorteado de novo a cada campanha,
   simulando o draft do jogo.

   O DRAFT TEM RE-SPIN. `abortarSpin` (game.js:1953) descarta o time sorteado sem gastar
   slot, e o botão fica visível sempre que há sorteio pendente (game.js:1918) — o jogador
   pode girar quantas vezes quiser antes de aceitar uma carta. Medir um draft guloso de
   cinco giros mede um jogo que não existe: mede o jogador mais apressado possível. Por isso
   o esforço de draft é um PARÂMETRO aqui (DIFICULDADE_LIMIAR), e a suíte imprime a curva
   invicto × esforço em vez de um número solto. */
const {X,T}=require("./motor");
const {pct,inRange,printCheck,mean}=require("./common");
const {wilsonIntervalPercent}=require("../src/domain/statistics/proportion-interval.mjs");

const N=+(process.env.N||400);
// A linha do elenco draftado tem amostra própria: o invicto vive perto de 5%, e a 300 campanhas
// um único evento vale 0,33 pp — essa amostra não distingue 1,5% de 4%. Ver DIMENSIONAMENTO.
const DRAFT_N=+(process.env.DIFICULDADE_N||3000);
const CURVA_N=+(process.env.DIFICULDADE_CURVA_N||600);
// Esforço de draft da linha que governa o alvo: OVR mínimo que o jogador aceita antes de
// girar de novo. 0 = aceita a primeira carta de cada giro.
// DECISÃO DO RESPONSÁVEL (27/07/2026): o alvo de 4–6% descreve o jogador APRESSADO, ou seja,
// limiar 0. Quem gasta re-spin fica acima da faixa de propósito — o esforço é recompensado.
const LIMIAR=+(process.env.DIFICULDADE_LIMIAR||0);
// Cada correção de fidelidade do medidor pode ser desligada para atribuir seu efeito
// isoladamente (DIFICULDADE_AJUSTES=nicks,roles,overlap). Padrão: todas ligadas.
const AJUSTES=new Set((process.env.DIFICULDADE_AJUSTES??"nicks,roles,overlap").split(",")
  .map(item=>item.trim()).filter(Boolean));
const STRICT=process.env.DIFICULDADE_STRICT==="1";

// invicto% com IC95% de Wilson: sem o intervalo, mover o número é indistinguível de sorte.
const proporcao=(sucessos,total)=>{
  const ic=wilsonIntervalPercent(sucessos,total);
  return ic.n?`${ic.estimate.toFixed(1)}% [${ic.low.toFixed(1)}–${ic.high.toFixed(1)}]`:"—";
};

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
const nickDe=carta=>(carta._eng||carta).nick;

/* O time NPC que mais compartilha jogadores com o seu elenco sai do Major — melhor esforço
   contra "donk vs donk", só dá pra excluir um (game.js:2296-2300). Sem isso, o elenco
   draftado enfrenta times que contêm os próprios jogadores dele. */
function campoDoMajor(meu,meuIndice){
  const npc=embaralhar(T.filter((_,i)=>i!==meuIndice).slice());
  if(AJUSTES.has("overlap")){
    const meusNicks=new Set(meu.jogadores.map(nickDe));
    let fora=-1,maior=0;
    npc.forEach((t,i)=>{
      const sobrepostos=t.jogadores.reduce((n,j)=>n+(meusNicks.has(nickDe(j))?1:0),0);
      if(sobrepostos>maior){maior=sobrepostos;fora=i;}
    });
    if(fora>=0)npc.splice(fora,1);
  }
  return npc.slice(0,15);
}

function campanha(meuIndice){
  const meu=T[meuIndice];
  const npc=campoDoMajor(meu,meuIndice);
  const times=npc.map(t=>({time:t,nome:t.nome,ef:t.ef,quim:t.quim,v:0,d:0,vivo:true,meu:false}));
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

/* ─── ELENCO DRAFTADO ────────────────────────────────────────────────────────
   O alvo de 4–6% descreve o elenco que o USUÁRIO monta. Mas montar não é escolher os
   cinco melhores do jogo: no draft real a roleta sorteia UM time por giro e você escolhe
   UMA carta dele. Medir o top-5 global daria um limite superior, não o elenco que se joga.

   O que separa um elenco do outro é o ESFORÇO: como o re-spin é ilimitado e gratuito, o
   jogador aceita a carta ou gira de novo. `limiar` é o OVR mínimo que ele aceita — um
   número, sem nick, sem time e sem exceção. limiar 0 reproduz o jogador que aceita a
   primeira carta; limiar alto reproduz quem gira até achar carta de elite.

   Ninguém gira para sempre: depois de PACIENCIA giros numa vaga, o jogador fica com a
   melhor carta que viu. É o que torna todo limiar alcançável — inclusive um acima do que o
   pool oferece — e o que faz `giros` medir esforço de verdade em vez de medir a trava. */
const PACIENCIA=40;
const MAX_GIROS=600;   // rede de segurança: nunca deve pegar, com 5 vagas × PACIENCIA
const melhorCarta=cartas=>cartas.slice().sort((x,y)=>y.ovr-x.ovr)[0]||null;

/* O OVR de treinador vai de 14 a 18; o de jogador, de 12 a 22. Aplicar o mesmo limiar bruto
   aos dois faria o jogador exigente girar para sempre atrás de um treinador que não existe.
   O esforço é convertido por QUANTIL: quem só aceita jogador no topo X% também só aceita
   treinador no topo X% do próprio pool. */
const ordenar=valores=>valores.slice().sort((a,b)=>a-b);
const OVR_JOGADORES=ordenar(Object.values(X.POOL).map(j=>j.ovr));
const OVR_TREINADORES=ordenar(X.TEAMS.map(t=>t.treinador).filter(Boolean).map(t=>t.ovr));
const quantilDe=(valores,alvo)=>valores.filter(v=>v<alvo).length/valores.length;
function limiarTreinador(limiar){
  const q=quantilDe(OVR_JOGADORES,limiar);
  return OVR_TREINADORES[Math.min(OVR_TREINADORES.length-1,Math.floor(q*OVR_TREINADORES.length))];
}

function elencoDraftado(limiar){
  const times=X.TEAMS;
  const escolhidos=[];
  const usados=new Set();  // por NICK: a UI proíbe repetir o mesmo jogador (game.js:2162)
  const disponivel=p=>!(AJUSTES.has("nicks")?usados.has(p.nick):escolhidos.includes(p));
  const temIgl=()=>escolhidos.some(p=>p.primario==="IGL");
  const temAwp=()=>escolhidos.some(p=>(p.combatRole||p.primario)==="AWPer");
  let giros=0;
  while(escolhidos.length<5&&giros<MAX_GIROS){
    let escolha=null,melhorVista=null;
    for(let tentativa=0;tentativa<PACIENCIA&&giros<MAX_GIROS;tentativa++){
      const time=times[Math.floor(rnd()*times.length)];
      giros++;
      const cartas=time.jogadores.map(c=>c._eng).filter(disponivel);
      if(!cartas.length)continue;
      const faltamSlots=5-escolhidos.length;
      // um jogador competente prioriza cobrir IGL e AWP enquanto ainda há espaço
      let alvo=null;
      if(!temIgl()&&faltamSlots<=3)alvo=melhorCarta(cartas.filter(p=>p.primario==="IGL"));
      if(!alvo&&!temAwp()&&faltamSlots<=2)alvo=melhorCarta(cartas.filter(p=>(p.combatRole||p.primario)==="AWPer"));
      const cobreFuncao=!!alvo;
      if(!alvo)alvo=melhorCarta(cartas);
      // A carta de COBERTURA é sempre aceita, e isso não é indulgência: ficar sem IGL custa
      // 25% de química e sem AWP 20% (CFG_QUIMICA.PEN), enquanto a diferença de OVR entre um
      // IGL e outro vale poucos pontos de força bruta. Recusar cobertura por OVR seria o
      // jogador jogando contra a própria aritmética do jogo.
      if(cobreFuncao||alvo.ovr>=limiar){escolha=alvo;break;}
      if(!melhorVista||alvo.ovr>melhorVista.ovr)melhorVista=alvo;   // re-spin: guarda e gira
    }
    const carta=escolha||melhorVista;
    if(!carta)continue;
    escolhidos.push(carta);usados.add(carta.nick);
  }
  // Na UI o treinador vem na mesma leva de cartas do time sorteado (game.js:2092), então o
  // jogador pode pegá-lo de oportunidade durante os cinco giros. Medir os giros do treinador
  // à parte é conservador: superestima o esforço, nunca o subestima.
  const alvoTreinador=limiarTreinador(limiar);
  let treinador=null,melhorTreinador=null;
  for(let tentativa=0;tentativa<PACIENCIA;tentativa++){
    giros++;
    const candidato=times[Math.floor(rnd()*times.length)].treinador;
    if(!candidato)continue;
    if(candidato.ovr>=alvoTreinador){treinador=candidato;break;}
    if(!melhorTreinador||candidato.ovr>melhorTreinador.ovr)melhorTreinador=candidato;
  }
  treinador=treinador||melhorTreinador;
  // no jogo, o elenco é avaliado com as funções redistribuídas no contexto do SEU time
  // (cap de 2 + AWP) antes de virar força efetiva — montarMeuTime, game.js:2284
  const engine=AJUSTES.has("roles")?X.distribuirRoles(escolhidos.map(p=>({...p}))):escolhidos;
  const forca=X.forcaTime(engine,treinador&&treinador.carac,treinador&&treinador.ovr);
  return {nome:"DRAFT",jogadores:engine.map(p=>({_eng:p})),giros,
    ef:forca.efetiva,quim:forca.quimica,elenco:engine.map(p=>`${p.nick}(${p.ovr})`)};
}

/* Uma fatia de campanhas com um esforço de draft fixo. Devolve contagens brutas: o
   intervalo é calculado na impressão, para que amostra e evento fiquem sempre visíveis. */
function medirDraft(limiar,campanhas){
  let titulos=0,invictos=0,suica=0,somaEf=0,somaQuim=0,somaGiros=0;
  const exemplos=[];
  for(let c=0;c<campanhas;c++){
    const draft=elencoDraftado(limiar); // draft NOVO a cada campanha, como no jogo
    somaEf+=draft.ef;somaQuim+=draft.quim;somaGiros+=draft.giros;
    if(exemplos.length<3)exemplos.push(`${draft.elenco.join(" ")} → força ${draft.ef.toFixed(0)}`);
    T.push(draft);
    const r=campanha(T.length-1);
    T.pop();
    if(r.titulo)titulos++;
    if(r.invicto)invictos++;
    if(r.fim==="suica")suica++;
  }
  return {limiar,campanhas,titulos,invictos,suica,exemplos,
    ef:somaEf/campanhas,quim:somaQuim/campanhas,giros:somaGiros/campanhas};
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

/* ─── CURVA DE ESFORÇO: o alvo de 4–6% descreve QUAL jogador? ────────────────
   Como o re-spin é ilimitado, o invicto não é uma propriedade do motor sozinho: é uma
   função do esforço que o jogador gasta no draft. Sem essa curva, "1,5%" e "4%" descrevem
   jogadores diferentes e a comparação não quer dizer nada. */
const LIMIARES=[0,18,19,20,21,22];
console.log(`\n  CURVA DE ESFORÇO DO DRAFT (${CURVA_N} campanhas por ponto)`);
console.log(`    ${"OVR mín".padEnd(8)} ${"giros".padStart(6)} ${"força".padStart(6)} ${"quím".padStart(5)}  ${"título".padStart(18)}  ${"invicto".padStart(18)}`);
const curva=LIMIARES.map(limiar=>{
  const r=medirDraft(limiar,CURVA_N);
  console.log(`    ${String(limiar).padEnd(8)} ${r.giros.toFixed(1).padStart(6)} ${r.ef.toFixed(1).padStart(6)} ${(r.quim*100).toFixed(0).padStart(4)}%  ${proporcao(r.titulos,r.campanhas).padStart(18)}  ${proporcao(r.invictos,r.campanhas).padStart(18)}`);
  return r;
});

/* ─── a linha que governa o alvo: o elenco draftado no esforço declarado ─── */
const draftado=medirDraft(LIMIAR,DRAFT_N);
const dCamp=draftado.campanhas,dTit=draftado.titulos,dInv=draftado.invictos;
console.log(`
  ELENCO DRAFTADO (${dCamp} drafts · OVR mín ${LIMIAR} · ${draftado.giros.toFixed(1)} giros · força média ${draftado.ef.toFixed(1)} · química média ${(draftado.quim*100).toFixed(0)}%)`);
draftado.exemplos.forEach(e=>console.log(`    ex: ${e}`));
console.log(`    título ${proporcao(dTit,dCamp)} · invicto ${proporcao(dInv,dCamp)} · cai na suíça ${proporcao(draftado.suica,dCamp)}`);
console.log(`    (IC95% de Wilson; ±${wilsonIntervalPercent(dInv,dCamp).margin.toFixed(2)} pp no invicto)`);
const naFaixa=curva.filter(r=>inRange(pct(r.invictos,r.campanhas),4,6));
if(naFaixa.length)console.log(`    esforço que cai em 4–6%: OVR mín ${naFaixa.map(r=>r.limiar).join(", ")}`);
else console.log("    nenhum esforço de draft medido cai em 4–6% — a diferença não é só de elenco");

const checks=[
  // O alvo de 4-6% descreve o elenco DRAFTADO — é o que o usuário realmente joga.
  ["Invicto (elenco draftado) %",proporcao(dInv,dCamp),"4–6",inRange(pct(dInv,dCamp),4,6)],
  ["Título (elenco draftado) %",proporcao(dTit,dCamp),"25–60",inRange(pct(dTit,dCamp),25,60)],
  ["Título (faixa alta de fábrica) %",alta.pTitulo.toFixed(1),"12–30",inRange(alta.pTitulo,12,30)],
  ["Faixa alta supera a baixa em título",(alta.pTitulo-baixa.pTitulo).toFixed(1),">0",alta.pTitulo>baixa.pTitulo]
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
