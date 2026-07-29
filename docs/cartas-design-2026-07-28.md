# Cartas de jogador — design aprovado (28/07/2026)

> **Estado: LIGADO AO JOGO em 29/07/2026**, depois do P2, como o responsável havia
> decidido. O design executável vive em `src/ui/game/card-view.mjs`, com
> `src/ui/shared/flags.mjs` (bandeiras) e `src/ui/shared/role-emblems.mjs`
> (emblemas), e o CSS entrou em `style.css` — commits `c1ecdee` e `8a12250`. O que
> mudou de lá para cá está na **seção 10**.
>
> `prototipo-cartas.html` deixou de ser protótipo e virou o **laboratório de
> cartas** — ver a seção 11. Ele importa o código real, então não pode mais
> divergir do jogo.

## 1. A direção escolhida

Três direções foram apresentadas; o responsável escolheu a **A** ("mil vezes o A"),
com duas ressalvas que foram atendidas: *"conseguir realmente enxergar o que importa"*
(hierarquia) e *"falta refino profissional"* (ofício).

Linguagem visual: a foto **é** a carta, tingida pela cor da raridade; uma diagonal
separa a zona da foto da placa de informação; quase nenhum texto.

## 2. Frente — quem é e quanto vale

Três níveis de leitura, e **só três**:

1. **OVR** sozinho no canto superior esquerdo, sem competir com nada.
2. **Nick** sobre uma placa sólida — contraste garantido em qualquer foto.
3. **Função primária** na cor da raridade.

Rodapé em uma linha só, apagada: **função secundária** e **time**. Canto superior
direito: **bandeira do país**.

Decisões que custaram iteração:

- O nome **não** pode ficar sobre uma faixa em degradê: o contraste muda ao longo da
  própria palavra. Placa sólida resolve, e é o que cartas de coleção reais fazem.
- Campeonato e ano ficam **só no verso** — na frente competiriam com o OVR.
- Nome longo **encolhe** (escala por comprimento), nunca é cortado com reticências.
  A razão vive na `.carta`, então **as duas faces encolhem juntas**.

## 3. Verso — como joga

A espinha é o **playstyle**, e a **receita fica visível** com os pesos que o motor
realmente usa: dá para ver *por que* ele é Closer, não só o rótulo.

- Firepower **sempre em primeiro**; os demais por contribuição ao estilo.
  Mesma regra do `backPlayer` em `game.js` — fp é prefixado mesmo quando não está na
  receita, e o conjunto é cortado em 4. Por isso o verso mostra **3 ou 4 stats**, e o
  layout precisa aguentar os dois casos (por isso a lista centraliza).
- Rodapé: **campeonato**, **ano** e **colocação**. É o que distingue duas cartas do
  mesmo jogador — donk em *IEM Katowice 2024* e donk em *Budapest Major 2025* são a
  mesma pessoa em eras diferentes.

## 4. Padronização

- **Um bloco de tokens em `.c` governa as DUAS faces**: um recuo lateral (`--pad`),
  um passo vertical (`--passo`) que gera a pilha inteira por `calc`, e quatro corpos
  de texto numa razão de ~1,5.
- **Raridade é uma tabela** de três colunas — cor, aro, brilho. Nova raridade = nova
  linha.
- A diagonal do verso **deriva em CSS** o mesmo ângulo físico da frente
  (`--corte-n * --placa-n / --faixa-n`). Antes era um valor fixo com a conta só no
  comentário, e mudar a altura da placa desalinhava as faces em silêncio.
- **Uma carta, duas densidades**: tudo é `cqw` sobre container query. Abaixo de 150px
  o texto miúdo some sozinho, nas duas faces. Não são duas cartas.

## 5. Faixas de raridade — decididas por medição

**Por OVR puro**, sem promoção por estrela:

| tier | OVR | n | % |
|---|---|---|---|
| holo | 21+ | 6 | 7,1% |
| ts | 20 | 11 | 12,9% |
| t1 | 19 | 11 | 12,9% |
| t2 | 17–18 | 30 | 35,3% |
| t3 | ≤16 | 27 | 31,8% |

A proposta inicial era "estrela promove um degrau". Foi **descartada por medição**: a
flag `estrela` do motor é exatamente `ovr>=20`, com **zero discordâncias em 85** — a
promoção não moveria uma única carta.

**Reconferido em 29/07/2026, já com as cartas ligadas ao jogo:** `tierOf`
(`src/ui/game/card-view.mjs`) aplica exatamente estes cortes e a distribuição medida
nos 85 é a desta tabela. As duas medições da flag também continuam idênticas
(17 jogadores com `estrela`, 17 com `ovr>=20`, zero discordâncias).

O **selo ★ foi removido** a pedido do responsável ("achei bem feio").

## 6. Bandeiras

**22 países** em SVG embutido, cobrindo 85 de 85 jogadores (o `POOL` resolve país
juntando `p.pais` com o mapa) mais CAN e AUT, que só aparecem em treinador.

**Não são emoji.** O Windows não tem os glifos de bandeira e renderiza as duas letras
no lugar do desenho. Como saem com ~14px, o que lê é geometria e cor — USA, GBR, AUS,
CAN, ISR, MNG, BIH, KAZ, SVK e BLR são simplificadas de propósito.

## 7. Casos reais que quebrariam o layout

Todos achados medindo o motor, todos com fila própria no protótipo:

- **IGL tem `role2` nulo** nos 17 casos. A carta usa `combatRole`.
- **Coringa não tem receita** (3 jogadores) — o verso diz isso em vez de mostrar
  barras vazias.
- **Firepower 2** (chopper) fixado em primeiro deixaria uma barra invisível. Há piso
  de 3% no trilho.
- **Sem foto** é o estado de **todos** os 85 hoje — é estado declarado, não remendo.

## 8. Dados: tudo vem do motor

As 15 cartas do protótipo saíram de `avaliarJogador` e `TIMES_DEF`, conferidas com
**zero divergências**. Nada é digitado. Foi assim que apareceu que o s1mple é OVR 20
e não 21, como um rascunho anterior afirmava.

## 9. O que falta — situação em 29/07/2026

1. ~~**Ligar ao jogo**~~ **FEITO** (`c1ecdee`). Os tokens pagaram o que prometiam:
   entraram no `style.css` como um bloco só.
2. ~~**Carta de TREINADOR**~~ **FEITA** no mesmo commit, e pelo mesmo esqueleto das
   outras. Duas diferenças declaradas: a cor vem da **característica**, não da
   raridade, porque ele não disputa a escala de OVR dos jogadores; e a característica
   ocupa o lugar da função primária, já que é ela que descreve o que ele faz pelo
   time. O emblema é a prancheta e o verso descreve o efeito da característica.
3. **Fotos — CONTINUA ABERTO.** A camada existe e está vazia (`.c-foto`): 0 de 85
   jogadores têm retrato e não há campo para guardá-lo. O estado "sem foto" é
   declarado, não remendo — a tinta da raridade sobe e a carta fica assumidamente
   gráfica. `src/data/catalog.mjs` registra isso em `DIVERGENCIAS` (`sem-foto`).
   Decisão de produto pendente; quando as fotos existirem, é mudança de dado, não
   redesenho.
4. ~~**Daltonismo**~~ **RESOLVIDO** (`8a12250`) pelo emblema de função: seis
   silhuetas no mesmo grid 24×24, forma independente de cor, que também diferencia na
   grade de 2 colunas do celular. `tools/check-game-view-modules.js` exige as seis
   silhuetas distintas.
5. **Duplicados na roleta — CONTINUA ABERTO, como questão visual.** 8 jogadores têm
   duas eras e as duas frentes ficam quase iguais; só o rodapé (time) e o verso
   (campeonato, ano, colocação) as distinguem. O que já existe, e é **anterior a este
   documento**, é a regra de LINE: `game.js` bloqueia o mesmo nick duas vezes no seu
   elenco (classe `dup`) e o Major remove um NPC com sobreposição de nicks. Falta
   decidir se a apresentação deve distinguir as eras na própria frente.

## 10. O que mudou ao ligar ao jogo (29/07/2026)

**A carta ganhou um segundo canal.** O design de 28/07 comunicava uma coisa por cor —
a raridade. No elenco do MongolZ isso produzia quatro cartas praticamente iguais
(17, 17, 17, 16, todas na mesma faixa), e foi o que o responsável apontou jogando.
Agora são dois canais, e eles não disputam nenhuma propriedade:

| classe | canal | pinta |
|---|---|---|
| `tier-*` | **raridade** | moldura: aro, brilho, fio, placa e o rótulo do OVR |
| `fn-*` | **função** | campo: cor de fundo, nome da função e o emblema ao fundo |

**As faixas vivem no código, em dois lugares que precisam andar juntos.** `tierOf`
em `src/ui/game/card-view.mjs` é a fonte; `elencos.html` mantém a própria cópia
(`tierVars`) porque é template gerado. Se as duas divergirem, o **mesmo jogador
aparece com cor diferente em duas telas** — o comentário está escrito nos dois
arquivos. O guarda de views cobre as bordas (20 não pode cair em `tier-1`, 17 não
pode cair em `tier-3`).

O resto deste documento (hierarquia da frente, playstyle como espinha do verso,
tokens, bandeiras e os casos que quebram layout) continua valendo como escrito.

## 11. O laboratório de cartas (29/07/2026)

`prototipo-cartas.html` era autocontido — cópia do CSS, das bandeiras, dos dados e
da escala de nome — e apodreceu no dia em que as cartas foram ligadas ao jogo. Agora
ele **importa** `style.css`, `src/ui/game/card-view.mjs`, `src/ui/shared/flags.mjs` e
`src/ui/shared/role-emblems.mjs`: zero cópia, 85 jogadores e 15 treinadores reais.

```text
npm run serve   →   http://127.0.0.1:5173/prototipo-cartas.html
```

Precisa de servidor: módulo ES não carrega por `file://`.

O que ele tem: um botão **Proposta** (tecla `P`) que liga o bloco `#proposta` e faz o
A/B contra o jogo atual; **verso**, **escala de cinza**, **cinco larguras reais**
(250/188/176/130/120 px) e **simulação de daltonismo**; a escada de raridade isolando
só o OVR; a matriz de 30 combinações raridade × função; os casos que quebram; os 17
elencos completos; emblemas e bandeiras ampliados.

E tem o **medidor de encaixe**, que é a parte que não é gosto: ele compara texto
contra caixa em todas as cartas da página e reprova por número. Toda mudança de design
de carta entra aqui primeiro; ao ser aprovada, migra para `style.css`/`card-view.mjs`.

### A regressão que o medidor achou

**A escala de nome estava morta no jogo.** `--t2` era declarado em `.card`, mas
`card-view` põe `--nick-esc` em `.cfaces`, que é **filha** — e substituição de custom
property acontece no elemento onde a propriedade é declarada, então `var(--nick-esc,1)`
sempre caía no fallback 1. Os 100 nicks renderizavam a 16cqw. No protótipo antigo
funcionava porque lá a razão vivia em `.carta`, um **ancestral**; a relação inverteu na
migração e nenhuma guarda mede encaixe.

Resultado medido: `olofmeister` e `pashaBiceps` passavam **28 px** da borda e eram
cortados no meio da letra; `electroNic`, `Skadoodle` e `controlez` também estouravam.
A densidade compacta ainda **aumentava** a fonte (18cqw), o que reabria o estouro a
120 px mesmo com a razão viva.

| largura | estouros hoje | com a proposta |
|---|---:|---:|
| 250 · 188 · 176 px | 14 | **0** |
| 130 · 120 px | 22 | **0** |

### Propostas no laboratório, aguardando aprovação

| id | o que é | natureza |
|---|---|---|
| P1 | `--t2` declarado onde `--nick-esc` existe; compacto para de crescer o nick | conserto |
| P3 | característica do treinador com razão própria (`Desenvolvedor` estourava 16 px, 26 px a 120 px) | conserto |
| P4 | escada de raridade legível em cinza: 0–4 marcas + peso de aro + fio normalizado | design |
| P5 | campo da função com menos croma; emblema mais presente | design |
| P6 | treinador sai da escada: moldura neutra e fio segmentado | design |
| P8 | `:hover` para de exibir o aro de opacidade cheia de outra faixa | conserto |
| P9 | carta declarando "sem treinador" no lugar do buraco na grade | design |

Os números que sustentam P4 e P5: a luminância das cinco faixas é quase o inverso da
escada (`s 0,300 < 2 0,402 < 3 0,460 < h 0,469 < 1 0,581`), e **as seis** cores de
função caem a ≤30° de matiz de alguma cor de raridade — IGL×tier-3 a 4°, AWPer×holo a
5°, Rifler×tier-1 a 6°. Não há como separar por matiz (cinco matizes já cobrem a roda),
então raridade fica com a saturação e a contagem; função fica com a forma.
