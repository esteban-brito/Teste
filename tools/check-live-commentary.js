/* Guarda da narração ao vivo — `src/domain/narrative/live-commentary.mjs`.

   A emenda de 06/08/2026 da §11-bis autoriza a narração sob TRÊS condições
   cumulativas. Uma delas é técnica e é aqui que ela se prova: **o motor fica
   intocado**. As outras duas (opt-in e modo limpo) vivem no E2E, porque são de UI.

   Sem esta guarda, a narração poderia começar a consumir o RNG da simulação — e
   o sintoma disso não seria um texto errado, seria TODO resultado do jogo mudar,
   com golden e snapshot quebrando longe da causa. */
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {ROOT}=require("../bancada/lib/common");

const ARQ=path.join(ROOT,"src","domain","narrative","live-commentary.mjs");
/* Analisa CÓDIGO, não prosa. O arquivo explica no cabeçalho por que não usa
   `Math.random`, e a primeira versão desta guarda reprovou por causa da própria
   explicação. Comentário é onde o contrato é registrado — varrer o texto cru
   transformaria documentar a regra em violá-la. */
const semComentarios=txt=>txt
  .replace(/\/\*[\s\S]*?\*\//g,"")
  .replace(/(^|[^:])\/\/.*$/gm,"$1");
const fonte=semComentarios(fs.readFileSync(ARQ,"utf8"));

(async()=>{
  const mod=await import("file://"+ARQ.replace(/\\/g,"/"));
  const {escolherMomentos,pontuarRound,falasDoRound,falaFechamento,VOZ}=mod;

  /* ── 1. O MOTOR FICA INTOCADO ─────────────────────────────────────────────
     Provado pela FONTE, não por execução: um `Math.random` só dispara quando o
     caminho que o contém roda, e um teste não visita todos. */
  assert.ok(!/Math\.random/.test(fonte),
    "live-commentary usa Math.random — a fonte de aleatoriedade tem de ser INJETADA");
  assert.ok(!/\bsrand\b|mulberry|rndF|\brnd\(/i.test(fonte),
    "live-commentary tocou o RNG da simulação; isso deslocaria todos os resultados");
  assert.ok(!/from\s+["'].*(simulation|tactics|evaluation)/.test(fonte),
    "live-commentary importou o motor; ela deve LER o registro, não recalculá-lo");
  assert.ok(!/document|window|localStorage|Date\.now|new Date/.test(fonte),
    "live-commentary tocou DOM ou relógio; ela é domínio puro");

  /* ── 2. EMOÇÃO: até 3 momentos, nenhum morno, e o time do usuário pesa ───
     Contrato de 07/08/2026: "3 rounds narrados deve ser o limite. Não tem
     minimo, tudo depende do motor […] um cara perder 1x3 nao é emocionante". */
  const rd=(o={})=>({r:5,pa:6,pb:5,venceA:true,ladoA:"CT",ladoB:"TR",troca:false,
    plantado:false,buyA:"full",buyB:"full",clutchX:0,clutchWon:null,destaque:"ZywOo",...o});
  const meuA={nomeA:"Vitality",nomeB:"NAVI",mapa:"Nuke",meuA:true,meuB:false};

  // TETO de 3, mesmo num mapa cheio de clutches
  const cheio=Array.from({length:24},(_,i)=>rd({r:i+1,clutchX:3,clutchWon:true,pa:i,pb:i}));
  assert.ok(escolherMomentos(cheio,meuA).size<=3,
    `teto de 3 momentos furado (${escolherMomentos(cheio,meuA).size})`);

  // PISO ZERO: mapa morno não narra nada
  const morno=Array.from({length:24},(_,i)=>rd({r:i+1,pa:i,pb:2}));
  assert.equal(escolherMomentos(morno,meuA).size,0,
    "mapa sem momento nenhum ainda assim narrou — o mínimo tem de ser ZERO");

  // A PISTOL nunca entra: não há round anterior de onde tirar o delta
  assert.ok(!escolherMomentos(cheio,meuA).has(0),"a pistol (índice 0) não pode ser um momento");

  /* O FILTRO DO RESPONSÁVEL: perder um clutch NÃO é momento; ganhar é. */
  const perdido=rd({clutchX:3,clutchWon:false,venceA:false});
  const ganho=rd({clutchX:3,clutchWon:true,venceA:true});
  assert.ok(pontuarRound(ganho,rd(),meuA)>pontuarRound(perdido,rd(),meuA),
    "clutch perdido pelo usuário pontuou tanto quanto um ganho");
  assert.ok(pontuarRound(perdido,rd(),meuA)<45,
    "1v3 PERDIDO pelo usuário passaria o piso — é exatamente o anticlímax recusado");

  /* O TIME DO USUÁRIO PESA MAIS: a mesma jogada vale mais quando é dele. */
  const meuB={...meuA,meuA:false,meuB:true};
  assert.ok(pontuarRound(ganho,rd(),meuA)>pontuarRound(ganho,rd(),meuB),
    "a mesma jogada deveria valer mais para o time do usuário");

  /* PLACAR APERTADO É ESPERANÇA: 11-11 vale mais que o mesmo lance em 11-3. */
  const apertado=rd({clutchX:2,clutchWon:true,pa:11,pb:11});
  const folgado=rd({clutchX:2,clutchWon:true,pa:11,pb:3});
  assert.ok(pontuarRound(apertado,rd(),meuA)>pontuarRound(folgado,rd(),meuA),
    "round apertado não valeu mais que o folgado");

  /* DETERMINÍSTICO: a seleção não consome aleatoriedade — mesmo mapa, mesmos
     momentos, sempre. É o que permite reproduzir um relato depois. */
  const a=[...escolherMomentos(cheio,meuA)].join(","),b=[...escolherMomentos(cheio,meuA)].join(",");
  assert.equal(a,b,"a seleção de momentos variou entre duas chamadas");
  assert.ok(!/escolherMomentos[\s\S]{0,400}random/.test(fonte),
    "escolherMomentos passou a depender de aleatoriedade");

  // ordem CRONOLÓGICA: a narração acompanha o jogo, não um ranking
  const ordem=[...escolherMomentos(cheio,meuA)];
  assert.deepEqual(ordem,ordem.toSorted((x,y)=>x-y),"momentos vieram fora de ordem cronológica");

  // entrada degenerada não quebra
  assert.equal(escolherMomentos([],meuA).size,0,"lista vazia devolveu momentos");
  assert.equal(escolherMomentos(null,meuA).size,0,"lista nula quebrou a seleção");

  /* ── 3. AS FALAS SAEM DO DADO, não de um saco genérico ───────────────────── */
  const ctx={nomeA:"Vitality",nomeB:"NAVI",mapa:"Ancient"};
  const base={r:5,pa:3,pb:2,venceA:true,ladoA:"CT",ladoB:"TR",troca:false,plantado:false,
    buyA:"full",buyB:"full",clutchX:0,clutchWon:null,destaque:"ZywOo"};
  const texto=(rd,rand=()=>0,ant=null)=>falasDoRound(rd,ant,ctx,rand).map(f=>f.texto).join(" | ");

  assert.match(texto({...base,clutchX:3,clutchWon:true}),/1v3|contra 3/,
    "clutch vencido não virou fala de clutch");
  assert.match(texto({...base,clutchX:3,clutchWon:true}),/ZywOo/,
    "clutch vencido não nomeou o destaque do round");
  assert.match(texto({...base,buyA:"eco"}),/ECO|eco/,"round de eco não foi narrado como eco");
  assert.match(texto({...base,troca:true,r:13}),/tempo|lados|inverte/i,
    "troca de lado não foi narrada");
  assert.match(texto({...base,tatica:{jogadaA:"rush",jogadaB:"default",usouA:true,executouA:true}}),
    /rush|default/,"a jogada do round não apareceu no comentário");
  assert.match(texto({...base,plantado:true}),/[Bb]omba|plant|relógio/,
    "plant não apareceu em nenhuma das duas vozes");

  /* ── 3-ter. É NARRAÇÃO AO VIVO, NÃO ESTÚDIO ───────────────────────────────
     Contrato de 07/08/2026: "nada de analise, quero uma narracao em tempo real".
     A fala conta o desenrolar — onde, situação, desfecho — e nunca comenta a
     jogada de fora. */
  const proibido=/repara que|isso não é sorte|diz muito sobre|na prática|o problema d[ao]|qualidade individual/i;
  for(const rd of [base,{...base,clutchX:2,clutchWon:true},{...base,buyA:"eco"},
                   {...base,plantado:true},{...base,tatica:{jogadaA:"rush",jogadaB:"lurk"}}]){
    for(let i=0;i<10;i++){
      const t=texto(rd,()=>i/10);
      assert.ok(!proibido.test(t),`voltou linguagem de análise: "${t.slice(0,90)}"`);
    }
  }
  /* CALLOUT DO MAPA: a narração situa a jogada num lugar real do mapa jogado.
     Sem isso ela vira "a equipe pressiona" — genérica, que foi a crítica. */
  const porMapa=m=>falasDoRound(base,null,{...ctx,mapa:m},()=>0).map(f=>f.texto).join(" ");
  assert.match(porMapa("Nuke"),/outside|rampa|duto|lobby|secret|garagem|bomb/i,
    "narração em Nuke não usou nenhum callout da Nuke");
  assert.match(porMapa("Inferno"),/banana|apartamento|biblioteca|arco|pátio|\bA\b|\bB\b/i,
    "narração em Inferno não usou nenhum callout do Inferno");
  // mapa fora do pool não quebra nem vaza id
  const desconhecido=porMapa("MapaQueNãoExiste");
  assert.ok(desconhecido.length>20&&!/undefined/.test(desconhecido),
    "mapa fora do pool quebrou a narração");

  /* PORTUGUÊS: PREPOSIÇÃO CONTRAÍDA. Os callouts guardam o artigo junto ("a
     garagem", "o meio"), porque o gênero é do LUGAR e quem escreve a fala não
     deveria ter de lembrar dele. O preço é que a frase precisa contrair —
     `pelo()`, `no()`, `pro()`, `da()`. Sem isso saiu "por a garagem" e "no o A"
     na primeira execução, e nada acusou: o texto estava lá, só era português
     quebrado. Esta prova varre TODOS os mapas do pool e todas as variantes. */
  const errosPT=/\b(por|de|em|para|pra|pro)\s+(a|o)\s|\bn[ao]\s+[ao]\s|\bpel[ao]\s+[ao]\s|\bd[ao]\s+[ao]\s/i;
  for(const m of ["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Cache","Desconhecido"]){
    for(const rd of [base,{...base,clutchX:2,clutchWon:true,plantado:true},
                     {...base,buyA:"eco"},{...base,tatica:{jogadaA:"split",jogadaB:"rush"}}]){
      for(let i=0;i<12;i++){
        const t=falasDoRound(rd,null,{...ctx,mapa:m},()=>i/12).map(f=>f.texto).join(" | ");
        assert.ok(!errosPT.test(t),`preposição sem contração em ${m}: "${t.slice(0,100)}"`);
      }
    }
  }

  /* TRÊS TEMPOS, nesta ordem: quem narra abre a jogada, a situação aperta, e o
     desfecho fecha. É o que separa "contar o momento" de "listar fatos". */
  const tempos=falasDoRound({...base,clutchX:3,clutchWon:true,plantado:true},null,ctx,()=>0);
  assert.equal(tempos.length,3,`o momento deve ter três tempos (veio ${tempos.length})`);
  assert.match(tempos[1].texto,/1v3/,"o segundo tempo deve estabelecer a SITUAÇÃO (1vX)");
  assert.match(tempos[2].texto,/CLUTCH|clutch|ACERTOU|ACABA/i,"o terceiro tempo deve ser o DESFECHO");

  /* ── 3-bis. O ROUND É CONTADO PELOS DEZ, não por um nome ──────────────────
     Crítica do responsável: "parece que uma pessoa tá matando bots". A narração
     tem de nascer do DELTA de kills entre este round e o anterior — quem abriu,
     quem confirmou, quem resistiu do outro lado. */
  const ctxN={...ctx,nicksA:["ZywOo","apEX","flameZ","mezii","Spinx"],
    nicksB:["s1mple","b1t","Aleksib","jL","iM"]};
  const comSnap=(kA,kB,dA,dB)=>({...base,
    snapA:kA.map((k,i)=>({k,d:dA[i]})),snapB:kB.map((k,i)=>({k,d:dB[i]}))});
  const antZero={snapA:[0,0,0,0,0].map(()=>({k:0,d:0})),snapB:[0,0,0,0,0].map(()=>({k:0,d:0}))};
  const falarCom=(rd,rand=()=>0)=>falasDoRound(rd,antZero,ctxN,rand).map(f=>f.texto).join(" | ");

  const ace=falarCom(comSnap([5,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1]));
  assert.match(ace,/ACE|CINCO|cinco/,"5 kills num round não viraram ace");
  assert.match(ace,/ZywOo/i,"o ace não nomeou quem fez");

  const tres=falarCom(comSnap([3,0,0,0,0],[1,0,0,0,0],[0,1,0,0,0],[1,1,1,0,0]));
  assert.match(tres,/[Tt]rês|[Tt]riplo|3/,"multi-kill de 3 não foi narrado como tal");

  /* DOIS NOMES, não um: é a diferença entre "fulano decidiu" e contar o round. */
  const dupla=falarCom(comSnap([2,2,0,0,0],[1,0,0,0,0],[0,0,1,0,0],[1,1,1,1,0]));
  const nomesCitados=ctxN.nicksA.filter(n=>dupla.includes(n)).length;
  assert.ok(nomesCitados>=2,
    `round com dois protagonistas citou ${nomesCitados} nome(s) — a narração ainda fala de um jogador só`);

  /* O adversário também existe: quem resistiu do lado que perdeu tem nome. */
  const trocacao=falarCom(comSnap([2,0,0,0,0],[2,0,0,0,0],[0,1,1,0,0],[1,1,0,0,0]));
  const citouB=ctxN.nicksB.some(n=>trocacao.includes(n));
  assert.ok(citouB,"round de trocação não citou ninguém do time que perdeu");

  // sem snap, degrada com elegância em vez de inventar
  const semSnap=falarCom({...base});
  assert.ok(semSnap.length>20&&!/undefined|NaN/.test(semSnap),
    "round sem snap produziu fala quebrada em vez de degradar");

  /* ── 4. SEMPRE AS DUAS VOZES, e o comentarista é quem carrega o mecanismo ── */
  /* SEMPRE OS TRÊS TEMPOS, e a alternância das vozes é o que faz soar dupla:
     o narrador abre a jogada, o parceiro grita a situação, o narrador fecha. */
  const falas=falasDoRound(base,null,ctx,()=>0.5);
  assert.equal(falas.length,3,`o momento tem três tempos (veio ${falas.length})`);
  assert.equal(falas[0].voz,VOZ.PBP,"o primeiro tempo (ONDE) é do narrador");
  assert.equal(falas[1].voz,VOZ.COR,"o segundo tempo (SITUAÇÃO) é do parceiro");
  assert.equal(falas[2].voz,VOZ.PBP,"o terceiro tempo (DESFECHO) volta ao narrador");
  assert.ok(falas.every(f=>f.texto&&f.texto.trim().length>8),"fala vazia ou curta demais");
  /* O primeiro tempo ARMA a jogada — termina em reticências, não em ponto final:
     é o que sustenta a tensão até o desfecho chegar. */
  assert.match(falas[0].texto,/…$/,"o primeiro tempo deveria deixar a jogada em suspenso");

  /* ── 5. DETERMINISMO e NÃO-MUTAÇÃO ──────────────────────────────────────── */
  const congelado=JSON.stringify(base);
  const a1=texto(base,()=>0.42),a2=texto(base,()=>0.42);
  assert.equal(a1,a2,"mesma fonte de aleatoriedade deu falas diferentes");
  assert.equal(JSON.stringify(base),congelado,"a narração MUTOU o registro do round");

  /* ── 6. VARIEDADE: não pode ser sempre a mesma frase ────────────────────── */
  const vistos=new Set();
  for(let i=0;i<12;i++)vistos.add(falasDoRound(base,null,ctx,()=>i/12).map(f=>f.texto).join("|"));
  assert.ok(vistos.size>=3,`narração repetitiva: ${vistos.size} variantes em 12 sorteios`);

  /* ── 7. ABERTURA E FECHAMENTO existem (e só o modo com narração os usa) ─── */
  /* NÃO HÁ MAIS ABERTURA. "a partida ta abrindo com a narracao na tela nao
     quero isso" — o mapa começa em silêncio e o palco só entra quando há
     momento que valha. */
  assert.equal(typeof mod.falaAbertura,"undefined","a fala de abertura voltou a existir");
  assert.match(falaFechamento(ctx,[13,11],()=>0)[0].texto,/13-11/,"fechamento não cita o placar");
  assert.match(falaFechamento(ctx,[13,11],()=>0)[0].texto,/detalhe|fio/i,
    "placar apertado não foi tratado como apertado");

  console.log("live commentary: ok (motor intocado · até 3 momentos por MÉRITO · piso zero · "+
    "time do usuário pesa · três tempos · callouts do mapa · português contraído)");
})().catch(e=>{console.error("check-live-commentary:",e.message);process.exit(1);});
