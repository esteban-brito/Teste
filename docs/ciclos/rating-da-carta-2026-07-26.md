# O rating emerge da carta — 26 de julho de 2026

> Etapa 3 do ciclo de fidelidade. **É balanceamento.** A regra nova, em uma frase:
> o rating histórico entra **uma única vez**, dentro do OVR (`nmOVR`). Daí em diante o
> motor só enxerga a carta — stats, função, playstyle e OVR.

## 1. O problema: a correlação era circular

`ratingCompetitivo` (o rating HLTV real do jogador) alimentava o motor em **três** pontos:

| Ponto | O que fazia | Efeito |
|---|---|---|
| `CFG_FA.PRIOR` | injetava 45% do desvio do rating real direto na nota final | constante por jogador: desvio **0,081 entre** jogadores, **zero dentro** |
| `CFG_SIM.FRAG_RATING` | multiplicador de 0,60 a 1,55 sobre o volume de kills | decidia a produção individual |
| `CFG_SIM.FORMA_RATING` | 35% do centro da forma do dia | decidia o patamar da noite |

Além disso `tierDe` e `ehEstrela` reliam o rating para classificar nível — usando duas
vezes um número que já tinha entrado no OVR.

O resultado media-se sozinho: o benchmark reportava correlação real×sim de **0,955**, mas
boa parte disso era o motor devolvendo o número que havia recebido. A prova está na
decomposição de variância: o **peso do contexto** era de apenas **44,5%**, quando no CS
profissional a maior parte da variação do rating de um jogador vem do que acontece no mapa,
não de quem ele é.

Medição adicional que fecha o argumento: o multiplicador de produção correlacionava apenas
**0,753** com um candidato construído só a partir do OVR. Ou seja, o motor estava usando
informação sobre o jogador que a carta **não contém**.

## 2. O que foi feito

Removidos: `CFG_FA.PRIOR`, o campo `ratingBase`, `CFG_SIM.FRAG_RATING`, `CFG_SIM.RATING_REF`,
`CFG_SIM.FORMA_RATING` e a própria função `ratingCompetitivo` — **nenhum ponto do motor lê
mais o rating histórico**.

Substituições, todas derivadas da carta:

- **`fragPeso`**: o multiplicador de nível passa a vir do OVR (`FRAG_OVR_MULT`), que é onde o
  rating histórico legitimamente entrou. O valor saiu de uma regressão do multiplicador antigo
  sobre o OVR (0,0565 por ponto) e foi ajustado para **0,045**, ponto em que a sobreposição
  entre bandas de OVR volta à faixa real.
- **`formaDoDia`**: o centro passa a ser só `centroOVR(ovr)`. A curva foi reajustada
  (inclinação 0,060 → **0,064**, base 0,28 → **0,277**) para que sozinha reproduza a média
  (1,079) e o desvio (0,138) que o centro tinha quando misturava OVR e rating.
- **`tierDe`** e **`ehEstrela`**: cortes por OVR (`LENDA_OVR` 21, `STAR_OVR` 18, `SOLIDO_OVR` 16,
  `ESTRELA_OVR` 20), escolhidos sobre os 85 jogadores para preservar a ordem de grandeza das
  faixas (Lenda 6→9, Star 28→30, Sólido 31→34, Role 20→12; estrelas 15→17). A regra de que
  IGL/Support de pouco fogo é *streaky* foi **preservada** — ela deriva de função e firepower,
  que são carta.
- **`CFG_FA.BASE`**: recentrada de `.592` para **`.614`**. Sem o prior a média simulada caía
  para 1,140; em `.614` volta a **1,163**, que é a média histórica do próprio elenco.

## 3. Efeito medido

### O alvo central foi atingido

| Medida | Antes | Depois | Alvo |
|---|---|---|---|
| **Peso do contexto** | 44,5% | **71,9%** | 70–88% |
| **Sobreposição OVR 14-16 × 19-22** | 17,7% | **25,4%** | 25–40% |
| r² do OVR sobre a média do jogador | 0,573 | 0,614 | 0,20–0,75 |
| Variância *entre* jogadores | 0,0359 | **0,0122** | — |

A variância entre jogadores caiu 66%: era, em boa parte, o prior — uma constante por jogador
que não variava de mapa para mapa. O resultado individual deixou de estar decidido antes do
mapa começar.

### Não se moveu o que não podia

- **Snapshot idêntico**: função, playstyle e OVR dos 85 jogadores intactos.
- Macro de `realismo.js` integralmente na faixa.
- `kda.js` verde: KPR global 0,694, KAST 73,2%, ADR 78,8, assinaturas por função preservadas.

### O que piorou — e por que isso é o resultado correto

`bancada/rating.js` caiu de r=0,960 / MAE=0,045 / inclinação=1,013 para **r=0,859 / MAE=0,074
/ inclinação=0,510**.

Isso não é regressão: é a medida deixando de ser circular. A inclinação de 0,51 diz que a
carta explica cerca de metade da dispersão do rating histórico. Forçá-la de volta a 1,0
exigiria devolver o rating histórico ao motor — exatamente o que esta etapa removeu.

Por isso `rating.js` **deixou de ser gate** e virou relatório. Sua única checagem obrigatória
que permanece é a **cobertura**: um jogador sumir da amostra continua sendo erro.

O gate de qualidade individual passou a ser `bancada/perfis.js`, agora com **ratchet por
etapa**: os critérios de coerência de carta já reprovam a suíte, de modo que uma mudança
futura que reintroduza circularidade quebra o build.

### O que continua pendente e por quê

O **desvio intra-jogador** segue em **0,170** (alvo 0,22–0,32). Investigamos: dobrar a
volatilidade da forma (`PERFIL_TIER.vol` ×2) move o número apenas de 0,168 para 0,180. A causa
não é a forma — é a estrutura do round. Com 58% dos rounds terminando em 8–9 kills, todo
jogador produz em todo round, e a média sobre ~20 rounds achata a variação. Só o relógio do
round (Etapa 4) pode produzir a produção irregular que o CS real tem.

Esses critérios ficam marcados como "aguarda o relógio do round" em `perfis.js` — visíveis,
não silenciados, e não reprovando algo que a etapa atual não podia resolver.

## 4. Âncoras atualizadas

1. **`economy-and-clutches`** (seed 1): 10-13 → **5-13**.
2. **`repeated-overtime`**: a seed 349 deixou de ir para a prorrogação. Este cenário é frágil
   por natureza — qualquer balanceamento reembaralha o RNG. A regra, agora escrita no próprio
   arquivo, é **procurar uma seed que volte a produzir 2+ prorrogações**, nunca aceitar um
   placar de tempo normal. A seed **111** reproduz 22-18 em 40 rounds (três prorrogações). O
   guarda estrutural `totalRounds>=30` continua confirmando a cobertura.
3. **`campaign-best-of-three`** (seed 9): segue 1-2 em três mapas; o terceiro mudou de Dust2
   para Ancient.
4. **`campaign-golden.json`** (sandbox, seed 424242): 2-1 em três mapas → **2-0 em dois**.

## 5. Validação

22/22 suítes verdes (`npm run validate`), incluindo os três E2E e todas as paridades de
`npm run check`.
