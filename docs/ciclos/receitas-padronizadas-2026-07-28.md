# Receitas de playstyle padronizadas

> Fatia B da reformulação pedida em 28/07/2026: playstyles padronizados, mínimo de 3 stats,
> mudando o mínimo possível de jogadores.

## O problema

Cada playstyle era definido por uma receita de pesos sobre 6 eixos, e cada uma tinha um formato
próprio:

```
Opener       ab .506  fogo .379  ent .115
Spacetaker   ent .610  ut .204  fogo .093  ab .093
Trader       tr .50  fogo .30  ut .20
Closer       cl .55  fogo .45                     ← só DOIS eixos
Facilitador  ut .593  tr .176  ab .118  fogo .113
```

Dois defeitos concretos:

- **o Closer era decidido por dois eixos**, o que o tornava o estilo mais fácil de cair em cima
  de qualquer perfil com clutch e fogo — e violava o mínimo de três pedido;
- **os números quebrados eram cicatriz de calibrador**, não decisão. Ninguém conseguia dizer o
  que separava `.118` de `.113`, e qualquer recalibragem futura produziria outra rodada deles.

## O defeito de fundo, medido antes de mexer

A classificação era decidida no **quarto decimal**. Medição em 28/07/2026, motor intacto:

| distância para virar de estilo | jogadores |
|---|---|
| < 0,01 | 15 de 85 |
| < 0,05 | **45 de 85** |

O `zweih` estava a **0,0000**. Ou seja: metade do elenco a um empurrão de ser outro estilo. Isso
torna qualquer padronização cara em mudanças, e torna o rótulo menos informativo do que parece.

Por isso a reformulação perseguiu **duas** métricas, não uma: quantos jogadores mudam
(estabilidade) **e** a margem de decisão (nitidez). `bancada/ferramentas/classificacao.js` mede as duas.

## A regra

**Todo playstyle tem exatamente três eixos, na escada `0,50 / 0,30 / 0,20`.**

A receita vira uma frase legível — *"Closer é clutch, depois fogo, depois utilitária"* — e some
a possibilidade de o calibrador produzir pesos ilegíveis.

```
Opener       ab   fogo ent          Baiter       tr  cl  fogo   (ovrW: cl ut tr)
Spacetaker   ent  ut   fogo         Closer       cl  fogo ut
Trader       tr   fogo ut           Facilitador  ut  ent fogo   (ovrW: ut tr ent)
Playmaker    fogo ab   cl           Cerebral     ut  ab  cl
Infiltrador  cl   ab   fogo         Ancora       cl  ut  tr
```

## Como os eixos em aberto foram decididos

Quatro escolhas não tinham resposta óbvia: o 3º eixo do Closer, do Spacetaker e do Facilitador,
e a ordem do Cerebral (cujos dois últimos empatavam em `.30`). Elas foram decididas por
**medição**, não por gosto: as 32 combinações plausíveis foram avaliadas contra a classificação
aprovada dos 85, com braço de controle provando que a re-derivação volta exatamente a zero.

Todas as 32 cabiam no limite de 20 mudanças, e **em nenhuma delas a função de algum jogador
mudou** — padronizar receita de estilo não toca a atribuição de função, que vive noutro modelo.

### A âncora que reprovou o primeiro vencedor

O melhor candidato por nitidez pura tirava **drop, fnx e gla1ve** do Facilitador — exatamente os
três jogadores que `bancada/suites/drop-reform.js` ancora, de uma reforma deliberada anterior. A
medição pegou o erro: a receita `ut/tr/ab` era pior que a antiga para capturar o perfil "glue".

As âncoras viraram restrição dura e o Facilitador foi rebuscado sobre 20 combinações. Duas
sobreviveram; escolheu-se **`ut / ent / fogo`**:

- mantém a população de Facilitador em 8 (a alternativa derrubava para 5, perto do mínimo de 3
  que `perfis.js` exige para o critério do estilo valer);
- tem a **menor fragilidade de todas** as combinações testadas;
- e é a mais fiel: o glue é utilitária, depois tomar espaço, e só então fogo — ele não é fragger.

A margem do Facilitador no próprio `drop-reform.js` **subiu** de 0,022 para 0,079.

## Resultado

| | antes | depois |
|---|---|---|
| margem média | 0,0680 | **0,0775** |
| a menos de 0,01 de virar | 15 | **10** |
| a menos de 0,02 | 23 | 21 |
| a menos de 0,05 | 45 | **38** |
| jogadores tocados | — | **18 de 85** (limite 20) |
| dos quais mudaram identidade | — | 11 |
| dos quais mudou só o OVR | — | 7 |
| **funções alteradas** | — | **0** |

### Os 11 que mudaram de estilo

| jogador | antes → depois |
|---|---|
| **rain** | Playmaker → **Opener** — é o entry fragger da FaZe |
| **sh1ro** | Trader → **Closer** — o AWPer de clutch por excelência |
| **gla1ve** | Facilitador → **Cerebral** — o IGL cerebral arquetípico |
| **m0NESY** | Playmaker → Opener — AWPer de abertura agressiva |
| olofmeister | Opener → Playmaker |
| bLitz · yuurih (×2) | → Closer |
| Qikert · TaZ | → Facilitador |
| fame | Playmaker → Opener |

Quatro deles são rótulos **mais fiéis** do que os antigos, não apenas diferentes.

### Os 7 que mudaram só de OVR (±1)

`s1mple` 21→20 · `coldzera` 21→20 · `karrigan` 21→20 · `flameZ` 16→15 · `HooXi` 16→17 ·
`FalleN` 17→18 · `tabseN` 17→18.

Os dois primeiros vêm da receita do Opener passar a pesar menos fogo (`.379` → `.30`) e mais
entrada (`.115` → `.20`). Ambos permanecem na mesma faixa de carta.

## O que NÃO foi padronizado, e por quê

`STYLE_CONTRA` — a tabela de contraindicações por estilo — continua com números irregulares
(`.112`, `.036`, `.252`…). Padronizá-la exigiria seu próprio orçamento de mudanças, e o teto de
20 já estava em 18. Fica registrado como a próxima peça da padronização, com o mesmo método.

## Validação

`npm run validate`, **24/24 suítes**. `perfis.js` 15/15 · `realismo.js` 12/12 macro e 6/6 forma ·
`kda` 6/6 · `assists` 3/3 · `dificuldade` 4/4 (invicto 5,5%, título 28,7%) · `drop-reform` com
todas as âncoras de pé.

Snapshot regravado depois de cada um dos 18 ser explicado. `elencos.html` regenerado. Goldens
regravados com seeds que preservam a forma de cada cenário — histórico do `repeated-overtime`:
129 → 349 → 515 → 200 → 456 → 132 → **645**.
