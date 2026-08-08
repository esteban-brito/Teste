/* bancada/lib/major.js — a entrada do Major, em UM lugar só.

   POR QUE EXISTE. Em 07/08/2026 o Major deixou de abrir direto: clicar em
   "Entrar no Major" passou a mostrar o PORTÃO DO NOME, obrigatório, e a Suíça só
   abre depois de nomear o time. Isso quebrou de uma vez as TRÊS travessias que
   existiam — `e2e-game-flow`, `e2e-acessibilidade` e `tools/visual-regression`
   —, cada uma com a sua cópia de `click("#suicabtn")`.

   É a lição do arrasto (`lib/arrasto.js`) repetida no mesmo mês: o errado nunca
   foi haver três consumidores, era haver três implementações do mesmo percurso.
   Quando o portão ganhar um passo a mais, só este arquivo muda.

   O NOME PADRÃO DA BANCADA é fixo de propósito: um nome sorteado faria as
   capturas visuais mudarem de execução para execução, e a comparação pixel a
   pixel do ritual visual acusaria diferença onde não houve mudança. */

const NOME_BANCADA="Time Teste";

/** Passa pelo portão do nome e deixa a Fase Suíça aberta. */
async function entrarNoMajor(page,{nome=NOME_BANCADA,timeout=8000}={}){
  await page.click("#suicabtn");
  await page.waitForSelector("#nomeOverlay",{state:"visible",timeout});
  /* `fill` dispara `input`, que é o que reavalia o botão. Preencher por
     `evaluate` deixaria o botão desabilitado e o clique seguinte seria um
     timeout sem explicação. */
  await page.fill("#teamName",nome);
  await page.click("#nomeConfirmar");
  await page.waitForSelector("#suicaOverlay",{state:"visible",timeout});
}

/** Reabre a Suíça depois de ela já ter sido fechada — o portão não volta,
    porque o nome já está gravado no progresso desta sessão. */
async function reabrirSuica(page,{timeout=8000}={}){
  await page.click("#suicabtn");
  /* O portão reaparece a cada entrada (ele confirma o nome atual), então a
     travessia é a mesma; o campo já vem preenchido e o botão já vem habilitado. */
  const portao=page.locator("#nomeOverlay");
  if(await portao.isVisible())await page.click("#nomeConfirmar");
  await page.waitForSelector("#suicaOverlay",{state:"visible",timeout});
}

module.exports={entrarNoMajor,reabrirSuica,NOME_BANCADA};
