/* bancada/e2e-cartas.js — ENCAIXE DA CARTA: o texto cabe na caixa?
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ESTA SUÍTE EXISTE. Em 29/07/2026 a escala de nome das cartas estava
   MORTA no jogo: `--t2` era declarado em `.card`, mas o card-view põe
   `--nick-esc` em `.cfaces`, que é filha — e substituição de custom property
   acontece no elemento onde a propriedade é declarada, então o fallback 1 valia
   sempre. Os 100 nicks renderizavam a 16cqw, e `olofmeister` e `pashaBiceps`
   eram cortados no meio da letra, 28px além da borda.

   Nada pegou isso, e a razão é estrutural: `check-game-view-modules.js` compara
   STRINGS, e o comparador visual compara DUAS EXECUÇÕES DO MESMO CÓDIGO — um
   nome permanentemente cortado é estável, logo invisível para ele. Faltava uma
   guarda que medisse GEOMETRIA.

   COMO ELA MEDE. O laboratório (`prototipo-cartas.html`) já renderiza as 145
   cartas com os módulos e o CSS reais, e expõe `window.__LAB_MEDIR`. Esta suíte
   chama a MESMA função, com a proposta desligada — isto é, o jogo como está —
   nas cinco larguras reais da carta. Uma implementação, dois usos: instrumento
   para desenhar, portão para publicar.

   O QUE ELA REPROVA: qualquer texto que passe da caixa em qualquer largura, e o
   laboratório ficar quebrado (erro de página, importação morta, contagem errada
   de cartas). O laboratório é a bancada da próxima mudança de carta: se ele
   apodrecer em silêncio, a próxima sessão redesenha às cegas. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {okMark,chromiumLaunchOptions}=require("./common");

/* As cinco larguras em que a carta realmente aparece, medidas na árvore real:
   roleta, desktop de 6 colunas, celular de 2, celular de 3 e tablet de 3. */
const LARGURAS=["250","188","176","130","120"];
const CARTAS_ESPERADAS=145;   /* 85 jogadores + 15 treinadores + as sínteses do lab */

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/prototipo-cartas.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

(async()=>{
  console.log("— E2E: ENCAIXE DAS CARTAS (laboratório) —");
  const port=6300+Math.floor(Math.random()*300);
  const server=spawn(process.execPath,[path.join(__dirname,"..","tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{
    try{if(browser)await browser.close();}catch{}
    try{server.kill();}catch{}
    process.exitCode=code;
  };
  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});

    await page.goto(`http://127.0.0.1:${port}/prototipo-cartas.html`,{waitUntil:"networkidle"});
    await page.waitForFunction(()=>typeof window.__LAB_MEDIR==="function",{timeout:15000});
    await page.evaluate(()=>document.fonts.ready);

    const cartas=await page.evaluate(()=>document.querySelectorAll(".card,.coachcard").length);
    check(cartas===CARTAS_ESPERADAS,
      `laboratório monta as ${CARTAS_ESPERADAS} cartas pelos módulos reais (viu ${cartas})`);
    check(errors.length===0,`laboratório carrega sem erro de página${errors.length?": "+errors[0]:""}`);

    /* A proposta tem de estar DESLIGADA: o que está sob teste é o jogo publicado. */
    const proposta=await page.isChecked("#cProposta");
    check(!proposta,"medição roda com a proposta desligada (estado publicado do jogo)");

    /* O QUE REPROVA E O QUE NÃO REPROVA. Reprova texto que VAZA a caixa ou é
       decapitado — nick, função e rótulo do verso, que não têm reticências. NÃO
       reprova campo com `text-overflow:ellipsis` declarado no CSS (campeonato, nick
       do verso, nome de stat): ali cortar é a decisão de design, e "DreamHack
       Cluj-Napoca 2015" não caberia em fonte nenhuma. Essa distinção existe porque a
       primeira versão desta suíte reprovou a CI sem defeito algum: a métrica da
       fonte no Linux é alguns pixels mais larga que no Windows e cruzou o limite das
       reticências lá, não aqui. Estouro real tem folga de dezenas de pixels, então
       não é sensível a plataforma. */
    for(const largura of LARGURAS){
      await page.selectOption("#cLargura",largura);
      await page.waitForTimeout(120);
      const {total,falhas,reticencias}=await page.evaluate(()=>window.__LAB_MEDIR());
      check(falhas.length===0,
        `${largura}px · ${total} cartas sem estouro de texto`+
        (reticencias.length?` (${reticencias.length} com reticências declaradas)`:"")+
        (falhas.length?` — ${falhas.length} falha(s), 1ª: ${falhas[0].nick} `+
          `${falhas[0].campo} "${falhas[0].texto}" falta ${falhas[0].falta}px`:""));
      if(falhas.length)for(const falha of falhas.slice(0,8))
        console.log(`      ${falha.nick} · ${falha.campo} · "${falha.texto}" · `+
          `falta ${falha.falta}px · passa a borda ${falha.passa>0?falha.passa+"px":"—"}`);
    }

    /* As provas sintéticas rodam a 188px porque abaixo de 150px a densidade compacta
       ESCONDE o rodapé do verso (`.c-vrod`), e caixa oculta não mede nada. */
    await page.selectOption("#cLargura","188");
    await page.waitForTimeout(120);

    /* O medidor precisa ser capaz de ACUSAR: sem esta prova, "zero estouros" pode
       significar apenas que a medição parou de funcionar. */
    const detecta=await page.evaluate(()=>{
      const nick=document.querySelector(".card .c-nick");
      if(!nick)return null;
      const original=nick.textContent;
      nick.textContent="NOMEIMPOSSIVELMENTELONGOPARACABER";
      const {falhas}=window.__LAB_MEDIR();
      nick.textContent=original;
      return falhas.some(f=>f.campo.startsWith("nick"));
    });
    check(detecta===true,"medidor detecta um nome que não cabe (prova de que ele mede)");

    /* E a distinção também é testada: campo com reticências declaradas entra no
       relatório, nunca na reprovação. Sem esta prova, a suíte volta a ficar vermelha
       em outra plataforma por uma decisão de design. */
    const separa=await page.evaluate(()=>{
      const rodape=document.querySelector(".card .c-vrod b");
      if(!rodape)return null;
      const original=rodape.textContent;
      rodape.textContent="CAMPEONATO DE NOME ABSURDAMENTE LONGO 2026";
      const {falhas,reticencias}=window.__LAB_MEDIR();
      rodape.textContent=original;
      return {reprovou:falhas.some(f=>f.campo.startsWith("campeonato")),
        relatou:reticencias.some(f=>f.campo.startsWith("campeonato"))};
    });
    check(separa&&separa.relatou&&!separa.reprovou,
      "campo com reticências declaradas é relatado, não reprovado");

    const limpo=await page.evaluate(()=>window.__LAB_MEDIR().falhas.length);
    check(limpo===0,"medição volta a zero depois da prova sintética");

    console.log(failures
      ?`✗ ${failures} checagem(ns) de encaixe falharam`
      :"✓ nenhum texto de carta estoura a caixa nas cinco larguras");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e de cartas abortou: "+(error.message||error));
    console.log("✗ e2e de encaixe das cartas falhou");
    return done(1);
  }
})();
