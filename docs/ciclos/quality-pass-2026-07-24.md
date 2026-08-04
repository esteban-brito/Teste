# Passada de qualidade — bugs, performance e limpeza (24/07/2026)

Escopo: varredura estática + dinâmica de `game.js`, `sandbox.html`, `bancada/`, `tools/`,
`src/` e docs, com foco em bugs, performance e lixo. Regra desta passada: preservar 100% do
comportamento observável (golden, snapshot e paridades idênticos; nenhuma mudança de RNG,
config ou balanceamento).

Baseline registrado antes de qualquer mudança: `npm run check` 2,8 s · `npm run lint` 2,5 s ·
`npm run bench` com 16/19 suítes verdes e tempos por suíte em anexo ao PR (rating 52,4 s ·
realismo 38,9 s · calibrador 30,6 s · assists 15,9 s · kda 15,6 s). As 3 vermelhas eram os
E2E — ver achado 1.

## Achados corrigidos

### 1. [bug/infra · alta] E2E impossíveis de rodar fora da CI com cache de browser divergente
- **Onde:** `bancada/suites/e2e-intent.js:42`, `bancada/suites/e2e-simulation.js:35`, `bancada/suites/e2e-game-flow.js:117`.
- **Repro:** container padrão com Chromium pré-instalado (`chromium-1194` em
  `PLAYWRIGHT_BROWSERS_PATH`) e Playwright fixado em `^1.61.1` → os três E2E abortam com
  `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1228/...`.
  O contrato "ausência de infra falha visível" estava correto, mas a suíte não oferecia NENHUM
  caminho para usar um Chromium local válido — só CI conseguia rodar E2E.
- **Correção:** helper `chromiumLaunchOptions()` em `bancada/lib/common.js`, usado pelos três E2E.
  Sem a env `CHROMIUM_EXECUTABLE`, o comportamento é byte a byte o de antes (mesmo objeto
  `{headless:true}`); com ela, `executablePath` aponta o binário local. Caminho inválido
  continua falhando visível — nada converte falta de browser em sucesso.
- **Prova:** `CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e` → 3/3 suítes
  verdes (antes: 3/3 vermelhas neste ambiente); sem a env, mesmo erro visível de antes.

### 2. [performance · média] Recomputação integral da estatística individual a cada tecla
- **Onde:** `sandbox.html`, `simPlayerDistributionRows` (consumida por `refreshSimPlayerView`,
  reset e exportação CSV).
- **Medição (antes):** cada chamada recalcula `describeSample` + `percentileRange` +
  `meanConfidenceInterval` para todos os participantes — cada uma reordena o array de amostras
  do jogador. Em cenário liga (85 jogadores × 288 amostras): **13,4 ms por chamada** (medido em
  Node com o módulo real), disparada a CADA tecla da busca, troca de filtro/ordenação/direção,
  seleção de comparação, reset e exportação — sendo que as estatísticas não mudam quando só a
  visão muda.
- **Correção:** memoização por lote (`WeakMap` keyed no objeto do batch — cada execução cria um
  batch novo em `newSimAcc`, então não existe cache velho; o batch é imutável depois do run).
  A construção original virou `simPlayerRowsBuild`; a API e a saída são idênticas.
- **Medição (depois):** primeira renderização paga o custo uma única vez; toda interação
  subsequente é cache hit (~0 ms de estatística). Também elimina os recomputes duplicados que
  já ocorriam num mesmo fluxo (painel + reset + CSV).
- **Prova de preservação:** `npm run test:e2e` verde (o `e2e-simulation` dirige busca, filtros,
  ordenação, comparação e CSV com valores exatos); check/lint/regression/calibrator verdes.

## Achados reportados (sem mudança — exigiriam decisão de balanceamento)

### 3. [precisa-decisão · baixa] Fallback contraditório no peso de assist
- **Onde:** `game.js` (pick de assistente): `C.ASSIST_BASE+C.ASSIST_UT_W*(venc.stats[i].ut||40)`.
- **Fato:** `prepTime` já garante `ut:j.ut??50`, então `||40` só age quando `ut === 0` — valor
  alcançável apenas por jogador editado no sandbox (nenhum dos 85 reais tem `ut=0`; verificado).
  Nesse caso um jogador com ZERO utility pesa como se tivesse 40. Corrigir muda o sorteio
  ponderado nesses cenários (saída muda) → fica registrado para um futuro commit de
  balanceamento, se o responsável quiser.

### 4. [design confirmado · info] Drop silencioso em `dedupeLevers`
- **Onde:** `sandbox.html:2160` — `try{k=knobKey(l.make(.1));}catch{return;}`.
- **Veredito:** defensivo intencional: uma alavanca candidata inválida não pode derrubar a busca
  inteira do calibrador; descartá-la é a semântica desejada de um gerador de candidatos. Sem
  mudança.

## Varreduras com resultado limpo (nada a corrigir)

- **NaN/fronteiras do combate:** 0 valores não-finitos em 20.000 player-maps (seed 999) e no
  caminho de time incompleto (`prepTime` clonando, 200 mapas, seed 777). `preservationEdge`/
  `tradeChance`/`assistPresenceTotal` têm guarda real no fluxo (o `break` de eliminação total
  precede as médias; presença mínima 0,5 × 4 slots).
- **`scheduledMatch`:** nunca gera auto-confronto e cobre os 16 adversários por ciclo (análise
  modular do índice).
- **Código morto:** 0 funções sem referência em `game.js` e em `sandbox.html`; 0 exports mortos
  em `src/` (os dois suspeitos, `quantileSorted` e `distributionSummary`, são usados por acesso
  qualificado em `bancada/suites/auditoria.js` e `bancada/suites/r5-comparison.js`).
- **CSS órfão:** 0 (as classes `coach-*` são construídas dinamicamente em `game.js:1578`).
- **Sobras de debug:** 0 `console.*` indevidos (os 3 do sandbox são `console.error` legítimos de
  fallback de workers/erro visível).
- **CSV:** escaping e neutralização de fórmula (`'` para `=+-@\t\r`) corretos em `simCsvCell`;
  números negativos não são neutralizados indevidamente (checagem de `typeof`).
- **Consistência entre placares:** formatação idêntica de K/D/A/KAST/ADR/Rating entre o jogo
  (`preencheFinais`) e o sandbox (`scoreTable`).
- **Docs:** sem referência a arquivo inexistente (falsos positivos do verificador eram basenames
  citados em contexto de diretório e o futuro `career.html`, declarado como visão).

## Validação final

Mudanças tocam apenas `bancada/lib/common.js`, os 3 E2E e o painel individual do `sandbox.html`
(camada de visão). Gates executados após as mudanças: `npm run check` (15 paridades) ✓ ·
`npm run lint` ✓ · `test:data` ✓ · `test:regression` (golden + snapshot idênticos) ✓ ·
`test:calibrator` ✓ · `test:e2e` 3/3 ✓ (com `CHROMIUM_EXECUTABLE` local). Motor intocado:
nenhum `CFG_*`, RNG, dado ou classificação mudou — o grupo benchmark permanece coberto pelo
baseline registrado (16/16 não-E2E verdes antes e nenhum arquivo de motor alterado).
