# Auditoria de identidade individual — Etapa R4.1

Data: 23 de julho de 2026  
Escopo: caracterização diagnóstica, sem balanceamento

## Contrato da execução

Comando:

```text
node bancada/auditoria.js --deep --cycles 8
```

A auditoria usa o motor executável de `game.js` por `bancada/motor.js`, agenda
round-robin determinística e o contrato Mulberry32 existente. A execução cobriu:

- 85 IDs e 17 times;
- 16 adversários por jogador;
- 8 mapas, com exposição igual;
- 8 ciclos e 1.088 mapas;
- 22.446 rounds;
- 128 mapas por jogador;
- orientação A/B equilibrada, que não deve ser confundida com produção CT/TR.

O JSON completo do schema 2 foi construído duas vezes no mesmo processo. Os
dois resultados produziram o mesmo SHA-256:

```text
18a77a4aa8cba855a1a7cfc3ba60605c69de5a3b16b42229761a5ce9c6e26a23
```

O relatório se autovalida antes de ser retornado: cobertura de todos os grupos,
player-rounds, resultados por jogador, duas observações de compra por round e
igualdade global entre kills e deaths.

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

## A média IGL esconde a função de combate

| Par | N | Rating | KPR | DPR | APR | KAST | ADR |
|---|---:|---:|---:|---:|---:|---:|---:|
| IGL/AWPer | 2 | 1,295 | 0,866 | 0,700 | 0,221 | 76,7% | 92,9 |
| IGL/Rifler | 2 | 1,205 | 0,798 | 0,668 | 0,200 | 75,8% | 86,0 |
| IGL/Entry | 5 | 0,972 | 0,506 | 0,661 | 0,239 | 69,8% | 64,4 |
| IGL/Support | 8 | 0,893 | 0,467 | 0,613 | 0,307 | 74,0% | 63,2 |

Conclusão restrita aos dados simulados: `IGL` isoladamente não é uma unidade
válida para diagnosticar identidade de combate. O par primária/secundária deve
ser preservado em toda comparação posterior. A diferença não autoriza ainda
alterar multiplicadores; primeiro é necessário localizar quanto vem dos dados
dos jogadores, do papel usado pelo motor e do fluxo de combate.

## Economia observada

| Compra | Time-rounds | Frequência |
|---|---:|---:|
| Pistol | 4.352 | 9,7% |
| Eco | 4.822 | 10,7% |
| Force | 3.410 | 7,6% |
| Full | 32.308 | 72,0% |

Isso rejeita a hipótese de que o simulador não produz rounds eco. Não permite,
porém, declarar o ADR fiel: o resultado individual ainda é agregado por mapa e
não pode ser relacionado a compra, arma, lado ou estado de sobrevivência.

## Achados que permanecem abertos

1. AWPers continuam em aproximadamente 0,68 DPR. A auditoria confirma o
   sintoma, mas ainda não separa exposição, save, lado e perfil agressivo.
2. `IGL/AWPer` apresenta produção muito acima de `AWPer` primário. É necessário
   medir o caminho efetivo do papel de combate antes de mudar qualquer regra.
3. Support registra 72,2% KAST. A média não informa quantos créditos vieram de
   kill, assistência, sobrevivência ou trade.
4. Entry tem 0,192 APR, praticamente igual a Rifler (0,186) e abaixo de Lurker
   (0,205). O suposto paradoxo de A/K não aparece quando se usa APR.
5. olofmeister permanece o maior desvio absoluto: rating real 1,27 contra
   1,081 simulado nesta agenda. Ele é caso de reprodução, não alvo de regra.

## Limite desta etapa

O relatório não consegue observar, sem telemetria adicional:

- KPR, DPR, ADR, KAST e sobrevivência separados por CT/TR;
- compra do time ligada à produção individual de cada round;
- save por jogador ou preservação de arma;
- arma usada, porque o motor atual não mantém inventário individual;
- assistência de dano separada de flash assist;
- componentes factuais do KAST por round.

Essas ausências são declaradas no próprio JSON. Nenhuma conclusão deve simular
essa granularidade a partir de médias agregadas.

## Gate para R4.2

A próxima etapa permitida é somente telemetria opcional dos eventos que já
existem no motor. Ela deve manter quantidade e ordem das chamadas ao RNG, placar,
timeline, estatísticas e goldens exatamente iguais. Armas individuais ou novas
regras de save são mudanças de modelo e ficam fora da telemetria.

Nenhum `CFG_*`, peso, threshold, dado de jogador, role, rating, regra econômica
ou golden foi alterado nesta etapa.

## Validação

Aprovados após a mudança:

```text
npm run check
npm run lint
npm run test:data
npm run test:regression
npm run test:benchmark
```

O golden completo permaneceu idêntico. O benchmark histórico também permaneceu
verde em 45.900 mapas e 941.838 rounds.
