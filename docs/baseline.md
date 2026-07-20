# Baseline de comportamento

> Retrato histórico de 19 de julho de 2026. A bancada atual possui 16 suítes;
> consulte `docs/testing.md`. Os números e a contagem abaixo não devem ser
> reescritos retroativamente para parecerem atuais.

- Commit de origem: `f06662a92dd1c6a35c8ce82d24a206e6061b7068`
- Branch: `sandbox-test`
- Data do registro: 2026-07-19
- CI: Node 20
- Ambiente local desta captura: Node 26.4.0, npm 11.17.0

Este documento identifica o estado anterior à modularização. Os limites
executáveis continuam nos testes; os números abaixo ajudam a investigar uma
diferença, mas não substituem asserts.

## Invariantes estruturais

- 17 times.
- 85 entradas em `ATRIBUTOS` e 85 cards de jogador.
- 5 jogadores por time.
- Major com 15 NPCs e o time do usuário.
- OVR de jogador limitado a 5–22.
- Snapshot indexado pelo ID cru do jogador, inclusive entradas de outras eras.

## Distribuição aprovada

| Role primário | Total |
|---|---:|
| IGL | 17 |
| Rifler | 16 |
| AWPer | 15 |
| Entry | 15 |
| Lurker | 12 |
| Support | 10 |

| Playstyle | Total |
|---|---:|
| Opener | 16 |
| Playmaker | 12 |
| Trader | 9 |
| Infiltrador | 8 |
| Cerebral | 8 |
| Spacetaker | 7 |
| Facilitador | 7 |
| Ancora | 7 |
| Closer | 7 |
| Coringa | 3 |
| Baiter | 1 |

## Execução de referência do benchmark

A execução de validação deste baseline utilizou `N=300` no teste de realismo e
45.900 mapas/939.247 rounds:

| Métrica | Resultado de referência |
|---|---:|
| KPR | 0,694 |
| CT round win | 51,4% |
| Plant | 55,4% |
| T post-plant | 59,6% |
| Anti-eco | 79,1% |
| Conversão pós-pistol | 72,5% |
| Clutch 1v1 | 49,9% |
| Clutch 1v2 | 24,3% |
| Clutch 1v3 | 9,6% |
| Correlação de rating | 0,819 |
| MAE de rating | 0,070 |
| Assists/kills | 0,307 |
| Assists por jogador/round | 0,213 |

Os benchmarks possuem amostragem e podem oscilar dentro dos intervalos
aprovados. Para refatoração do RNG ou simulador, devem ser adicionados golden
tests determinísticos antes de aceitar qualquer extração.

## Estado conhecido da validação

- `npm run check`: aprovado.
- `npm run lint`: deve usar dependências locais instaladas por `npm ci`.
- `npm run bench`: 13 suítes; aprovado no baseline.
- E2E: duas suítes obrigatórias, executadas com Playwright e Chromium reais.
