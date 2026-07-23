# R5.2 — caudas individuais sem pisos ou tetos duros

Data: 23 de julho de 2026

Baseline pareado: `8136df1`

## Escopo

Esta etapa altera somente a família de caudas individuais autorizada em R5.2.
Ela não muda dados de jogadores, roles, química, economia, exposição, save,
trade, assistência nem pesos do rating. Portanto, não tenta corrigir ainda o
diagnóstico tático de AWPer, IGL, Support, Entry ou Lurker.

## Mudança executável

- o clamp final `0,30–3,0` foi removido de `fallenAngels`;
- a forma deixou de acumular valores no piso `0,30` e no teto `2,20`;
- abaixo do joelho positivo, uma continuação exponencial suave mantém o valor
  estritamente positivo e se aproxima de zero sem formar um piso;
- acima do joelho de cauda, uma continuação logarítmica suave mantém a função
  estritamente crescente e sem limite superior;
- a mesma amostra gaussiana anterior continua sendo usada uma única vez. Não
  houve novo ponto de RNG nem seleção por nome, ID, time ou época.

Os joelhos apenas mudam a inclinação das caudas. Eles não são limites: todo
valor extremo de entrada continua produzindo um valor extremo maior de saída.
Clamps de probabilidade em `[0,1]` permanecem necessários e não são tetos de
desempenho individual.

## Provas específicas de cauda

`npm run test:r5:tails` cobre dois níveis:

- eventos sintéticos válidos de um round produziram ratings `0,104` e `7,654`,
  atravessando os dois limites antigos sem valor não finito;
- 250.000 sorteios determinísticos de `formaDoDia` produziram mínimo `0,285`,
  máximo `2,727`, cinco valores abaixo de `0,30`, 6.836 acima de `2,20` e zero
  massa exatamente nas fronteiras antigas.

Essa prova demonstra ausência de parede matemática. Ela não afirma que um
rating acima de 3 terá uma frequência realista: essa frequência depende dos
eventos do mapa e será medida na suíte rara de R6.

## Comparação pareada de desenvolvimento

A mesma agenda de 1.088 mapas e 10.880 player-maps foi executada antes e depois.
Os principais resultados foram:

| Métrica | Baseline | R5.2 | Delta pareado |
|---|---:|---:|---:|
| Rating médio | 1,1387 | 1,1383 | -0,0004 |
| KPR | 0,6942 | 0,6934 | -0,0008 |
| DPR | 0,6942 | 0,6934 | -0,0008 |
| A/R | 0,2128 | 0,2124 | -0,0003 |
| ADR | 78,820 | 78,724 | -0,096 |
| KAST | 73,070% | 73,093% | +0,023 p.p. |
| Sobrevivência | 30,577% | 30,661% | +0,083 p.p. |
| Save | 0,997% | 0,988% | -0,009 p.p. |

O IC95% bloqueado por mapa do delta de rating foi `[-0,001077; 0,000331]`.
Todos os deslocamentos centrais ficaram muito abaixo dos pisos materiais
congelados: `0,03` para rating, `0,02` para KPR/DPR/A/R, `2` para ADR e `2`
pontos percentuais para proporções. Os deltas por role também foram pequenos;
nenhuma role foi usada como alvo deste candidato.

Na amostra curta, a cauda observada de rating foi descritiva: mínimo/máximo
passaram de `0,51/2,49` para `0,52/2,43`. Não observar um evento acima de 3 em
10.880 player-maps não constitui teto; a prova sintética cobre a matemática e a
frequência rara exige pelo menos um milhão de player-maps em R6.

## Benchmark integral

O benchmark executou 45.900 mapas e 938.287 rounds e aprovou todas as guardas.
Resultados centrais: KPR `0,694`, CT `51,0%`, plant `55,4%`, pós-plant TR
`60,0%`, anti-eco `79,5%`, conversão pós-pistol `72,8%` e assistências por
round `0,213`. O rating manteve correlação `0,947`, MAE `0,052`, inclinação
`0,997` e erro individual máximo `0,182`.

Contra o baseline observado, a força do favorito em gap 0–3 variou de `54,2%`
para `55,3%` (+1,1 p.p.) e o erro individual máximo de `0,178` para `0,182`
(+0,004). Ambos permanecem abaixo dos respectivos pisos materiais e todas as
guardas continuam verdes.

## Golden e interface

A mudança de balanceamento altera legitimamente timelines determinísticas. O
fixture não foi atualizado para esconder regressão:

- `economy-and-clutches` permaneceu bit a bit idêntico;
- a cobertura de prorrogação repetida preservou o placar `19–17` e 36 rounds,
  usando a seed reproduzível `36` em vez de adaptar o motor à seed antiga;
- a campanha de seed `9` passou de vitória B por `2–1` em
  `Nuke, Anubis, Train` para vitória A por `2–1` em
  `Nuke, Train, Overpass`.

Depois da explicação e revisão, o golden foi regenerado. As três suítes E2E
passaram sem mudança no golden próprio da campanha da interface.

## Limites da conclusão

R5.2 cumpre o requisito de produto de retirar curadoria rígida das pontas sem
desestabilizar o centro. Ainda não prova fidelidade tática por role nem uma
frequência realista para ratings extremamente raros. O corpus oficial permanece
em 1/800 mapas e 1/6 eventos; tuning tático numérico continua proibido até R5.3
fornecer alvos empíricos auditáveis. A execução de release com 50.000 mapas e a
suíte de ao menos um milhão de player-maps permanecem gates de R6.
