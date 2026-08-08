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
   não deixe o presente sem prova.

   ─────────────────────────────────────────────────────────────────────────────
   GRANDEZA VIVA — 07/08/2026. Linha de arquivo não é a única medida que a
   documentação declara como vigente, e a outra classe estava inteiramente sem
   guarda: **quantos checadores e quantas suítes o repositório tem**. Em 07/08 uma
   varredura manual achou o mesmo número errado em CINCO lugares — três dizendo
   "20/20 checadores" quando já eram 21, mais "25/25 suítes" quando eram 26 e um
   `game.js` de 882 linhas que hoje tem 1.307. Nenhum caiu por descuido isolado:
   o `check-live-commentary` entrou no `npm run check` e **nada no repositório
   sabia que aquele número tinha dono**.

   É a mesma falha que criou este arquivo, num eixo novo. Por isso a segunda
   marca conta a grandeza na FONTE que a produz — `tools/run-checks.js` e
   `bancada/run.js` —, nunca num número guardado à parte, que envelheceria junto:

       <!-- contagem-verificada -->
       | grandeza | valor |
       |---|---:|
       | `checadores` | 21 |
       | `suites` | 26 |

   Grandeza desconhecida é ERRO, não linha ignorada: um nome digitado errado
   viraria cobertura ausente em silêncio, que é exatamente o defeito que
   `run-checks.js` recusa no próprio cabeçalho ao não descobrir checador por glob. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");
const MARCA="<!-- medicao-verificada -->";
const MARCA_CONTAGEM="<!-- contagem-verificada -->";

/* Extrai um literal pelo nome, BALANCEANDO os delimitadores em vez de parar no
   primeiro fechamento. Os dois alvos são aninhados — `CHECADORES` é um array de
   objetos e `SUITE_GROUPS` é um objeto de arrays —, e um casador que fecha no
   primeiro delimitador leria só a primeira entrada. Erro por BORDA, que é a
   regra 23 do CLAUDE.md; a primeira versão desta função só contava `[` e não
   fechava `SUITE_GROUPS` nunca. */
const PARES={"[":"]","{":"}"};
function blocoBalanceado(fonte,abertura){
  const inicio=fonte.indexOf(abertura);
  if(inicio<0)throw new Error(`fonte não contém "${abertura}" — a contagem perdeu a âncora`);
  const abre=abertura.at(-1),fecha=PARES[abre];
  if(!fecha)throw new Error(`âncora "${abertura}" não termina em delimitador`);
  let profundidade=0;
  for(let i=inicio+abertura.length-1;i<fonte.length;i++){
    if(fonte[i]===abre)profundidade++;
    else if(fonte[i]===fecha&&--profundidade===0)return fonte.slice(inicio,i+1);
  }
  throw new Error(`"${abertura}" não fecha — a contagem perdeu a âncora`);
}

const leia=relativo=>fs.readFileSync(path.join(RAIZ,relativo),"utf8");

/* Cada grandeza conta na FONTE que a produz. Se um dia a forma do literal mudar,
   `blocoDeArray` estoura em vez de devolver zero em silêncio — contagem que erra
   para baixo é pior que contagem ausente, porque parece prova. */
const GRANDEZAS={
  /* `npm run check`: um checador é uma entrada `{nome:...}` da lista. */
  checadores:()=>
    (blocoBalanceado(leia("tools/run-checks.js"),"const CHECADORES=[").match(/\{\s*nome:/g)||[]).length,
  /* `npm run validate`: as suítes do grupo `all`, que é a união dos seis grupos.
     Contadas na DECLARAÇÃO dos grupos, não em `all`, porque `all` é montado por
     spread e não contém nome nenhum de arquivo. */
  suites:()=>
    (blocoBalanceado(leia("bancada/run.js"),"const SUITE_GROUPS={").match(/"[^"]+\.js"/g)||[]).length,
};

function documentos(){
  const achados=["AGENTS.md","CLAUDE.md","README.md"]
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
function linhasDeclaradas(conteudo,marca){
  const declaradas=[],linhas=conteudo.split(/\r?\n/);
  for(let i=0;i<linhas.length;i++){
    if(linhas[i].trim()!==marca)continue;
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
let provadas=0,contagens=0;
/* As grandezas vivas são lidas UMA vez, antes do laço: elas não dependem do
   documento, e reler a fonte por declaração faria o custo crescer com o número
   de lugares que citam o mesmo número — que é justamente o que se espera que
   cresça. */
const REAL=Object.fromEntries(Object.entries(GRANDEZAS).map(([k,f])=>[k,f()]));

for(const documento of documentos()){
  const relativo=path.relative(RAIZ,documento).replace(/\\/g,"/");
  const conteudo=fs.readFileSync(documento,"utf8");

  for(const {alvo,esperado,linha} of linhasDeclaradas(conteudo,MARCA)){
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

  for(const {alvo,esperado,linha} of linhasDeclaradas(conteudo,MARCA_CONTAGEM)){
    if(!Object.hasOwn(REAL,alvo)){
      erros.push(`${relativo}:${linha} declara a grandeza "${alvo}", que ninguém sabe contar`
        +` (conhecidas: ${Object.keys(REAL).join(", ")})`);
      continue;
    }
    contagens++;
    if(REAL[alvo]!==esperado)
      erros.push(`${relativo}:${linha} diz que o repositório tem ${esperado} ${alvo}; tem ${REAL[alvo]}`);
  }
}

assert.equal(erros.length,0,
  `medição declarada divergente da árvore real:\n  ${erros.join("\n  ")}`);
assert.ok(provadas>0,
  "nenhuma medição declarada foi encontrada — a marca sumiu da documentação");
assert.ok(contagens>0,
  "nenhuma contagem declarada foi encontrada — a marca de grandeza viva sumiu da documentação");
console.log(`doc measurements: ok (${provadas} medições e ${contagens} contagens declaradas`
  +` conferem com a árvore · ${REAL.checadores} checadores · ${REAL.suites} suítes)`);
