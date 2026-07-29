# Cartas de jogador — design aprovado (28/07/2026)

> Artefato: `prototipo-cartas.html` (raiz, autocontido, **desligado do jogo**).
> Abra no navegador e clique numa carta para virar.
>
> **Estado: aprovado, aguardando o fim do P2 para ser ligado ao jogo.** Decisão do
> responsável — ligar antes significaria refazer o trabalho depois da modularização.

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

## 9. O que falta

1. **Ligar ao jogo** (`game.js` + `style.css`) — depois do P2. Os tokens pagam aqui:
   entram no `style.css` como um bloco só.
2. **Carta de TREINADOR.** O jogo já tem (`coachHTML`/`backCoach`, com `nick`, `pais`,
   `time`, `ovr`, `carac`, `caracCor`) e ela **não foi desenhada**. Do jeito que está,
   continuaria feia no meio das novas.
3. **Fotos.** Não existem e não há campo para guardá-las. É a única lacuna de dados
   real que a varredura do repositório confirmou. Decisão de produto pendente.
4. **Daltonismo** — a raridade é comunicada só por cor; a espessura do aro ajuda
   pouco. Prata (t3) contra roxo (holo) é o par mais arriscado. Não testado.
5. **Duplicados na roleta** — 8 jogadores têm duas eras. Se a roleta puder entregar
   as duas, as frentes ficam quase iguais e só o verso as distingue. É regra de jogo
   que ainda não existe.
