/* NARRAÇÃO AO VIVO — dupla de narradores sobre os rounds sorteados de um mapa.
   ══════════════════════════════════════════════════════════════════════════════

   CONTRATO, e ele é o que autoriza esta camada a existir. A §11-bis de
   `docs/project-context.md` proibia "placar ao vivo narrando a decisão do round"
   até 06/08/2026, e a emenda que abriu a exceção impõe três condições
   cumulativas. Duas são de UI; a terceira é DESTE arquivo:

     **o motor fica intocado.** Nada aqui consome o RNG da simulação, lê relógio,
     toca DOM ou muta o `registro`. O `random` é injetado pelo chamador e vem de
     um canal SEPARADO — usar o Mulberry32 da sessão deslocaria toda a
     simulação e quebraria golden e snapshot. A narração LÊ o round já decidido.

   POR QUE DUAS VOZES. Uma dupla real se divide em papéis: o narrador conta o que
   aconteceu (play-by-play), o comentarista explica por que aconteceu (color).
   Uma voz só vira legenda; duas viram conversa. O comentarista é o único que
   fala de mecanismo — é ele que carrega `registro.tatica`, e é por isso que a
   narração é opt-in.

   COMO O CONTEÚDO SE LIGA AO JOGO. Nada aqui é genérico: cada fala nasce de um
   campo do `registro` — `clutchX`/`clutchWon`, `destaque`, `plantado`, `troca`,
   a classe de compra dos dois times, o placar, e (com a camada tática ligada) o
   tipo de jogada, quem leu quem e se a jogada saiu como planejada. */

/** As duas vozes. `pbp` narra a ação; `cor` comenta o porquê. */
import {calloutsDe,pelo,no,pro,da} from "./map-callouts.mjs";

export const VOZ={PBP:"pbp",COR:"cor"};

/** Rótulo de cada tipo de jogada, na língua de quem narra — não no jargão do
    módulo. `TIPOS_JOGADA` é contrato de ordem em `play-style.mjs`; aqui só
    traduzimos, e um tipo desconhecido cai num rótulo neutro em vez de vazar o id. */
const JOGADA_LABEL={
  rush:"rush",executada:"jogada executada",default:"default",
  pick:"pick de AWP",split:"split",lurk:"lurk"
};
const rotuloJogada=id=>JOGADA_LABEL[id]||"a jogada deles";

const COMPRA_LABEL={
  eco:"eco",pistol:"pistol",force:"force buy",full:"full buy",awp:"full com AWP"
};
const rotuloCompra=c=>COMPRA_LABEL[c]||c;

/* Escolhe um item pelo `random` injetado. Sem `Math.random` aqui dentro: o
   chamador decide a fonte, e é isso que torna a narração reproduzível num teste. */
const escolher=(lista,random)=>lista[Math.floor(random()*lista.length)%lista.length];

/* ═══════ EMOÇÃO: QUAIS ROUNDS MERECEM PARAR O JOGO ═══════
   Contrato de 07/08/2026, nas palavras do responsável:

     "3 rounds narrados deve ser o limite. Não tem minimo, tudo depende do motor
      da simulação. […] um cara perder 1x3 nao é emocionante, emocionante é ele
      ganhar […] pq dai da esperança pro cara q ta assistindo, e a narração
      sempre com a emoção mais focado no time do usuario"

   Três consequências de desenho, e nenhuma é detalhe:

   1. **MÉRITO, NÃO SORTEIO.** Antes eu escolhia 3 a 5 rounds espalhados e narrava
      o que calhasse — por isso caía um 1v3 perdido, que é anticlímax. Agora cada
      round é PONTUADO e só os melhores sobem. A seleção virou determinística: não
      consome aleatoriedade nenhuma, e o mesmo mapa sempre destaca os mesmos
      momentos.
   2. **TETO DE 3, PISO DE ZERO.** Se o mapa foi morno, ninguém fala. Narrar um
      round sem graça só para cumprir cota é o que faz a transmissão soar
      artificial — e "tudo depende do motor" é literalmente isso.
   3. **O TIME DO USUÁRIO PESA MAIS.** A mesma jogada vale mais quando é o time
      dele: é a diferença entre torcer e assistir. Perder um clutch é o oposto de
      emocionante, então PONTUA NEGATIVO quando é ele quem perde. */
const PISO_EMOCAO=45;

export function pontuarRound(rd,ant,ctx){
  const f=lerRound(rd,ant,ctx);
  const meuVenceu=ctx.meuA!=null||ctx.meuB!=null
    ? (f.venceA?!!ctx.meuA:!!ctx.meuB)
    : null;                                  // sem dono: mapa entre dois adversários
  const meuPerdeuClutch=meuVenceu===false&&f.clutch&&!f.clutch.ganhou;
  let p=0;

  // ——— o que emociona, em ordem de peso ———
  if(f.clutch&&f.clutch.ganhou)p+=55+f.clutch.x*9;   // 1v1 = 64 · 1v4 = 91
  if(f.ace)p+=70;
  else if(f.multi===4)p+=48;
  else if(f.multi===3)p+=30;
  if(f.ecoVenceu&&f.ricoPerdeu)p+=34;               // roubo de round
  else if(f.ecoVenceu)p+=22;
  if(f.plantado&&f.clutch)p+=14;                    // bomba no chão aperta o clutch

  /* PLACAR APERTADO É ESPERANÇA. Round de 11-11 vale mais que 13-3: é onde o
     resultado ainda está em disputa e o espectador tem o que torcer. */
  const alto=Math.max(rd.pa,rd.pb),perto=Math.abs(rd.pa-rd.pb)<=2;
  if(alto>=11&&perto)p+=26;
  else if(alto>=11)p+=12;
  else if(perto)p+=6;

  // ——— o filtro do responsável: perder feio NÃO é momento ———
  if(meuPerdeuClutch)p-=40;
  if(meuVenceu===false)p=Math.round(p*0.55);        // derrota do usuário vale menos
  if(meuVenceu===true)p=Math.round(p*1.35);         // vitória dele vale mais

  return p;
}

/** Os melhores momentos do mapa: no máximo `max`, nenhum abaixo do piso, em
    ordem cronológica (a narração acompanha o jogo, não um ranking). */
export function escolherMomentos(rounds,ctx,{max=3,piso=PISO_EMOCAO}={}){
  if(!Array.isArray(rounds)||!rounds.length)return new Set();
  const notas=rounds.map((rd,i)=>({i,nota:i===0?0:pontuarRound(rd,rounds[i-1],ctx)}));
  return new Set(notas
    .filter(x=>x.nota>=piso)
    .sort((a,b)=>b.nota-a.nota||a.i-b.i)
    .slice(0,max)
    .map(x=>x.i)
    .sort((a,b)=>a-b));
}

/* O QUE ACONTECEU COM OS DEZ, e não só com o MVP.
   `snapA`/`snapB` trazem kills e mortes ACUMULADAS de cada jogador; a diferença
   contra o round anterior é o que aconteceu NESTE round. Sem esse delta a
   narração só conhece `destaque`, e aí todo round vira "fulano decidiu" — foi
   exatamente a crítica do responsável: "parece que uma pessoa tá matando bots".
   Com ele dá para dizer quem abriu, quem confirmou, quantos sobraram e se o
   round foi troca ou atropelo. */
function deltaLado(snap,snapAnt,nicks){
  if(!snap)return[];
  return snap.map((s,i)=>({
    nick:(nicks&&nicks[i])||`jogador ${i+1}`,
    k:s.k-((snapAnt&&snapAnt[i]&&snapAnt[i].k)||0),
    d:s.d-((snapAnt&&snapAnt[i]&&snapAnt[i].d)||0),
  }));
}
function lerRound(rd,ant,ctx){
  const venceA=!!rd.venceA;
  const vencedor=venceA?ctx.nomeA:ctx.nomeB;
  const perdedor=venceA?ctx.nomeB:ctx.nomeA;
  const compraVenc=venceA?rd.buyA:rd.buyB;
  const compraPerd=venceA?rd.buyB:rd.buyA;
  const t=rd.tatica||null;

  const dA=deltaLado(rd.snapA,ant&&ant.snapA,ctx.nicksA);
  const dB=deltaLado(rd.snapB,ant&&ant.snapB,ctx.nicksB);
  const dVenc=venceA?dA:dB, dPerd=venceA?dB:dA;
  const somaK=l=>l.reduce((s,p)=>s+Math.max(0,p.k),0);
  const mortos=l=>l.filter(p=>p.d>0).length;
  /* `toSorted` em vez de `[...x].sort()`: diz na assinatura que nada é mutado,
     em vez de depender de um spread defensivo que alguém pode remover achando
     que é redundante. O checador prova que a narração não muta o registro — esta
     é a versão da mesma garantia que se lê no código. */
  const ordenados=dVenc.toSorted((x,y)=>y.k-x.k);
  const topVenc=ordenados[0]?.k>0?ordenados[0]:null;
  const segundo=ordenados[1]?.k>0?ordenados[1]:null;
  const topPerd=dPerd.toSorted((x,y)=>y.k-x.k)[0];

  return{
    venceA,vencedor,perdedor,compraVenc,compraPerd,
    placar:`${rd.pa}-${rd.pb}`,
    ecoVenceu:compraVenc==="eco"||compraVenc==="pistol",
    forceVenceu:compraVenc==="force",
    ricoPerdeu:compraPerd==="full"||compraPerd==="awp",
    clutch:rd.clutchX>0?{x:rd.clutchX,ganhou:!!rd.clutchWon}:null,
    destaque:rd.destaque||null,
    plantado:!!rd.plantado,
    troca:!!rd.troca,
    /* Do lado que VENCEU: é dele que a narração fala, e misturar os dois lados
       numa frase só produz texto que não bate com o que a tela mostra. */
    jogada:t?(venceA?t.jogadaA:t.jogadaB):null,
    jogadaAdv:t?(venceA?t.jogadaB:t.jogadaA):null,
    executou:t?(venceA?t.executouA:t.executouB):null,
    leu:t?(venceA?t.usouA:t.usouB):null,
    // ——— o que o delta revelou ———
    temDelta:dVenc.length>0,
    top:topVenc,               // quem mais fragou no lado vencedor
    segundo,                   // o parceiro que confirmou
    topPerd:topPerd&&topPerd.k>0?topPerd:null,   // quem resistiu do lado que perdeu
    kVenc:somaK(dVenc),kPerd:somaK(dPerd),
    perdasVenc:mortos(dVenc),  // quantos do time vencedor caíram
    multi:topVenc&&topVenc.k>=3?topVenc.k:0,
    ace:!!(topVenc&&topVenc.k>=5),
    /* SEM SNAP NÃO HÁ CONCLUSÃO. `mortos([])` é 0, e um `<=1` ingênuo declarava
       "round limpo, zero baixas" para todo round de um mapa em modo leve — o
       ramo roubava a vez da fala tática e a narração ficava dizendo o contrário
       do que a tela mostrava. Ausência de dado não é dado. */
    limpo:dVenc.length>0&&mortos(dVenc)<=1,
  };
}

/* AS TRÊS VOZES DE ESTÚDIO SAÍRAM AQUI — 07/08/2026.
   `falaNarrador`, `falaComentarista` e `replica` descreviam o round de fora
   ("repara que o split não saiu como eles queriam"). O responsável recusou:
   "nada de analise, quero uma narracao em tempo real". O que ficou é `momento`,
   que conta o desenrolar em três tempos — onde, situação, desfecho.
   Os rótulos `rotuloJogada`/`rotuloCompra` continuam porque a situação ainda
   nomeia compra e jogada quando elas explicam o aperto do round. */

/* NARRAÇÃO É TEMPO REAL, NÃO ANÁLISE — 07/08/2026. O pedido veio com um exemplo
   que define tudo:

     "flame segue pelo duto e vai até o bomb B, é 1x4 com a bomba plantada […]
      Flame está com só 1 munição sobrando, e é hs, clutch perfeito de flame!"

   É o DESENROLAR de um momento, em ordem — não "repara que o split não saiu",
   que é estúdio e foi recusado. A sequência tem sempre três tempos:

     1. ONDE      — a jogada se arma, com callout do mapa real;
     2. SITUAÇÃO  — o aperto: quantos contra quantos, bomba no chão;
     3. DESFECHO  — quem resolveu, e como.

   O que cada tempo AFIRMA sai do `registro`. O cenário — nome de posição,
   munição contada, "no hs" — é cor de transmissão, e nunca contradiz o dado:
   quem não fez kill não ganha frag na narração. */
function momento(f,ctx,random){
  const cl=calloutsDe(ctx.mapa);
  const rota=escolher(cl.rotas,random);
  const bomb=escolher(cl.bomb,random);
  const heroi=f.top?f.top.nick:(f.destaque||null);
  const vitima=f.topPerd?f.topPerd.nick:null;
  const falas=[];

  // ——— 1. ONDE ———
  falas.push({voz:VOZ.PBP,texto:heroi
    ?escolher([
      `${heroi} sai ${pelo(rota)} com o time atrás…`,
      `A ${f.vencedor} vai ${pelo(rota)}, ${heroi} na frente…`,
      `Olha a movimentação ${pelo(rota)} — ${heroi} abrindo caminho…`,
      `${heroi} corta ${pelo(rota)} e vai ${pro(bomb)}…`,
    ],random)
    :escolher([
      `A ${f.vencedor} pressiona ${pelo(rota)}…`,
      `Movimento da ${f.vencedor} ${pelo(rota)}, buscando o ${bomb}…`,
    ],random)});

  // ——— 2. SITUAÇÃO ———
  if(f.clutch){
    const q=f.clutch.x;
    falas.push({voz:VOZ.COR,texto:f.plantado
      ?escolher([`E agora é 1v${q} com a bomba plantada ${no(bomb)}!`,
                 `Bomba no chão ${no(bomb)} e sobrou UM contra ${q}!`],random)
      :escolher([`Ficou 1v${q}! Um contra ${q}, sem bomba!`,
                 `É 1v${q} agora, o round todo nas costas dele!`],random)});
  }else if(f.plantado){
    falas.push({voz:VOZ.COR,texto:escolher([
      `Bomba plantada ${no(bomb)}! O CT tem que sair pra retomar!`,
      `Plantou ${no(bomb)}, e agora o relógio corre contra!`,
    ],random)});
  }else if(f.multi>=3){
    falas.push({voz:VOZ.COR,texto:escolher([
      `Ele pega um… pega dois… PEGA TRÊS ${no(bomb)}!`,
      `Tá limpando tudo! Um atrás do outro ${no(bomb)}!`,
    ],random)});
  }else if(vitima){
    falas.push({voz:VOZ.COR,texto:escolher([
      `${vitima} segura de frente, troca ${no(bomb)}!`,
      `${vitima} responde! Tá pegando fogo ${no(bomb)}!`,
    ],random)});
  }else if(f.ecoVenceu){
    falas.push({voz:VOZ.COR,texto:escolher([
      `E eles estão de ${rotuloCompra(f.compraVenc)}! Pistola contra rifle ${no(bomb)}!`,
      `Round de ${rotuloCompra(f.compraVenc)} e mesmo assim vão pra cima ${da(bomb)}!`,
    ],random)});
  }else if(f.jogada){
    /* Sem clutch, plant, multi-kill ou eco, quem dá forma ao momento é o TIPO DE
       JOGADA — e ele é dado do motor, não enfeite. Fica no ramo próprio, e não
       como terceira variante de um sorteio, senão o pedido "interligado com as
       táticas" só se cumpre por sorte. */
    falas.push({voz:VOZ.COR,texto:escolher([
      `É ${rotuloJogada(f.jogada)} da ${f.vencedor}, tudo ${pro(bomb)}!`,
      `Montam o ${rotuloJogada(f.jogada)} e vão de uma vez ${pro(bomb)}!`,
      `${rotuloJogada(f.jogada)} ${pelo(rota)} — a ${f.perdedor} tem que ler rápido!`,
    ],random)});
  }else{
    falas.push({voz:VOZ.COR,texto:escolher([
      `Trocam tiro ${no(bomb)}, ninguém recua!`,
      `Aperta ${no(bomb)}, a ${f.perdedor} tenta segurar!`,
      `Fecha o espaço ${no(bomb)}!`,
    ],random)});
  }

  // ——— 3. DESFECHO ———
  if(f.clutch&&f.clutch.ganhou&&heroi){
    falas.push({voz:VOZ.PBP,texto:escolher([
      `${heroi} com pouca munição… e é HEADSHOT! CLUTCH PERFEITO DO ${String(heroi).toUpperCase()}!`,
      `Último tiro… ACERTOU! Clutch de ${heroi}, inacreditável!`,
      `Ele vira, atira e ACABA! 1v${f.clutch.x} do ${heroi}! ${f.placar}!`,
    ],random)});
  }else if(f.clutch&&!f.clutch.ganhou){
    falas.push({voz:VOZ.PBP,texto:escolher([
      `Tenta o último… e não vai! A ${f.vencedor} fecha. ${f.placar}.`,
      `Chegou perto, mas caiu ${no(bomb)}. ${f.placar} pra ${f.vencedor}.`,
    ],random)});
  }else if(f.ace&&heroi){
    falas.push({voz:VOZ.PBP,
      texto:`E É ACE! OS CINCO PRO ${String(heroi).toUpperCase()}! Que round!`});
  }else if(f.multi>=3&&heroi){
    falas.push({voz:VOZ.PBP,texto:escolher([
      `${f.multi} kills do ${heroi} e a ${f.vencedor} leva! ${f.placar}!`,
      `Fechou com ${f.multi} do ${heroi}! ${f.placar}!`,
    ],random)});
  }else if(f.top&&f.segundo){
    falas.push({voz:VOZ.PBP,texto:escolher([
      `${f.top.nick} abre, ${f.segundo.nick} confirma e acabou! ${f.placar}.`,
      `Dois do ${f.top.nick}, ${f.segundo.nick} fecha a conta. ${f.placar}.`,
    ],random)});
  }else if(f.ecoVenceu){
    falas.push({voz:VOZ.PBP,
      texto:`E DE PISTOLA! A ${f.vencedor} rouba o round! ${f.placar}!`});
  }else if(f.troca){
    /* O round 13 é o único que não termina o assunto: ele fecha o primeiro
       tempo. Narrar a virada de lado é ao vivo — é o que a transmissão faz
       quando o placar zera de significado. */
    falas.push({voz:VOZ.PBP,texto:escolher([
      `Acabou o primeiro tempo! ${f.placar}, e agora invertem os lados!`,
      `Fim de primeira metade em ${f.placar} — trocam de lado e é jogo novo!`,
    ],random)});
  }else{
    falas.push({voz:VOZ.PBP,texto:escolher([
      `${heroi?heroi+" fecha":"A "+f.vencedor+" fecha"} e o round é da ${f.vencedor}. ${f.placar}.`,
      `Acabou! ${f.vencedor}, ${f.placar}.`,
    ],random)});
  }
  return falas;
}

/** `ant` é o round ANTERIOR — é dele que sai o delta de kills. Passar `null`
    degrada com elegância: a fala volta a usar `destaque` e placar. */
export function falasDoRound(rd,ant,ctx,random){
  return momento(lerRound(rd,ant,ctx),ctx,random);
}

/* A ABERTURA DE MAPA FOI REMOVIDA — 07/08/2026: "a partida ta abrindo com a
   narracao na tela nao quero isso". O mapa começa em silêncio; o palco só entra
   quando há um momento que mereça parar o jogo. Só o FECHAMENTO sobreviveu, e
   ele fala e sai de cena para liberar o placar. */
export function falaFechamento(ctx,placar,random){
  const [a,b]=placar;
  const venc=a>b?ctx.nomeA:ctx.nomeB;
  const apertado=Math.abs(a-b)<=2;
  return[{voz:VOZ.COR,texto:apertado
    ?escolher([`${venc} leva no detalhe, ${a}-${b}. Jogo que podia cair para qualquer lado.`,
               `${a}-${b}. Decidido no fio, e a ${venc} soube fechar.`],random)
    :escolher([`${venc} controla e fecha em ${a}-${b}.`,
               `${a}-${b} para a ${venc} — sem sustos no fim.`],random)}];
}
