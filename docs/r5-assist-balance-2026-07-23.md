# R5.7b — oportunidade contextual de assistência

Data: 23 de julho de 2026

Baseline: `b8b707a`

## Hipótese e mecanismo

A seleção do assistente já favorecia `ut`, mas a chance de existir uma
assistência era praticamente igual para qualquer composição viva. O candidato
mede a utilidade disponível entre os quatro companheiros elegíveis do matador:
jogadores vivos têm peso integral e mortos preservam o desconto histórico de
`0,5`, representando dano ou utilidade produzidos antes da morte.

A média disponível é zero-centrada na população e desloca em `0,10` a chance
existente. Aberturas mantêm o multiplicador anterior. O sorteio que decide a
oportunidade e a seleção ponderada do assistente continuam sendo os mesmos; não
há condição por nome, ID, time ou função, clamp novo nem crédito direto de KAST.
Quando o limiar muda, uma escolha condicional de assistente pode passar a ser
consumida e deslocar o restante daquela seed.

APR (assistências por round) é a medida principal. A/K permanece apenas como
leitura derivada, pois varia também quando o volume de kills muda.

## Comparação pareada

Nas mesmas 1.088 partidas e 10.880 player-maps:

| Métrica global | Antes | Depois | Delta | IC95% do delta |
|---|---:|---:|---:|---:|
| Rating | 1,14117 | 1,14083 | -0,00035 | -0,00155 a +0,00086 |
| KPR/DPR | 0,69281 | 0,69231 | -0,00051 | -0,00280 a +0,00179 |
| APR | 0,21355 | 0,21267 | -0,00087 | -0,00229 a +0,00055 |
| KAST | 73,2958% | 73,2218% | -0,0740 p.p. | -0,1805 a +0,0325 p.p. |
| ADR | 78,7338 | 78,6782 | -0,0556 | -0,3149 a +0,2037 |

O efeito global é imaterial e a assinatura de utilidade se fortaleceu sem bônus
por função:

| Função primária | APR antes | Depois | A/K antes→depois |
|---|---:|---:|---:|
| AWPer | 0,19584 | 0,19603 | 0,2514→0,2518 |
| Rifler | 0,18513 | 0,18196 | 0,2358→0,2323 |
| Entry | 0,19304 | 0,19179 | 0,2911→0,2901 |
| Lurker | 0,20140 | 0,20003 | 0,2613→0,2600 |
| Support | 0,23954 | 0,24181 | 0,3926→0,3973 |
| IGL | 0,26728 | 0,26647 | 0,4856→0,4845 |

A separação A/K de Support/IGL contra AWPer/Entry passou de `0,171` para
`0,175`. As variações de KAST ficaram entre `-0,32` e `+0,36` p.p. por função e
vieram exclusivamente dos eventos simulados.

## Benchmark e goldens

Em 45.900 mapas e 938.511 rounds, todas as guardas passaram. Rating ficou em
correlação `0,956`, MAE `0,049`, inclinação `1,017` e maior erro `0,177`.
KPR global `0,695`, KAST `73,2%`, ADR `78,9` e favorito em gap 0–3 ficou em
`54,2%`.

Antes de atualizar os fixtures, foram reproduzidos:

- Nuke seed 1: `6–13→5–13`, ainda com pistol/eco/force/full e clutch vencido;
- overtime repetido: seed `127` substituída pela `129`, `22–18` em 40 rounds;
- campanha Node seed 9: `1–2→2–0`, Nuke `13–2` e Inferno `13–4`;
- campanha do navegador seed 424242: vencedor, mapas e orientações preservados;
  Nuke mudou de `16–14` para `4–13`, Ancient de `9–13` para `13–6` e Anubis
  permaneceu `11–13`.

Esta evidência é interna e não constitui nota IFCS.

Check, lint, dados, regressão, benchmark e os três E2E passaram com as amostras
e limites originais. O snapshot de classificação dos 85 jogadores permaneceu
idêntico ao aprovado.
