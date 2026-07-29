/* Guarda das listas de export do motor.

   O calibrador não importa o game.js: ele lê o arquivo como TEXTO, corta no marcador de UI e
   constrói o motor com `new Function(slice + "return {nome1,nome2,...};")()`. Ali cada nome é
   uma REFERÊNCIA de identificador, não uma string — e a mesma lista ainda está escrita duas
   vezes, literalmente igual, no sandbox e no worker.

   Isso cria dois modos de falha que nada detectava:
     1. alguém edita uma das listas e esquece a outra;
     2. alguém remove um `const` do game.js e esquece as listas.

   Em ambos, `new Function` COMPILA — o erro só aparece na chamada, e com sintomas diferentes
   por consumidor: a página do sandbox abre em branco ou o worker devolve erro em todo job.
   Esta guarda antecipa isso para o `npm run check`, que roda em
   segundos, em vez de aparecer no E2E três minutos depois. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const CONSUMIDORES = [
  "sandbox.html",
  "calibrador-worker.js"
];

// A lista aparece no código-fonte como o literal `\nreturn {a,b,c};` dentro de uma string.
const PADRAO = /\\nreturn \{([^}]+)\}/;

function listaDe(arquivo) {
  const src = fs.readFileSync(path.join(root, arquivo), "utf8");
  const achado = src.match(PADRAO);
  if (!achado) throw new Error(`nao encontrei a lista de export do motor em ${arquivo}`);
  return achado[1].split(",").map(nome => nome.trim()).filter(Boolean);
}

const listas = CONSUMIDORES.map(arquivo => ({ arquivo, nomes: listaDe(arquivo) }));

// 1. as listas têm que ser idênticas, na mesma ordem
const referencia = listas[0];
let falhas = 0;
listas.slice(1).forEach(({ arquivo, nomes }) => {
  if (nomes.join(",") === referencia.nomes.join(",")) return;
  falhas += 1;
  const faltando = referencia.nomes.filter(nome => !nomes.includes(nome));
  const sobrando = nomes.filter(nome => !referencia.nomes.includes(nome));
  console.error(`lista de export divergente entre ${referencia.arquivo} e ${arquivo}`);
  if (faltando.length) console.error(`  ausente em ${arquivo}: ${faltando.join(", ")}`);
  if (sobrando.length) console.error(`  sobrando em ${arquivo}: ${sobrando.join(", ")}`);
  if (!faltando.length && !sobrando.length) console.error("  mesmos nomes, ordem diferente");
});

// 2. todo nome da lista tem que existir no motor — é o modo de falha que a remoção de uma
//    tabela morta provoca, e que nenhum teste rápido pegava
const linhas = fs.readFileSync(path.join(root, "game.js"), "utf8").split(/\r?\n/);
let corte = linhas.findIndex(linha => linha.includes("// === UI START ==="));
if (corte < 0) corte = linhas.findIndex(linha => linha.includes("document.getElementById"));
if (corte < 0) throw new Error("marcador de UI nao encontrado em game.js");
const slice = linhas.slice(0, corte).join("\n");

let motor;
try {
  motor = new Function(slice + `\nreturn {${referencia.nomes.join(",")}};`)();
} catch (erro) {
  console.error(`o motor nao constroi com a lista de ${referencia.arquivo}: ${erro.message}`);
  console.error("  provavel causa: um nome da lista nao existe mais em game.js");
  process.exit(1);
}

referencia.nomes.forEach(nome => {
  if (motor[nome] !== undefined) return;
  falhas += 1;
  console.error(`export exportado como undefined: ${nome}`);
});

if (falhas) {
  console.error(`engine exports: ${falhas} problema(s)`);
  process.exit(1);
}

console.log(`engine exports: ok (${referencia.nomes.length} nomes × ${CONSUMIDORES.length} consumidores)`);
