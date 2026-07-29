# Auditoria de identidade individual — Etapas R4.1 e R4.2

Data: 23 de julho de 2026  
Escopo: caracterização diagnóstica e telemetria opcional, sem balanceamento

## Contrato da execução

Comando:

```text
node bancada/auditoria.js --deep --cycles 8
```

A auditoria foi executada originalmente pelo motor de `game.js`; hoje
`bancada/motor.js` compõe a mesma API pública de simulação. A agenda round-robin
determinística e o contrato Mulberry32 permanecem. A execução cobriu:

- 85 IDs e 17 times;
- 16 adversários por jogador;
- 8 mapas, com exposição igual;
- 8 ciclos e 1.088 mapas;
- 22.446 rounds;
- 128 mapas por jogador;
- orientação A/B e exposição aos lados CT/TR equilibradas.

O JSON completo do schema 3 foi construído duas vezes no mesmo processo. Os
dois resultados produziram o mesmo SHA-256:

```text
eaf99d88c72cf6f0e912017a36865bdb9a329051b784a018ef0e930df48a0584
```

O relatório se autovalida antes de ser retornado: cobertura de todos os grupos,
player-rounds, resultados por jogador, partições CT/TR e por compra, igualdade
global entre kills e deaths e reconciliação de K/D/A/KAST da telemetria com o
resultado final de cada mapa.

## Telemetria R4.2

`simularMapa` aceita `{telemetry: true}` como opção exclusivamente diagnóstica.
Quando habilitada, registra os fatos que o motor já decidiu em cada round:

- lado e compra do time;
- kills, deaths, assists, dano e sobrevivência por jogador;
- abertura, trade imediato e crédito efetivo de KAST;
- plant, método do resultado, clutch e ramo explícito de save.

A opção não cria chamadas ao RNG nem altera placar, timeline, economia ou
estatísticas. O golden executa a mesma seed em motores novos com a opção desligada
e ligada, remove somente a telemetria e exige igualdade profunda do resultado
completo. Ele também reconstitui K/D/A/KAST/ADR dos rounds e confere os totais.

## Resultado por função primária

| Função | N | Rating | KPR | DPR | APR | KAST | ADR |
|---|---:|---:|---:|---:|---:|---:|---:|
| AWPer | 15 | 1,244 | 0,789 | 0,682 | 0,193 | 75,3% | 85,3 |
| Rifler | 16 | 1,247 | 0,775 | 0,734 | 0,186 | 72,9% | 84,8 |
| Entry | 15 | 1,113 | 0,673 | 0,720 | 0,192 | 70,5% | 76,8 |
| Lurker | 12 | 1,198 | 0,763 | 0,709 | 0,205 | 74,1% | 84,2 |
| Support | 10 | 1,010 | 0,599 | 0,685 | 0,238 | 72,2% | 72,2 |
| IGL | 17 | 1,000 | 0,566 | 0,644 | 0,264 | 73,3% | 69,8 |

Essas taxas são agregadas por player-round. O relatório mantém também as
distribuições por jogador-mapa, e não somente as médias desta tabela.

## Sobrevivência e save por lado

| Função | DPR CT | Sobrevive CT | Save CT | DPR TR | Sobrevive TR | Save TR |
|---|---:|---:|---:|---:|---:|---:|
| AWPer | 0,686 | 31,4% | 0,7% | 0,677 | 32,3% | 1,3% |
| Rifler | 0,740 | 26,0% | 0,5% | 0,728 | 27,2% | 0,9% |
| Entry | 0,727 | 27,3% | 0,6% | 0,713 | 28,7% | 1,0% |
| Lurker | 0,710 | 29,0% | 0,8% | 0,708 | 29,2% | 1,4% |
| Support | 0,696 | 30,4% | 0,8% | 0,674 | 32,6% | 1,5% |
| IGL | 0,653 | 34,7% | 0,9% | 0,635 | 36,5% | 1,5% |

`Save` significa que o jogador sobreviveu em um ramo de save já existente. O
motor não mantém inventário individual; portanto, a coluna não prova que uma AWP
ou outra arma específica foi preservada.

O AWPer tem DPR menor que Rifler, Entry e Lurker, mas não possui um mecanismo de
save distintivo. O IGL primário é o grupo que mais sobrevive. Isso confirma o
sintoma agregado, mas não autoriza a conclusão comportamental de que todo IGL
está “baitando”: a função primária mistura perfis de combate incompatíveis.

## Trade e composição do KAST

| Função | Mortes trocadas | Crédito KAST entre mortes trocadas |
|---|---:|---:|
| AWPer | 31,2% | 44,7% |
| Rifler | 31,8% | 44,9% |
| Entry | 32,0% | 44,3% |
| Lurker | 32,0% | 44,7% |
| Support | 32,2% | 45,4% |
| IGL | 30,9% | 44,9% |

As diferenças são mínimas e o crédito efetivo converge para a probabilidade
global já existente de 45%. Logo, o motor atual não produz uma identidade de
trade/KAST própria para Support, Entry ou outro papel. Esta é evidência do local
do modelo que precisará ser comparado em eventual R5; ainda não é uma proposta
de novos pesos.

## A média IGL esconde a função de combate

| Par | N | Rating | KPR | DPR | APR | KAST | ADR |
|---|---:|---:|---:|---:|---:|---:|---:|
| IGL/AWPer | 2 | 1,295 | 0,866 | 0,700 | 0,221 | 76,7% | 92,9 |
| IGL/Rifler | 2 | 1,205 | 0,798 | 0,668 | 0,200 | 75,8% | 86,0 |
| IGL/Entry | 5 | 0,972 | 0,506 | 0,661 | 0,239 | 69,8% | 64,4 |
| IGL/Support | 8 | 0,893 | 0,467 | 0,613 | 0,307 | 74,0% | 63,2 |

`IGL` isoladamente não é unidade válida para diagnosticar identidade de combate.
O par primária/secundária deve ser preservado em toda comparação posterior. A
diferença também mostra por que uma correção uniforme por role seria arriscada.

## Economia observada

| Compra | Time-rounds | Frequência |
|---|---:|---:|
| Pistol | 4.352 | 9,7% |
| Eco | 4.822 | 10,7% |
| Force | 3.410 | 7,6% |
| Full | 32.308 | 72,0% |

O relatório agora relaciona essas compras de time à produção individual de cada
round. A presença de 10,7% de ecos rejeita a causa proposta de “ausência de
rounds eco” para o ADR observado. Declarar a média de ADR inflada ainda exige um
alvo empírico equivalente em época, nível, formato e composição de roles.

## Diagnóstico do laudo externo

1. A igualdade global KPR=DPR é uma invariante correta, mas não basta para
   classificar todo o sistema como robusto ou realista.
2. A crítica ao DPR/survival do AWPer é material; a causa específica alegada
   (arma e economia quebrada) não pode ser provada sem inventário individual.
3. A linha IGL realmente sobrevive mais, porém o rótulo “baiter” não é provado.
   O agregado é fortemente afetado pelo segundo papel e pelos atributos.
4. Rifler e Lurker permanecem próximos; a telemetria também não encontrou uma
   grande separação de sobrevivência entre eles.
5. Support não recebe identidade especial de trade/KAST. Esta crítica é
   sustentada diretamente pelos eventos de round.
6. A hipótese de inflação do ADR por ausência de eco é rejeitada pelos dados.
7. `A/K` não deve orientar o ajuste: o motor e o relatório usam APR. Entry tem
   0,192 APR, próximo de Rifler (0,186), não o maior valor entre as funções.
8. olofmeister segue como maior desvio absoluto, rating real 1,27 contra 1,081
   simulado nesta agenda. É caso de reprodução, nunca alvo nominal de regra.

## Limites restantes

Mesmo com a telemetria, o relatório não observa:

- inventário, arma usada ou arma preservada por jogador;
- compra individual, pois a compra disponível é um estado do time;
- assistência de dano separada de flash assist;
- dados empíricos externos equivalentes que convertam caracterização em alvo;
- IFCS válido; esta auditoria continua sendo uma prova interna do simulador.

## Gate para balanceamento

R4.2 encerra a lacuna de observabilidade de rounds sem mudar o modelo. Antes de
R5, cada hipótese de alteração deve receber alvo mensurável, comparação pareada
nas mesmas seeds e avaliação por role primária/secundária, lado, compra, caudas e
métricas macro. Armas individuais ou novas regras de save são mudanças de modelo,
não extensões de telemetria.

Nenhum `CFG_*`, peso, threshold, dado de jogador, role, rating, regra econômica
ou fixture golden foi alterado nas etapas R4.1 e R4.2.

## Validação

Aprovados após a mudança:

```text
npm run check
npm run lint
npm run test:data
npm run test:regression
npm run test:benchmark
npm run test:e2e
```

O benchmark histórico permaneceu verde em 45.900 mapas e 941.838 rounds. O E2E
completo passou pelos fluxos do editor, Simular e jogo principal. Dentro da
regressão, o golden prova a paridade opcional da telemetria, o estado posterior
do RNG e a reconciliação dos eventos com o resultado final.
