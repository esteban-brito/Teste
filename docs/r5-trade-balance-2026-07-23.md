# R5.7a — oportunidade contextual de trade

Data: 23 de julho de 2026

Baseline: `84ec6c4`

## Hipótese e mecanismo

Todo refrag elegível usava a mesma chance `0,56`. `tr` influenciava quem fazia
a trade kill, mas a morte de Entry, Lurker ou AWPer tinha a mesma possibilidade
de ser trocada. Isso explicava a convergência de mortes trocadas em ~31–32% para
todas as funções.

O candidato acrescenta dois sinais normalizados:

- prontidão dos companheiros vivos: média de `tr` e `ut`;
- possibilidade de troca da vítima: média de `en` e `tr`.

Ambos são zero-centrados nas médias do elenco e deslocam em `0,15` a chance
existente. O mesmo sorteio decide o refrag; não há novo RNG, clamp, condição por
nome/função ou crédito direto de KAST. `tr` continua inclinando a seleção do
refragger depois que a oportunidade acontece.

## Seleção do candidato

As intensidades `0,30` e `0,20` foram rejeitadas apesar de passarem as guardas:
o favorito em gap 0–3 caiu respectivamente para `51,5%` e `52,7%`, contra
`54,9%` no baseline. As perdas de `3,4` e `2,2` p.p. excediam o piso material de
2 p.p. A intensidade `0,15` preservou a identidade e deixou o indicador em
`54,0%`, delta não material de `-0,9` p.p.

## Comparação pareada

Nas mesmas 1.088 partidas e 10.880 player-maps:

| Métrica global | Antes | Depois | Delta | IC95% do delta |
|---|---:|---:|---:|---:|
| Rating | 1,14213 | 1,14117 | -0,00096 | -0,00250 a +0,00058 |
| KPR/DPR | 0,69544 | 0,69281 | -0,00263 | -0,00557 a +0,00031 |
| APR | 0,21290 | 0,21355 | +0,00065 | -0,00111 a +0,00240 |
| KAST | 73,1586% | 73,2958% | +0,1372 p.p. | -0,0048 a +0,2791 p.p. |
| ADR | 78,9422 | 78,7338 | -0,2084 | -0,5397 a +0,1230 |
| Mortes trocadas | 31,193% | 31,107% | -0,087 p.p. | -0,222 a +0,049 p.p. |
| Trade kills/R | 0,22057 | 0,21945 | -0,00112 | -0,00260 a +0,00036 |

O total de trade ficou estável, mas a identidade mudou:

| Função primária | Mortes trocadas antes | Depois | Delta | KAST antes→depois |
|---|---:|---:|---:|---:|
| AWPer | 31,52% | 31,11% | -0,41 p.p. | 75,52%→75,54% |
| Rifler | 31,69% | 30,66% | -1,03 p.p. | 73,24%→73,29% |
| Entry | 31,10% | 32,47% | +1,36 p.p. | 70,13%→70,70% |
| Lurker | 31,73% | 30,93% | -0,80 p.p. | 74,10%→74,01% |
| Support | 31,76% | 32,46% | +0,70 p.p. | 72,24%→72,67% |
| IGL | 29,81% | 29,66% | -0,15 p.p. | 73,55%→73,48% |

KAST de Entry e Support subiu somente porque mais mortes receberam um refrag
efetivo no evento. A probabilidade posterior de o refrag cair na janela de KAST
não foi alterada nesta subetapa.

## Benchmark e goldens

Em 45.900 mapas e 935.030 rounds, todas as guardas passaram. Rating ficou em
correlação `0,957`, MAE `0,048`, inclinação `1,014` e maior erro `0,175`.
KPR global `0,694`, KAST `73,3%`, ADR `78,8` e favoritos permaneceram verdes.

Antes de atualizar os fixtures, foram reproduzidos:

- Nuke seed 1: `9–13→6–13`;
- overtime repetido: seed `21` substituída pela `127`, `22–18` em 40 rounds;
- campanha Node seed 9: `2–1→1–2`, Nuke/Dust2/Train;
- campanha do navegador seed 424242: `0–2→1–2`, com Nuke `16–14`,
  Ancient `9–13` e Anubis `11–13`.

Assistência, seleção ponderada do assistente e chance de crédito KAST do
refrag permanecem inalteradas. Esta evidência é interna e não constitui nota IFCS.

Check, lint, dados, regressão, benchmark e os três E2E passaram. A chamada
monolítica de `npm run validate` foi encerrada por timeout do executor sem
reportar falha; os grupos obrigatórios foram repetidos isoladamente, sem reduzir
amostras ou limites.
