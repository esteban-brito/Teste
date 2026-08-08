# P5 — aplicação, UI e estado: checkpoint de retomada (29/07/2026)

> **LEIA ESTE ARQUIVO INTEIRO antes de alterar `game.js`, `src/application`,
> `src/infrastructure/persistence` ou `src/ui/game`.** Ele foi escrito para uma
> nova sessão do Codex sem memória da conversa, do jogo ou das decisões tomadas.
>
> Este documento não substitui `AGENTS.md`, `docs/retomada-2026-08-05.md`,
> `docs/project-context.md`,
> `docs/ciclos/p2-modularizacao-2026-07-28.md`, `docs/architecture.md` nem
> `docs/testing.md`. Ele é o handoff operacional focado no ciclo P5.

## 1. Decisão do responsável e estado seguro

O responsável interrompeu conscientemente a continuação do P5 porque a próxima
parte importante exigiria aproximadamente uma a duas horas. Esse foi o motivo
histórico deste handoff, não um bloqueio permanente. Em 29/07/2026, o responsável
concedeu a autorização persistente registrada em `AGENTS.md`: numa nova sessão,
leia os arquivos obrigatórios, confirme o estado real e retome autonomamente a
próxima fatia segura, sem esperar uma nova permissão para cada etapa.

O jogo está funcional e o repositório está num ponto seguro. O trabalho restante
é importante para a futura Carreira de Jogador e para manutenção, mas não é uma
emergência para o jogo atual.

Atualização de 30/07/2026: o endurecimento das cartas levou `game.js` de 888 para
889 linhas — um import de aplicação — e acrescentou um contrato pequeno a
`src/application/card-face.mjs`:
`setCardFlipped(card, showBack)` é a única operação que sincroniza a classe visual,
`data-face` e `aria-hidden`. O E2E de cartas cobre teclado, touch, reduced motion,
densidade compacta e geometria; detalhes em `docs/cartas-design-2026-07-28.md`,
seção 11. O marco fechou com `npm run validate` verde, 25/25 suítes em 198,2 s.
Isso não muda a próxima fatia estrutural segura descrita neste handoff.

Atualização de 31/07/2026: a A refinada foi promovida e refinada como única carta
canônica. `game.js` permanece com 889 linhas; as mudanças ficaram no componente,
CSS, laboratório, guardas e cache do deploy. O checkpoint publicado é `7175c26`,
a execução `30652005186` ficou verde e `npm run validate` aprovou 25/25. O
contrato final está em `docs/cartas-design-2026-07-28.md` §14 e a retomada geral
em `docs/retomada-2026-08-05.md`. Isso também não altera a fatia estrutural P5.

Atualização estrutural posterior de 31/07/2026: a primeira fatia recomendada
deste handoff foi executada. Criação/reset de `S`, `TG`, `MP` e `MATCH` vivem em
`src/application/draft`, `src/application/major` e `src/application/match`;
`tools/check-game-state.js` protege shape, isolamento, identidade e quirks, e o
checker do entrypoint impede reinlining. Nenhum controlador foi movido e
`game.js` ficou com 882 linhas. A próxima fatia é somente draft/roleta (§12).

Estado funcional que precede este handoff:

- branch: `sandbox-test`;
- commit de código: `57f5699a724f45f50ab7ecc677a1673be3299509`;
- `HEAD` e `origin/sandbox-test` apontavam para o mesmo commit;
- worktree limpo antes da criação deste documento;
- todos os commits de código descritos aqui já estavam publicados;
- `main` permaneceu intocável;
- nenhum snapshot ou golden foi atualizado;
- não há commit local de código aguardando push.

O commit que adiciona este handoff vem imediatamente depois de `57f5699`. Ao
retomar, confirme a realidade com `git status --short --branch` e `git log`, pois
o repositório pode ter avançado depois de 29/07/2026.

## 2. Leitura obrigatória numa sessão sem memória

Leia nesta ordem:

1. `AGENTS.md` — branch, disciplina, validações e invariantes;
2. `docs/retomada-2026-08-05.md` — checkpoint geral e prioridades atuais;
3. este arquivo — ponto operacional do P5;
4. `docs/ciclos/p2-modularizacao-2026-07-28.md` — como o motor foi extraído e como RNG
   e paridade foram provados;
5. `docs/project-context.md` — histórico, roadmap completo e visão da Carreira;
6. `docs/architecture.md` — camadas e dependências permitidas;
7. `docs/testing.md` — grupos, guardas e comandos;
8. `src/data/catalog.mjs` — antes de afirmar que qualquer dado não existe;
9. `game.js` — somente depois das leituras acima, para conferir o estado atual.

Se a tarefa tocar avaliação, química ou simulação, leia também os ADRs e as
referências indicadas pelo P2. Não deduza contratos do motor apenas pelo uso na UI.

## 3. O que foi concluído antes do P5

O ciclo P2 de modularização por paridade terminou por completo. Dados e motores
saíram de `game.js`; jogo, sandbox, worker e bancada passaram a usar as APIs
públicas compartilhadas.

Fechamento relevante do P2:

| commit | resultado |
|---|---|
| `7b5ce6d` | jogo migrou para `src/public/simulation-api.mjs` |
| `2897fdf` | bancada migrou para a API pública; 28 checadores diferenciais transitórios foram removidos, com 2.107 deleções |
| `4945d47` | bloco legado do motor foi removido de `game.js`; 1.973 deleções no commit e queda de 3.054 para 1.206 linhas |
| `fd79be1` | documentação das guardas permanentes foi consolidada após o P2 |

O P2 terminou com `npm run validate` verde em 24/24 suítes, 168,3 segundos, sem
mudar roster snapshot, goldens, dados, `CFG_*`, classificações ou consumo de RNG.
Os detalhes e as armadilhas descobertas estão no relatório P2; não os replique de
memória.

## 4. O que foi concluído no P5 em 29/07/2026

Foram feitos quatro commits estruturais, todos publicados em `sandbox-test`:

| commit | fatia | efeito em `game.js` | prova permanente |
|---|---|---:|---|
| `87521dc` | Web Audio | 1.206 → 1.121 linhas | `tools/check-audio-module.js` |
| `8eace9e` | progresso/localStorage/backup | 1.121 → 1.105 linhas | `tools/check-progress-store.js` |
| `bef00b5` | cartas, verso e resumo de química | 1.105 → 1.029 linhas | primeira parte de `tools/check-game-view-modules.js` |
| `57f5699` | times, Suíça, playoffs, partida, final e Hall | 1.029 → 938 linhas | contrato ampliado de `tools/check-game-view-modules.js` |

Resultado acumulado deste P5:

- `game.js` caiu de 1.206 para **938 linhas**;
- Web Audio não está mais embutido no entrypoint;
- persistência e backup não estão mais embutidos no entrypoint;
- os templates HTML determinísticos não acessam mais DOM ou estado global;
- o entrypoint ainda coordena estado, eventos, timers e fluxo;
- nenhum algoritmo esportivo, valor, threshold, chamada de RNG ou dado foi
  deliberadamente alterado.

### 4.1 Áudio

Fonte atual: `src/application/audio.mjs`.

- exporta `createAudio()` para teste e o singleton `Audio` para o jogo;
- preserva volume mestre `0.65`, desbloqueio iOS, mute e todos os efeitos;
- continua usando `Math.random()` apenas para ruído/variação sonora;
- não usa o Mulberry32 do simulador e não conhece estado esportivo;
- importar o módulo não cria `AudioContext`; `Audio.init()` continua dependente de
  gesto do usuário.

### 4.2 Persistência do progresso

Fonte atual: `src/infrastructure/persistence/progress-store.mjs`.

- exporta `createProgressStore()` e o singleton `PROGRESSO`;
- chave preservada: `draft90.progresso.v1`;
- schema preservado:

```js
{
  versao: 1,
  titulos: [],
  recordes: {},
  contadores: { campanhas: 0, titulos: 0, invictos: 0 }
}
```

- leitura inválida ou storage bloqueado volta ao objeto vazio;
- erro de quota no save não interrompe o jogo;
- importação continua validando superficialmente a versão e os três blocos;
- exportação continua baixando `draft9-0-progresso.json` como JSON;
- o módulo **não carrega sozinho**: `PROGRESSO.carregar()` permanece chamado por
  `game.js` durante a inicialização. Preserve esse momento até haver teste para uma
  mudança deliberada.

### 4.3 Views puras

O escape compartilhado vive em `src/ui/shared/html.mjs`. Os seis módulos em
`src/ui/game/` são:

```text
build-summary-view.mjs  selos do resultado de química
card-view.mjs           fita da roleta, frente/verso e tiers das cartas
team-view.mjs           monograma, chip, cabeçalho ao vivo e antessala
tournament-view.mjs     colunas da Suíça e bracket dos playoffs
match-view.mjs          tabela inicial do placar ao vivo
history-view.mjs        manchete, campanha final, placar final e Hall da Fama
```

Esses módulos recebem dados prontos e retornam strings/objetos de strings. Eles
não devem importar DOM, estado global, áudio, storage ou simulador. O DOM continua
sendo atualizado por `game.js`.

`tools/check-game-entrypoint.js` impede que essas responsabilidades principais
voltem a ser embutidas. `tools/check-game-view-modules.js` congela:

- escaping existente (aspas simples continuam sem escape, por paridade);
- cinco tiers visuais;
- frente e verso de jogador e treinador;
- ordem peso × valor das estatísticas do playstyle;
- prioridade e valores dos selos de química;
- identidade visual e placeholders dos times;
- nove grupos possíveis e 16 slots finais da Suíça;
- quartas, resultados, semifinais e coroação dos playoffs;
- cabeçalhos e colunas do placar;
- manchete, MVP, jornada, ratings e recordes da campanha;
- estado vazio, títulos, contadores e recordes do Hall.

## 5. Arquitetura executável atual

```text
index.html
  -> game.js (aplicação, estado, eventos, timers e mutação de DOM)
       -> src/public/simulation-api.mjs
            -> src/public/evaluation-api.mjs
            -> src/data/**
            -> src/domain/**
       -> src/application/audio.mjs
       -> src/infrastructure/persistence/progress-store.mjs
       -> src/ui/shared/html.mjs
       -> src/ui/game/*.mjs

sandbox.html + calibrador-worker.js + bancada/lib/motor.js
  -> a mesma src/public/simulation-api.mjs
```

Arquivos grandes que permanecem (medidos em `8a12250`, 29/07/2026):

- `game.js`: **888 linhas** — eram 938 no commit-base deste handoff (`57f5699`); a
  diferença saiu da remoção do tilt morto em `458c6b4`;
- `sandbox.html`: 4.205 linhas, inalterado;
- `style.css`: **971 linhas** — eram 1.291 antes da fusão das camadas de cascata
  (`3a221e2`, `832017b`), que removeu duplicação e CSS morto sem mudança visual,
  provada pelo comparador de `tools/visual-regression.js`.

Medição vigente, provada por `tools/check-doc-measurements.js` a cada
`npm run check`:

<!-- medicao-verificada -->

| arquivo | linhas |
|---|---:|
| `game.js` | 1618 |
| `sandbox.html` | 4205 |
| `style.css` | 2358 |
| `prototipo-cartas.html` | 842 |

Até 01/08/2026 este parágrafo dizia "medição vigente" e errava três dos quatro
números — `style.css` 1.031 quando eram 1.261, `prototipo-cartas.html` 392 quando
eram 592 e `game.js` 889 quando eram 882. A tabela acima é executável: mexer nos
arquivos sem atualizar o número reprova o `check`. O crescimento do CSS pertence
ao componente canônico e às três densidades comprovadas; não muda a recomendação
de separar estado antes de controladores.

Tamanho não é autorização para dividir ou apagar. `sandbox.html` ainda possui
dívida própria do P6; `style.css` não deve ser reorganizado junto com estado ou
controladores.

## 6. Validação do estado final de código

No checkpoint histórico `57f5699`, passaram:

- `npm run check` — sintaxe e todas as guardas permanentes, incluindo áudio,
  progresso, views, APIs públicas, sandbox, catálogo, add-team, RNG e estatística;
- `npm run lint` — limpo, sem warnings;
- `npm run test:data` — verde; permanecem 14 warnings conhecidos de treinador sem
  `coachPais` inline, usando `PAIS_TREINADOR` como projetado;
- `npm run test:regression` — 9/9 suítes, snapshot e golden idênticos;
- `npm run test:e2e` — as 3 suítes então existentes, em 82,5 s:
  - intenções no calibrador: 59,7 s;
  - aba Simular: 6,5 s;
  - jogo completo: 15,6 s.

O E2E final percorreu draft, lineup, força/química, Major com 16 times, Suíça,
quartas, semifinal, final, título, ratings, recordes, reinício, reload e Hall.

Benchmark, fidelidade e calibrador Node não foram repetidos nessa última fatia
porque ela moveu somente aplicação/persistência/templates e não tocou avaliação,
química, simulação, scorer, corpus, worker ou busca. O último `validate` integral
do fechamento P2 era 24/24. A bancada atual acrescentou o E2E de cartas e possui
25 suítes; o checkpoint `7175c26` aprovou `npm run validate` 25/25 em 184,2 s.
Ao tocar uma área, siga a matriz obrigatória do `AGENTS.md`; não use esta
justificativa para pular uma suíte pertinente.

Na fatia de estado de 31/07/2026 passaram `npm run check`, `npm run lint`,
`npm run test:data`, as 9 suítes de regressão e os 4 E2E em 85,4 s. Snapshot,
golden e sequência do Mulberry32 permaneceram idênticos. A guarda nova também
foi verificada reprovando quando `resetDraftState()` passou temporariamente a
zerar `justPlaced`, antes da restauração do contrato correto.

## 7. Mapa histórico das 889 linhas de `game.js`

Linhas medidas no commit `8a12250` (29/07/2026) — confira novamente se o arquivo
avançou. O mapa anterior era do commit-base `57f5699` e tinha uma faixa de tilt que
**não existe mais**: `458c6b4` removeu o efeito, e não há nenhuma ocorrência de
`tilt` em `game.js` ou `style.css`.

Depois da extração exclusiva de estado descrita na atualização acima, o arquivo
tem 882 linhas e as faixas abaixo deslocaram alguns números. O agrupamento de
responsabilidades continua válido como mapa histórico; não use as linhas como
endereços atuais sem conferir o arquivo.

```text
1–24    imports, contratos públicos, constantes e criação da view de cartas
26–41   estado S do draft, sessão de giro e referências DOM principais
43–51   modo virar (frente/verso das cartas)
53–108  elenco cheio, HUD com count-up, resultado de química e trava do giro
110–158 roleta: offset medido no DOM, parada, fita idle, aborto e revelação
160–245 sortear: fita, transição, tick sonoro e explosão de vitória
247–302 lineup, picks e iluminação de slots
304–386 seleção, colocação, troca e reset do draft
388–435 wiring de botões e delegação de click/keydown
437–469 criação do time do usuário e início do Major
470–522 progresso, manchete, registro de partida e fim de campanha
523–547 tela final
548–611 Suíça (pareamento, anti-rematch, resolução dos NPCs)
613–669 playoffs: seeds, avanço de fase e bracket
671–683 abrir/fechar overlays e wiring do torneio
685–787 reprodução cinematográfica de mapa e scoreboard
789–845 orquestração de série MATCH e ponte E2E
846–880 reinício, Hall, importação e visibilidade da seção do Major
882–888 desbloqueio de áudio no primeiro gesto e inicialização final
```

O próximo problema não é a quantidade de linhas isoladamente. As fábricas e
resets já saíram, mas os controladores ainda fecham sobre as instâncias mutáveis,
DOM, timers e callbacks no mesmo entrypoint.

## 8. Contratos exatos dos estados extraídos

As formas abaixo vivem agora nos três módulos listados na seção 11. Os
controladores continuam mutando as mesmas instâncias compostas por `game.js`.

### 8.1 `S` — draft

Estado inicial atual:

```js
{
  jogadores: Array(5).fill(null),
  treinador: null,
  drawn: null,
  taken: new Set(),
  sel: null,
  spinning: false,
  justPlaced: null
}
```

Armadilhas:

- `taken` é um `Set` cuja identidade é preservada; resets chamam `.clear()`;
- `resetar()` e `jogarNovamente()` fazem `Object.assign` apenas em
  `jogadores`, `treinador`, `drawn`, `sel` e `spinning`;
- esses resets **não atribuem `justPlaced`**. Não “corrija” isso durante a primeira
  movimentação estrutural;
- o array de jogadores sempre nasce com cinco posições;
- a UI, a roleta e os handlers capturam a referência de `S`; substituir o objeto
  durante reset pode quebrar closures.

### 8.2 `TG` — Major

`TG` nasce exatamente como `{}`. `iniciarTorneio()` adiciona:

```js
{
  times,
  rodada: 0,
  classificados: [],
  eliminados: [],
  playoffs: null,
  campanha: { mapasV: 0, mapasD: 0, ratings: {}, jornada: [], fim: null }
}
```

`jogarNovamente()` preserva a identidade de `TG` e atribui `times=null`,
`rodada=0`, arrays novos, `playoffs=null` e `campanha=null`. O estado inicialmente
`undefined` e o estado após reset `null` são diferentes; não normalize essa
diferença junto com a extração.

### 8.3 `MP` — reprodução do mapa

Estado inicial atual:

```js
{
  ativo: false,
  timer: null,
  onFim: null,
  gen: 0,
  jogo: null,
  ctx: ""
}
```

`MP.sb` é adicionado dinamicamente por `montarScoreboard()`. A geração `gen`
invalida timers órfãos: `pararReproducao()` incrementa o número e não deve ser
substituído apenas por `clearTimeout`. `onFim` é consumido e zerado uma única vez.

### 8.4 `MATCH` — série do jogador

Estado inicial atual:

```js
{
  A: null,
  B: null,
  md: 1,
  mapaIdx: 0,
  vA: 0,
  vB: 0,
  contexto: "",
  onSerieFim: null
}
```

Armadilhas:

- `rodando` não existe no literal inicial; é criado por `abrirPartida()` e aparece
  no reset de `jogarNovamente()`;
- a ponte E2E expõe `getMatch: () => MATCH`; a identidade do objeto faz parte do
  contrato observável;
- `MP` e `MATCH` se cruzam: parar reprodução escreve `MATCH.rodando=false`;
- `onSerieFim` deve disparar apenas uma vez e é zerado antes do callback;
- o placar `[vA, vB]` preserva a orientação da série, inclusive ao mapear o time
  do usuário no bracket.

## 9. RNG, timers e ordem de efeitos — não “limpar” sem prova

Existem duas famílias de aleatoriedade no entrypoint:

- `Math.random()` alimenta a roleta visual/draft e variações de áudio;
- `rndF()` pertence à sessão Mulberry32 pública e alimenta o Major/simulação.

Ao extrair controladores, não troque uma pela outra, não adicione amostras e não
mude a ordem das chamadas.

Contratos sensíveis ainda em `game.js`:

- `SPIN_MS=2700` e `WIN_INDEX=44` fazem parte da roleta atual;
- `RITMO={base:260,troca:1000,inicio:500}` controla a reprodução;
- `spinSession` e `spinCleanup` invalidam callbacks antigos da roleta;
- `MP.gen` invalida callbacks antigos da reprodução;
- `iniciarTorneio()` faz Fisher–Yates com `rndF()`, remove exatamente um NPC com
  maior sobreposição de nicks, limita a 15 NPCs e acrescenta o time do usuário;
- `sortearFormaCampanha(TG.times)` é chamado uma vez por Major;
- a Suíça embaralha cada bucket com Fisher–Yates, tenta evitar rematch e resolve
  pares NPC na ordem atual;
- `Object.values(POOL).forEach(delete _formaCamp)` prepara a nova campanha;
- mudar ordem de render, callbacks ou resets pode mudar o ponto em que usuário e
  E2E observam o estado, mesmo sem alterar o resultado final.

## 10. O que realmente falta e por que foi adiado

### Importante antes da Carreira

1. ~~**Separar os quatro estados** sem mudar formas, identidades ou reset.~~
   **Concluído em 31/07/2026.**
2. **Extrair controladores**, um por vez: draft, Major e partida/reprodução.
3. Tornar DOM, timers, áudio e persistência dependências explícitas desses
   controladores.
4. Manter o E2E completo como prova da composição real.

Isso reduz o risco de a futura Carreira compartilhar ou corromper estado do modo
atual. Não é necessário para jogar hoje, mas é fundação relevante para o ciclo
posterior da Carreira. O P6 do roadmap estrutural trata de sandbox/calibrador e
permanece separado.

### Importante depois, em ciclo separado

- decompor a UI interna de `sandbox.html`;
- remover o loader legado que ainda interpreta o script inline do sandbox;
- auditar arquivos órfãos por grafo de uso e Git antes de apagar qualquer coisa.

### Não é prioridade

- perseguir uma meta arbitrária de linhas;
- criar um arquivo minúsculo para cada função;
- renomear tudo por estética;
- formatar em massa;
- mover CSS junto com controladores;
- apagar arquivo apenas porque parece antigo ou duplicado.

## 11. Fatia de estado concluída

A mudança separou **somente estado**, sem mover controladores no mesmo commit.

Estrutura entregue, alinhada ao roadmap:

```text
src/application/draft/draft-state.mjs
  createDraftState()
  resetDraftState(state)

src/application/major/major-state.mjs
  createMajorState()
  resetMajorState(state)

src/application/match/match-state.mjs
  createMapPlaybackState()
  createMatchState()
  resetMatchState(state)
```

Contratos cumpridos nessa primeira fatia:

1. as formas exatas registradas na seção 8 foram copiadas;
2. referências dos objetos e do `Set` são preservadas nos resets;
3. a ausência inicial de `MATCH.rodando` e o `TG={}` inicial foram preservados;
4. `sortear`, `avancarSuica`, `avancarPlayoff`, `reproduzirMapa` e
   `continuarPartida` continuam no entrypoint;
5. `tools/check-game-state.js` cobre
   shapes, instâncias independentes, identidade após reset e os campos
   deliberadamente não tocados;
6. a guarda integra `npm run check`. O checker do entrypoint cobre o reinlining
   **contando as chamadas** de cada fábrica e reset — reinlinar apaga o call
   site, seja qual for a grafia. A primeira versão comparava o texto do reset
   antigo e deixava passar `Object.assign(S,{treinador:…,jogadores:…})` com as
   chaves noutra ordem; `no-unused-vars` é `warn`, então o import órfão também
   não reprovava o lint. As contagens valem para o wiring atual: quando os
   controladores saírem (§12), atualize os números junto com a extração;
7. este handoff e `docs/project-context.md` foram atualizados na mesma fatia;
8. a matriz de validação de estado/controladores continua obrigatória antes do
   commit;
9. qualquer controlador permanece para outro commit.

Estimativa dada ao responsável em 29/07/2026:

- estados: 15–25 minutos;
- controladores: mais 45–90 minutos;
- auditoria final de órfãos: 20–40 minutos;
- bloco estrutural realmente importante: aproximadamente 1–2 horas.

Essa estimativa foi o motivo da pausa, não um bloqueio técnico.

## 12. Próxima fatia e sequência dos controladores

A fatia de estado está verde. A ordem recomendada agora é:

1. controlador do draft/roleta;
2. controlador do Major (criação, Suíça e playoffs);
3. controlador de série e reprodução;
4. wiring DOM fino no entrypoint;
5. auditoria de referências e arquivos órfãos;
6. somente então reavaliar o encerramento do P5.

Não extraia os três controladores num único commit. O Major contém o risco maior
por consumo de `rndF()`, ordem de pareamento, identidade por referência e callbacks
de série.

## 13. Limpeza e exclusões já realizadas

“Limpeza” já incluiu deleções materiais, mas somente após os consumidores migrarem:

- 28 checkers diferenciais transitórios removidos em `2897fdf`;
- bloco legado de dados/motores removido de `game.js` em `4945d47`;
- total dessas duas consolidações: mais de 4.000 linhas removidas;
- P5 moveu responsabilidades, mas não apagou assets, dados ou documentação útil.

### Auditoria de órfãos executada em 31/07/2026

A auditoria pedida abaixo foi feita: grafo completo de imports (estáticos e
dinâmicos) de todo arquivo versionado, cruzado com `package.json`, o workflow,
referências em HTML e citações em documentação.

Resultado:

- **nenhum módulo órfão em `src/`** — tudo é alcançável por `game.js`,
  `sandbox.html`, `prototipo-cartas.html` ou `bancada/lib/motor.js`. As três
  estatísticas (`sample-summary`, `paired-comparison`, `proportion-interval`) só
  aparecem por `import()` dinâmico e `require` de `.mjs`; uma busca ingênua as
  declara órfãs por engano;
- **`bancada/ferramentas/classificacao.js` e `bancada/ferramentas/serie.js` NÃO são órfãos.** Eles se
  declaram no cabeçalho como bancadas de trabalho fora do `run.js`, de propósito.
  Não os remova por não aparecerem em `SUITE_GROUPS`;
- removido `instalar-drop-iphone.sh`: instalador de uso único que entrou junto com
  o próprio commit que ele criava (`9cbaf2e`) e cujos companheiros já haviam saído
  em `838bf98`. Zero referências em qualquer arquivo versionado;
- resíduo **não versionado** apagado do disco (≈422 MB): `tmp/` com 61 arquivos do
  ciclo A/B de cartas e das capturas do experimento R5, e as quatro pastas
  `visual-card-*`, que por contrato nunca são versionadas nem reutilizadas entre
  sessões;
- **não tocar:** `.venv-fidelity/` e `fidelity-corpus/raw/` somam ~1,4 GB mas são o
  pipeline IFCS offline documentado; o `.dem` de `raw/` é a entrada selada em
  `fidelity-corpus/parser-proof.json`.

O roteiro original, que continua válido para a próxima vez:

1. começar com `git status` e `rg --files`;
2. conferir imports, scripts do `package.json`, referências HTML, docs e workflow;
3. distinguir fonte, artefato gerado e material histórico útil;
4. respeitar que `elencos.html` é gerado, não órfão;
5. não versionar demos, `processed/`, `private-audit/`, cookies ou credenciais;
6. apagar em commit próprio, com prova de que checks e fluxos não dependem dos
   alvos.

## 14. Avisos conhecidos que não são falhas novas

- `npm run test:data` informa 14 ocorrências de treinador sem `coachPais` inline;
  o fallback `PAIS_TREINADOR` é o contrato atual;
- o catálogo declara uma divergência conhecida, `camp-empacotado`, e continua
  verde;
- o corpus IFCS oficial ainda não está completo; não chamar baseline técnico de
  nota oficial;
- `sandbox.html` ainda é grande e possui loader inline legado;
- persistência atual serve ao histórico do modo existente; uma Carreira exigirá
  contrato próprio, migrations e IDs persistentes conforme `project-context`;
- `game.js` ter 882 linhas não significa que todas devam sair.

## 15. Validação e disciplina ao retomar

Antes de editar:

```text
git status --short --branch
npm ci                         # se dependências não estiverem instaladas
npm run check
```

Para estado/controladores do jogo, antes de commitar:

```text
npm run check
npm run lint
npm run test:data
npm run test:regression
npm run test:e2e
```

Rode benchmark, fidelity ou calibrator quando a matriz de `AGENTS.md` exigir.
Nunca reduza amostras para ganhar tempo. Nunca atualize snapshot/golden para fazer
uma refatoração passar.

A regra persistente é a do `AGENTS.md`: commits e push de checkpoints verdes para
`sandbox-test`, inclusive o deploy automático de Pages, estão autorizados sem
nova confirmação. Merge em `main`, mudança de branch, force-push e reescrita de
histórico continuam exigindo pedido explícito.

## 16. Critério de encerramento do P5

O P5 pode ser considerado estruturalmente encerrado quando:

- ~~`S`, `TG`, `MP` e `MATCH` tiverem criação/reset testáveis fora do
  entrypoint;~~ concluído;
- draft, Major e partida tiverem controladores com dependências explícitas;
- `game.js` atuar principalmente como composição e wiring de DOM;
- nenhuma renderização recalcular regra esportiva;
- nenhuma mudança tiver alterado dados, configurações, RNG ou balanceamento;
- o fluxo completo continuar verde no E2E;
- documentação e inventário de arquivos refletirem a árvore real.

Até lá, o P5 está **em andamento, num checkpoint verde e autorizado a prosseguir**
pela próxima fatia segura — não bloqueado e não abandonado.
