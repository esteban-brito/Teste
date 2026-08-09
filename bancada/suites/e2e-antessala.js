/* bancada/suites/e2e-antessala.js — a antessala medida NA TELA.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE, e por que ela nasceu em 08/08/2026.

   A antessala é o PADRÃO DE DESIGN do jogo desde 07/08, e nesse dia ela ganhou
   foto de mapa, filtro de cor, lente de junção e bisel em todas as peças. No
   caminho eu cometi seis erros; quatro deles eram detectáveis por máquina e
   nenhum tinha guarda:

     1. `estiloDoMapa` emitia `url("…")` com ASPAS DUPLAS, e a string vai para
        dentro de `style="…"` por `innerHTML`. O parser de HTML fechava o
        atributo na primeira aspa e o elemento perdia o estilo INTEIRO — cor,
        ambiente e foto de uma vez. Nada lançava; o elemento só aparecia cru;
     2. o banho de cor de cada mapa estava na mesma camada da foto, e `filter`
        age no ELEMENTO inteiro: o `grayscale` dessaturava justamente a cor que
        identifica o mapa. Os três mapas de um MD3 chegavam cinza;
     3. as auroras coloridas estavam pintadas NA FRENTE do scrim, e é no topo
        que elas são mais fortes — exatamente onde vive a faixa de contexto. O
        contraste dos rótulos caiu para 1,69:1;
     4. `flex-basis` nos dois botões, num contêiner que tem largura de conteúdo,
        empilhou as duas ações num viewport de 1440px com 828px sobrando.

   O QUE TODOS TÊM EM COMUM: nenhum quebra nada. Não há exceção, não há 404, o
   fluxo avança e as outras suítes passam. São defeitos que só existem em PIXEL,
   e por isso a régua tem de ser o pixel — não o DOM.

   POR QUE OS SETE MAPAS. É a regra 46: defeito que depende de dado sorteado não
   aparece numa amostra. O erro 3 reprovava nos sete, mas o pior caso era Cache,
   que tem céu branco; medir só a tela que apareceu daria falso verde para os
   outros seis em metade dos casos.

   POR QUE TRÊS VIEWPORTS. Regra 39: numa guarda responsiva, o meio é que
   reprova. No celular as metades do palco empilham e o campo gira para 172°, e
   foi lá que a lente cruzou o nome do time — invisível no desktop.

   COMO ELA PODE FALHAR. A seção de provas sintéticas reintroduz cada um dos
   quatro defeitos, dentro da página, e exige que o auditor acuse. Guarda sempre
   verde passa por cobertura sem ser cobertura. Não remova essas provas. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {pathToFileURL}=require("url");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");
const {entrarNoMajor}=require("../lib/major");

const TELAS=[
  {nome:"desktop",width:1440,height:900},
  {nome:"tablet", width:760, height:1024},
  {nome:"celular",width:390, height:844},
];

const PISO_CONTRASTE=4.5;   // WCAG AA para texto normal
const PISO_FOTO=24;         // delta de canal com × sem a foto: abaixo disso ela não chega
const PISO_CROMA=10;        // separação de croma entre dois mapas na tela

function waitServer(port,tries=60){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/index.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

/* ── Ferramentas de pixel ──────────────────────────────────────────────────
   Sem lib de imagem no repositório: quem decodifica o PNG é o próprio
   navegador, num canvas. É a mesma escolha de `tools/build-map-art.js`. */
const NO_NAVEGADOR={
  /* Contraste do texto contra o fundo REAL atrás dele.
     A TINTA é a cor DECLARADA, e isto não é detalhe: num rótulo de 10px com
     tracking quase todo pixel é antialiasing parcial, e a média deles despenca,
     devolvendo um contraste que não existe. WCAG mede a cor do texto. O FUNDO,
     esse sim, vem do pixel — a faixa é vidro quase transparente sobre uma foto,
     e aí nenhuma cor declarada sabe o que está por baixo. */
  contraste:async ({comTexto,semTexto,alvos})=>{
    const ler=async b64=>{const i=new Image();i.src="data:image/png;base64,"+b64;await i.decode();return i;};
    const [ia,ib]=await Promise.all([ler(comTexto),ler(semTexto)]);
    const cv=document.createElement("canvas");cv.width=ia.width;cv.height=ia.height;
    const cx=cv.getContext("2d");
    cx.drawImage(ia,0,0);const da=cx.getImageData(0,0,cv.width,cv.height).data;
    cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(ib,0,0);
    const db=cx.getImageData(0,0,cv.width,cv.height).data;
    const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;};
    const L=(r,g,b)=>.2126*f(r)+.7152*f(g)+.0722*f(b);
    const razao=(x,y)=>{const [a,b]=x>y?[x,y]:[y,x];return (a+.05)/(b+.05);};
    let pior={c:Infinity,alvo:null,texto:""};
    for(const sel of alvos)for(const el of document.querySelectorAll(sel)){
      const bb=el.getBoundingClientRect();
      if(bb.width<2||bb.height<2)continue;
      const cs=getComputedStyle(el);
      if(cs.visibility==="hidden"||cs.display==="none")continue;
      const cor=(cs.color.match(/[\d.]+/g)||[]).map(Number);
      if(cor.length<3)continue;
      let fundo=[0,0,0],n=0;
      const y1=Math.min(cv.height,Math.round(bb.bottom)),x1=Math.min(cv.width,Math.round(bb.right));
      for(let y=Math.max(0,Math.round(bb.y));y<y1;y++)
        for(let x=Math.max(0,Math.round(bb.x));x<x1;x++){
          const i=(cv.width*y+x)<<2;
          if(da[i]===db[i]&&da[i+1]===db[i+1]&&da[i+2]===db[i+2]){
            fundo[0]+=db[i];fundo[1]+=db[i+1];fundo[2]+=db[i+2];n++;}
        }
      if(n<6)continue;
      const c=razao(L(cor[0],cor[1],cor[2]),L(fundo[0]/n,fundo[1]/n,fundo[2]/n));
      if(c<pior.c)pior={c:+c.toFixed(2),alvo:sel,texto:el.textContent.trim().slice(0,20)};
    }
    return pior;
  },
  /* Delta máximo de canal entre duas fotos, numa região. Serve para "a foto
     chega?" e para "o vidro trabalha?" — as duas perguntas que o ciclo de
     08/08 provou serem diferentes. */
  delta:async ({a,b,regiao})=>{
    const ler=async s=>{const i=new Image();i.src="data:image/png;base64,"+s;await i.decode();return i;};
    const [ia,ib]=await Promise.all([ler(a),ler(b)]);
    const cv=document.createElement("canvas");cv.width=ia.width;cv.height=ia.height;
    const cx=cv.getContext("2d");
    cx.drawImage(ia,0,0);const da=cx.getImageData(0,0,cv.width,cv.height).data;
    cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(ib,0,0);
    const db=cx.getImageData(0,0,cv.width,cv.height).data;
    let max=0;
    const y1=Math.min(cv.height,Math.round(regiao.y+regiao.h));
    const x1=Math.min(cv.width,Math.round(regiao.x+regiao.w));
    for(let y=Math.max(0,Math.round(regiao.y));y<y1;y++)
      for(let x=Math.max(0,Math.round(regiao.x));x<x1;x++){
        const i=(cv.width*y+x)<<2;
        const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]));
        if(d>max)max=d;
      }
    return max;
  },
  /* Cor média de uma região, para provar que dois mapas não chegam à tela
     iguais — o defeito 2, em que o filtro comia a cor de todos por igual. */
  corMedia:async ({b64,regiao})=>{
    const i=new Image();i.src="data:image/png;base64,"+b64;await i.decode();
    const cv=document.createElement("canvas");cv.width=i.width;cv.height=i.height;
    const cx=cv.getContext("2d");cx.drawImage(i,0,0);
    const d=cx.getImageData(Math.round(regiao.x),Math.round(regiao.y),
      Math.round(regiao.w),Math.round(regiao.h)).data;
    let r=0,g=0,b=0,n=0;
    for(let k=0;k<d.length;k+=4){r+=d[k];g+=d[k+1];b+=d[k+2];n++;}
    return [r/n,g/n,b/n];
  }
};

const foto=async page=>{await page.waitForTimeout(160);return (await page.screenshot()).toString("base64");};

/* Distância de croma entre duas cores: quanto elas diferem depois de tirada a
   luminância. Duas fotos podem ter o mesmo brilho e cores opostas — é a
   diferença de MATIZ que diz que os mapas se distinguem. */
function distanciaCroma(a,b){
  const croma=c=>[c[0]-(c[0]+c[1]+c[2])/3,c[1]-(c[0]+c[1]+c[2])/3,c[2]-(c[0]+c[1]+c[2])/3];
  const [x,y]=[croma(a),croma(b)];
  return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);
}

const ALVOS_TEXTO=[".pm-chip-r",".pm-chip-v",".pm-mapa-nome",".pm-name",
  ".pm-forca-leg",".pm-acao-sub",".pm-ef b"];

async function abrirAntessala(page,port){
  await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"networkidle"});
  await page.evaluate(()=>document.fonts.ready);
  await page.click("#randombtn");
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6",null,{timeout:20000});
  await page.evaluate(()=>window.__DRAFT9_E2E__.srand(20260729));
  await entrarNoMajor(page);
  await page.click("#suicaAvancar");
  await page.waitForSelector("#prematchStart",{state:"visible",timeout:20000});
  /* `waitForSelector` dá "visível" com `opacity:0` — regra 47. A antessala entra
     com transição, e medir antes devolve a tela inteira como lavada. Esperar o
     ESTADO que se vai medir, não o que o framework chama de pronto. */
  await page.waitForFunction(()=>getComputedStyle(document.getElementById("prematch")).opacity==="1",
    null,{timeout:8000}).catch(()=>{});
  await page.waitForTimeout(1500);
  await page.addStyleTag({content:`*,*::before,*::after{
    animation-play-state:paused!important;animation-delay:-10s!important;transition:none!important}`});
}

/* ── 1 · A FOTO CHEGA, E CADA MAPA CHEGA DIFERENTE ───────────────────────── */
async function provarAmbiente(page,estilos,achados,tela){
  const vestir=estilo=>page.evaluate(css=>{
    const el=document.getElementById("prematch");
    for(const par of css.split(";")){
      const i=par.indexOf(":");
      if(i>0)el.style.setProperty(par.slice(0,i).trim(),par.slice(i+1).trim());
    }
    /* O fundo é montado pelo produto a partir de `MATCH.mapas`; aqui a tela é
       revestida à mão para varrer o catálogo sem jogar sete partidas. A faixa
       herda as variáveis do `#prematch`, então basta limpar as dela. */
    for(const faixa of document.querySelectorAll(".pm-fundo-faixa"))
      faixa.setAttribute("style","--x0:-60%;--x1:160%");
  },estilo);

  /* A REGIÃO É MEDIDA, NÃO CRAVADA. A primeira versão amostrava um retângulo
     fixo no canto superior esquerdo — que no desktop é fundo puro e no celular
     cai dentro do scrim denso do topo, onde a foto é escurecida de propósito.
     A guarda acusava "foto ausente" nos sete mapas do celular por olhar o lugar
     errado. Aqui ela olha a faixa abaixo da ação, que é fundo em qualquer
     viewport. */
  const regiaoFundo=await page.evaluate(()=>{
    const modos=document.querySelector(".prematch-modos").getBoundingClientRect();
    const h=Math.max(60,Math.min(150,window.innerHeight-modos.bottom-24));
    return {x:16,y:Math.round(modos.bottom+12),w:Math.round(window.innerWidth-32),h:Math.round(h)};
  });
  const cores={};
  for(const [mapa,estilo] of Object.entries(estilos)){
    await vestir(estilo);
    const com=await foto(page);
    cores[mapa]=await page.evaluate(NO_NAVEGADOR.corMedia,{b64:com,regiao:regiaoFundo});

    /* A FOTO CHEGA? Compara com a mesma tela sem `--mapa-arte`. Foi este número
       que denunciou o `url("…")` quebrado: sem estilo aplicado o delta é ZERO. */
    const off=await page.addStyleTag({content:".pm-fundo-faixa::before{background-image:none!important}"});
    const sem=await foto(page);
    await off.evaluate(e=>e.remove());
    const d=await page.evaluate(NO_NAVEGADOR.delta,{a:com,b:sem,regiao:regiaoFundo});
    if(d<PISO_FOTO)achados.push({tela:tela.nome,mapa,tipo:"foto-ausente",
      detalhe:`a arte de ${mapa} muda só ${d}/255 na tela (piso ${PISO_FOTO}) — `
        +"estilo inline quebrado, asset faltando ou filtro cobrindo tudo"});

    /* CONTRASTE nos sete: o pior texto da tela contra o fundo real. */
    const escondido=await page.addStyleTag({content:
      ALVOS_TEXTO.join(",")+"{color:transparent!important;text-shadow:none!important}"});
    const semTexto=await foto(page);
    await escondido.evaluate(e=>e.remove());
    const pior=await page.evaluate(NO_NAVEGADOR.contraste,
      {comTexto:com,semTexto,alvos:ALVOS_TEXTO});
    if(pior.c<PISO_CONTRASTE)achados.push({tela:tela.nome,mapa,tipo:"contraste",
      detalhe:`"${pior.texto}" (${pior.alvo}) dá ${pior.c}:1 sobre ${mapa}, piso ${PISO_CONTRASTE}`});
  }

  /* CADA MAPA CHEGA DIFERENTE. `check-map-identity` já prova que as cores
     DECLARADAS se distinguem; isto prova que elas sobrevivem ao filtro, que é
     onde o defeito 2 morava — lá as sete chegavam cinza e a guarda de tokens
     continuava verde. */
  const nomes=Object.keys(cores);
  let pior={d:Infinity,par:null};
  for(let i=0;i<nomes.length;i++)for(let j=i+1;j<nomes.length;j++){
    const d=distanciaCroma(cores[nomes[i]],cores[nomes[j]]);
    if(d<pior.d)pior={d:+d.toFixed(1),par:`${nomes[i]}×${nomes[j]}`};
  }
  if(pior.d<PISO_CROMA)achados.push({tela:tela.nome,mapa:pior.par,tipo:"mapas-iguais",
    detalhe:`${pior.par} chegam à tela a ${pior.d} de croma (piso ${PISO_CROMA}) — `
      +"o filtro está comendo a cor que identifica o mapa"});
  return cores;
}

/* ── 2 · AS PEÇAS SÃO O MESMO OBJETO ─────────────────────────────────────── */
async function provarPecas(page,achados,tela){
  const r=await page.evaluate(()=>{
    const cx=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,top:b.top};};
    const acoes=[...document.querySelectorAll(".prematch-modos .roll")].map(cx);
    /* Raio de cada peça, para provar que a escala não voltou a divergir. */
    const raio=sel=>{const el=document.querySelector(sel);
      return el?parseFloat(getComputedStyle(el).borderTopLeftRadius):null;};
    /* O MATERIAL É UM SÓ NA TELA INTEIRA — regra 64, agora medida. Até
       09/08/2026 o nível `raso` declarava `saturate(1.9)` contra `1.4` dos
       outros dois, e a folha ainda escrevia `140%` num e `1.4` noutro: dois
       valores computados iguais em duas notações, mais um terceiro diferente.
       Três filtros são três materiais, e "cada bloco parece um liquid glass
       diferente" foi exatamente a crítica que criou este sistema. O que separa
       os níveis é a DENSIDADE do fundo, nunca o filtro. */
    const materiais=new Set();
    for(const el of document.querySelectorAll("#prematch *")){
      const f=getComputedStyle(el).backdropFilter;
      if(f&&f!=="none")materiais.add(f);
    }
    const lamina=getComputedStyle(document.querySelector(".pm-palco"),"::after").backdropFilter;
    if(lamina&&lamina!=="none")materiais.add(lamina);

    /* AS BORDAS VERTICAIS DOS BLOCOS EMPILHADOS. No celular a barra de ação
       tinha `max-width:320px` contra 358 de todo o resto: a única aresta fora de
       prumo da tela, e a captura mostrava o último bloco recuado sem motivo.
       Medir a folga de cada lado dentro do `.prematch` pega isso e pega também
       qualquer bloco que deixe de ser centrado. */
    const pm=document.getElementById("prematch").getBoundingClientRect();
    const blocos=[...document.getElementById("prematch").children]
      .filter(el=>!el.classList.contains("pm-fundo")&&!el.hasAttribute("hidden")
        &&el.getBoundingClientRect().height>0)
      .map(el=>{const b=el.getBoundingClientRect();
        return {nome:el.id?"#"+el.id:"."+[...el.classList][0],
          esq:+(b.left-pm.left).toFixed(1),dir:+(pm.right-b.right).toFixed(1),
          larg:+b.width.toFixed(1)};});

    return {
      acoes,materiais:[...materiais],blocos,
      raios:{
        lamina:raio(".pm-palco"),acao:raio(".prematch-modos .roll"),
        brasao:raio(".pm-lado .team-mono"),faixa:raio(".prematch-ctx"),
        veredito:raio(".pm-forca"),fechar:raio(".match-close")
      },
      rolagemH:document.documentElement.scrollWidth>window.innerWidth+1
    };
  });

  /* UM MATERIAL. */
  if(r.materiais.length>1)achados.push({tela:tela.nome,mapa:"—",tipo:"vidros-diferentes",
    detalhe:`${r.materiais.length} materiais de vidro na mesma tela `
      +`(${r.materiais.join(" | ")}) — o que separa os níveis é a densidade do fundo`});

  /* CADA BLOCO CENTRADO, e todos os empilhados com a MESMA largura no celular,
     onde a coluna é uma só. No desktop as larguras divergem de propósito — o
     palco é o herói e a moldura é mais estreita —, então ali só a centragem
     é cobrada. */
  for(const b of r.blocos)
    if(Math.abs(b.esq-b.dir)>1)achados.push({tela:tela.nome,mapa:"—",tipo:"bloco-descentrado",
      detalhe:`${b.nome} tem folga ${b.esq} à esquerda e ${b.dir} à direita`});
  if(tela.width<=640&&r.blocos.length>1){
    const larguras=[...new Set(r.blocos.map(b=>b.larg))];
    if(larguras.length>1)achados.push({tela:tela.nome,mapa:"—",tipo:"blocos-desalinhados",
      detalhe:`os blocos empilhados medem ${larguras.join(", ")}px — numa coluna só, `
        +`toda aresta vertical tem de bater (${r.blocos.map(b=>b.nome+":"+b.larg).join(" ")})`});
  }

  /* AS DUAS AÇÕES TÊM A MESMA CAIXA E A MESMA LINHA. Foi aqui que o
     `flex-basis` empilhou os botões com 828px sobrando: as larguras ficaram
     iguais e o `top` divergiu, então medir só a largura daria verde. */
  if(r.acoes.length===2){
    const [a,b]=r.acoes;
    if(Math.abs(a.w-b.w)>1)achados.push({tela:tela.nome,mapa:"—",tipo:"acoes-desiguais",
      detalhe:`as duas ações medem ${a.w.toFixed(1)} e ${b.w.toFixed(1)}px — mesmo nível, mesma caixa`});
    if(Math.abs(a.h-b.h)>1)achados.push({tela:tela.nome,mapa:"—",tipo:"acoes-desiguais",
      detalhe:`as duas ações têm alturas ${a.h.toFixed(1)} e ${b.h.toFixed(1)}px`});
    /* No celular elas empilham DE PROPÓSITO — largura cheia é a decisão certa
       num dedo. Fora dele, empilhar é o defeito. */
    if(tela.width>640&&Math.abs(a.top-b.top)>1)
      achados.push({tela:tela.nome,mapa:"—",tipo:"acoes-empilhadas",
        detalhe:`as ações quebraram linha em ${tela.width}px, com espaço de sobra`});
  }else achados.push({tela:tela.nome,mapa:"—",tipo:"acoes-ausentes",
    detalhe:`esperava 2 ações na antessala, achei ${r.acoes.length}`});

  /* A ESCALA DE RAIOS. Seis valores distintos foi o que a revisão externa
     chamou de "cada componente com sua própria regra de esquina" — o único
     item da crítica de 08/08 que procedia. Quatro é a escala declarada. */
  const distintos=[...new Set(Object.values(r.raios).filter(v=>v!==null&&v>0))];
  if(distintos.length>4)achados.push({tela:tela.nome,mapa:"—",tipo:"raios-divergentes",
    detalhe:`${distintos.length} raios distintos na tela (${distintos.sort((x,y)=>x-y).join(", ")}) — `
      +"a escala tem 4"});
  if(r.raios.acao!==null&&r.raios.brasao!==null&&Math.abs(r.raios.acao-r.raios.brasao)>0.6)
    achados.push({tela:tela.nome,mapa:"—",tipo:"raios-divergentes",
      detalhe:`ação (${r.raios.acao}px) e brasão (${r.raios.brasao}px) pousam na mesma lâmina `
        +"e têm de partilhar o raio derivado dela"});

  if(r.rolagemH)achados.push({tela:tela.nome,mapa:"—",tipo:"overflow",
    detalhe:"a antessala rola na horizontal"});
}

/* ── 3 · CAMPO E COSTURA SAEM DO MESMO NÚMERO ────────────────────────────
   Prova ESTÁTICA, sobre a folha. Foi o erro mais bobo do ciclo e o mais fácil
   de guardar: escrevi a variante da lente em `max-width:560px` com ângulo de
   195°, enquanto o empilhamento acontece em 640px com o campo em 172°. Os dois
   valores estavam no arquivo, a três telas de distância. */
function provarCoerenciaDaCostura(folhaCrua,achados){
  /* OS COMENTÁRIOS SAEM ANTES. Esta folha explica cada decisão em prosa, e
     `.pm-costura` aparece citada em vários comentários; o casador então pegava o
     texto do comentário e o PRÓXIMO bloco de regra, acusando um 140° que era o
     especular da lâmina. É a regra 44 pela segunda vez no mesmo arquivo — abrir
     o literal antes de escrever quem o lê. */
  const folha=folhaCrua.replace(/\/\*[\s\S]*?\*\//g,"");
  /* O seletor chega CRU e é escapado uma vez só. A primeira versão recebia o
     seletor já escapado e escapava de novo, então o padrão procurava `\\.` e
     nunca casava: a prova sintética passava verde num CSS deliberadamente
     quebrado. É a regra 44 — casador escrito antes de olhar o literal. */
  const angulos=alvo=>{
    const out=[];
    const re=new RegExp(alvo.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"[^{]*\\{[^}]*\\}","g");
    for(const bloco of folha.match(re)||[])
      for(const m of bloco.matchAll(/linear-gradient\(\s*(\d+)deg/g))out.push(Number(m[1]));
    return out;
  };
  const campo=new Set(angulos(".pm-palco::before"));
  const costura=new Set(angulos(".pm-costura"));
  for(const a of costura)if(!campo.has(a))
    achados.push({tela:"folha",mapa:"—",tipo:"costura-fora-de-eixo",
      detalhe:`a costura usa ${a}° e o campo não — os dois desenham a MESMA divisão `
        +`(campo: ${[...campo].join("°, ")}°)`});
  /* E os breakpoints em que cada um muda de eixo têm de ser os mesmos. */
  const larguras=trecho=>[...folha.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{/g)]
    .filter(m=>{
      const fim=folha.indexOf("\n}",m.index);
      return folha.slice(m.index,fim<0?undefined:fim).includes(trecho);
    }).map(m=>Number(m[1]));
  const bpCampo=new Set(larguras(".pm-palco::before"));
  for(const bp of new Set(larguras(".pm-costura")))if(!bpCampo.has(bp))
    achados.push({tela:"folha",mapa:"—",tipo:"costura-fora-de-eixo",
      detalhe:`a costura vira eixo em ${bp}px e o campo vira em ${[...bpCampo].join(", ")}px`});
}

/* ── PROVAS SINTÉTICAS ────────────────────────────────────────────────────
   Cada uma reintroduz um dos quatro defeitos reais de 08/08 e exige que o
   auditor acuse. Sem elas, uma guarda sempre verde passaria por cobertura. */
async function provasSinteticas(browser,port){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await ctx.newPage();
  await abrirAntessala(page,port);
  const tela={nome:"sintético",width:1440,height:900};
  const {estiloDoMapa}=await import(pathToFileURL(path.join(ROOT,"src/ui/shared/map-identity.mjs")).href);
  const doisMapas={Inferno:estiloDoMapa("Inferno"),Nuke:estiloDoMapa("Nuke")};

  /* 1 — a foto some (o defeito das aspas duplas, visto pelo efeito). */
  let quebra=await page.addStyleTag({content:".pm-fundo-faixa::before{background-image:none!important}"});
  let achados=[];
  await provarAmbiente(page,doisMapas,achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="foto-ausente"),
    "prova sintética · auditor acusa foto de mapa que não chega à tela");

  /* 2 — o filtro come a cor de todos por igual. */
  /* Mata as DUAS fontes de cor do mapa — a camada da faixa e as auroras da tela
     —, senão o croma sobrevive pelas auroras e a prova passa verde sem provar
     nada. Foi assim na primeira execução.
     A INJEÇÃO É AGNÓSTICA DE IMPLEMENTAÇÃO desde 09/08/2026, e a lição custou
     uma execução: ela apagava a cor com `background-image:none` na camada da
     faixa, o que funcionava enquanto aquilo era um gradiente. Quando a camada
     virou um gel de `mix-blend-mode` com background-COLOR, a linha deixou de
     apagar coisa alguma — a prova parou de injetar defeito e reprovou por não
     ter o que acusar. Hoje ela usa `grayscale(1)`, que é literalmente o defeito
     descrito pelo achado ("o filtro está comendo a cor que identifica o mapa") e
     não depende de qual propriedade produz a cor. Prova sintética que conhece a
     implementação envelhece junto com ela. */
  quebra=await page.addStyleTag({content:".pm-fundo{filter:grayscale(1)!important}"
    +".prematch[style*=\"--mapa-ceu\"]::after{background-image:none!important}"});
  achados=[];
  await provarAmbiente(page,doisMapas,achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="mapas-iguais"),
    "prova sintética · auditor acusa dois mapas que chegam iguais à tela");

  /* 3 — contraste de texto sobre a foto. */
  quebra=await page.addStyleTag({content:".pm-chip-r{color:#5a6472!important}"
    +".prematch-ctx{background:transparent!important}"});
  achados=[];
  await provarAmbiente(page,{Cache:estiloDoMapa("Cache")},achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="contraste"),
    "prova sintética · auditor acusa texto abaixo de 4,5:1 sobre a foto");

  /* 4 — as duas ações com caixas diferentes. */
  quebra=await page.addStyleTag({content:"#prematchStart{min-width:120px!important}"});
  achados=[];
  await provarPecas(page,achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="acoes-desiguais"),
    "prova sintética · auditor acusa as duas ações com caixas diferentes");

  /* 5 — raio fora da escala. */
  quebra=await page.addStyleTag({content:".pm-lado .team-mono{border-radius:31px!important}"});
  achados=[];
  await provarPecas(page,achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="raios-divergentes"),
    "prova sintética · auditor acusa raio fora da escala");

  /* 6 — um segundo material de vidro na mesma tela. */
  quebra=await page.addStyleTag({content:".prematch-ctx{backdrop-filter:blur(3px) saturate(3)!important;"
    +"-webkit-backdrop-filter:blur(3px) saturate(3)!important}"});
  achados=[];
  await provarPecas(page,achados,tela);
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="vidros-diferentes"),
    "prova sintética · auditor acusa dois materiais de vidro na mesma tela");

  /* 7 — um bloco fora do prumo da coluna. */
  quebra=await page.addStyleTag({content:".prematch-modos{max-width:200px}"});
  achados=[];
  await provarPecas(page,achados,{...tela,width:390});
  await quebra.evaluate(e=>e.remove());
  check(achados.some(a=>a.tipo==="blocos-desalinhados"),
    "prova sintética · auditor acusa bloco mais estreito que a coluna");

  /* 8 — a costura num eixo que o campo não usa (prova estática). */
  achados=[];
  provarCoerenciaDaCostura(".pm-palco::before{background:linear-gradient(105deg,red,blue)}"
    +".pm-costura{background:linear-gradient(195deg,red,blue)}",achados);
  check(achados.some(a=>a.tipo==="costura-fora-de-eixo"),
    "prova sintética · auditor acusa costura em eixo diferente do campo");

  /* E volta ao verde: o auditor tem de saber dizer que não há defeito. */
  achados=[];
  await provarPecas(page,achados,tela);
  check(achados.length===0,"auditoria volta ao verde depois das provas sintéticas");
  await ctx.close();
}

(async()=>{
  const port=7000+Math.floor(Math.random()*300);   // 6000 é ERR_UNSAFE_PORT no Chromium
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());

    const {MAPA_MARCA,estiloDoMapa}=
      await import(pathToFileURL(path.join(ROOT,"src/ui/shared/map-identity.mjs")).href);
    const estilos=Object.fromEntries(Object.keys(MAPA_MARCA).map(m=>[m,estiloDoMapa(m)]));

    const achados=[];
    const folha=require("fs").readFileSync(path.join(ROOT,"style.css"),"utf8");
    provarCoerenciaDaCostura(folha,achados);

    for(const tela of TELAS){
      const ctx=await browser.newContext({viewport:{width:tela.width,height:tela.height},deviceScaleFactor:1});
      const page=await ctx.newPage();
      await abrirAntessala(page,port);
      await provarAmbiente(page,estilos,achados,tela);
      await provarPecas(page,achados,tela);
      await ctx.close();
    }

    for(const a of achados)console.log(`    ✗ [${a.tela}/${a.mapa}] ${a.tipo} — ${a.detalhe}`);
    check(achados.length===0,
      `antessala íntegra em ${TELAS.length} viewports × ${Object.keys(estilos).length} mapas `
      +`(${achados.length} achado(s))`);

    await provasSinteticas(browser,port);

    console.log(failures?`✗ ${failures} checagem(ns) da antessala falharam`
      :"✓ antessala: foto chega, mapas se distinguem, texto legível e peças no mesmo sistema");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ suíte abortou: "+(error.message||error));
    console.log("✗ e2e da antessala falhou");
    return done(1);
  }
})();
