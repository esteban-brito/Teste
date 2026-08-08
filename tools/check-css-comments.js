/* COMENTÁRIO DE CSS ABRE E FECHA EM PAR — contrato de 08/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. Ao remover o `.pm-versus` encontrei SEIS linhas de prosa
   vivendo como CSS cru no meio de `style.css`: um comentário FECHAVA, e a nota
   seguinte tinha perdido a ABERTURA numa edição anterior. O texto ficava com uma
   nota fechada, seis linhas de prosa solta terminadas por um fechamento órfão, e
   logo abaixo a regra `.pm-versus text`. Nada reclamava.

   (Este cabeçalho não reproduz os delimitadores literalmente de propósito: um
   fechamento dentro deste comentário o encerraria aqui, e o arquivo deixaria de
   ser JavaScript válido. Aconteceu na primeira escrita — a armadilha que a
   guarda descreve pegou a própria guarda.)

   ISSO NÃO É COSMÉTICO. A recuperação de erro do CSS não pula a linha ruim: ela
   consome tudo como prelúdio de seletor até achar um bloco, e então DESCARTA
   esse bloco junto. Ou seja, a regra logo abaixo da prosa órfã morre em silêncio
   — o navegador não avisa, o lint de JS não olha CSS, e a folha continua
   "funcionando" com uma regra a menos. É a mesma classe de defeito que a
   auditoria de cascata de 02/08 achou, mas por um caminho novo.

   E É A REGRA 23 NUM EIXO NOVO: reescrita erra na BORDA. A edição que produziu
   isto apagou a abertura e deixou o fechamento, que é exatamente o tipo de erro
   que ler o próprio diff não mostra — as duas linhas parecem prosa nos dois
   estados.

   O QUE ELE PROVA. Que os delimitadores se alternam corretamente do começo ao
   fim de cada folha: nenhum `*/` sem `/*` aberto antes, e nenhum `/*` deixado
   aberto no fim do arquivo. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");

/* As folhas de verdade do projeto. `sandbox.html` e os laboratórios carregam
   `<style>` inline e ficam de fora de propósito: extrair CSS de HTML pede um
   parser de HTML, e a dívida do `sandbox.html` é escopo recusado desde 03/08. */
const FOLHAS=["style.css"];

const erros=[];
let abertos=0;

for(const relativo of FOLHAS){
  const fonte=fs.readFileSync(path.join(RAIZ,relativo),"utf8");
  const linhaDe=indice=>fonte.slice(0,indice).split(/\r?\n/).length;
  let dentro=false,inicio=-1;
  for(let i=0;i<fonte.length-1;i++){
    const par=fonte[i]+fonte[i+1];
    /* CSS não aninha comentário: o primeiro `*/` fecha, e um `/*` dentro de um
       comentário aberto é texto. Por isso o estado é um booleano e não um
       contador — contar profundidade daria falso negativo justamente no caso em
       que alguém escreve `/*` dentro de uma nota. */
    if(!dentro&&par==="/*"){dentro=true;inicio=i;abertos++;i++;}
    else if(dentro&&par==="*/"){dentro=false;i++;}
    else if(!dentro&&par==="*/"){
      erros.push(`${relativo}:${linhaDe(i)} tem \`*/\` sem \`/*\` aberto`
        +" — a prosa acima está sendo lida como CSS, e a regra abaixo dela é descartada");
      i++;
    }
  }
  if(dentro)
    erros.push(`${relativo}:${linhaDe(inicio)} abre comentário que nunca fecha`
      +" — daí até o fim do arquivo nada chega à tela");
}

/* 2 — PROSA FORA DE COMENTÁRIO.
   O pareamento sozinho NÃO basta, e isto foi provado do jeito caro em 08/08/2026:
   ao documentar o defeito acima eu escrevi os delimitadores literalmente, entre
   crases, dentro de um comentário. O fechamento encerrou o comentário no meio da
   frase; a abertura, duas linhas abaixo, começou outro. O arquivo ficou
   PERFEITAMENTE PAREADO — esta guarda passou — e mesmo assim quatro linhas de
   português viraram CSS cru, e a regra `.prematch-ctx` logo abaixo foi consumida
   pela recuperação de erro. Os chips do topo da antessala empilharam.

   Como se detecta prosa: por CARACTERE. Fora de comentário e fora de string, o
   CSS deste projeto é ASCII de seletor e declaração. Acento, travessão e crase
   não aparecem ali nunca — mas são exatamente o que a prosa em português traz.
   É um sinal barato, sem falso positivo, e pega a classe inteira em vez do caso
   que eu já conheço. */
const SINAIS=/[À-ÿ`—–“”…]/;

for(const relativo of FOLHAS){
  const fonte=fs.readFileSync(path.join(RAIZ,relativo),"utf8");
  const linhaDe=indice=>fonte.slice(0,indice).split(/\r?\n/).length;
  let dentro=false,aspas="";
  for(let i=0;i<fonte.length;i++){
    const c=fonte[i],par=c+(fonte[i+1]||"");
    if(dentro){if(par==="*/"){dentro=false;i++;}continue;}
    if(aspas){if(c===aspas&&fonte[i-1]!=="\\")aspas="";continue;}
    if(par==="/*"){dentro=true;i++;continue;}
    if(c==='"'||c==="'"){aspas=c;continue;}
    if(SINAIS.test(c)){
      const trecho=fonte.slice(Math.max(0,i-40),i+40).replace(/\s+/g," ").trim();
      erros.push(`${relativo}:${linhaDe(i)} tem "${c}" fora de comentário e fora de string`
        +` — isto é PROSA sendo lida como CSS, e a regra seguinte é descartada.`
        +` Contexto: …${trecho}…`);
      break; // um por folha basta: o resto é a mesma ocorrência
    }
  }
}

assert.equal(erros.length,0,`comentário de CSS desbalanceado ou prosa solta:\n  ${erros.join("\n  ")}`);

console.log(`css comments: ok (${FOLHAS.length} folha(s) · ${abertos} comentários pareados`
  +" · nenhuma prosa fora de comentário)");
