# Estratégia de testes

## Princípio

Os testes protegem comportamento, não a organização interna. Uma extração de
módulo deve manter snapshots, seeds, métricas e contratos públicos. Alteração de
limite estatístico exige justificativa de balanceamento separada.

A futura nota consolidada de realismo segue o IFCS definido em
`docs/realism-methodology.md`. Até o corpus real auditado ser implementado, as
faixas atuais são guardas de regressão, não uma nota de 0–100.

## Grupos atuais

| Comando | Suítes | Finalidade |
|---|---|---|
| `npm run test:data` | `times.js` | integridade de jogadores, times e derivados |
| `npm run test:regression` | auditoria, snapshot, drop, golden, comparador R5, varredura e abertura | classificação, invariantes, resultados completos, pareamento e peso do sorteio de abertura |
| `npm run test:calibrator` | basic, heavy, worker | busca, intenção, custo e paralelismo |
| `npm run test:benchmark` | realismo, assists, KDA, rating, perfis, dificuldade | fidelidade estatística dos motores, coerência de carta e dificuldade da campanha |
| `npm run test:fidelity` | scorer e corpus IFCS | matemática, cobertura, caps, proveniência e auditoria |
| `npm run test:e2e` | cards, intent, simulation, game flow | cartas, calibrador, aba Simular e jogo principal no navegador |
| `npm run test:r5` | comparador pareado R5 | hashes, cobertura, delta nulo e detecção sintética |
| `npm run test:r5:tails` | guardas de cauda R5.2 | ratings extremos, forma positiva e ausência de massa nos limites antigos |
| `npm run test:all` | as 25 suítes acima | validação completa na ordem histórica |
| `npm run bench` | alias de `test:all` | compatibilidade com CI e fluxo legado |

`npm run validate` executa sintaxe, lint e as 25 suítes.

`npm run check` inclui ainda `check-audio-module.js`, que usa um Web Audio falso
para provar inicialização, volume mestre, desbloqueio iOS, síntese, mute e
isolamento de instâncias sem depender de hardware ou de um navegador real.

`check-progress-store.js` cobre schema, fallback sem storage, save, importação,
download do backup e isolamento de instâncias com adaptadores falsos de navegador.

`check-game-view-modules.js` congela escaping, cartas, tiers, selos, identidade
dos times, Suíça, playoffs, placar, antessala, campanha final e Hall sem DOM.

`bancada/e2e-cartas.js` é a guarda geométrica e interativa das cartas. Mede 145
cartas em oito larguras, nos estados publicado e proposta, e reprova estouro
horizontal, recorte vertical e colisão entre regiões. No jogo real, prova a
costura do layout compacto, frente/verso acessível por teclado, reset do modo
Virar, seleção normal, `prefers-reduced-motion` e ausência de hover preso em
dispositivos touch. Casos sintéticos garantem que o detector não esteja sempre
verde e separam falha real de reticências deliberadas.

Os servidores efêmeros dos E2E devem usar faixas aceitas pelo Chromium. O fluxo
principal usa 7000–7299; a faixa antiga 5900–6199 incluía a porta 6000, que o
navegador bloqueia com `ERR_UNSAFE_PORT` antes de qualquer teste de produto.

## Comparador visual (não é suíte, é instrumento)

`tools/visual-regression.js` fotografa o jogo em 3 larguras × 7 estados (inicial,
cartas, versos, elenco completo, suíça, antessala e mapa ao vivo) e compara duas
execuções pixel a pixel. Ele existe porque o E2E prova que os elementos existem e
que o fluxo funciona, mas nenhuma suíte percebia se algo tinha ficado feio.

```bash
npm run visual:capturar -- visual-antes
# aplique a mudança
npm run visual:capturar -- visual-depois
npm run visual:comparar -- visual-antes visual-depois
```

`comparar` sai com código 1 se houver diferença e informa a caixa envolvente e a
primeira cor divergente, o suficiente para localizar a região.

Determinismo depende de três travas descritas no cabeçalho do arquivo: `Math.random`
substituído antes dos scripts da página (a roleta não usa o RNG semeado), `srand`
fixado pela ponte `?e2e=1` antes da fase suíça, e todas as animações congeladas no
mesmo quadro — com atraso `-10s`, para que as animações de entrada fiquem no quadro
FINAL e não no primeiro. Antes de confiar num resultado, rode duas capturas sem
mudar nada: a diferença tem de ser zero.

**Não há imagens de referência versionadas.** Guardar PNGs no Git faria de toda
mudança de design deliberada um commit de binários; a prova é sempre entre duas
execuções da mesma sessão, e as pastas de saída são ignoradas pelo Git.

Em 29/07/2026 este instrumento pegou três mudanças visuais silenciosas durante a
fusão das camadas de cascata do `style.css` — nenhuma delas visível na leitura do
código, todas prontas para ir ao ar.

## Suítes de forma (medição, não gate)

`perfis.js`, `dificuldade.js` e a seção FORMA de `realismo.js` medem **distribuição**,
não média: assinatura por função e playstyle, sobreposição entre bandas de OVR,
variância intra-jogador, peso do contexto, kills por round, método do round e
probabilidade de campanha invicta.

Elas rodam em modo relatório e não reprovam a suíte enquanto o problema que medem não
for atacado — e cada critério vira gate quando a etapa que o resolve é entregue
(ratchet `ETAPA_ATIVA`). Estado atual: `perfis.js` tem as etapas `rating`, `relogio` e
`abertura` ativas, e só `distribuicao` (desvio intra-jogador, depende de momentum
intra-mapa) espera `PERFIS_STRICT=1`; a seção FORMA de `realismo.js` ainda aceita
`ECONOMIA_STRICT=1`; **`dificuldade.js` virou gate por padrão em 27/07/2026** e só volta
a relatório com `DIFICULDADE_STRICT=0`. O retrato de referência que originou os alvos
está em [`baseline-simulacao-2026-07-26.md`](baseline-simulacao-2026-07-26.md), e a
calibração que fechou a dificuldade em
[`dificuldade-invicto-2026-07-27.md`](dificuldade-invicto-2026-07-27.md).

Toda calibração de constante passa por `bancada/sweep.js`: braços pareados pela mesma
seed e agenda, valor restaurado mesmo após falha, e braço de controle obrigatório
provando que nenhum estado atravessa braços. Proporções raras (a campanha invicta vive
perto de 5%) são relatadas com intervalo de Wilson — sem intervalo, mover o número é
indistinguível de sorte.

O `npm run check` também compara o módulo estatístico compartilhado com as
fórmulas legadas em 5.464 amostras determinísticas, incluindo vazios, extremos,
quantis, imutabilidade da entrada e intervalo de confiança.

Durante P2, checadores diferenciais compararam `combatProfile` (261 casos),
`fallenAngels` (2.048 eventos), `exposureProfile` (175 casos),
`preservationValue`, `tradeContextProfile` e `assistContextProfile` (174 casos
cada), além de todas as fronteiras de avaliação e simulação. Eles foram
aposentados quando a segunda implementação saiu de `game.js`: depois disso,
comparar módulo e adapter seria comparar o módulo consigo mesmo.

A proteção permanente ficou distribuída entre:

- `tools/check-public-evaluation-api.js` e `check-public-simulation-api.js`, que
  exercitam composição, identidade, determinismo e sessões isoladas;
- `tools/check-random-source-contract.js`, com vetores Mulberry32 congelados;
- snapshot do elenco e goldens completos de mapa/campanha;
- regressões funcionais, auditoria de componentes, benchmarks estatísticos e E2E.

Os contratos semânticos continuam: IGL usa a função de combate classificada;
não-IGL preserva a primária; preservação não significa inventário; prontidão de
trade e utilidade disponível não concedem trade, assistência ou KAST sozinhas.

`npm run audit:r5:rating` reconstrói as onze parcelas do FALLEnANGELs a partir
da telemetria e exige igualdade com o rating final de cada player-map. A
execução padrão usa 61.200 mapas-alvo, separa 60/20/20 jogadores por hash
determinístico e não reporta o candidato no holdout de auditoria.

## Estado de referência

- A aplicação possui 17 times e 85 cards de jogador.
- O snapshot deve conter exatamente uma entrada por ID cru de `ATRIBUTOS`.
- Os benchmarks usam amostragem; limites são os contratos, e uma execução
  específica é registrada em `docs/baseline.md`.
- A CI usa Node 20. Desenvolvedores em outra versão devem registrar divergências.

O `docs/baseline.md` é um retrato histórico: sua contagem de 13 suítes corresponde
à captura de 19 de julho de 2026, não à bancada atual. A validação final de P2,
em 28 de julho de 2026, aprovou 24/24 suítes em 168,3 s. Isso confirma regressão;
não é uma nota IFCS oficial.

## Validação do extrator IFCS

O extrator de demos é uma ferramenta Python offline, separada do runtime e da
validação Node:

```text
python -m venv .venv-fidelity
.venv-fidelity/Scripts/python -m pip install -r requirements-fidelity.lock
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --check-environment
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --self-test
```

O ambiente com Awpy 2.0.2 e o autoteste sintético foram aprovados localmente. O
extrator também processou duas vezes a mesma demo CS2 real em destinos novos e
reproduziu mapa, placar, rounds e dez jogadores. A entrada e os resultados
esperados estão selados em `fidelity-corpus/parser-proof.json`. Essa demo FACEIT
acadêmica prova o pipeline, mas não substitui a coleta nem a auditoria do corpus
profissional exigido para a nota.

O piloto profissional FURIA 8–13 Falcons também foi executado duas vezes. O
placar, os 21 rounds, os dez jogadores e os hashes das 21 tabelas derivadas
coincidiram entre as execuções.

O diagnóstico legado pode produzir uma nota técnica preliminar de aderência às
faixas, mas ela deve sempre ser rotulada como `not-ifcs`. A captura atual está
em `docs/fidelity-technical-baseline.json`: 4.000 mapas, 131/136 avaliações
aprovadas e resultado arredondado 96/100.

## Atualização de snapshot

1. Execute `npm run test:regression` e leia todas as diferenças.
2. Confirme que cada jogador alterado pertence ao objetivo aprovado.
3. Execute `npm run snapshot:update`.
4. Revise o diff JSON manualmente.
5. Execute novamente regressão e benchmark.
6. Não misture a atualização com movimentação de arquivos ou formatação.

## Golden do simulador

`npm run test:golden` reconstrói três cenários em motores novos e compara mapa,
placar, todos os rounds, economia, plant, clutch, destaques e estatísticas dos
dez jogadores com `bancada/simulation-golden.json`. A cobertura inclui uma
série melhor de três, prorrogação repetida e paridade entre os modos completo e
leve. Os jogadores são identificados pelo ID cru, não apenas pelo nick.

A suíte também liga a telemetria opcional de rounds em um motor novo, reconcilia
K/D/A/KAST/ADR com o resultado final e exige igualdade profunda, inclusive no
estado posterior do RNG, após remover somente o campo diagnóstico.

O golden é um teste de caracterização: ele prova que uma refatoração preservou
o comportamento observável e o consumo do Mulberry32. Ele não afirma que o
balanceamento congelado é ideal. Uma mudança deliberada de balanceamento deve
ser comparada estatisticamente em commit separado antes de executar
`npm run golden:update`; nunca se atualiza o fixture apenas para esconder uma
regressão.

## Caudas individuais R5

`npm run test:r5:tails` prova, com eventos sintéticos válidos, que o rating pode
atravessar os limites antigos de `0,30` e `3,0`. A mesma suíte amostra 250.000
formas determinísticas e exige valores positivos e finitos, passagem pelos
limites antigos e ausência de massa exatamente em `0,30` ou `2,20`. O teste não
substitui a suíte rara de release: frequências da ordem de 1/10.000 ou 1/100.000
exigem ao menos um milhão de player-maps no gate R6.

## E2E obrigatório

Playwright é uma dependência de desenvolvimento e Chromium é instalado
explicitamente na CI. Ausência da biblioteca, do browser ou falha de lançamento
encerra a suíte com erro. Um E2E pulado não é considerado cobertura.

`e2e-intent.js` protege o editor de atributos e o caminho paralelo do calibrador.
No editor, o navegador valida rascunhos por jogador, aplicação explícita,
restauração individual, descarte, reset global, relatório, exportação JSON e a
ordem visual nome completo → número → slider limitado. `e2e-simulation.js`
protege mapa, lote A × B e amostra round-robin da liga. O contrato inclui
KAST/ADR/Rating, lados, plant e pós-plant, anti-eco, conversão pós-pistol,
clutches, força do favorito, métricas por função, diagnóstico de suficiência,
cobertura dos 17 times, probabilidades bilaterais, seed automática por execução,
rolagem, responsividade, valores inválidos e erros de página. O determinismo do
motor por seed continua sendo um contrato separado, descrito no ADR 0003.

O painel individual também possui contrato explícito: mostra os dez jogadores
de um confronto mesmo com lote abaixo do mínimo estatístico e mostra os 85 IDs
na amostra completa da liga. A quantidade de mapas permanece visível para que
uma linha com pouca amostra não pareça tão confiável quanto uma média longa. O
E2E valida as duas funções de cada jogador, totais de kills, deaths e assists,
K/D e as médias por round KPR, DPR, A/R, KAST e ADR. Valida ainda média,
mediana, desvio-padrão, P5, P95, extremos, P10–P90, IC95%, busca, filtros nas
duas funções, ordenação numérica, comparação de dois jogadores e reset entre
amostras. O download CSV é lido pelo teste para verificar BOM, nome rastreável,
schema de desempenho, respeito aos filtros, escaping e neutralização de
fórmulas.

O contrato visual exige um gráfico acessível por jogador, painéis em largura
integral, tabela desktop sem rolagem horizontal, cabeçalho e três colunas de
identidade fixos, coluna explícita de comparação, legenda completa, escala comum,
ajuda recolhida e ausência de badges repetidos quando toda a amostra é suficiente.
Os filtros se reorganizam em três colunas na largura intermediária e os jogadores
viram cards no celular, sempre sem overflow da página. Os gráficos preservam os
valores numéricos e seus rótulos para leitores de tela.

O mesmo E2E protege a campanha curta: controles próprios, término no segundo
mapa vencido, dois ou três mapas sem repetição, orientação alternada, dez
jogadores, uma amostra por mapa e ausência de apresentação como fidelidade. A
seed `424242` deve reproduzir integralmente `bancada/campaign-golden.json`.

`e2e-game-flow.js` percorre o jogo principal pela interface real: sorteia e
monta os seis slots, valida força e química, disputa Suíça e playoffs, confere
placares e ratings, chega à tela final e reinicia a campanha. O teste escolhe
uma seed vencedora reproduzível para cobrir todas as fases sem alterar o RNG ou
o balanceamento executável do produto.

## Próximas camadas

- Guardas justificadas de caudas, ranking e inversões somente depois de revisar
  a caracterização produzida por R1; R1 e R2 permanecem diagnósticas.
- Distribuição de resultados entre muitas campanhas MD3 e seu contrato de teste.
- Unitários de fórmulas e limites após cada motor ser extraído.
- Integração do torneio sem DOM.
- Screenshots responsivos e com `prefers-reduced-motion`.
- Benchmark de desempenho separado dos asserts de realismo.
- Adquirir, auditar e selar o corpus real; então produzir a primeira baseline
  IFCS sem tuning no mesmo commit.
