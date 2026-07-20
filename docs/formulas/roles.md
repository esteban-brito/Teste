# Roles e role secundário — PRISMA

Fonte executável atual: `game.js`, de `ROLE_PERFIL` até `distribuirRoles`.

## Afinidade

Para cada role de combate:

```text
afinidade(role, jogador)
  = dot(ROLE_PERFIL[role].afin, atributos)
  - dot(ROLE_CONTRA[role], atributos)
  - penalidades condicionais da role
  + ajustes de IGL
  + sinergias específicas da role
```

Sinergias específicas usam mínimos entre atributos relacionados. Exemplos:

- Entry combina entrada com abertura, fogo e trade;
- Lurker combina clutch com abertura/fogo;
- Support combina utilitário e trade;
- Rifler combina fogo com abertura/trade e recebe bônus generalista.

Um jogador com `fp >= CFG_AVALIACAO.SUP_FRAG` não pode vencer como Support por
uma diferença mínima: sua afinidade de Lurker é elevada para `Support + 0.01`.

## Role primário

- Para não IGL, vence a maior afinidade entre AWPer, Rifler, Entry, Lurker e
  Support.
- Para IGL, o primário é `IGL`; a maior afinidade de combate torna-se role
  secundário/combat role.

## Realidade do par

`rolePairReality(primary, secondary, player)` começa no custo de
`ROLE_PAIR_BASE`, com fallback 0,14. Condições de atributos reduzem ou aumentam
o custo. O resultado é limitado a 0–0,85.

```text
secondaryScore = afinidadeSecundária - realityCost * 18
```

Pares paradoxais Entry/Support e Entry/Lurker podem ceder lugar à terceira role
se ela mantiver pelo menos `PARADOXO_PEN` da afinidade da candidata original.

O secundário é forte quando:

```text
secondaryScore / max(1, afinidadePrimária) >= 0,82
```

## Contexto de time

`distribuirRoles` preserva IGL e distribui roles de combate com limites de
composição. AWP possui cap 1; as demais roles, cap 2. Se não houver AWPer, o
jogador com maior adequação de sniper é o fallback. Essa passagem contextual
faz parte do comportamento e precisa manter a ordem de desempate.

## Invariantes de teste

- todo jogador possui role primário e secundário diferentes;
- IGL mantém `IGL` como primário e uma combat role válida;
- todos os 85 IDs permanecem no snapshot;
- realidade fica nos limites definidos;
- distribuição não depende da ordem dos slots para escolher o melhor IGL;
- pares paradoxais e cap de AWP têm casos unitários antes da extração.

