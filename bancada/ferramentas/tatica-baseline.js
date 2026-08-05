/* BANCADA DE TRABALHO — o "antes" da camada tática. NÃO entra no `run.js`.
   ══════════════════════════════════════════════════════════════════════════════

   A PERGUNTA. Hoje, descontada a diferença de força, algum eixo de identidade
   tática explica o resultado de um confronto? Em especial `leitura`, que é a
   qualidade do IGL.

   A RESPOSTA ESPERADA É ZERO, e é por isso que a medição vale: ela é o "antes"
   contra o qual a camada tática vai ser julgada. Se `leitura` já explicasse algo
   hoje, seria porque o IGL entra pela força (via OVR) e não por ser IGL — e isso
   mudaria como a camada deve ser ligada.

   COMO. Cada par de elencos joga N mapas com orientação alternada, para que o
   viés de lado se cancele. Depois, correlação PARCIAL entre a diferença de cada
   eixo e a taxa de vitória, controlando pela diferença de força efetiva. Parcial,
   e não bruta: sem controlar a força, qualquer eixo correlacionado com elenco bom
   apareceria como se explicasse o jogo.

   COMO ELA PODE FALHAR. Um estimador que devolve zero para tudo é indistinguível
   de um estimador quebrado. Por isso a saída inclui uma prova sintética: um
   resultado FABRICADO com sinal conhecido em `leitura`, que o mesmo estimador
   precisa recuperar. Sem ela, "deu zero" não significaria nada.

   LIGADA × DESLIGADA. Com `--tatica` a mesma medição roda com a camada ativa,
   nas MESMAS seeds. É a comparação pareada que decide se a camada acrescenta o
   que promete — `leitura` deixando de ser nula — sem inflar os quatro eixos que
   já agem. Ligar aqui é local à ferramenta: `CFG_TATICA.ATIVA` continua saindo
   de fábrica em 0, e `tools/check-tactics-layer.js` cobra isso.

   `--canais` responde uma pergunta DIFERENTE da correlação: não "o eixo explica
   o mapa?", mas "quanto vale ACERTAR a leitura, e por qual canal?". Ver o
   cabeçalho de `medirCanais`, que é onde mora a armadilha mais cara do arquivo.

   Uso:  node bancada/ferramentas/tatica-baseline.js [--mapas 40] [--tatica]
         node bancada/ferramentas/tatica-baseline.js --canais [--rounds 110000] */
const {X,T}=require("../lib/motor");
const {teamIdentityRaw,computeIdentityMeans}=require("../../src/domain/tactics/team-identity.mjs");
const {CFG_TATICA}=require("../../src/domain/tactics/tactics-config.mjs");
const {CFG_PADRAO:CFG_PLANO}=require("../../src/domain/tactics/round-plan.mjs");
const {TIPOS_JOGADA}=require("../../src/domain/tactics/play-style.mjs");

const EIXOS=["ritmo","estrutura","utilitaria","leitura","dependencia"];

function argInt(nome,padrao){
  const i=process.argv.indexOf(nome);
  if(i<0)return padrao;
  const v=Number(process.argv[i+1]);
  return Number.isFinite(v)&&v>0?Math.floor(v):padrao;
}

const media=xs=>xs.reduce((s,x)=>s+x,0)/Math.max(1,xs.length);
function correlacao(xs,ys){
  const mx=media(xs),my=media(ys);
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){
    const dx=xs[i]-mx,dy=ys[i]-my;
    sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;
  }
  const den=Math.sqrt(sxx*syy);
  return den>0?sxy/den:0;
}
/* Correlação de x com y removendo o efeito de z de AMBOS. É a pergunta certa:
   "sobra alguma coisa depois que a força explicou o que podia explicar?" */
function correlacaoParcial(xs,ys,zs){
  const rxy=correlacao(xs,ys),rxz=correlacao(xs,zs),ryz=correlacao(ys,zs);
  const den=Math.sqrt((1-rxz*rxz)*(1-ryz*ryz));
  return den>1e-12?(rxy-rxz*ryz)/den:0;
}
/* IC95% de uma correlação pela transformação z de Fisher. Sem ele, um r de 0,08
   em 136 pares pareceria um achado — e não é. */
function icFisher(r,n){
  if(n<4)return [NaN,NaN];
  const z=.5*Math.log((1+r)/(1-r)),se=1/Math.sqrt(n-3);
  const lo=Math.tanh(z-1.96*se),hi=Math.tanh(z+1.96*se);
  return [lo,hi];
}
const contemZero=([lo,hi])=>lo<=0&&hi>=0;

/* ——— POTÊNCIA DOS CANAIS ————————————————————————————————————————————————
   Quanto vale ACERTAR a leitura, em pontos de round vencido pelo T, e por qual
   dos três canais de `confrontoDePlanos`.

   O BRAÇO DE CONTROLE É OBRIGATÓRIO, e descobrir isso custou uma medição
   inteira. `ctAcertou` NÃO é exógeno: a direção sai da inércia, a inércia
   depende de quem venceu o round anterior, e quem venceu o round anterior
   prevê quem vence o próximo. Com os três canais em ZERO — onde acertar não
   pode valer nada, por construção — o contraste "errou menos acertou" ainda
   deu −0,83 pp ± 0,30 em 111 mil rounds. Quem lê esse contraste sem subtrair o
   controle atribui ao canal um efeito que é SELEÇÃO. Toda linha da tabela
   abaixo é lida CONTRA o controle, nunca contra zero.

   OS CANAIS SÃO ISOLADOS porque não fazem a mesma coisa. `ACERTO_ABERTURA` e
   `RITMO_CONTATO` respondem a acertar a direção. `ACERTO_PLANT` responde a
   `utilitaria` e é ORTOGONAL à leitura — ele entra aqui não pelo contraste,
   que nele é nulo, mas pela coluna `Plant%`: empurrão simétrico num processo
   de PRIMEIRO SUCESSO não se cancela. `1−∏(1−pᵢ)` é côncava, então ruído
   simétrico ABAIXA a média (Jensen), e Plant% é gate em 46–60. */
function medirCanais(orcamentoRounds){
  const PROJETO={ACERTO_ABERTURA:CFG_PLANO.ACERTO_ABERTURA,
    ACERTO_PLANT:CFG_PLANO.ACERTO_PLANT,RITMO_CONTATO:CFG_PLANO.RITMO_CONTATO};
  const zerado={ACERTO_ABERTURA:0,ACERTO_PLANT:0,RITMO_CONTATO:0};
  const so=chave=>({...zerado,[chave]:PROJETO[chave]});
  const cenarios=[
    ["CONTROLE (os três em 0)",zerado],
    ["só ACERTO_ABERTURA",so("ACERTO_ABERTURA")],
    ["só ACERTO_PLANT",so("ACERTO_PLANT")],
    ["só RITMO_CONTATO",so("RITMO_CONTATO")],
    ["os três (projeto)",PROJETO]
  ];

  const rodar=()=>{
    const acertou={n:0,tw:0,p:0},errou={n:0,tw:0,p:0};
    let seed=1000,rounds=0,plantados=0;
    // percorre os pares em ciclos até gastar o orçamento: seeds distintas por
    // cenário seriam braços não pareados, então a sequência recomeça igual.
    fim: for(let ciclo=0;ciclo<200;ciclo++)
      for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++){
        X.srand(seed++);
        const jogo=X.simularMapa({nome:T[i].nome,jogadores:T[i].jogadores},
          {nome:T[j].nome,jogadores:T[j].jogadores},
          X.forcaDoDia(T[i].ef,T[i].quim),X.forcaDoDia(T[j].ef,T[j].quim),null,true);
        for(const round of jogo.rounds){
          if(!round.tatica)continue;
          rounds++;
          if(round.plantado)plantados++;
          // o T deste round é o lado oposto ao CT; `venceA` é do time A
          const venceuT=(round.ladoA==="TR")===round.venceA;
          const celula=round.tatica.ctAcertou?acertou:errou;
          celula.n++;
          if(venceuT)celula.tw++;
          if(round.plantado)celula.p++;
        }
        if(rounds>=orcamentoRounds)break fim;
      }
    const taxa=(x,n)=>n?x/n:0;
    const pctA=taxa(acertou.tw,acertou.n),pctE=taxa(errou.tw,errou.n);
    // erro-padrão da DIFERENÇA de duas proporções independentes
    const se=100*Math.sqrt(pctA*(1-pctA)/Math.max(1,acertou.n)+
      pctE*(1-pctE)/Math.max(1,errou.n));
    return {rounds,se,
      acerto:100*taxa(acertou.n,rounds),
      contraste:100*(pctE-pctA),
      plant:100*taxa(plantados,rounds)};
  };

  const aplicar=valores=>Object.assign(CFG_PLANO,valores);
  const saida=[];
  try{
    for(const [nome,valores] of cenarios){
      aplicar(valores);
      saida.push([nome,rodar()]);
    }
  }finally{
    // valor restaurado mesmo após falha, como manda `bancada/lib/sweep.js`
    aplicar(PROJETO);
  }

  const controle=saida[0][1].contraste;
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" POTÊNCIA DOS CANAIS — quanto vale ACERTAR a leitura");
  console.log("══════════════════════════════════════════════════════════════\n");
  console.log("cenário                    rounds   CT acerta   contraste  (SE)   "+
    "CORRIGIDO   Plant%");
  console.log("─".repeat(94));
  for(const [nome,r] of saida){
    const corrigido=r.contraste-controle;
    const ehControle=nome.startsWith("CONTROLE");
    console.log(`${nome.padEnd(26)} ${String(r.rounds).padStart(6)}  `+
      `${r.acerto.toFixed(1).padStart(8)}%  `+
      `${r.contraste.toFixed(2).padStart(9)}  (${r.se.toFixed(2)})  `+
      `${(ehControle?"—":corrigido.toFixed(2)+" pp").padStart(9)}  `+
      `${r.plant.toFixed(2).padStart(7)}`);
  }
  const seControle=saida[0][1].se;
  console.log("\n── como ler ──");
  console.log(`  O controle mede o CONFUNDIMENTO: ${controle.toFixed(2)} pp ± ${seControle.toFixed(2)} `+
    `com os canais em 0.`);
  console.log("  Ele não é zero porque `ctAcertou` correlaciona com o estado do round.");
  console.log("  A coluna CORRIGIDO é a única que fala do canal; as outras falam de seleção.\n");
  const acertoMedio=saida[saida.length-1][1].acerto;
  const canal=saida[saida.length-1][1].contraste-controle;
  /* A base é o acaso: um CT que não sabe nada acerta 1/n. Ela mudou de 50% para
     16,7% quando `direcao` A|B virou o vocabulário de seis jogadas, e deixar o
     50 cravado aqui faria a conta mentir exatamente na fatia que a mudou. */
  const base=100/TIPOS_JOGADA.length;
  const leitura=acertoMedio-base;
  console.log("── transmissão total ──");
  console.log(`  acertar vale ${canal.toFixed(2)} pp de round, e o CT acerta ${acertoMedio.toFixed(1)}% `+
    `contra ${base.toFixed(1)}% de acaso.`);
  console.log(`  transmissão de round = ${leitura.toFixed(1)}×${canal.toFixed(2)}/100 = `+
    `${(leitura*canal/100).toFixed(4)} pp`);
  console.log(`  ampliada para o mapa (≈4× numa corrida a 13) ≈ `+
    `${(leitura*canal/100*4).toFixed(3)} pp de vitória de mapa.`);
  console.log("  Aumentar o GANHO do canal não resolve sozinho: o produto tem DOIS");
  console.log("  fatores, e o que estava travado em zero era o da esquerda.");
}

function main(){
  if(process.argv.includes("--canais")){
    CFG_TATICA.ATIVA=1;
    medirCanais(argInt("--rounds",110000));
    CFG_TATICA.ATIVA=0;
    return;
  }
  const mapasPorPar=argInt("--mapas",40);
  const comTatica=process.argv.includes("--tatica");
  CFG_TATICA.ATIVA=comTatica?1:0;
  /* Exploração: varrer os pesos da decisão SEM tocar no padrão do produto. É
     bancada — é para isso que ela existe. Nada aqui é escolha de balanceamento
     enquanto não houver medição que a justifique. */
  const varrer=(nome,chave)=>{
    const i=process.argv.indexOf(nome);
    if(i<0)return;
    const v=Number(process.argv[i+1]);
    if(Number.isFinite(v)){CFG_PLANO[chave]=v;console.log(`  [varredura] ${chave}=${v}`);}
  };
  varrer("--inercia-estrutura","INERCIA_ESTRUTURA");
  varrer("--inercia-base","INERCIA_BASE");
  varrer("--mix-leitura","MIX_LEITURA");
  varrer("--acerto-abertura","ACERTO_ABERTURA");

  const identidades=T.map(time=>teamIdentityRaw(time.jogadores));
  const medias=computeIdentityMeans(T.map(time=>time.jogadores));
  const zero=identidades.map(bruto=>{
    const saida={};
    for(const eixo of EIXOS)saida[eixo]=bruto[eixo]-medias[eixo];
    return saida;
  });

  const pares=[];
  let seed=1,mapas=0,roundsTaticos=0,acertosCT=0,execucoesFalhas=0;
  const diag=T.map(()=>({rounds:0,usou:0,semUsar:0,acertouUsando:0,acertouSemUsar:0,conf:0}));
  const porGap=[0,1,2].map(()=>({rounds:0,usou:0,acertou:0}));
  for(let i=0;i<T.length;i++){
    for(let j=i+1;j<T.length;j++){
      let vitoriasI=0;
      for(let m=0;m<mapasPorPar;m++){
        X.srand(seed++);
        // orientação alternada: metade dos mapas com i como time A
        const iComoA=m%2===0;
        const a=iComoA?T[i]:T[j],b=iComoA?T[j]:T[i];
        const fa=X.forcaDoDia(a.ef,a.quim),fb=X.forcaDoDia(b.ef,b.quim);
        const jogo=X.simularMapa({nome:a.nome,jogadores:a.jogadores},
          {nome:b.nome,jogadores:b.jogadores},fa,fb,null,true);
        const venceuA=jogo.placar[0]>jogo.placar[1];
        if(venceuA===iComoA)vitoriasI++;
        mapas++;
        for(const round of jogo.rounds){
          const t=round.tatica;
          if(!t)continue;
          roundsTaticos++;
          if(t.ctAcertou)acertosCT++;
          if(!t.executouA||!t.executouB)execucoesFalhas++;
          /* DIAGNÓSTICO: quem estava de CT usou a leitura, e acertou?
             Separa "a leitura não funciona" de "funciona e rende pouco". */
          const ctEhA=round.ladoA==="CT";
          const usouCT=ctEhA?t.usouA:t.usouB;
          const confCT=ctEhA?t.confA:t.confB;
          // quem está de CT e quem está de T neste round, na numeração do par
          const idCT=ctEhA===iComoA?i:j,idT=idCT===i?j:i;
          const d=diag[idCT];
          d.rounds++;d.conf+=confCT||0;
          if(usouCT){d.usou++;if(t.ctAcertou)d.acertouUsando++;}
          else{d.semUsar++;if(t.ctAcertou)d.acertouSemUsar++;}
          /* O QUE REALMENTE IMPORTA: a DIFERENÇA de leitura entre quem lê e quem
             é lido. CT quer coincidir e T quer divergir — isso é matching
             pennies, e entre iguais o equilíbrio é 50/50 com ganho zero por
             construção. Se a leitura vale alguma coisa, ela vale na assimetria. */
          const gap=zero[idCT].leitura-zero[idT].leitura;
          const faixa=gap>.25?0:gap<-.25?2:1;
          porGap[faixa].rounds++;
          if(usouCT){porGap[faixa].usou++;if(t.ctAcertou)porGap[faixa].acertou++;}
        }
      }
      const linha={i,j,taxa:vitoriasI/mapasPorPar,forca:T[i].ef-T[j].ef};
      for(const eixo of EIXOS)linha[eixo]=zero[i][eixo]-zero[j][eixo];
      pares.push(linha);
    }
  }

  const taxas=pares.map(p=>p.taxa),forcas=pares.map(p=>p.forca);
  const n=pares.length;

  console.log("══════════════════════════════════════════════════════════════");
  console.log(` BASELINE TÁTICO — ${n} pares × ${mapasPorPar} mapas = ${mapas} mapas`);
  console.log(` camada tática: ${comTatica?"LIGADA":"desligada"}`);
  console.log("══════════════════════════════════════════════════════════════\n");
  if(comTatica){
    if(!roundsTaticos){
      console.log("✗ a camada está ligada mas nenhum round registrou decisão — wiring quebrado\n");
      process.exitCode=1;return;
    }
    console.log(`decisões registradas: ${roundsTaticos} rounds · `+
      `CT acertou a leitura em ${(100*acertosCT/roundsTaticos).toFixed(1)}% · `+
      `execução falhou em ${(100*execucoesFalhas/roundsTaticos).toFixed(1)}%`);

    /* A pergunta que separa "não funciona" de "rende pouco": quem lê melhor
       APOSTA mais vezes, e quando aposta ACERTA mais? Se as duas respostas forem
       "não", o defeito é no mecanismo; se forem "sim", é na recompensa. */
    const ordenados=T.map((_,k)=>k).sort((x,y)=>zero[y].leitura-zero[x].leitura);
    const metade=Math.floor(T.length/2);
    const bloco=indices=>{
      const s=indices.reduce((acc,k)=>({rounds:acc.rounds+diag[k].rounds,usou:acc.usou+diag[k].usou,
        acertouUsando:acc.acertouUsando+diag[k].acertouUsando,
        acertouSemUsar:acc.acertouSemUsar+diag[k].acertouSemUsar,
        semUsar:acc.semUsar+diag[k].semUsar,conf:acc.conf+diag[k].conf}),
        {rounds:0,usou:0,acertouUsando:0,acertouSemUsar:0,semUsar:0,conf:0});
      return {taxaUso:100*s.usou/Math.max(1,s.rounds),
        acertoUsando:100*s.acertouUsando/Math.max(1,s.usou),
        acertoSemUsar:100*s.acertouSemUsar/Math.max(1,s.semUsar),
        confMedia:s.conf/Math.max(1,s.rounds)};
    };
    const alta=bloco(ordenados.slice(0,metade)),baixa=bloco(ordenados.slice(-metade));
    console.log("\n  como CT          usa a leitura   acerta apostando   acerta sem apostar   confiança média");
    for(const [rot,b] of [["leitura ALTA",alta],["leitura BAIXA",baixa]]){
      console.log(`  ${rot.padEnd(16)} ${b.taxaUso.toFixed(1).padStart(6)}%  `+
        `${b.acertoUsando.toFixed(1).padStart(13)}%  ${b.acertoSemUsar.toFixed(1).padStart(17)}%  `+
        `${b.confMedia.toFixed(3).padStart(14)}`);
    }
    const rotulos=["CT lê MUITO melhor","leitura parecida","CT lê MUITO pior"];
    console.log("\n  por DIFERENÇA de leitura   rounds     usa      acerta apostando");
    porGap.forEach((g,k)=>console.log(`  ${rotulos[k].padEnd(24)} ${String(g.rounds).padStart(8)}  `+
      `${(100*g.usou/Math.max(1,g.rounds)).toFixed(1).padStart(5)}%  `+
      `${(100*g.acertou/Math.max(1,g.usou)).toFixed(1).padStart(15)}%`));
    console.log("");
  }

  const rForca=correlacao(forcas,taxas);
  console.log(`força efetiva × taxa de vitória:  r = ${rForca.toFixed(3)}   `+
    `(o estimador funciona se este for claramente positivo)\n`);

  console.log("eixo            r bruto    r parcial (controlando força)   IC95%           veredito");
  console.log("─".repeat(92));
  const achados=[];
  for(const eixo of EIXOS){
    const xs=pares.map(p=>p[eixo]);
    const bruto=correlacao(xs,taxas);
    const parcial=correlacaoParcial(xs,taxas,forcas);
    const ic=icFisher(parcial,n);
    const nulo=contemZero(ic);
    if(!nulo)achados.push(eixo);
    console.log(`${eixo.padEnd(14)} ${bruto.toFixed(3).padStart(7)}    `+
      `${parcial.toFixed(3).padStart(9)}                  `+
      `[${ic[0].toFixed(3)}, ${ic[1].toFixed(3)}]`.padEnd(20)+
      (nulo?"nulo":"NÃO NULO"));
  }

  /* ROBUSTEZ. A taxa é limitada a [0,1]: pares muito desiguais encostam em 0 ou 1
     e achatam a correlação linear, o que pode fabricar ou esconder efeito. Se o
     sinal não sobreviver ao subconjunto SEM saturação, ele é artefato de escala,
     não achado. Uma medição só é achado quando resiste a ser remedida. */
  const semSaturar=pares.filter(p=>p.taxa>.08&&p.taxa<.92);
  const saturados=n-semSaturar.length;
  console.log(`\n── robustez: ${saturados} de ${n} pares saturam a taxa; `+
    `refazendo nos ${semSaturar.length} restantes ──`);
  if(semSaturar.length>=20){
    const taxasS=semSaturar.map(p=>p.taxa),forcasS=semSaturar.map(p=>p.forca);
    for(const eixo of EIXOS){
      const parcial=correlacaoParcial(semSaturar.map(p=>p[eixo]),taxasS,forcasS);
      const ic=icFisher(parcial,semSaturar.length);
      const antes=correlacaoParcial(pares.map(p=>p[eixo]),taxas,forcas);
      const mesmoSinal=Math.sign(parcial)===Math.sign(antes);
      console.log(`  ${eixo.padEnd(14)} ${parcial.toFixed(3).padStart(7)}  `+
        `[${ic[0].toFixed(3)}, ${ic[1].toFixed(3)}]`.padEnd(20)+
        (contemZero(ic)?"nulo":"NÃO NULO")+(mesmoSinal?"":"   ⚠ SINAL INVERTEU"));
    }
  }else console.log("  amostra insuficiente sem saturação — aumente --mapas");

  console.log("\n── prova sintética: o estimador sabe achar sinal quando ele existe? ──");
  /* Resultado FABRICADO com dependência conhecida de `leitura`, sobre a mesma
     estrutura de força dos pares reais. Se o estimador não recuperar isto, o
     zero das linhas acima não significa nada. */
  const fabricado=pares.map(p=>1/(1+Math.exp(-(0.25*p.forca+3.0*p.leitura))));
  const rFab=correlacaoParcial(pares.map(p=>p.leitura),fabricado,forcas);
  const icFab=icFisher(rFab,n);
  console.log(`  leitura × resultado fabricado:  r parcial = ${rFab.toFixed(3)} `+
    `[${icFab[0].toFixed(3)}, ${icFab[1].toFixed(3)}]`);
  const detecta=rFab>.5&&!contemZero(icFab);
  console.log(`  ${detecta?"✓":"✗"} o estimador ${detecta?"recupera":"NÃO recupera"} um sinal plantado — `+
    `${detecta?"o zero medido acima é informação":"a medição acima não vale nada"}`);

  console.log("\n── veredito ──");
  if(!detecta){
    console.log("  ✗ estimador não validado; não interprete as linhas acima.");
    process.exitCode=1;return;
  }
  if(achados.length===0){
    console.log("  Nenhum eixo de identidade tática explica o resultado depois de");
    console.log("  descontada a força. É o esperado: hoje o IGL só chega ao jogo");
    console.log("  pelo OVR, e não por ser IGL. Este é o ZERO contra o qual a");
    console.log("  camada tática vai ser medida.");
  }else{
    console.log(`  ATENÇÃO: ${achados.join(", ")} já explica(m) resultado hoje.`);
    console.log("  Isso significa que o eixo entra no jogo por outro caminho (força,");
    console.log("  química ou classificação). Entender por onde é pré-requisito de");
    console.log("  ligar a camada, senão o efeito seria contado duas vezes.");
  }
}

main();
