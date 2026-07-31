# R5.8 — auditoria do rating pós-eventos

Data: 23 de julho de 2026

Baseline: `bf62406`

## Resultado

Nenhum peso do rating foi alterado. O candidato foi rejeitado porque o prior
atual já está no ponto de calibração e aumentá-lo não melhora a validação.
Corrigir resíduos individuais por essa via esconderia diferenças produzidas nos
rounds, especialmente em confrontos entre equipes de épocas distintas.

O comando `npm run audit:r5:rating` reconstrói as onze parcelas a partir da
telemetria do round e exige igualdade com o rating exibido em cada player-map.
A execução completa cobriu 61.200 mapas-alvo, 85 jogadores e 3.600 amostras por
jogador.

## Decomposição

| Parcela | Média | DP entre jogadores | Correlação com rating histórico |
|---|---:|---:|---:|
| Base | 0,5920 | 0,0000 | 0,000 |
| Kills eco-ajustadas | 0,2838 | 0,0766 | 0,871 |
| Sobrevivência | 0,0491 | 0,0118 | -0,436 |
| KAST | 0,1757 | 0,0078 | 0,457 |
| Multi-kill | 0,0112 | 0,0042 | 0,856 |
| Swing | -0,0051 | 0,0027 | 0,704 |
| Abertura | 0,0086 | 0,0123 | 0,863 |
| Dano | 0,0051 | 0,0253 | 0,850 |
| Trade | 0,0165 | 0,0044 | 0,285 |
| Prior histórico | 0,0011 | 0,0807 | 1,000 |
| Sistema do IGL | 0,0030 | 0,0060 | -0,381 |

Sem o prior, os eventos ainda preservam correlação `0,875`, mas ficam em MAE
`0,0704` e RMSE `0,0985`. O rating completo alcança correlação `0,956`, MAE
`0,0486` e RMSE `0,0602`. Portanto, os eventos dominam o valor de cada mapa e o
prior melhora a calibração de longo prazo sem fixar o resultado.

## Candidato recusado

Os 85 jogadores foram ordenados por hash determinístico e separados em 51 para
calibração, 17 para validação e 17 para auditoria. O holdout de auditoria não foi
usado para selecionar nem reportar o candidato.

Na calibração, o coeficiente ótimo do prior foi `0,455`, contra `0,450` atual:

| Split | Configuração | Correlação | MAE | RMSE |
|---|---|---:|---:|---:|
| Calibração | atual | 0,956 | 0,0518 | 0,0636 |
| Calibração | candidato | 0,956 | 0,0517 | 0,0636 |
| Validação | atual | 0,957 | 0,0497 | 0,0596 |
| Validação | candidato | 0,958 | 0,0498 | 0,0600 |

O ganho de MAE na calibração é `0,0001`, enquanto MAE e RMSE pioram na
validação. O coeficiente, os clamps internos do prior e todos os demais pesos
foram preservados. O rating final continua sem piso ou teto duro.

## Caso FaZe

As fontes históricas confirmam os valores de entrada. No ESL One New York 2017,
uma amostra excepcional de sete mapas, olofmeister registrou KPR `0,78`, DPR
`0,52` e rating `1,27`; karrigan registrou `0,59`, `0,48` e `1,20`:

- [histórico de eventos de olofmeister](https://www.hltv.org/stats/players/events/885/olofmeister);
- [histórico de eventos de karrigan](https://www.hltv.org/stats/players/events/429/karrigan);
- [evento ESL One New York 2017](https://www.hltv.org/events/2636/esl-one-new-york-2017).

No confronto artificial NAVI 2021 × FaZe 2017, seed `20260720`, a FaZe venceu
363 de 491 mapas. Mesmo assim, o contexto é outro:

| Jogador | Rating histórico | Rating sim | KPR sim | DPR sim | KAST sim | ADR sim |
|---|---:|---:|---:|---:|---:|---:|
| olofmeister | 1,27 | 1,092 | 0,567 | 0,624 | 68,8% | 64,5 |
| karrigan | 1,20 | 1,048 | 0,452 | 0,593 | 73,5% | 62,0 |

Antes do prior, ambos ficam em aproximadamente `1,04`; o pós-processamento não
é a causa da produção baixa. Um lote de 491 mapas reduz o erro amostral e
converge para a expectativa daquele confronto, não para a média do torneio de
origem. Igualar os valores por força seria curadoria.

O próximo trabalho cientificamente defensável é melhorar proveniência dos sete
atributos crus ou medir a relação entre domínio de rounds e distribuição de
kills usando referência factual. Isso deve ser uma etapa de dados/combate
separada, não uma alteração no rating final.
