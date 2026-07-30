# Playstyles — ZÊNITE

Fonte executável atual: `NM_AXES`, receitas, gates e `styleMatch` em
`src/domain/evaluation/style-score.mjs`; identidade e traços vivem em
`src/domain/evaluation/style-identity.mjs`.

## Eixos

O classificador usa seis eixos:

```text
fogo, entrada, abertura, trade, clutch, utilitário
```

Para AWPer, `fogo = sn`; para as demais roles, `fogo = fp`. Os sete atributos
crus continuam sendo usados pelos gates de Baiter e Coringa.

## Competição entre estilos normais

Cada receita define um vetor de pesos. O score base é a similaridade do cosseno:

```text
score = dot(receita, eixos) / (norma(receita) * norma(eixos) + 1e-9)
```

As contraindicações reduzem:

```text
contraPenalty = médiaPonderadaDosEixosContraindicados * 0,42
```

Facilitador pode receber `facilitatorGlueBonus`, baseado no piso e equilíbrio
entre fogo, entrada e utilitário, especialização e trade. AWPer possui ajuste
`AWP_LEAN` entre Closer e Infiltrador.

`STYLE_ROLE_FIT` foi **removido em 28/07/2026**. Era uma tabela de afinidade
função→playstyle que empurrava a classificação, e isso era circular: a função já
sai dos atributos, então usá-la para decidir o estilo fazia o estilo ecoar a
função em vez de ser evidência independente. A plausibilidade role/playstyle é
calculada separadamente por `roleStyleReality` e `ROLE_STYLE_BASE`.

## Gates

### Baiter

Baiter é um gate de baixo impacto, não uma simples receita. Exige:

- não ser IGL;
- no máximo dois atributos acima de 50;
- rating até 1,02;
- entrada até 50;
- abertura até 45, ou simultaneamente fogo até 15 e trade até 20.

### Coringa

Os sete atributos são ordenados. Coringa exige:

- no máximo um atributo abaixo de `pisoMin`;
- quinto maior atributo maior ou igual ao piso;
- diferença entre o maior e o quinto maior até `spreadMax`.

## Receitas atuais

| Label | Pesos de identidade |
|---|---|
| Opener | abertura .506, fogo .379, entrada .115 |
| Spacetaker | entrada .610, fogo .093, abertura .093, utilitário .204 |
| Trader | trade .50, fogo .30, utilitário .20 |
| Playmaker | fogo .45, abertura .35, clutch .20 |
| Infiltrador | clutch .46, abertura .34, fogo .20 |
| Baiter | gate; qualidade: clutch .40, utilitário .35, trade .25 |
| Closer | clutch .55, fogo .45 |
| Facilitador | utilitário .593, trade .176, abertura .118, fogo .113 |
| Cerebral | utilitário .40, abertura .30, clutch .30 |
| Ancora | clutch .50, utilitário .32, trade .18 |

## Invariantes

- rating não participa da identidade do playstyle;
- role não adiciona `STYLE_ROLE_FIT` ao score de classificação;
- Baiter e Coringa são avaliados antes das receitas normais;
- ordem das receitas resolve empates e deve ser preservada;
- `matchMargin` é a diferença entre primeiro e segundo score.
