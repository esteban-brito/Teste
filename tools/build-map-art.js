/* NORMALIZADOR DA ARTE DE MAPA — 08/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE UMA FERRAMENTA, E NÃO SETE ARQUIVOS ARRASTADOS PARA UMA PASTA.
   As prints chegam como o jogo as entrega: JPEG, PNG e WebP misturados, entre
   330 kB e 772 kB, e duas delas fora de 16:9 (2560×1391 e 1920×1068). Asset que
   entra no repositório sem passo reprodutível não pode ser refeito quando o
   parâmetro muda — e aqui o parâmetro MUDA por medição: a largura de saída é
   escolhida fotografando a tela final, não por palpite. `docs/card-portraits.md`
   já estabeleceu esse contrato para os retratos; este é o mesmo contrato para o
   fundo da antessala.

   POR QUE O CHROMIUM DECODIFICA. O projeto não tem `sharp` nem `pngjs`, e não
   vai ganhar uma dependência nativa por causa de sete imagens. O Playwright já é
   devDependency porque a bancada inteira depende dele, e o Chromium sabe ler os
   quatro formatos de entrada e escrever WebP com qualidade controlada. É a mesma
   escolha que `tools/visual-regression.js` faz para comparar capturas.

   O RECORTE É CENTRADO, e isso é seguro AQUI por um motivo que não vale em
   geral: as sete prints já vêm em 16:9 ou a 1–2% dele, então o corte tira no
   máximo 44 px de uma borda. Se uma print futura chegar em 4:3, corte centrado
   comeria o assunto — por isso a ferramenta AVISA quando a sobra passa de 8%.

   QUALIDADE ALTA EM RESOLUÇÃO BAIXA, e não o contrário. O instinto é comprimir
   forte porque a imagem vai ser desfocada; ele está errado. Artefato de bloco do
   WebP mede ~16 px na origem e, ampliado de 320 px para 1440, vira uma mancha
   quadrada de 72 px — maior que o raio de desfoque da lâmina, ou seja,
   sobrevive ao blur e aparece como sujeira. Menos pixels com qualidade alta
   pesa o mesmo e não inventa geometria. */
const fs=require("node:fs");
const path=require("node:path");
const {Buffer}=require("node:buffer");

const RAIZ=path.join(__dirname,"..");
const DESTINO=path.join(RAIZ,"assets","mapas");

/* De onde veio cada arquivo cru. Fica aqui, e não num JSON à parte, porque é a
   única coisa que liga o nome que o jogo usa ao arquivo que a pessoa baixou —
   e porque um mapeamento sem dono envelhece calado (regra 43). */
const ORIGENS={
  Ancient:"AncientASite.jpg",
  Anubis: "anubis.jpg",
  Cache:  "CS2_de_cache.png",
  Dust2:  "CS2_Dust_2_A_Site.jpg",
  Inferno:"De_infernoCS2BSite.jpeg",
  Mirage: "De_mirage_cs2.webp",
  Nuke:   "CS2_Nuke_Outside.jpeg"
};

/* O SLUG É MINÚSCULO, e isso não é estilo. O `MAPAS_POOL` usa `Dust2` com
   maiúscula; um arquivo `Dust2.webp` funciona no Windows do responsável e some
   no CI Linux se qualquer referência escrever `dust2`. Minúsculo em toda parte
   remove a classe inteira de defeito, e `check-map-art.js` prova a
   correspondência dos dois lados. */
const slug=mapa=>mapa.toLowerCase();

const PROPORCAO=16/9;
const QUALIDADE=0.9;
const SOBRA_MAXIMA=0.08; // acima disso o recorte centrado deixa de ser inócuo

/* 240px É MEDIDO, NÃO ESCOLHIDO — 08/08/2026. Varrendo 160/320/720 px contra
   raios de desfoque de 4 a 36 px e medindo quanto da foto CHEGA à lâmina (delta
   máximo de canal com × sem a arte), a curva satura cedo: com desfoque ≥10px,
   w160 dá 78/255 e w720 dá 80/255 — indistinguíveis. Resolução e desfoque são o
   MESMO parâmetro, porque esticar 240px para 1440 já é um desfoque de ~6px
   antes de o `filter` rodar.
   240 fica por margem: entrega o teto da curva e mantém os sete em 82 kB,
   dentro do teto de 100 kB que `check-map-art.js` cobra. */
const LARGURA_PADRAO=240;

function carregarPlaywright(){
  try{return require("playwright");}
  catch{
    console.error("build-map-art: Playwright não está instalado. Rode `npm ci`.");
    process.exit(1);
  }
}

const mime=arquivo=>{
  const ext=path.extname(arquivo).toLowerCase();
  if(ext===".png")return "image/png";
  if(ext===".webp")return "image/webp";
  return "image/jpeg";
};

/** Redimensiona e recorta uma print para 16:9 na largura pedida, em WebP. */
async function normalizar(page,cru,largura){
  const alvo={w:largura,h:Math.round(largura/PROPORCAO)};
  return page.evaluate(async ({b64,tipo,alvo,proporcao,qualidade})=>{
    const img=new Image();
    img.src=`data:${tipo};base64,${b64}`;
    await img.decode();
    const nat={w:img.naturalWidth,h:img.naturalHeight};
    /* Recorte centrado: sobra na largura ou na altura, nunca nas duas. */
    let corte;
    if(nat.w/nat.h>proporcao){
      const w=Math.round(nat.h*proporcao);
      corte={x:Math.round((nat.w-w)/2),y:0,w,h:nat.h};
    }else{
      const h=Math.round(nat.w/proporcao);
      corte={x:0,y:Math.round((nat.h-h)/2),w:nat.w,h};
    }
    const cv=document.createElement("canvas");
    cv.width=alvo.w;cv.height=alvo.h;
    const cx=cv.getContext("2d");
    cx.imageSmoothingEnabled=true;
    cx.imageSmoothingQuality="high";
    cx.drawImage(img,corte.x,corte.y,corte.w,corte.h,0,0,alvo.w,alvo.h);
    const url=cv.toDataURL("image/webp",qualidade);
    return {b64:url.slice(url.indexOf(",")+1),nat,corte};
  },{b64:cru.toString("base64"),tipo:mime(cru.nome||""),alvo,proporcao:PROPORCAO,qualidade:QUALIDADE});
}

async function main(){
  /* O padrão é `mapas-origem/`, que o `.gitignore` guarda fora do repositório
     pela mesma razão que `fotos-origem/`: material de trabalho não é asset
     publicado, mas regenerar não pode virar uma caçada na pasta de downloads. */
  const origem=process.argv[2]||path.join(RAIZ,"mapas-origem");
  const larguras=(process.argv[3]||String(LARGURA_PADRAO)).split(",").map(Number);
  if(!fs.existsSync(origem)){
    console.error(`build-map-art: pasta de prints não encontrada: ${origem}`);
    console.error("uso: node tools/build-map-art.js [pasta-com-as-prints] [larguras]");
    console.error("ex.:  node tools/build-map-art.js mapas-origem 160,240,320,480");
    process.exit(1);
  }
  const {chromium}=carregarPlaywright();
  const browser=await chromium.launch();
  const page=await browser.newPage();
  /* `about:blank` não aceita canvas de data-URI com origem nenhuma em alguns
     modos; uma página vazia servida como `data:` resolve e não pede servidor. */
  await page.goto("data:text/html,<html><body></body></html>");

  let total=0;
  try{
    for(const largura of larguras){
      const pasta=larguras.length>1?path.join(DESTINO,`w${largura}`):DESTINO;
      fs.mkdirSync(pasta,{recursive:true});
      let soma=0;
      for(const [mapa,arquivo] of Object.entries(ORIGENS)){
        const caminho=path.join(origem,arquivo);
        if(!fs.existsSync(caminho))throw new Error(`print ausente para ${mapa}: ${caminho}`);
        const cru=fs.readFileSync(caminho);cru.nome=arquivo;
        const {b64,nat,corte}=await normalizar(page,cru,largura);
        const buffer=Buffer.from(b64,"base64");
        const sobra=1-(corte.w*corte.h)/(nat.w*nat.h);
        if(sobra>SOBRA_MAXIMA)
          console.warn(`  ! ${mapa}: recorte centrado descartou ${(sobra*100).toFixed(1)}% `
            +`da print (${nat.w}×${nat.h}). Confira o enquadramento.`);
        fs.writeFileSync(path.join(pasta,`${slug(mapa)}.webp`),buffer);
        soma+=buffer.length;
        console.log(`  ${slug(mapa).padEnd(8)} ${nat.w}×${nat.h} → ${largura}×${Math.round(largura/PROPORCAO)}`
          +`  ${String(Math.round(buffer.length/1000)).padStart(3)} kB`
          +`  (sobra ${(sobra*100).toFixed(1)}%)`);
        total++;
      }
      console.log(`w${largura}: ${Object.keys(ORIGENS).length} arquivos · ${Math.round(soma/1000)} kB somados\n`);
    }
  }finally{await browser.close();}
  console.log(`build-map-art: ${total} arquivo(s) escrito(s) em ${path.relative(RAIZ,DESTINO)}`);
}

module.exports={ORIGENS,slug,PROPORCAO};

if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
