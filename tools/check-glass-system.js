/* O SISTEMA DE VIDRO — contrato de 07/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. A antessala foi eleita PADRÃO de estilo para o jogo
   inteiro: *"vou usar ela como um padrão de estilo, css, design e tudo mais pra
   todo o jogo"*. Um padrão que vive como números repetidos em cada regra não é
   padrão — é coincidência que dura até o próximo ajuste. A tokenização de cor de
   02–03/08 já provou isso neste repositório: 225 hex soltos disputando o mesmo
   papel, e nenhuma guarda olhando.

   O QUE ESTE CHECADOR IMPEDE:

     1. um token do sistema sumir sem que as telas que o usam reclamem;
     2. a antessala — a tela de REFERÊNCIA — voltar a declarar vidro na mão,
        que é como o padrão se desfaz sem ninguém decidir desfazê-lo;
     3. `backdrop-filter` entrar sem `-webkit-` ao lado. O Safari ainda exige o
        prefixo, e sem ele o efeito some inteiro no iPhone — justamente o
        aparelho cujo visual foi pedido como referência. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.resolve(__dirname,"..");
const folha=fs.readFileSync(path.join(RAIZ,"style.css"),"utf8");

/* 1 — OS TOKENS EXISTEM. */
/* O nível `lente` entrou e SAIU no mesmo dia. Ele existia para a junção dos
   dois times, que virou uma faixa de material com espessura — e a comparação
   com o painel da narração derrubou a ideia inteira: *"o da partida ainda está
   mil vezes superior, pq é MINIMALISTA"*. Liquid glass é o que sobra quando se
   tira o resto, não mais uma camada. Três níveis, e cada um é um PAPEL. */
const NIVEIS=["alto","medio","raso"];
const FACETAS={alto:["bg","borda","blur","sombra"],medio:["bg","borda","blur","sombra"],
  raso:["bg","borda","blur"]};
for(const nivel of NIVEIS)
  for(const faceta of FACETAS[nivel])
    assert.ok(new RegExp(`--vidro-${nivel}-${faceta}\\s*:`).test(folha),
      `o token --vidro-${nivel}-${faceta} sumiu do sistema`);
for(const raio of ["lamina","peca","pilula"])
  assert.ok(new RegExp(`--r-${raio}\\s*:`).test(folha),`o raio --r-${raio} sumiu da escala`);

/* 2 — A TELA DE REFERÊNCIA USA OS TOKENS.
   Cada superfície da antessala tem de consumir o sistema; se uma delas voltar a
   declarar `backdrop-filter` com número próprio, o padrão já divergiu. */
/* O NÍVEL PASSOU A SIGNIFICAR PAPEL — 08/08/2026, e por isso esta lista mudou.
   Antes os três níveis eram só três raios de desfoque, e `medio` pintava chip,
   mapa e botão indistintamente: o material não dizia nada sobre a peça. Agora
   `alto` é LÂMINA, `medio` é AÇÃO — o que se pressiona — e `raso` é APOIO, a
   informação que não se toca. Chip e placa de mapa desceram para `raso`.

   `.prematch-nota` saiu da lista porque o ELEMENTO saiu da tela: era uma pílula
   de vidro de 8.127px² explicando o botão logo acima dela, e a explicação passou
   a viver dentro do próprio botão. Sem ele, `--vidro-raso-*` ficaria sem nenhum
   consumidor — era o único —, e token órfão é o que o `:root` desta folha proíbe
   em texto. Descer chip e mapa para `raso` resolve as duas coisas de uma vez.

   ISTO É UMA DECISÃO DE DESIGN, e a guarda tem de acompanhá-la explicitamente.
   Ela existe para impedir DIVERGÊNCIA silenciosa — vidro declarado na mão —, não
   para congelar quantas superfícies a tela tem. Mudar a lista sem mudar a folha,
   ou o contrário, reprova. */
const SUPERFICIES=[
  /* O vidro migrou de `.pm-palco` para o pseudo-elemento em 08/08/2026, e a
     guarda tem de seguir a PILHA real: a lâmina agora vive ENTRE o campo de cor
     e o conteúdo. Enquanto ela era o contêiner, as duas metades pintavam por
     cima dela e o desfoque não amostrava nada — vidro declarado, não acontecendo. */
  [".pm-palco::after","--vidro-alto-blur"],
  [".prematch-modos .roll","--vidro-medio-blur"],
  /* `.pm-mapa` saiu da lista em 08/08/2026 porque o ELEMENTO saiu da tela: a
     pílula do mapa vivia numa segunda linha e lia como órfã, e o mapa virou mais
     um chip da faixa de contexto. Ele não deixou `--vidro-raso-*` sem
     consumidor — `.prematch-ctx` continua sendo um, e agora o chip do mapa mora
     dentro dela. */
  [".prematch-ctx","--vidro-raso-blur"],
];
for(const [seletor,token] of SUPERFICIES){
  const escapado=seletor.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const regra=folha.match(new RegExp(`${escapado}\\{([^}]*)\\}`));
  assert.ok(regra,`a superfície "${seletor}" da tela de referência sumiu da folha`);
  assert.ok(regra[1].includes(`var(${token})`),
    `"${seletor}" declara vidro na mão em vez de usar ${token} — o padrão divergiu`);
}

/* 2-bis — QUANTAS SUPERFÍCIES AINDA ESTÃO FORA DO SISTEMA.
   A regra 2 só olha a tela de referência, então uma superfície de vidro NOVA,
   em qualquer outra tela, entrava com número próprio sem que nada reclamasse —
   e foi exatamente o que aconteceu: `.np-card`, o palco da narração, declara
   `blur(16px) saturate(1.3)` na mão desde 06/08/2026. A documentação chegou a
   dizer que a guarda cobria SEIS superfícies quando ela cobria cinco, o que é
   pior que não ter guarda: faz a próxima sessão confiar no que não é medido.

   Migrar `.np-card` para os tokens NÃO é trabalho desta guarda — os valores
   diferem (14px/140% contra 16px/1.3), então é mudança de PIXEL, e mudança de
   pixel se pede, se mede em fps e se prova no comparador visual. É a fatia
   "levar o padrão às outras telas", que está declarada como próximo ciclo.

   O que a guarda faz é impedir que a dívida CRESÇA em silêncio: o número de
   superfícies fora do sistema está travado. Uma nova reprova; migrar `.np-card`
   também reprova, e aí o número desce de propósito, com o commit que o explica. */
const FORA_DO_SISTEMA=1;
const declaracoes=folha.match(/(?<!-webkit-)backdrop-filter\s*:\s*([^;}]+)/g)||[];
const naMao=declaracoes.filter(d=>!d.includes("var(--vidro-"));
assert.equal(naMao.length,FORA_DO_SISTEMA,
  `${naMao.length} superfície(s) declaram vidro na mão, e a dívida travada é ${FORA_DO_SISTEMA}`
  +` — ${naMao.map(d=>d.replace(/\s+/g," ").trim()).join(" | ")}.`
  +" Vidro novo usa os tokens; migrar o que falta baixa este número no mesmo commit");

/* 3 — TODO `backdrop-filter` TEM O PAR `-webkit-`.
   Sem o prefixo o vidro some no Safari, e foi o visual do iPhone que motivou o
   sistema. A conta é por OCORRÊNCIA, não por regra: uma linha nova sem par
   passaria despercebida numa folha de duas mil linhas. */
const semPrefixo=(folha.match(/(?<!-webkit-)backdrop-filter\s*:/g)||[]).length;
const comPrefixo=(folha.match(/-webkit-backdrop-filter\s*:/g)||[]).length;
assert.equal(semPrefixo,comPrefixo,
  `${semPrefixo} declarações de backdrop-filter contra ${comPrefixo} com -webkit-`
  +" — no Safari o vidro sem prefixo simplesmente não existe");

/* 4 — O CUSTO ESTÁ DECLARADO. O bloco de tokens tem de continuar dizendo que o
   filtro custa e que fps se mede antes de levá-lo a uma tela nova; foi um
   `backdrop-filter` não medido que derrubou a partida para 31 fps em 29/07. */
assert.ok(/MEÇA O FPS DELA/.test(folha),
  "o aviso de medir fps sumiu do bloco de tokens — ele é a única memória do custo");

console.log(`glass system: ok (${NIVEIS.length} níveis · ${SUPERFICIES.length} superfícies de referência`
  +` · ${naMao.length} fora do sistema · ${comPrefixo} backdrop-filter com prefixo)`);
