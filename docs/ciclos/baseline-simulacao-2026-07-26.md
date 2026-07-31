# Baseline da simulação — 26 de julho de 2026

> Retrato de referência ANTES do ciclo de fidelidade (Etapas 1–5 do plano de
> profissionalização da simulação). Nenhum motor, dado, `CFG_*`, RNG ou
> balanceamento foi alterado para produzir estes números: `npm run check`,
> `snapshot`, `simulation-golden` e as paridades continuam idênticos.
>
> Este documento existe para que as etapas seguintes tenham contra o que comparar.
> Ele não declara que o estado atual é ruim — declara o que ele **é**, com número.

## 1. O que foi construído

Três instrumentos novos, todos de medição pura:

| Suíte | O que mede |
|---|---|
| `bancada/perfis.js` | coerência de carta: assinatura por função e por playstyle, sobreposição entre bandas de OVR, variância intra-jogador, peso do contexto |
| `bancada/dificuldade.js` | P(título) e P(invicto) por faixa de força, replicando o Major da UI (suíça + playoffs) |
| `bancada/realismo.js` (ampliado) | **forma** além da média: kills por round, placar do perdedor, método do round, abertura por lado, mix de compra por lado |

As três rodam em modo **relatório**: imprimem o retrato e os alvos, mas não
reprovam a suíte. Os alvos passam a valer por variável de ambiente, na etapa em
que o problema correspondente for atacado:

- `PERFIS_STRICT=1` — depois da Etapa 3 (rating emerge da carta);
- `FORMA_STRICT=1` — depois da Etapa 4 (o round ganha tempo);
- `DIFICULDADE_STRICT=1` — no fechamento.

Congelar limites antes disso produziria gate verde sobre premissa errada.

`bancada/realismo.js` liga a telemetria em 1 de cada 8 mapas. A telemetria observa
decisões já tomadas — não consome RNG nem altera resultado (game.js, `simularMapa`)
—, então amostrar é seguro e mantém a suíte barata.

## 2. Coerência de carta — o achado central

Amostra: 40 campanhas, 61.200 jogador-mapas, 85 jogadores. Os valores são estáveis
(idênticos em N=6 e N=40), ou seja, são estrutura e não ruído.

| Medida | Atual | Alvo | Leitura |
|---|---|---|---|
| Peso do contexto | **44,5%** | 70–88% | menos da metade da variação do rating vem da partida |
| Desvio intra-jogador por mapa | **0,169** | 0,22–0,32 | o jogador oscila pouco demais; falta noite ruim e noite de gala |
| Sobreposição OVR 14-16 × 19-22 | **16,4%** | 25–40% | um OVR 15 quase nunca supera um OVR 20 |
| r² do OVR sobre a média do jogador | 0,602 | 0,20–0,75 | dentro da faixa, na borda alta |

**Interpretação.** O resultado individual está decidido antes do mapa começar. A
identidade do jogador explica mais que o que acontece no round — o oposto do CS
real, onde um mesmo profissional passa de 0,80 a 1,60 conforme adversário, lado,
mapa, economia e time. É a assinatura numérica do rating histórico entrar como
entrada do motor (`CFG_FA.PRIOR`, `CFG_SIM.FRAG_RATING`, `CFG_SIM.FORMA_RATING`).

## 3. Assinatura por função e por playstyle

Duas quebras de identidade, ambas reprodutíveis:

- **Entry não lidera opening kills.** Entry abre 0,117/round contra 0,153 do
  Rifler. Entry lidera opening *deaths* (0,124) — ou seja, morre tentando abrir mas
  não é quem mais abre. A parcela de exposição da R5.6 resolveu o lado das mortes;
  o lado das kills continua governado por volume de firepower.
- **Spacetaker abre abaixo da média.** A receita do estilo é "abertura + fogo +
  entrada", mas ele marca 0,063 de opening kill por round, abaixo da média dos dez
  estilos, e tem o segundo pior KPR (0,53). O playstyle decide OVR e química, mas
  quase não se expressa no combate.

O que **funciona** hoje: AWPer fraga mais que Support (+0,170 KPR), Support assiste
mais que AWPer (+0,046 APR), IGL rende abaixo da média, Opener abre acima da média,
Trader troca acima da média, Âncora morre abaixo da média.

O estilo **Baiter tem um único jogador** no pool de 85; a checagem correspondente é
dispensada por amostra insuficiente, nunca dada como aprovada.

## 4. Forma do round — o round é um massacre

Distribuição de kills por round (45.900 mapas, 937 mil rounds):

```
2: 7,7%   3: 1,5%   4: 12,1%   5: 2,5%   6: 8,6%   7: 9,3%   8: 28,4%   9: 29,9%
```

- **0,0% dos rounds têm 0 ou 1 kill** (alvo real 8–20%). É estrutural: o laço de
  `combateRound` só avança quando alguém morre, então o relógio não pode correr sem
  baixa. Round quieto e default sem contato são impossíveis por construção.
- **58,3% dos rounds terminam com 8 ou 9 kills**, isto é, com o vencedor tendo 1 ou
  2 sobreviventes. A média de 6,94 kills/round bate o KPR real de 0,694 — mas a
  **forma** é uma barra dupla, com vale em 3, 5 e 7, e não a curva unimodal do CS.
  É exatamente o tipo de erro que uma faixa de média não pega.
- **Mapas apertados (perdedor com 10+ rounds): 26,3%**, contra 45–70% no real. O
  placar do perdedor está quase uniforme entre 0 e 11, quando deveria concentrar
  entre 8 e 12.

Método do round: `detona 31,9% · elim 23,8% · defuse 20,8% · close 16,5% · tempo 7,0%`.
Os 16,5% de `close` são o `CLOSE_MEN`, mecanismo que existe apenas para compensar a
ausência de relógio — ele segura o KPR na faixa às custas da forma.

Economia: **eco no lado TR em 9,0%**, abaixo dos 10–25% reais. Coerente com o custo
de equipar os cinco (`full: 4300`) ser cerca de cinco vezes mais barato que o CS2
real, enquanto prêmios e loss bonus usam os valores exatos do jogo.

## 5. Dificuldade

Amostra: 3.400 campanhas (200 por time), Major de 16 replicado da UI.

| Faixa | Força efetiva | Título | Invicto | Cai na suíça |
|---|---|---|---|---|
| alta | 98,2 | 20,1% | **3,1%** | 12,8% |
| média | 88,6 | 1,5% | 0,0% | 49,0% |
| baixa | 78,5 | **0,0%** | 0,0% | 88,5% |

O alvo acordado é **4–6% de invicto** para elenco bom; a faixa alta está em 3,1%,
perto e ligeiramente difícil demais.

O problema real não é a média, é a **inclinação**: a FaZe (força 103) leva 57,5% dos
títulos e 14,0% dos invictos sozinha, enquanto nenhum time abaixo de 85 ganhou um
único título em 1.200 campanhas. Um elenco fraco está matematicamente morto, o que
contraria a intenção de produto — o jogador precisa poder tentar vencer de várias
formas, não apenas montando o elenco de maior OVR.

Ressalva de leitura: aqui o "seu time" é um elenco de fábrica. No jogo real o usuário
drafta escolhendo as melhores cartas, então o elenco montado tende a ser mais forte
que qualquer time de fábrica — por isso a linha que governa o alvo é a faixa alta.

## 6. Consequência para as próximas etapas

Os números acima dizem em que ordem atacar:

1. o peso do contexto (44,5%) e o desvio intra-jogador (0,169) são o mesmo problema
   visto de dois ângulos, e ambos apontam para a Etapa 3;
2. a forma do round (0% de rounds quietos, barra dupla em 8-9 kills) é a Etapa 4, e
   nenhuma quantidade de ajuste de peso a resolve — falta o relógio;
3. a expressão fraca do playstyle é a Etapa 2, e é pré-requisito para que a Etapa 3
   tenha do que derivar o rating;
4. o eco no TR e o custo de compra são a Etapa 5;
5. a inclinação da dificuldade só pode ser calibrada depois, porque as quatro
   mudanças acima mexem nela.

## 7. Reprodução

```powershell
npm run check                 # motor e paridades intactos
node bancada/perfis.js        # N=40 para o retrato deste documento
node bancada/realismo.js      # N=300 (padrão)
node bancada/dificuldade.js   # N=3400 para o retrato deste documento
```

Sementes fixas: `perfis.js` 31415, `dificuldade.js` 20260726, `realismo.js` 90210.
