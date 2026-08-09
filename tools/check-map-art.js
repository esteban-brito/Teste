/* A ARTE DE FUNDO DOS MAPAS — contrato executável, 08/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE. `check-map-identity` já prova a marca de COR de cada mapa —
   cobertura, distinguibilidade e contraste. A arte é a segunda metade da mesma
   identidade e chegou sem guarda nenhuma; componente sem prova não fica parado,
   ele apodrece em silêncio (a lição do `.c-mono`, regra 37).

   O QUE ESTE CHECADOR IMPEDE, concretamente:

     1. mapa novo no pool sem arte — cairia no fallback de gradiente e ficaria
        indistinguível dos outros esquecidos. É o mesmo defeito que
        `check-map-identity` impede no eixo da cor;
     2. asset com nome que o runtime não pede — `arteDoMapa` gera o caminho em
        MINÚSCULO justamente porque `Dust2.webp` funciona no Windows e some no
        CI Linux. Aqui os dois lados são comparados;
     3. proporção errada. O fundo é `cover`: uma print 4:3 não quebraria a tela,
        ela cortaria o assunto em silêncio;
     4. peso. Sete imagens numa tela que hoje abre instantânea — o teto existe
        porque a compressão é escolha de quem gera, não do formato;
     5. órfão — arte de mapa que saiu do pool continuaria pesando no repositório.

   E UMA PROVA QUE NÃO É SOBRE ARQUIVO: que o CSS realmente CONSUMA a variável.
   `estiloDoMapa` pode emitir `--mapa-arte` perfeitamente e a folha não usar,
   que foi exatamente o que aconteceu com `--b1`/`--b2`/`--b3` até a limpeza por
   mutação de 02/08. Token emitido sem consumidor é trabalho invisível. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {webpDimensions}=require("./lib/webp");

const RAIZ=path.join(__dirname,"..");
const ARTE_DIR=path.join(RAIZ,"assets","mapas");
const url=rel=>pathToFileURL(path.join(RAIZ,rel)).href;

const PROPORCAO=16/9;
const TOLERANCIA=0.005;   // meio por cento: recorte exato, não "quase"
const LARGURA_MINIMA=200; // abaixo disto o artefato de bloco sobrevive ao desfoque
const MAX_BYTES=25_000;
const MAX_TOTAL=100_000;

async function main(){
  const {MAPA_MARCA,arteDoMapa}=await import(url("src/ui/shared/map-identity.mjs"));
  const {estiloDoMapa}=await import(url("src/ui/shared/map-identity.mjs"));
  const {MAPAS_POOL}=await import(url("src/domain/simulation/simulation-config.mjs"));

  assert.ok(fs.existsSync(ARTE_DIR),"assets/mapas não existe");

  /* 1 — COBERTURA, e o caminho que o runtime realmente pede. */
  let total=0;
  const esperados=new Set();
  for(const mapa of MAPAS_POOL){
    const rel=arteDoMapa(mapa);
    assert.ok(rel,`o mapa "${mapa}" está no pool e não tem arte declarada`);
    assert.ok(rel.startsWith("assets/mapas/")&&rel.endsWith(".webp"),
      `caminho de arte fora do padrão para ${mapa}: ${rel}`);

    const base=path.basename(rel);
    assert.equal(base,base.toLowerCase(),
      `o asset de ${mapa} precisa ser minúsculo (${base}) — maiúscula some no CI Linux`);
    esperados.add(base);

    const arquivo=path.join(RAIZ,rel);
    assert.ok(fs.existsSync(arquivo),`arte declarada por ${mapa} não existe: ${rel}`);

    /* 2 — FORMATO, PROPORÇÃO, RESOLUÇÃO E PESO. */
    const buffer=fs.readFileSync(arquivo);
    const {width,height}=webpDimensions(buffer);
    const proporcao=width/height;
    assert.ok(Math.abs(proporcao-PROPORCAO)/PROPORCAO<=TOLERANCIA,
      `${base} precisa ser 16:9 (viu ${width}×${height} = ${proporcao.toFixed(3)})`);
    assert.ok(width>=LARGURA_MINIMA,
      `${base} tem ${width}px de largura; o piso é ${LARGURA_MINIMA}px — `
      +"abaixo disso o artefato de bloco sobrevive ao desfoque e vira mancha");
    assert.ok(buffer.length<=MAX_BYTES,
      `${base} pesa ${Math.round(buffer.length/1000)} kB e o teto é ${MAX_BYTES/1000} kB`);
    total+=buffer.length;
  }
  assert.ok(total<=MAX_TOTAL,
    `a arte de mapa soma ${Math.round(total/1000)} kB e o teto é ${MAX_TOTAL/1000} kB`);

  /* 3 — ÓRFÃOS. */
  const noDisco=fs.readdirSync(ARTE_DIR).filter(n=>n.toLowerCase().endsWith(".webp"));
  const orfaos=noDisco.filter(n=>!esperados.has(n));
  assert.equal(orfaos.length,0,
    `arte sem mapa no pool: ${orfaos.join(", ")} — asset órfão pesa e não aparece`);

  /* Nada além de WebP mora na pasta: uma pasta `w320/` esquecida pelo gerador
     de candidatas dobraria o peso do repositório sem aparecer em lugar nenhum. */
  const intrusos=fs.readdirSync(ARTE_DIR).filter(n=>!n.toLowerCase().endsWith(".webp"));
  assert.equal(intrusos.length,0,
    `assets/mapas só aceita .webp; sobrou: ${intrusos.join(", ")}`);

  /* 4 — MAPA SEM MARCA CAI NO FALLBACK, e o fallback é declarado. */
  assert.equal(arteDoMapa("MapaQueNaoExiste"),null,
    "mapa desconhecido precisa devolver null, para o CSS cair no gradiente");
  assert.ok(estiloDoMapa("MapaQueNaoExiste").includes("--mapa-arte:none"),
    "sem arte, `--mapa-arte` precisa valer `none` — a regra de CSS é uma só");
  for(const mapa of MAPAS_POOL)
    assert.ok(estiloDoMapa(mapa).includes(`--mapa-arte:url('${arteDoMapa(mapa)}')`),
      `estiloDoMapa(${mapa}) não emite a arte`);
  /* ASPAS SIMPLES, e a guarda cobra. Esta string entra em `style="..."` via
     `innerHTML`; com aspas duplas o parser de HTML fecha o atributo na primeira
     delas e o elemento perde o estilo INTEIRO — cor, ambiente e foto de uma vez.
     O defeito é silencioso: nada lança, o elemento só aparece cru. Aconteceu em
     08/08/2026 e custou uma rodada de captura para ser visto. */
  assert.ok(!/--mapa-arte:url\("/.test(estiloDoMapa(MAPAS_POOL[0])),
    "`--mapa-arte` com aspas duplas quebra o atributo style em innerHTML");

  /* 5 — O CSS CONSOME. Token emitido sem consumidor é trabalho invisível. */
  const css=fs.readFileSync(path.join(RAIZ,"style.css"),"utf8");
  assert.ok(/var\(--mapa-arte\)/.test(css),
    "`--mapa-arte` é emitido e style.css não o consome");
  assert.ok(/--mapa-blur/.test(css),
    "o raio de desfoque da arte precisa ser uma variável, não um número solto");

  /* 6 — A ARTE NÃO SUBSTITUIU A COR. Toda a ambientação e o fallback dependem
     de `ceu`/`chao` continuarem existindo para os sete. */
  for(const mapa of MAPAS_POOL){
    const {ceu,chao}=MAPA_MARCA[mapa];
    assert.ok(ceu&&chao,`${mapa} perdeu ceu/chao — o fallback sem arte deixaria de existir`);
  }

  console.log(`map art: ok (${MAPAS_POOL.length} mapas · 16:9 · WebP · `
    +`${Math.round(total/1000)} kB somados · fallback declarado · CSS consome)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
