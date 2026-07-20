# ADR 0001: separar refatoração de balanceamento

- Status: aceito
- Data: 2026-07-19

## Contexto

Os motores dependem de centenas de pesos, thresholds, clamps e arredondamentos.
Alterar estrutura e números na mesma revisão torna impossível atribuir uma
regressão à sua causa.

## Decisão

Movimentações, extrações, renomes e formatação devem preservar o comportamento.
Mudanças de balanceamento usam commits e revisão separados, acompanhados de
snapshot e benchmark antes/depois.

## Consequências

- Commits estruturais podem ser revertidos isoladamente.
- Algumas inconsistências de nomenclatura permanecem durante a migração.
- A suíte de caracterização é gate obrigatório para cada extração.

