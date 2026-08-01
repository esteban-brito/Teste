/* Prova as MEDIÇÕES que a documentação declara como vigentes.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. `check-doc-links.js` prova que uma referência aponta para
   arquivo existente — não que a AFIRMAÇÃO sobre ele continue verdadeira. A
   diferença já custou caro: em 31/07/2026 a §5 do handoff do P5 dizia "medição
   vigente" e errava três dos quatro números (`style.css` 1.031 quando eram 1.261,
   `prototipo-cartas.html` 392 quando eram 592, `game.js` 889 quando eram 882).
   Nenhuma guarda reclamou, porque nenhuma media isso.

   COMO DECLARAR. Uma tabela markdown precedida da marca abaixo. Toda linha vira
   asserção executável; a contagem é a de `wc -l` (número de quebras de linha).

       <!-- medicao-verificada -->
       | arquivo | linhas |
       |---|---:|
       | `game.js` | 882 |

   Prosa NÃO é medida aqui: número solto em parágrafo continua sem prova. Se um
   número precisa ser confiável, declare-o na tabela. Se ele é histórico — "caiu
   de 3.054 para 1.206 em `4945d47`" — deixe na prosa, porque descreve um commit
   e não o estado de hoje. A regra vale para os dois lados: não trave história e
   não deixe o presente sem prova. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");
const MARCA="<!-- medicao-verificada -->";

function documentos(){
  const achados=["AGENTS.md","CLAUDE.md","README.md","ADD_TEAM.md"]
    .map(nome=>path.join(RAIZ,nome)).filter(fs.existsSync);
  const caminhar=dir=>{
    for(const entrada of fs.readdirSync(dir,{withFileTypes:true})){
      const alvo=path.join(dir,entrada.name);
      if(entrada.isDirectory())caminhar(alvo);
      else if(entrada.name.endsWith(".md"))achados.push(alvo);
    }
  };
  caminhar(path.join(RAIZ,"docs"));
  return achados;
}

/** Linhas de um arquivo pela mesma conta de `wc -l`: quebras de linha. */
function linhasDe(arquivo){
  const bruto=fs.readFileSync(arquivo,"utf8");
  let n=0;
  for(let i=0;i<bruto.length;i++)if(bruto[i]==="\n")n++;
  return n;
}

/** Extrai as linhas de tabela que seguem cada marca, até a tabela terminar. */
function medicoesDeclaradas(conteudo){
  const declaradas=[],linhas=conteudo.split(/\r?\n/);
  for(let i=0;i<linhas.length;i++){
    if(linhas[i].trim()!==MARCA)continue;
    let inicio=i+1;
    // o markdown exige linha em branco entre o comentário HTML e a tabela, senão
    // a tabela não renderiza; pular essa folga é parte do formato, não tolerância
    while(inicio<linhas.length&&linhas[inicio].trim()==="")inicio++;
    for(let j=inicio;j<linhas.length;j++){
      const linha=linhas[j].trim();
      if(!linha.startsWith("|"))break;                 // fim da tabela
      if(/^\|[\s:|-]+\|$/.test(linha))continue;        // separador
      const celulas=linha.split("|").slice(1,-1).map(c=>c.trim());
      if(celulas.length<2)continue;
      const alvo=celulas[0].replace(/^`|`$/g,"");
      const valor=celulas[1].replace(/\*\*/g,"").replace(/\./g,"").trim();
      if(!/^\d+$/.test(valor))continue;                // cabeçalho da tabela
      declaradas.push({alvo,esperado:+valor,linha:j+1});
    }
  }
  return declaradas;
}

const erros=[];
let provadas=0;
for(const documento of documentos()){
  const relativo=path.relative(RAIZ,documento).replace(/\\/g,"/");
  for(const {alvo,esperado,linha} of medicoesDeclaradas(fs.readFileSync(documento,"utf8"))){
    const arquivo=path.join(RAIZ,alvo);
    if(!fs.existsSync(arquivo)){
      erros.push(`${relativo}:${linha} declara medição de "${alvo}", que não existe`);
      continue;
    }
    const real=linhasDe(arquivo);
    provadas++;
    if(real!==esperado)
      erros.push(`${relativo}:${linha} diz que ${alvo} tem ${esperado} linhas; tem ${real}`);
  }
}

assert.equal(erros.length,0,
  `medição declarada divergente da árvore real:\n  ${erros.join("\n  ")}`);
assert.ok(provadas>0,
  "nenhuma medição declarada foi encontrada — a marca sumiu da documentação");
console.log(`doc measurements: ok (${provadas} medições declaradas conferem com a árvore)`);
