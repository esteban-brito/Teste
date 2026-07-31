# Auditoria e recalibração do desempenho individual — 20/07/2026

## Objetivo

Corrigir a compressão dos ratings simulados sem regras por jogador. A mudança é
de balanceamento, separada dos commits estruturais e dos testes determinísticos.
Nenhum ID, nick, time ou época participa das novas fórmulas.

## Problemas confirmados

1. `TIER_LENDA` e `TIER_STAR` eram listas manuais de nomes. O mesmo nick recebia
   tratamento de estrela mesmo em outro card e outra época.
2. A regressão real→sim tinha inclinação 0,706. Ratings altos eram puxados para
   baixo e ratings baixos para cima, embora correlação e MAE ainda passassem os
   limites antigos.
3. O rating pós-mapa recebia bônus direto de `fp`. Isso confundia uma dimensão
   criada no card com o desempenho observado e favorecia perfis de fogo alto.
4. Uma média de 491 mapas quase não muda entre execuções porque o erro-padrão
   cai aproximadamente com `1/sqrt(491)`. Essa estabilidade é correta; a falha
   era a média convergir para o valor errado, não ela convergir.

## Critérios técnicos

A referência atual é o Rating 3.0 da HLTV. Ele combina kills, dano,
sobrevivência, KAST, multi-kills e Round Swing; também contextualiza economia,
mapa e lado. O ajuste de outubro de 2025 restaurou uma relação aproximada de
60% produção para 40% custo/sobrevivência e reduziu o peso excessivo do Swing:

- [Introducing Rating 3.0](https://www.hltv.org/news/42485/introducing-rating-30)
- [Rating 3.0 adjustments go live](https://www.hltv.org/news/43047/rating-30-adjustments-go-live)

A qualidade do adversário também altera o resultado esperado. Portanto, o
rating de origem é uma referência de nível, não uma obrigação de repetir o
mesmo número em todo confronto:

- [Why fixture difficulty is the key to understanding ratings](https://www.hltv.org/news/44188/why-fixture-difficulty-is-the-key-to-understanding-ratings)

## Solução geral

- estrela e tier passam a derivar do rating observado: 1,30 para química de
  estrela, 1,40 para a faixa excepcional e 1,20 para a faixa de estrela;
- `fp` continua descrevendo o perfil de frag, mas rating observado calibra a
  eficiência individual; OVR permanece responsável principalmente pela força
  do time e chance de vencer duelos;
- o centro da forma combina 65% do centro por OVR e 35% do rating observado;
- o antigo bônus pós-jogo de `fp` foi substituído por prior moderado do rating
  observado. Eventos do mapa ainda dominam e permitem variação acima/abaixo;
- o teste golden prova que trocar somente o nome não altera avaliação, placar
  ou estatísticas numéricas sob a mesma seed;
- os limites do benchmark agora exigem correlação ≥0,90, MAE ≤0,065,
  inclinação entre 0,85 e 1,15 e erro individual máximo ≤0,20.

## Comparação estatística controlada

Amostra oficial: 400 campanhas no teste de rating; benchmark macro com 45.900
mapas. O estado anterior é o commit `96f61d5` e a seed permanece 1337.

| Indicador | Antes | Depois |
|---|---:|---:|
| jogadores identificados | 85/85 | 85/85 |
| correlação real×sim | 0,853 | 0,946 |
| erro médio absoluto | 0,071 | 0,052 |
| inclinação real→sim | 0,706 | 0,998 |
| maior erro individual | 0,30 | 0,18 |
| KPR global | 0,694 | 0,694 |
| CT round win | 51,2% | 51,0% |
| plant | 55,4% | 55,5% |
| clutch 1v1 / 1v2 / 1v3 | 49,3 / 24,4 / 9,8% | 49,6 / 24,2 / 9,8% |

Todos os indicadores macro permaneceram dentro das faixas aprovadas.

### Reprodução dos confrontos reportados

Mesma seed `20260720`, 491 mapas, lados normais do mapa:

| Confronto / jogador | Antes | Depois | Rating de origem |
|---|---:|---:|---:|
| NAVI×MongolZ — s1mple | 1,396 | 1,479 | 1,47 |
| NAVI×MongolZ — electroNic | 1,390 | 1,360 | 1,28 |
| NAVI×MongolZ — 910 | 1,192 | 1,148 | 1,02 |
| NAVI×FaZe — s1mple | 1,272 | 1,341 | 1,47 |
| NAVI×FaZe — electroNic | 1,282 | 1,227 | 1,28 |
| NAVI×FaZe — NiKo | 1,432 | 1,620 | 1,70 |

Os valores não são fixados por jogador: são resultados agregados da mesma
simulação round a round. A comparação por nomes aparece somente neste relatório
de diagnóstico, nunca no motor.

## Validação já executada nesta etapa

- benchmark completo de realismo: aprovado;
- regressão, snapshot de 85 jogadores e goldens: aprovados;
- calibrador principal, pesado e workers: aprovados;
- golden repetido duas vezes em motores novos: idêntico;
- invariância a nome: aprovada;
- sintaxe, contrato do sandbox e lint: aprovados.
- validação integral: 17/17 suítes em 173,7 s, com 45.900 mapas e 941.838 rounds.

## Estado posterior e limites desta recalibração

O commit `626b7ed` publicou esta recalibração. O commit `d7b3200` alterou apenas
a apresentação do sandbox para listar todos os jogadores simulados; não mudou
rating, pesos, RNG ou resultados.

Esta etapa corrigiu a compressão e endureceu correlação, MAE, inclinação e erro
máximo. Ela ainda não protege completamente:

- percentis e caudas individuais;
- correlação de ranking e preservação de top players;
- inversões de hierarquia dentro de cada time;
- distribuição mapa a mapa apresentada ao usuário;
- possível viés específico de sobrevivência por role e playstyle.

A sequência aprovada está em `docs/next-steps.md`: primeiro auditoria individual,
depois variância no sandbox, contrato do modo campanha e auditoria de
AWPer/sobrevivência. Novo balanceamento só será executado se essa auditoria
comprovar um problema material, sempre sem curadoria por nome.
