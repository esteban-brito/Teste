# Monograma da carta e Fase Suíça (05/08/2026)

> Ciclo visual pedido pelo responsável: *"essas 2 letras dentro das cartas não
> parecem estar padronizadas e centralizadas"* e *"a tela da fase suíça […]
> queria que fosse mais bonito, centralizado, esses espaços vazios eu acho
> horrível"*.
>
> **Não é balanceamento e não é dado.** Motor, OVR, RNG e snapshot intocados.
> Comparação visual: 11 de 21 capturas mudaram, todas explicadas abaixo.

## Parte 1 — o monograma

`.c-mono` é o monograma do nick no campo sem retrato: **80 dos 85 jogadores** e
14 dos 15 treinadores. **Não tinha guarda nenhuma** — nem no E2E de cartas, nem
em `tools/`. É por isso que três defeitos conviveram sem ninguém ver.

### O que foi medido, antes

94 cartas do laboratório a 188 px, com a tinta real do glifo
(`actualBoundingBox` do canvas), não a caixa:

| defeito | medida |
|---|---|
| tinta fora do centro horizontal | média **+2,83 px** · pior **+5,25 px** (`MA`) |
| tinta fora do centro vertical | **−0,93 px** sistemático |
| tamanho aparente | `TI` 64,18 px → `SW` 120,90 px = **1,88×** |

Três causas diferentes, e nenhuma era "descuido de CSS":

- **horizontal** — `letter-spacing:-.05em` valia −4,32 px no corpo de 86,5 px.
  `letter-spacing` aplica o espaço **depois de cada letra, inclusive a última**,
  então o flex centrava a caixa de AVANÇO, que carrega esse espaço fantasma.
  Sozinho isso empurra a tinta ~2,16 px; o resto é assimetria de side bearing;
- **vertical** — `align-items:center` centra a **caixa da linha**, e a maiúscula
  ocupa só o miolo dela. É a régua da §21, agora num quarto componente;
- **tamanho** — corpo fixo (`46cqw`) com largura livre. Nada normalizava nada.

### A solução, e por que não foi compensação

Trocar texto centrado por **geometria normalizada**:

```
viewBox = a caixa de CAIXA-ALTA        base em y=100 · corpo = 100/cap
textLength + lengthAdjust="spacing"    mesmo avanço para todos
```

Com o viewBox valendo exatamente a caixa-alta, **centrar o elemento passa a
centrar a letra** — sem métrica de fonte no layout e sem constante de
compensação. A regra 21 do `CLAUDE.md` já custou uma sessão a este projeto por
compensação calibrada contra a régua errada; aqui não há o que compensar.

Duas constantes, **medidas na fonte e não estimadas**:

- `cap-height = 0,7031em` — idêntica para letras **e dígitos**, o que dispensa
  exceção para `91`, `S1`, `B1`, `N0` e `M0`;
- `WM = 1,68em` — o par **mais largo possível** em A-Z0-9. A constante sai da
  FONTE, não do dado: adicionar um time novo não pode espremer o monograma.

`spacingAndGlyphs` foi testado e **descartado**: ele estica os glifos e trocaria
inconsistência de tamanho por inconsistência de peso — `TI` ficaria 1,32× mais
gordo que `SW`. `spacing` mexe só no vão entre as duas letras.

### Depois

| medida | antes | depois |
|---|---:|---:|
| desvio horizontal | +2,83 px (máx +5,25) | **±0,01 px** |
| desvio vertical | −0,93 px | **±0,01 px** |
| razão de largura | 1,88× | **1,000×** |
| caixa-alta | 61,0 px | 60,78 px |

A caixa-alta não mudou de tamanho de propósito: `--mono-corpo` preserva o que
`46cqw × 0,7031` produzia. A letra ficou onde estava; só parou de escorregar.

### Três formas foram desenhadas e olhadas antes de escolher

`B` (só centrar) resolvia os desvios e deixava a variação de 1,88× intacta —
não atacava o que mais incomodava. `D` (uma letra) resolvia tudo por
simplificação, mas perde identidade: na amostra de oito cartas apareciam dois
`S` e dois `M`. `C` foi a escolhida, com a prancha comparativa na mesa.

## Parte 2 — a Fase Suíça

### A conta que fecha o diagnóstico

Num Suíço de 16 com 3 vitórias/3 derrotas, os grupos vivos de uma rodada R têm
sempre `vitórias + derrotas = R`. Logo:

```
R=0 → 1 grupo   R=1 → 2   R=2 → 3   R=3 → 2   R=4 → 1
```

**No máximo 3 grupos + Classificados + Eliminados = 5 colunas.** A 172 px fixos
isso ocupa 948 px de 1440. A tela **nunca enche** — não é caso de borda, é o
estado permanente.

Medido:

| momento | colunas | largura usada | vazio à direita | rola |
|---|---|---|---|---|
| rodada 0 · 1440 | 3 | 560 px | **880 px (61%)** | vertical: 1033 px em 788 |
| rodada 3 · 1440 | 4 | 754 px | **686 px (48%)** | — |
| rodada 0 · 390 | 3 | 446 px | −56 px | **horizontal**, "ELIMINADOS" cortado |

O pior detalhe é a rodada 0: metade da tela vazia à direita **e** conteúdo
cortado embaixo, ao mesmo tempo, porque os 16 times viravam uma torre única.

### O que mudou

`.swiss` deixou de ser fila de colunas fixas encostadas à esquerda e virou
composição centrada que encolhe antes de quebrar. Os itens de cada coluna
ganharam container próprio com grade elástica: a 300 px cabem dois times por
faixa, a 172 px cabe um.

| momento | antes | depois |
|---|---|---|
| rodada 0 · 1440 | 880 px de vazio à direita, rolagem vertical | margens **248/248**, sem rolagem |
| rodada 3 · 1440 | 686 px de vazio à direita | margens **87/87** |
| rodada 0 · 390 | rolagem horizontal | **sem rolagem horizontal**, colunas empilhadas |

O board também passou a centrar na vertical (`align-content:safe center`), que é
o que tira o vão morto embaixo quando a rodada tem pouco conteúdo.

## As guardas que faltavam

Nenhum dos dois defeitos aparecia em captura, e nenhum tinha prova. Agora têm:

- **`e2e-cartas.js`** remede a caixa-alta e o par mais largo **na fonte real**,
  e reprova se ela andar por baixo das constantes; prova que o avanço é uniforme,
  que o texto está no eixo e que o viewBox É a caixa-alta. A sintética tira a
  normalização e confirma que a medição volta a enxergar **1,75×** de variação;
- **`e2e-game-flow.js`** mede as duas margens da Suíça e a rolagem, em desktop e
  celular. Margem assimétrica e rolagem horizontal eram exatamente o que a
  captura não denunciava.

## Uma armadilha de medição encontrada no caminho

`getBBox()` de `<text>` devolve a **caixa EM** no Chromium, não a tinta: altura
fixa de 1,3em e topo em −41,49 para todos os monogramas. A primeira versão da
guarda vertical media essa constante e reprovava sem defeito nenhum. Serve para
a largura, que é o que `textLength` governa; não serve para altura. Virou a
regra **36**.

## Validação

- `npm run check` — 20/20;
- `bancada/suites/e2e-cartas.js` — verde nas oito larguras, com as sete provas
  novas do monograma;
- `bancada/suites/e2e-game-flow.js` — verde, com as quatro provas novas da Suíça;
- `npm run validate` — 26/26 suítes;
- comparação visual — 11 de 21 mudaram: 6 são o monograma (cartas e elenco nos
  três viewports), 3 são a Suíça, e 2 são o monograma aparecendo **atrás** do
  overlay na captura de página inteira do celular. As outras 10 seguem pixel a
  pixel idênticas.
