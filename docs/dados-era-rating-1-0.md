# Proveniência dos atributos da era Rating 1.0

> Registro da dívida apontada em `docs/next-steps.md` §R6: "antes de novo balanceamento,
> registrar a proveniência dos overrides do commit `f731b3a`". Escrito em 28/07/2026.

## O problema de fonte

A HLTV usou o **Rating 1.0** até 2017. Ele é calculado a partir de kills, deaths e multi-kills
por round — e só. **Não existem KAST, ADR nem impacto publicados** para essa era, e as
estatísticas granulares que existem são esparsas e de qualidade ruim.

O motor deste projeto lê sete atributos por jogador: `fp` (firepower), `en` (entrada),
`tr` (trade), `op` (abertura), `cl` (clutch), `sn` (AWP/sniper) e `ut` (utilitário). Cinco
deles — entrada, trade, abertura, clutch e utilitário — **não são deriváveis do Rating 1.0**.
Não é uma limitação do projeto: o dado não foi publicado.

## A decisão

Para os jogadores dessa era, os atributos foram **estimados por julgamento do responsável**,
com base no papel real que cada um exercia no time. É a mesma prática já registrada no bloco da
Virtus.pro (`src/data/players.mjs`: *"curadoria: era Rating 1.0 traduzida pra escala atual, por
papel real"*) — o que faltava era aplicá-la explicitamente ao bloco da EnVyUs.

Isso é **juízo, não fonte**, e está marcado como tal no código.

## O commit `f731b3a` (24/07/2026)

`data(players): apply sandbox editor overrides` gravou nos dados as estimativas produzidas no
editor do sandbox. Seis jogadores:

| jogador | time / evento | era | mudança |
|---|---|---|---|
| kennyS | EnVyUs · Cluj-Napoca 2015 | **1.0** | fp 94→70, en 46→29, tr 52→44, cl 63→39, ut 28→45 |
| NBK- | EnVyUs · Cluj-Napoca 2015 | **1.0** | fp 79→61, en 44→36, tr 81→58, op 36→18, cl 68→49, ut 72→42 |
| Happy | EnVyUs · Cluj-Napoca 2015 | **1.0** | en 11→21, op 40→74, cl 43→59, sn 12→28, ut 54→50, **rating 1.10→1.14** |
| apEX | EnVyUs · Cluj-Napoca 2015 | **1.0** | fp 77→56, en 97→76, op 89→87, cl 24→21, ut 42→57 |
| kioShiMa | EnVyUs · Cluj-Napoca 2015 | **1.0** | fp 61→44, en 52→22, tr 61→69, op 32→27, cl 49→37, ut 64→70 |
| RUSH | Cloud9 · Boston 2018 | 2.0 | tr 88→76 |

**A distribuição do esforço corrobora o motivo.** Os cinco reescritos a fundo são exatamente os
da era Rating 1.0; o único da era Rating 2.0 — onde os stats granulares existem — precisou de
um ajuste de um atributo. Não é coincidência: é o buraco de fonte aparecendo no diff.

### Efeito colateral registrado

O simulador centraliza sinais pela população completa dos 85 jogadores (médias usadas em
z-scores, `PRESERVATION_MEAN`, `TRADE_CONTEXT_MEAN`, `ASSIST_UTILITY_MEAN`, a distribuição de
OVR). Alterar seis desloca todos os outros um pouco. Consequências observadas no próprio commit:
o golden NAVI × Outsiders da seed 1 foi de 5–13 para 7–13, e a campanha MD3 da seed 424242
mudou de vencedor.

A classificação derivada também mudou: NBK- `Lurker/Support·Trader·17` → `Rifler/Support·Trader·15`,
Happy `IGL/Rifler·Cerebral·17` → `IGL/Lurker·Infiltrador·19`, apEX OVR 18 → 17, RUSH
`Trader` → `Spacetaker`.

Validação posterior: 19/19 suítes, 45.900 mapas, 937.856 rounds; correlação real×sim 0,955,
MAE 0,050, inclinação 1,016, maior erro individual 0,178.

## O ponto que exige atenção: `rating` é gabarito, não atributo

O campo `rating` **não descreve o jogador** — é a referência histórica contra a qual
`bancada/suites/rating.js` compara o rating simulado. É o gabarito.

O editor do sandbox trata `rating` como mais um campo editável, ao lado de `fp`, `en`, `tr`…
(`sandbox.html`, `EDITOR_FIELDS`). Ou seja: **a mesma tela edita a resposta e o gabarito**. O
`rating` do Happy mudando de 1,10 para 1,14 junto dos atributos é a instância concreta disso.

Para a era Rating 1.0 isso é menos grave do que parece — o próprio 1,10 já era um número da
métrica antiga, traduzido para a escala atual, e portanto também julgamento. Mas o risco
estrutural permanece: **é possível mover o alvo junto com a flecha e a pontaria parecer boa.**

Foi por essa circularidade, medida de forma independente, que `bancada/suites/rating.js` deixou de ser
gate em 26/07/2026 e virou relatório. Hoje o gate de qualidade individual é `bancada/suites/perfis.js`,
que compara **assinaturas de função e playstyle**, não o rating contra si mesmo.

### Guarda recomendada, ainda não implementada

Separar o gabarito dos atributos: mover os `rating` históricos para uma fonte própria com campo
`fonte` por jogador — distinguindo `"HLTV Rating 2.0, evento X"` de `"estimado (era Rating 1.0,
sem stats granulares)"` — e fazer o `npm run check` reprovar divergência. Efeito: mexer em
atributo continua livre; mexer no gabarito passa a exigir declarar de onde veio.

Isso também é pré-requisito honesto para qualquer nota IFCS: não se publica fidelidade
científica sobre entradas estimadas sem dizer quais são estimadas.

## Situação da dívida

**Paga no que era possível pagar.** O export JSON original do editor não existe mais e não há
como recuperá-lo. O que existe e agora está registrado: o diff exato (permanente no git), a
razão (buraco de fonte da era Rating 1.0), a natureza dos valores (juízo, não fonte), o efeito
colateral medido, e o risco estrutural do `rating` editável.

Os valores **permanecem como estão** — são decisão deliberada do responsável, não acidente.
