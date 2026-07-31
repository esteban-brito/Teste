/* Prova que toda referência a arquivo do repositório feita na documentação existe.

   POR QUE ISTO EXISTE. Em 31/07/2026 uma auditoria encontrou documentação
   apontando para `src/ui/shared/role-emblems.mjs`, deletado em `673e205`. Ninguém
   percebeu porque nada verificava: eram 164 referências em crase e 18 links
   markdown, todos sem guarda. Um caminho morto num documento é pior que ausência
   de documento — ele manda a próxima sessão procurar algo que não está lá.

   O QUE ELE COBRE. Somente arquivos `.md`, que é onde a referência apodrece em
   silêncio. Caminho citado dentro de código já é validado pelo próprio import do
   `npm run check`; repetir aqui só criaria falso positivo com template literal.

   COMO ELE PODE FALHAR. `referenciasQuebradas` recebe o corpus e o predicado de
   existência por parâmetro. O autoteste injeta um corpus sintético com referência
   morta e exige que o checador acuse — sem isso, um medidor sempre verde passaria
   despercebido. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");

const ROOT=path.join(__dirname,"..");

/* Uma crase só vira "referência a arquivo" quando começa por um destes prefixos ou
   é um arquivo de raiz conhecido. Sem essa âncora, `tierOf` e `npm run check`
   entrariam como caminhos. */
const RAIZES=["docs/","src/","tools/","bancada/","fonts/","fotos/",".github/","fidelity-corpus/"];
const ARQUIVOS_RAIZ=new Set(["AGENTS.md","README.md","CLAUDE.md","ADD_TEAM.md","game.js",
  "sandbox.html","style.css","index.html","elencos.html","prototipo-cartas.html","fonts.css",
  "package.json","package-lock.json","calibrador-worker.js","eslint.config.mjs","robots.txt"]);

/* Placeholders deliberados: o texto ensina a sintaxe de um comando, não aponta
   para um arquivo versionado. */
const EXCECOES=new Set(["caminho/do/time.txt","caminho/entrada.json"]);

/* Arquivos que a documentação cita de propósito sem que existam. Dívida DECLARADA,
   no espírito de `DIVERGENCIAS` em src/data/catalog.mjs: cada entrada precisa de
   motivo. Se o arquivo passar a existir, o checador reprova — a exceção também não
   pode apodrecer. */
const REFERENCIAS_DECLARADAS=new Map([
  ["src/ui/shared/role-emblems.mjs",
    "deletado em 673e205; a §11 de docs/cartas-design-2026-07-28.md o nomeia para dizer que saiu"],
  ["tools/check-game-state.js",
    "ainda não existe; a §11 de docs/p5-aplicacao-ui-2026-07-29.md o propõe como próxima guarda"]
]);

function ehCaminhoDeRepo(texto){
  if(EXCECOES.has(texto))return false;
  if(texto.endsWith("/"))return false;              // diretório, não arquivo
  if(/[`${}*?\s<>]/.test(texto))return false;       // template literal, glob ou <placeholder>
  if(!/\.[A-Za-z0-9]+$/.test(texto))return false;   // sem extensão não é arquivo
  if(ARQUIVOS_RAIZ.has(texto))return true;
  return RAIZES.some(raiz=>texto.startsWith(raiz));
}

/** Extrai referências de um markdown: crases e links markdown, sem âncora. */
function extrairReferencias(conteudo){
  const achadas=new Set();
  for(const [,cru] of conteudo.matchAll(/`([^`\n]+)`/g)){
    if(ehCaminhoDeRepo(cru))achadas.add(cru);
  }
  for(const [,alvo] of conteudo.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)){
    if(/^(https?:|mailto:|#)/.test(alvo))continue;
    const semAncora=alvo.split("#")[0];
    if(semAncora&&ehCaminhoDeRepo(semAncora))achadas.add(semAncora);
  }
  return [...achadas];
}

/** `arquivos` é {caminho: conteúdo}; `existe` decide se um alvo está no repositório. */
function referenciasQuebradas(arquivos,existe){
  const quebradas=[];
  for(const [arquivo,conteudo] of Object.entries(arquivos)){
    for(const ref of extrairReferencias(conteudo)){
      /* Referência de doc é sempre relativa à raiz do repositório, nunca ao arquivo:
         é assim que os documentos deste projeto se citam. */
      if(!existe(ref))quebradas.push({arquivo,ref});
    }
  }
  return quebradas;
}

function autoteste(){
  const morto={"docs/exemplo.md":"veja `src/ui/shared/role-emblems.mjs` e [x](docs/sumiu.md)"};
  const achados=referenciasQuebradas(morto,()=>false);
  assert.equal(achados.length,2,"o checador precisa acusar referência inexistente");
  const vivo={"docs/exemplo.md":"veja `docs/testing.md` e [x](AGENTS.md)"};
  assert.deepEqual(referenciasQuebradas(vivo,()=>true),[],
    "o checador não pode acusar referência válida");
  /* Um span de crase que não é caminho não pode virar referência. */
  const ruido={"docs/exemplo.md":"use `npm run check`, a função `tierOf` e `CFG_SIM`"};
  assert.deepEqual(referenciasQuebradas(ruido,()=>false),[],
    "texto em crase que não é caminho não deve ser cobrado");
}

function main(){
  autoteste();
  /* `--others --exclude-standard` inclui o que ainda não foi adicionado ao índice.
     Sem isso, um arquivo novo citado no mesmo commit que o cria seria acusado de
     inexistente — foi exatamente o que aconteceu ao criar este checador. */
  const versionados=execFileSync("git",["ls-files","--cached","--others","--exclude-standard"],
    {cwd:ROOT,encoding:"utf8"})
    .trim().split("\n").map(linha=>linha.trim()).filter(Boolean);
  const conhecidos=new Set(versionados);

  /* A exceção declarada também é dívida: quando o arquivo nasce, a entrada tem de
     sair da lista, senão ela vira uma permissão permanente que ninguém revisa. */
  const obsoletas=[...REFERENCIAS_DECLARADAS.keys()].filter(ref=>conhecidos.has(ref));
  assert.deepEqual(obsoletas,[],
    `exceção declarada virou arquivo real; remova de REFERENCIAS_DECLARADAS: ${obsoletas.join(", ")}`);

  const arquivos={};
  for(const arquivo of versionados){
    if(!arquivo.endsWith(".md"))continue;
    arquivos[arquivo]=fs.readFileSync(path.join(ROOT,arquivo),"utf8");
  }
  const quebradas=referenciasQuebradas(arquivos,
    ref=>conhecidos.has(ref)||REFERENCIAS_DECLARADAS.has(ref));
  if(quebradas.length){
    for(const {arquivo,ref} of quebradas)console.error(`  ${arquivo} -> ${ref}`);
    assert.fail(`${quebradas.length} referência(s) de documentação apontam para arquivo inexistente`);
  }
  const total=Object.values(arquivos)
    .reduce((soma,conteudo)=>soma+extrairReferencias(conteudo).length,0);
  console.log(`doc links: ok (${Object.keys(arquivos).length} documentos · ${total} referências · `+
    `${REFERENCIAS_DECLARADAS.size} exceções declaradas)`);
}

main();

module.exports={ehCaminhoDeRepo,extrairReferencias,referenciasQuebradas};
