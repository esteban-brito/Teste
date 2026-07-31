# R5.4 — fronteiras puras de combate e rating

Data: 23 de julho de 2026

Baseline estrutural: `6ffdb28`

## Escopo

Esta etapa é exclusivamente estrutural. Ela não altera CFG, pesos, thresholds,
clamps, arredondamentos, dados, roles, química, economia nem RNG.

Duas fronteiras foram explicitadas:

- `combatProfile` centraliza role primária, secundária, role de combate já
  classificada e os três multiplicadores que o motor usa hoje;
- `fallenAngelsComponents` expõe as onze parcelas somáveis do rating, enquanto
  `fallenAngels` continua somando-as na mesma ordem aritmética.

O comportamento corrente foi preservado de propósito: a role ativa de combate
continua sendo a primária, inclusive para IGL. Ativar a role secundária do IGL
será uma mudança de balanceamento separada em R5.5, condicionada ao gate de
evidência R5.3.

## Provas de paridade

- `combatProfile`: 261 comparações entre os 85 jogadores, wrappers usados pela
  aplicação e fallbacks sintéticos;
- `fallenAngelsComponents`: 2.048 eventos determinísticos cobrindo compras,
  estados numéricos, rounds, roles e extremos dos componentes;
- golden do simulador: três cenários completos, modo leve, telemetria e estado
  posterior do Mulberry32 idênticos;
- comparação entre o commit `6ffdb28` e a extração: delta absoluto zero nas 28
  métricas de 1.088 mapas e 10.880 player-maps pareados.

Os módulos ES ficam em `src/domain/simulation/`. `game.js` ainda mantém o adapter
legado porque navegador, sandbox e worker não concluíram a migração para imports
nativos; remover esse adapter exige uma etapa arquitetural própria.
