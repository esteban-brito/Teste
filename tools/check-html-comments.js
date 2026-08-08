/* COMENTÁRIO DE HTML E O MAPA DO index.html — contrato de 08/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE, e por que é um arquivo separado de `check-css-comments`.
   São a mesma CLASSE de defeito — delimitador que abre e não fecha — em dois
   materiais que falham de formas muito diferentes:

   - no CSS, a recuperação de erro consome a prosa como prelúdio de seletor e
     DESCARTA a regra seguinte junto. Perde-se uma regra, em silêncio;
   - no HTML, um comentário aberto engole tudo até o próximo fechamento. Se não
     houver nenhum, o resto do documento inteiro vira comentário: metade do jogo
     simplesmente não existe, e nem o navegador nem o lint dizem uma palavra.

   O segundo é mais barato de causar e muito mais caro de sofrer, e o `index.html`
   acabou de passar de 19 para 32 comentários — a superfície cresceu junto.

   (Os delimitadores nunca aparecem literais neste arquivo. São montados por
   concatenação porque a sequência de abertura do HTML também é um token de
   comentário legado em JavaScript, e porque escrever um fechamento dentro de uma
   nota já derrubou a antessala uma vez, em 08/08/2026.)

   O QUE ELE PROVA:

   1. PAREAMENTO. Os delimitadores se alternam do começo ao fim de cada página:
      nenhum fechamento sem abertura antes, e nenhuma abertura viva no fim.
   2. MARCAÇÃO ENGOLIDA — e esta é a prova que faltava. O pareamento SOZINHO não
      basta, exatamente como o irmão de CSS já registrava, e eu confirmei do jeito
      caro: a primeira versão desta guarda ficou verde depois de eu apagar o
      fechamento do marcador `PWA` no arquivo real. O comentário simplesmente
      correu até o fechamento SEGUINTE, engoliu as quatro `<meta>` do bloco pelo
      caminho e o arquivo voltou a ficar perfeitamente pareado — com um comentário
      a menos e quatro elementos fora do documento. Nada reclamava.
      O sinal certo é o DANO, não a sintaxe: uma linha que é uma tag inteira, ou
      um `id=`, dentro de um comentário. Prosa não escreve nenhum dos dois, e
      comentar marcação para desligá-la é proibido neste repositório de qualquer
      forma — elemento sem consumidor sai inteiro (regra 52).
   3. O MAPA É VERDADE. O cabeçalho do `index.html` lista as regiões do arquivo
      para que uma sessão nova pule direto em vez de ler tudo — e uma lista de
      regiões é exatamente o tipo de afirmação que envelhece sozinha (regra 43).
      Aqui ela tem dono: o mapa precisa ter os MESMOS nomes dos marcadores que
      existem de verdade, na MESMA ordem. Renomear uma região sem mexer no mapa
      reprova; acrescentar uma região e esquecer o mapa reprova. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");
const ABRE="<"+"!--";
const FECHA="--"+">";

/* Só as páginas que são MARCAÇÃO de verdade. `sandbox.html`,
   `prototipo-cartas.html` e `recorte-retratos.html` ficam de fora porque cada um
   carrega `<script>` inline, onde a sequência de abertura pode aparecer dentro de
   uma string sem ser comentário nenhum — separá-los pediria um parser de HTML, e
   a dívida do sandbox é escopo recusado desde 03/08. `elencos.html` é gerado. */
const PAGINAS=["index.html"];
/* Só o `index.html` declara mapa; os outros da lista, se entrarem, não precisam. */
const COM_MAPA=["index.html"];

const escaparRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

/* ── 1. pareamento ───────────────────────────────────────────────────────────
   HTML não aninha comentário: o primeiro fechamento fecha, e uma abertura dentro
   de um comentário vivo é texto. O estado é booleano pela mesma razão do irmão
   de CSS — contar profundidade daria falso negativo justamente no caso em que
   alguém descreve a sintaxe dentro de uma nota. */
function parear(fonte){
  const problemas=[];
  const linhaDe=indice=>fonte.slice(0,indice).split(/\r?\n/).length;
  let dentro=false,inicio=-1,pares=0;
  for(let i=0;i<fonte.length;i++){
    if(!dentro&&fonte.startsWith(ABRE,i)){dentro=true;inicio=i;pares++;i+=ABRE.length-1;continue;}
    if(dentro&&fonte.startsWith(FECHA,i)){dentro=false;i+=FECHA.length-1;continue;}
    if(!dentro&&fonte.startsWith(FECHA,i)){
      problemas.push(`:${linhaDe(i)} fecha um comentário que nunca abriu`);
      i+=FECHA.length-1;
    }
  }
  if(dentro)problemas.push(`:${linhaDe(inicio)} abre um comentário que nunca fecha`
    +" — daqui até o fim do arquivo o documento inteiro vira comentário");
  return {problemas,pares};
}

/* ── 2. marcação engolida ────────────────────────────────────────────────────
   Uma LINHA-TAG é uma linha cujo conteúdo inteiro é uma tag; é assim que a
   marcação real deste arquivo se apresenta, e é o que um comentário aberto
   demais captura primeiro. Menção em prosa não dispara: as notas do cabeçalho
   citam `<noscript>` e `<head>` no meio de frases, com texto depois. */
const LINHA_TAG=/^\s*<\/?[a-z!][^>]*>\s*$/;
const ID_LITERAL=/\sid="/;

function engolidos(fonte){
  const problemas=[];
  const linhaDe=indice=>fonte.slice(0,indice).split(/\r?\n/).length;
  let i=0;
  while(i<fonte.length){
    const abre=fonte.indexOf(ABRE,i);
    if(abre<0)break;
    const fecha=fonte.indexOf(FECHA,abre+ABRE.length);
    const corpo=fonte.slice(abre,fecha<0?fonte.length:fecha);
    corpo.split(/\r?\n/).forEach((linha,k)=>{
      const alvo=LINHA_TAG.test(linha)?"uma linha que é uma tag inteira"
        :ID_LITERAL.test(linha)?"um `id=` de elemento":null;
      if(alvo)problemas.push(`:${linhaDe(abre)+k} tem ${alvo} DENTRO de um comentário`
        +` — marcação engolida, e o elemento não existe na página: ${linha.trim().slice(0,60)}`);
    });
    i=fecha<0?fonte.length:fecha+FECHA.length;
  }
  return problemas;
}

/* ── 3. mapa × marcadores ────────────────────────────────────────────────────
   O mapa vive no PRIMEIRO comentário do arquivo, em linhas `· NOME — descrição`.
   Os marcadores de região são a linha de abertura de um comentário no formato
   `═══ NOME ═══…`. Nome é caixa-alta, o que os separa de qualquer prosa. */
const RE_MAPA=/^\s+· ([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ]*?) — /gm;
const RE_MARCA=new RegExp("^"+escaparRe(ABRE)+" ═══ ([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ]*?) ═+","gm");

const colher=(re,texto)=>[...texto.matchAll(re)].map(m=>m[1].trim());

function conferirMapa(fonte){
  const fim=fonte.indexOf(FECHA);
  assert.ok(fim>0,"a página não tem nenhum comentário — o mapa do cabeçalho sumiu");
  const cabecalho=fonte.slice(0,fim);
  const noMapa=colher(RE_MAPA,cabecalho);
  const marcadores=colher(RE_MARCA,fonte);
  const problemas=[];
  if(!noMapa.length)problemas.push("o cabeçalho não lista nenhuma região");
  if(!marcadores.length)problemas.push("o arquivo não tem nenhum marcador de região");
  if(noMapa.join(" | ")!==marcadores.join(" | "))
    problemas.push("o mapa do cabeçalho diverge dos marcadores do arquivo"
      +`\n      mapa      : ${noMapa.join(" · ")||"(vazio)"}`
      +`\n      marcadores: ${marcadores.join(" · ")||"(vazio)"}`);
  return {problemas,regioes:marcadores.length};
}

const erros=[];
let paresTotal=0,regioesTotal=0;
for(const relativo of PAGINAS){
  const fonte=fs.readFileSync(path.join(RAIZ,relativo),"utf8");
  const {problemas,pares}=parear(fonte);
  paresTotal+=pares;
  problemas.forEach(p=>erros.push(relativo+p));
  engolidos(fonte).forEach(p=>erros.push(relativo+p));
  if(COM_MAPA.includes(relativo)){
    const mapa=conferirMapa(fonte);
    regioesTotal+=mapa.regioes;
    mapa.problemas.forEach(p=>erros.push(`${relativo}: ${p}`));
  }
}

/* ── 3. o auto-teste, que é o que separa guarda de decoração ─────────────────
   Um medidor sempre verde passa por cobertura sem cobrir nada. Estes quatro
   casos injetam o defeito de propósito e exigem que ele seja acusado. */
const M=nome=>`${ABRE} ═══ ${nome} ═══ ${FECHA}`;
const cabecalhoDe=(...nomes)=>`${ABRE}\n  MAPA\n`
  +nomes.map(n=>`    · ${n} — descrição\n`).join("")+FECHA;

assert.ok(parear(`${ABRE} nota que nunca fecha\n<p>conteúdo</p>`).problemas.length,
  "auto-teste: abertura sem fechamento passou batido");
/* O caso que a primeira versão desta guarda deixou passar, agora congelado: o
   comentário fecha — no delimitador do marcador SEGUINTE — e leva marcação
   junto. Pareado e errado ao mesmo tempo. */
const ENGOLIDO=`${ABRE} ═══ PWA ═══\n<meta name="a" content="b">\n${ABRE} ═══ OG ═══ ${FECHA}`;
assert.equal(parear(ENGOLIDO).problemas.length,0,
  "auto-teste: o caso engolido deveria estar PAREADO — se não está, ele não prova nada");
assert.ok(engolidos(ENGOLIDO).length,
  "auto-teste: marcação engolida por comentário passou batida");
assert.ok(engolidos(`${ABRE} nota\n  <div class="x" id="alvo"></div>\n${FECHA}`).length,
  "auto-teste: `id=` dentro de comentário passou batido");
assert.equal(engolidos(`${ABRE} cita <noscript>, no meio da frase, e segue ${FECHA}`).length,0,
  "auto-teste: menção a tag em prosa virou falso positivo");
assert.ok(parear(`<p>a</p> ${FECHA} <p>b</p>`).problemas.length,
  "auto-teste: fechamento órfão passou batido");
assert.equal(parear(`${ABRE} ok ${FECHA}<p>a</p>${ABRE} ok ${FECHA}`).problemas.length,0,
  "auto-teste: arquivo são foi reprovado");
assert.ok(conferirMapa(cabecalhoDe("UM","DOIS")+"\n"+M("UM")).problemas.length,
  "auto-teste: região faltando no arquivo passou batida");
assert.ok(conferirMapa(cabecalhoDe("DOIS","UM")+"\n"+M("UM")+"\n"+M("DOIS")).problemas.length,
  "auto-teste: mapa fora de ordem passou batido");
assert.equal(conferirMapa(cabecalhoDe("UM","DOIS")+"\n"+M("UM")+"\n"+M("DOIS")).problemas.length,0,
  "auto-teste: mapa correto foi reprovado");

assert.equal(erros.length,0,`comentário de HTML desbalanceado ou mapa desatualizado:\n  ${erros.join("\n  ")}`);

console.log(`html comments: ok (${PAGINAS.length} página(s) · ${paresTotal} comentários pareados`
  +` · mapa igual aos ${regioesTotal} marcadores de região)`);
