# R5.6a — exposição contextual

Data: 23 de julho de 2026

Baseline: `180bbf9`

## Hipótese e mecanismo

A escolha da vítima usava `fragPeso` como sinal dominante, `en` somente na
abertura e agressividade genérica depois. Isso aproximava contato de produção:
Riflers de alto firepower eram expostos e Supports de baixo firepower eram
protegidos mesmo quando seus atributos descreviam outra participação.

O candidato preserva um expoente residual de volume, mas acrescenta um perfil
de exposição contínuo e positivo. O perfil usa:

- função efetiva de combate, inclusive a secundária de IGL;
- `en`, `op` e agressividade para iniciativa;
- `sn`, `cl` ou `ut` como sinal posicional conforme a função;
- lado CT/TR e as fases opening, pre-plant e post-plant.

Os atributos são normalizados e combinados antes de `Math.exp`; não há clamp,
piso/teto de desempenho, bônus direto de DPR/KAST ou novo sorteio. A força do
time continua decidindo quem vence o duelo e firepower continua escolhendo o
matador. O perfil muda somente quem tomou o contato perdido.

## Seleção do candidato

O primeiro candidato removeu todo sinal de volume e foi rejeitado: Support
perdeu 5,15 p.p. de KAST e Rifler ganhou 6,18 ADR. O segundo ainda produziu
deslocamentos materiais. A versão aceita reaproximou o mid-round do baseline,
manteve uma abertura específica e ficou abaixo de todos os pisos materiais
congelados por função.

## Comparação pareada

A agenda idêntica de 1.088 mapas e 10.880 player-maps produziu:

| Métrica global | Antes | Depois | Delta | IC95% do delta |
|---|---:|---:|---:|---:|
| Rating | 1,1409 | 1,1423 | +0,0014 | +0,0001 a +0,0027 |
| KPR/DPR | 0,6927 | 0,6957 | +0,0030 | +0,0006 a +0,0054 |
| APR | 0,2121 | 0,2130 | +0,0009 | -0,0006 a +0,0023 |
| KAST | 73,164% | 73,143% | -0,021 p.p. | -0,144 a +0,101 p.p. |
| ADR | 78,663 | 78,980 | +0,317 | +0,043 a +0,590 |
| Sobrevivência | 30,731% | 30,430% | -0,301 p.p. | -0,541 a -0,061 p.p. |
| Save explícito | 1,043% | 1,049% | +0,006 p.p. | -0,044 a +0,055 p.p. |

Por função primária:

| Função | DPR antes→depois | Morte de abertura/R | Ordem média da morte | KPR antes→depois |
|---|---:|---:|---:|---:|
| AWPer | 0,682→0,682 | 0,081→0,084 | 4,540→4,534 | 0,786→0,780 |
| Rifler | 0,733→0,735 | 0,126→0,123 | 4,014→4,015 | 0,777→0,787 |
| Entry | 0,720→0,730 | 0,123→0,123 | 4,136→4,086 | 0,677→0,671 |
| Lurker | 0,708→0,707 | 0,094→0,094 | 4,369→4,405 | 0,760→0,774 |
| Support | 0,682→0,683 | 0,092→0,091 | 4,544→4,594 | 0,599→0,606 |
| IGL | 0,636→0,640 | 0,082→0,082 | 4,729→4,726 | 0,553→0,555 |

Entry passa a ter a maior taxa de morte de abertura por pequena margem e morre
mais cedo; Lurker e Support passam a morrer mais tarde. O agregado IGL continua
heterogêneo. Dentro dele, IGL/Entry mudou de DPR `0,663→0,669` e ordem de morte
`4,479→4,412`, enquanto IGL/AWPer preservou DPR `0,651→0,651`.

## Benchmark longo

Em 45.900 mapas e 937.477 rounds, todas as guardas passaram. O resumo ficou:

- AWPer `0,78 KPR / 0,68 DPR / 85 ADR`;
- Rifler `0,79 / 0,73 / 86`;
- Entry `0,66 / 0,73 / 76`;
- Lurker `0,78 / 0,71 / 85`;
- Support `0,61 / 0,68 / 73`;
- IGL `0,55 / 0,64 / 68`.

O rating melhorou de correlação `0,949` e MAE `0,050` para `0,957` e `0,047`.
O maior erro individual caiu de `0,184` para `0,171`; todas as métricas macro,
economia, clutch e favorito permaneceram nas guardas.

## Goldens e limites

A identidade dos sobreviventes altera clutches e, portanto, timelines. Antes de
atualizar os fixtures, foram reproduzidos:

- seed 1 em Nuke: `4–13→9–13`;
- cobertura de overtime: seed `8` substituída pela `21`, `19–17` em 36 rounds;
- campanha Node seed 9: `1–2→2–1`, Nuke/Dust2/Train;
- campanha do navegador seed 424242: `1–2→0–2`, Nuke `11–13` e Ancient `5–13`.

R5.6a não muda economia, inventário, regra de save, trade, assistência ou
fórmula de rating. Save permanece a próxima família isolada; sem inventário, o
produto não afirmará que uma AWP específica foi preservada. A comparação é
interna e não constitui nota IFCS oficial.

`npm run validate` aprovou check, lint e as 19 suítes em 192,2 s, incluindo
regressão, calibrador, benchmark, scorer/corpus IFCS e os três fluxos E2E.
