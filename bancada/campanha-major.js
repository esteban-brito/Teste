/* bancada/campanha-major.js — o Major do jogo, replicado fora da UI.

   A campanha vive na camada de UI de game.js (iniciarTorneio / avancarSuica /
   garantirPlayoffs / avancarPlayoff), que a bancada não carrega. Este módulo replica esse
   torneio sobre os motores puros, e é a única cópia: a suíte de dificuldade e as varreduras
   de balanceamento consomem daqui, para não medirem dois torneios diferentes.

     · Major de 16 — 15 NPC sorteados + o seu time;
     · o time NPC que mais compartilha jogadores com o seu elenco fica de fora;
     · suíça por buckets de campanha, anti-rematch, 3V classifica / 3D elimina;
     · o SEU jogo é simulado round a round; jogos entre NPCs são resolvidos por moeda
       ponderada (logistica sobre a força do dia), exatamente como no jogo;
     · jogo decisivo (alguém em 2V ou 2D) é MD3; o resto é MD1;
     · playoffs: top 8 por força efetiva, quartas/semi/final em MD3.

   O RNG é o do motor (X.rndF): quem chama semeia com X.srand antes de medir. */
const {X,T}=require("./motor");

// O sorteio do torneio TEM que consumir o mesmo RNG semeado do motor. Cair em Math.random()
// silenciosamente tornaria a medida não-reprodutível — melhor falhar aqui.
if(typeof X.rndF!=="function")throw new Error("motor não exportou rndF: a campanha não seria reprodutível");
const rnd=X.rndF;

// Correções de fidelidade do medidor. Podem ser desligadas individualmente para atribuir o
// efeito de cada uma; ligadas, o elenco medido é o elenco que o jogo monta.
const AJUSTES_PADRAO=new Set(["nicks","roles","overlap"]);

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
  // seed pelo RESULTADO da suíça (3-0 na frente de 3-1, 3-1 na frente de 3-2), força só como
  // desempate — é assim que um Major real chaveia. Ver garantirPlayoffs em game.js.
  const seeds=times.filter(t=>t.classificado).slice(0,8).sort((a,b)=>a.d-b.d||b.ef-a.ef);
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
function campoDoMajor(meu,meuIndice,ajustes){
  const npc=embaralhar(T.filter((_,i)=>i!==meuIndice).slice());
  if(ajustes.has("overlap")){
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

function campanha(meuIndice,ajustes=AJUSTES_PADRAO){
  const meu=T[meuIndice];
  const npc=campoDoMajor(meu,meuIndice,ajustes);
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

   O que separa um elenco do outro é o ESFORÇO: como o re-spin é ilimitado e gratuito
   (abortarSpin, game.js:1953), o jogador aceita a carta ou gira de novo. `limiar` é o OVR
   mínimo que ele aceita — um número, sem nick, sem time e sem exceção. limiar 0 reproduz o
   jogador que aceita a primeira carta; limiar alto reproduz quem gira até achar elite.

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

function elencoDraftado(limiar,ajustes=AJUSTES_PADRAO){
  const times=X.TEAMS;
  const escolhidos=[];
  const usados=new Set();  // por NICK: a UI proíbe repetir o mesmo jogador (game.js:2162)
  const disponivel=p=>!(ajustes.has("nicks")?usados.has(p.nick):escolhidos.includes(p));
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
  const engine=ajustes.has("roles")?X.distribuirRoles(escolhidos.map(p=>({...p}))):escolhidos;
  const forca=X.forcaTime(engine,treinador&&treinador.carac,treinador&&treinador.ovr);
  return {nome:"DRAFT",jogadores:engine.map(p=>({_eng:p})),giros,
    ef:forca.efetiva,quim:forca.quimica,elenco:engine.map(p=>`${p.nick}(${p.ovr})`)};
}

/* Uma fatia de campanhas com um esforço de draft fixo. Devolve contagens brutas: o
   intervalo é calculado na impressão, para que amostra e evento fiquem sempre visíveis. */
function medirDraft({limiar=0,campanhas=1000,ajustes=AJUSTES_PADRAO}={}){
  let titulos=0,invictos=0,suica=0,somaEf=0,somaQuim=0,somaGiros=0;
  const exemplos=[];
  for(let c=0;c<campanhas;c++){
    const draft=elencoDraftado(limiar,ajustes); // draft NOVO a cada campanha, como no jogo
    somaEf+=draft.ef;somaQuim+=draft.quim;somaGiros+=draft.giros;
    if(exemplos.length<3)exemplos.push(`${draft.elenco.join(" ")} → força ${draft.ef.toFixed(0)}`);
    T.push(draft);
    const r=campanha(T.length-1,ajustes);
    T.pop();
    if(r.titulo)titulos++;
    if(r.invicto)invictos++;
    if(r.fim==="suica")suica++;
  }
  return {limiar,campanhas,titulos,invictos,suica,exemplos,
    ef:somaEf/campanhas,quim:somaQuim/campanhas,giros:somaGiros/campanhas};
}

module.exports={AJUSTES_PADRAO,campanha,elencoDraftado,medirDraft};
