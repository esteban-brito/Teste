# ADR 0003: preservar RNG determinístico

- Status: aceito
- Data: 2026-07-19

## Contexto

Forma, duelos, objetivos e economia consomem a mesma sequência pseudoaleatória.
Adicionar ou reordenar uma chamada muda todo o resultado subsequente.

## Decisão

O algoritmo Mulberry32, seus seeds e a ordem de consumo fazem parte do contrato
de comportamento. Ao extrair o simulador, o RNG será injetável, mantendo um
adapter que reproduz exatamente a implementação atual.

## Consequências

- Testes golden por seed são obrigatórios antes da extração.
- Otimizações não podem consumir aleatoriedade adicional.
- Mudança futura de algoritmo exige versão e migração explícitas.

