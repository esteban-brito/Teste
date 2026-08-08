/* bancada/lib/arrasto.js — o gesto de arrastar carta, em UM lugar só.

   POR QUE EXISTE. Escalar uma carta virou arrasto em 06/08/2026, e o gesto
   sintético foi copiado para três arquivos: `e2e-acessibilidade.js`,
   `e2e-game-flow.js` e `tools/visual-regression.js`. Quando a corrida de
   `requestAnimationFrame` da regra 41 foi corrigida, a correção teve de ser
   escrita DUAS vezes — e a terceira cópia, que usa outra estratégia, ficou de
   fora sem que nada acusasse. Três cópias de um gesto são três verdades sobre
   ele.

   POR QUE DUAS ESTRATÉGIAS, E NÃO UMA. Elas provam coisas diferentes:

     `porAutoRolagem` deixa a AUTO-ROLAGEM DO PRODUTO trazer o destino. É o gesto
     real do dedo no celular, onde carta e slot não cabem na mesma tela — medido,
     1.266 px de vão numa janela de 844 —, e de quebra é a única prova de que
     essa auto-rolagem existe: sem ela o laço nunca converge.

     `centralizando` rola a PÁGINA por script até enquadrar os dois antes de
     medir, e só então arrasta em linha reta. Não exercita a auto-rolagem, mas é
     imune ao vão e ao relógio, e por isso é a escolha certa quando o arrasto é
     meio para chegar a outro estado, não o objeto do teste.

   Unificar as duas em uma só trocaria uma cobertura pela outra. O que estava
   errado não era existirem duas estratégias: era existirem três implementações. */

/* SEM `steps` NO PONTEIRO. O Chromium COALESCE `pointermove`: com `steps:4`
   chegava um único evento, e justamente o primeiro — a 7,2 px, abaixo do limiar
   de 8 —, então o arrasto não começava. Medido: 4 eventos numa rodada, 1 na
   seguinte, o que fazia a suíte falhar de forma intermitente e parecer bug de
   produto. Dois movimentos discretos, cada um já além do limiar, não dependem
   de quantos o navegador resolve entregar.

   E O PONTEIRO É DE TOQUE. Duas das três telas rodam com `isMobile`/`hasTouch`,
   e ali `page.mouse` não reproduz o gesto do dedo. O produto ouve PONTEIRO, que
   é agnóstico de dispositivo. A fidelidade com ponteiro de mouse continua
   provada em `e2e-cartas.js`. */

/* Roda DENTRO da página. String porque precisa ser injetada por `evaluate` nos
   três consumidores sem que cada um redeclare o gesto. */
const GESTO_AUTO_ROLAGEM=`async ({o,d})=>{
  const a=document.querySelector(o);
  if(!a||!document.querySelector(d))throw new Error("arrasto sem alvo: "+o+" → "+d);
  const p=(tipo,x,y)=>a.dispatchEvent(new PointerEvent(tipo,{bubbles:true,cancelable:true,
    clientX:x,clientY:y,pointerId:1,pointerType:"touch",isPrimary:true,
    button:0,buttons:tipo==="pointerup"?0:1}));
  const quadro=()=>new Promise(r=>requestAnimationFrame(r));
  const caixaDestino=()=>document.querySelector(d).getBoundingClientRect();
  const ra=a.getBoundingClientRect();
  const x0=ra.left+ra.width/2,y0=ra.top+ra.height/2;
  p("pointerdown",x0,y0);
  p("pointermove",x0+30,y0+20);        // já além do limiar de 8px

  /* CONTA PROGRESSO, NÃO QUADRO — regra 41. O teto antigo de 240 iterações fazia
     ~13% dos arrastos do celular se perderem, e a causa era uma CORRIDA entre
     dois laços de requestAnimationFrame: este e o pulsoAutoRolagem do produto.
     Medido, o avanço alterna 0,7,0,7… assim que eles saem de fase — dois quadros
     por rolagem efetiva. Com 1.404 px de vão a 7 px por quadro são ~200 quadros
     úteis, que a desincronia dobra para ~400, contra um teto de 240; o pico real
     medido depois da correção é 299. Como a fase inicial varia a cada execução,
     o sintoma era intermitente e chegava como waitForFunction estourando 30 s
     depois, longe da causa.
     Contar iteração mede o relógio do TESTE; contar progresso mede a PÁGINA. O
     teto numérico aqui é só antitravamento: quem decide desistir é a ausência de
     rolagem por 90 quadros seguidos, que só ocorre se a página chegou ao fim ou
     o gesto morreu. */
  let semProgresso=0,scrollAnterior=window.scrollY,chegou=false;
  for(let i=0;i<2000;i++){
    const rb=caixaDestino();
    if(rb.top>=0&&rb.bottom<=window.innerHeight){chegou=true;break;}
    p("pointermove",x0,rb.top<0?24:window.innerHeight-24);
    await quadro();
    if(Math.abs(window.scrollY-scrollAnterior)<0.5)semProgresso++;
    else semProgresso=0;
    scrollAnterior=window.scrollY;
    if(semProgresso>90)break;
  }
  /* FALHA ALTO. O laço antigo saía em silêncio e soltava o ponteiro onde o slot
     não estava: o arrasto se perdia e o diagnóstico virava um timeout cego. */
  if(!chegou)throw new Error(
    "auto-rolagem não trouxe "+d+" para a viewport ("+semProgresso+" quadros sem rolar)");

  const rb=caixaDestino();
  const x1=rb.left+rb.width/2,y1=rb.top+rb.height/2;
  p("pointermove",x1,y1);
  await quadro();
  p("pointerup",x1,y1);
}`;

/* A carta entra com `deal` e `animation-delay` de até 275 ms. Medir a caixa no
   meio da animação devolve uma posição que já mudou quando o ponteiro desce — o
   `pointerdown` cai ao lado da carta e o arrasto nunca começa. Esperar a
   animação DELA, e não um tempo fixo, é o que torna o gesto determinístico.

   E só espera o que PODE terminar: `finished` de uma animação pausada não
   resolve nunca. Foi assim que `visual-regression.js` pendurou por dias — ele
   injeta `animation-play-state:paused` para a foto. Ver regra 38. */
async function esperarAnimacaoDe(page,origem){
  /* Aceita locator ou seletor, e sempre resolve para UM elemento: o Playwright
     recusa `locator.evaluate` ambíguo com "strict mode violation", e um seletor
     de família — `#picks .card[data-pick]` — casa as cinco cartas da mesa. */
  const alvo=typeof origem==="string"?page.locator(origem).first():origem.first();
  await alvo.evaluate(el=>
    Promise.all(el.getAnimations({subtree:true})
      .filter(a=>a.playState!=="paused")
      .map(a=>a.finished.catch(()=>{}))));
}

/* Estratégia 1 — deixa a auto-rolagem do produto trazer o destino.
   O gesto vai como STRING avaliada no browser, com o argumento já embutido:
   `page.evaluate(string, arg)` ignora o argumento — a string é avaliada como
   expressão e o segundo parâmetro não chega. Descoberto do jeito caro, medindo
   um resultado que voltava vazio e parecia defeito de produto. */
async function porAutoRolagem(page,origem,destino){
  await esperarAnimacaoDe(page,origem);
  await page.evaluate(
    `(${GESTO_AUTO_ROLAGEM})(${JSON.stringify({o:origem,d:destino})})`);
}

/* Estratégia 2 — enquadra os dois por script e arrasta em linha reta.
   CENTRAR ANTES DE MEDIR é o que torna o gesto reproduzível: a partir do
   segundo slot o destino cai abaixo da dobra, e o arrasto pousava no vazio. */
async function centralizando(page,origem,destino){
  await esperarAnimacaoDe(page,origem);
  await page.locator(origem).scrollIntoViewIfNeeded();
  let a=await page.locator(origem).boundingBox();
  let b=await page.locator(destino).boundingBox();
  if(!a||!b)throw new Error(`arrasto sem alvo: ${origem} → ${destino}`);
  const meio=(a.y+a.height/2+b.y+b.height/2)/2;
  const desloc=meio-page.viewportSize().height/2;
  if(Math.abs(desloc)>4){
    await page.evaluate(d=>window.scrollBy(0,d),desloc);
    await page.waitForTimeout(140);
    a=await page.locator(origem).boundingBox();
    b=await page.locator(destino).boundingBox();
    if(!a||!b)throw new Error(`arrasto perdeu o alvo ao rolar: ${origem} → ${destino}`);
  }
  return{a,b};
}

/* Estratégia 2, completa — enquadra e arrasta com MOUSE REAL.
   Aqui o ponteiro é de mouse, não sintético: `e2e-game-flow` roda em desktop sem
   `isMobile`, e é esta a prova de que o produto atende o dispositivo apontador.
   Um passo intermediário porque o produto só entra em arrasto depois de 8 px —
   ir direto ao destino também passaria do limiar, mas não exercitaria o caminho
   que a mão faz. */
async function porMouseCentralizado(page,origem,destino){
  const {a,b}=await centralizando(page,origem,destino);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
  await page.mouse.down();
  await page.mouse.move(a.x+a.width/2+30,a.y+a.height/2+20);
  await page.waitForTimeout(30);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.waitForTimeout(30);
  await page.mouse.up();
}

module.exports={GESTO_AUTO_ROLAGEM,esperarAnimacaoDe,porAutoRolagem,
  centralizando,porMouseCentralizado};
