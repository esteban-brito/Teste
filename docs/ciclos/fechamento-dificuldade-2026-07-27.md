# Fechamento do ciclo — dificuldade — 27 de julho de 2026

> Última etapa do ciclo de fidelidade. Contém uma **correção de bug** e um **resultado que
> não bateu o alvo**, registrado como está.

## 1. Bug corrigido: a flag de estrela estava sempre falsa

Ao mover `ehEstrela` do rating histórico para o OVR (etapa do rating), a função passou a ler
`p.ovr` — mas era chamada em `avaliarJogador` **antes** de `aplicarAvaliacaoContextual`
calcular o OVR. `(undefined ?? 0) >= 20` é sempre falso, então **nenhum jogador era estrela**.

Consequência silenciosa: toda a penalidade de ego da química desapareceu. Um elenco dos
cinco maiores OVR do jogo recebia química **89%** com o alerta `Estrelas (0)`.

Corrigido: `estrela` passou a ser decidida dentro de `aplicarAvaliacaoContextual`, onde o OVR
existe. O pool voltou a ter **17 estrelas** e o mesmo elenco de cinco superstars agora recebe
`Estrelas (4) −14%` e `Guerra de Estrelas −15%`, caindo para química **71%**.

Isso é exatamente a "punição por composição errada" que o plano pedia como alavanca de
dificuldade — só que estava quebrada, não ausente.

O snapshot dos 85 jogadores permanece idêntico: `estrela` não entra na classificação.

## 2. Correção de método: o que "elenco bom" significa

A primeira versão da suíte de dificuldade media **times de fábrica** e usava a faixa de força
alta como referência. Isso estava errado nos dois sentidos:

- medir os **cinco maiores OVR do jogo** é um limite superior, não um elenco jogável: no
  draft real a roleta sorteia um time por rodada e você escolhe **uma carta dele**;
- medir apenas times históricos subestima o elenco do usuário.

A suíte agora simula o **draft de verdade** — cinco giros, escolha gulosa da melhor carta
disponível do time sorteado, com prioridade para cobrir IGL e AWP — e sorteia um elenco novo
a cada campanha. É essa linha que governa o alvo.

Exemplos de elencos sorteados: `mzinho(17) tarik(20) donk(22) pashaBiceps(20) molodoy(19)`,
`molodoy(19) tabseN(17) karrigan(21) m0NESY(20) Xyp9x(20)`. Força média **87,7**, química
média **88%**.

## 3. Resultado: mais difícil que o alvo

| Medida | Valor | Alvo |
|---|---|---|
| Título (elenco draftado) | 15,3% | 25–60% |
| **Invicto (elenco draftado)** | **1,5%** | **4–6%** |
| Cai na suíça | 21,0% | — |
| Título (faixa alta de fábrica) | 18,3% | 12–30% ✓ |

O alvo acordado era 4–6% de campanha invicta. O jogo terminou o ciclo em **1,5%** — mais
duro que o pedido, não mais fácil.

### Por que não foi calibrado até o alvo

As alavancas de variância disponíveis **levantam o campo inteiro junto e se cancelam**.
Medido: varrer `QUIMICA_MAX` de 1,00 a 1,16 deixa o invicto oscilando entre 0,8% e 1,5% sem
tendência — porque a mesma folga que beneficia o elenco do usuário beneficia os 15 NPCs.

Comprimir a conversão de força em vitória (`D_MAPA`, `D_DUELO`) funcionaria, mas quebraria a
guarda de realismo `Favorito gap 16+` (hoje 86,7%, faixa 82–93): no CS real um time muito
mais forte ganha ~85–90% dos mapas, e afrouxar isso trocaria fidelidade por dificuldade.

Fechar a diferença é **decisão de produto**, não ajuste de constante. As opções, todas fora
do escopo de balanceamento do motor:

1. dar **re-spin** no draft (o usuário monta um elenco melhor que o guloso de um giro só);
2. restringir o campo do Major a times fortes, como um Major real (hoje entram times de
   força 73 e 74);
3. aceitar a faixa mais dura — 1,5% é raro, mas o ciclo inteiro foi pedido como "TEM que ser
   difícil".

A suíte `bancada/dificuldade.js` segue como **relatório**, com o alvo de 4–6% declarado e o
valor real impresso. Não foi marcada como aprovada.

## 4. Estado final do ciclo

| Suíte | Estado |
|---|---|
| `realismo.js` | **12/12 macro e 6/6 forma** dentro das faixas reais |
| `kda.js` | verde |
| `assists.js` | verde |
| `perfis.js` | coerência de carta no alvo; 3 critérios com causa diagnosticada e dono próprio |
| `rating.js` | relatório (deixou de ser gate por circularidade) |
| `dificuldade.js` | relatório — 1,5% contra alvo de 4–6% |
| 22 suítes | verdes |

### O que fica aberto, com causa medida

1. **Desvio intra-jogador** 0,165 (alvo 0,22–0,32). Três hipóteses testadas e refutadas
   (volatilidade da forma, relógio do round, piso da forma). Causa: as kills se distribuem
   dentro do mapa por sorteio multinomial com pesos fixos — o caso de menor dispersão
   possível. Exige momentum individual intra-mapa.
2. **Duelo de abertura decidido por firepower bruto**: Entry não lidera opening kills e
   Spacetaker fica na média. Correção medida (`AGR_ABRE ≈ 1,8`), reservada para commit
   próprio de balanceamento de função.
3. **Utilidade como recurso do round** — única parte do escopo original que não entrou.
4. **Dificuldade** — decisão de produto descrita acima.
