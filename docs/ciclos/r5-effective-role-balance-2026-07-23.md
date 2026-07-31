# R5.5 — função efetiva de combate do IGL

Data: 23 de julho de 2026

Baseline: `c9166bb`

## Hipótese e escopo

O PRISMA já classificava todo IGL também como AWPer, Entry, Rifler ou Support,
mas o simulador aplicava os multiplicadores genéricos de IGL em todos os duelos.
O candidato usa a função classificada somente para conversão de duelo, volume de
frag e impacto contextual. IGL continua sendo a função primária para liderança,
química e crédito de sistema no rating.

Nenhum multiplicador foi criado ou alterado. Dados, classificações, economia,
forma, quantidade e ordem dos pontos de RNG foram preservados.

## Comparação pareada

A mesma agenda de 1.088 mapas e 10.880 player-maps produziu:

| Métrica global | Antes | Depois | Delta |
|---|---:|---:|---:|
| Rating | 1,1383 | 1,1409 | +0,0026 |
| KPR | 0,6934 | 0,6927 | -0,0007 |
| DPR | 0,6934 | 0,6927 | -0,0007 |
| A/R | 0,2124 | 0,2121 | -0,0003 |
| KAST | 73,093% | 73,164% | +0,071 p.p. |
| ADR | 78,724 | 78,663 | -0,061 |
| Sobrevivência | 30,661% | 30,731% | +0,070 p.p. |

Todos os deltas globais ficaram muito abaixo dos pisos materiais congelados.
A média de IGL não deve ser interpretada como uma função de combate homogênea.
Separada pelo par já aprovado no roster, a mudança foi direcional:

- IGL/AWPer: KPR `0,879→0,796`, DPR `0,695→0,650` e sobrevivência
  `30,55%→34,97%`;
- IGL/Entry: KPR `0,506→0,518`, DPR `0,661→0,663` e sobrevivência
  `33,91%→33,70%`;
- IGL/Rifler: KPR `0,797→0,745` e DPR `0,670→0,656`;
- IGL/Support: KPR `0,466→0,469` e DPR `0,612→0,612`.

Isso remove a falsa equivalência entre IGLs sem impor bônus direto de
sobrevivência. A exposição de Entry ainda muda pouco e pertence à R5.6.

## Benchmark completo

Em 45.900 mapas e 936.599 rounds, todas as guardas passaram. O favorito em gap
0–3 convergiu para `55,0%`; o valor `48,5%` observado numa execução do navegador
veio de um subgrupo dentro do limite de 500 mapas da interface e não reproduziu
no benchmark longo.

O rating melhorou de correlação `0,947` e MAE `0,052` para `0,949` e `0,050`.
O desvio de karrigan caiu de `-0,15` para `-0,12`; inclinação ficou em `0,992` e
o maior erro individual em `0,184`, dentro das guardas.

## Goldens

A alteração de quem participa dos duelos muda timelines determinísticas:

- o cenário econômico preservou `4–13` e 17 rounds; mudaram apenas 52 folhas de
  identidade/produção individual;
- a cobertura de overtime passou para a seed `8`, placar `22–19` e 41 rounds;
- a campanha Node de seed `9` passou de `2–1` para `1–2`, com
  `Nuke/Dust2/Anubis`;
- a campanha do laboratório de seed `424242` passou de `0–2` para `1–2`, com
  Nuke `10–13`, Ancient `13–9` e Anubis `11–13`.

Os fixtures foram atualizados somente depois dessas diferenças serem
identificadas. Determinismo, modo leve, telemetria, jogo completo e E2E da aba
Simular permaneceram aprovados.

## Limites

R5.5 corrige qual perfil existente cada IGL usa; não implementa inventário de
AWP, save individual, exposição contextual completa, rotação de lurker ou
oportunidade espacial de trade. Esses mecanismos permanecem famílias separadas.
O corpus IFCS completo continua opcional para certificação futura e não é
pré-requisito operacional deste ciclo; nenhuma nota IFCS oficial é alegada.
