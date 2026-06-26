# draft9-0 · Simulador de Counter-Strike

Jogo de navegador (HTML/CSS/JavaScript, sem dependências) onde você monta um
elenco de Counter-Strike sorteando times históricos, escolhe jogadores e um
treinador, e tenta a campanha invicta (9-0) em um Major com fase suíça e
playoffs.

## Como jogar

Abra o arquivo `index.html` em qualquer navegador moderno. Não precisa instalar
nada — o jogo é só HTML, CSS e JavaScript estáticos. Mantenha os três arquivos
(`index.html`, `style.css`, `game.js`) na mesma pasta.

1. **Sorteie um time** na roleta.
2. **Escolha 1 carta** (jogador ou treinador) do time sorteado por rodada.
3. Repita até completar **5 jogadores + 1 treinador**.
4. Acompanhe a **Força efetiva** (força bruta × química × treinador) e os selos
   de análise do elenco.
5. Entre no **Major** e dispute a fase suíça e os playoffs rumo ao título.

Toque no ícone **⟲** no canto de uma **carta de jogador** para **virá-la** e ver o
verso com o estilo do jogador e 4 stats (Firepower, Abertura, Clutch, Utilitário).
Tocar no corpo da carta continua escolhendo/posicionando normalmente. (Cartas de
treinador não viram.) As cartas usam proporção 5/7 e se adaptam a qualquer tela.

## Estrutura

O projeto é dividido em três arquivos:

- **`index.html`** — a marcação: cabeçalho, roleta, elenco, análise e os
  overlays de torneio/partida/tela final.
- **`style.css`** — todo o visual: tema, cartas por tier, roleta, overlays de
  torneio e tela de partida ao vivo.
- **`game.js`** — toda a lógica, em duas camadas:
  - **Motor** (parte de cima): avaliação de jogadores (OVR), química de
    composição, rating contextual estilo HLTV e simulação de partida round a
    round. Os blocos `CFG_*` concentram os números de balanceamento.
  - **UI** (parte de baixo): roleta, montagem de elenco, fase suíça, playoffs
    e o reprodutor cinematográfico de partidas.

## Onde mexer no balanceamento

Os números do motor ficam concentrados em blocos `CFG_*` no topo do `game.js`:

- **`ROLE_PERFIL` / `CFG_AVALIACAO`** — Motores A e B. `ROLE_PERFIL` traz, por
  função, os pesos de **afinidade** (classificação do role), os pesos de
  **atributo no OVR** e o **`wR`** (quanto o rating HLTV pesa no OVR daquele
  role). `CFG_AVALIACAO` tem a curva única `core → OVR` (logística, satura em 22,
  sem cliffs) e as regras do IGL: `IGL_CREDITO` (crédito de liderança),
  `IGL_TITULO` (bônus de OVR por título — Campeão +3, Final +2, Top4 +1) e
  `IGL_TETO` (teto de 20). O IGL herda o perfil do seu **role de combate**.
- **`CFG_QUIMICA`** — química do elenco e OVR do treinador. A química vai de
  **50% a 100%** (100% = composição perfeita); cada falta de role, saturação ou
  excesso de estrela **subtrai**. As características do treinador são
  **mitigadores** de penalidade (recuperam rumo a 100%, nunca acima). Ex.:
  `PEN`/`DUREZA` (tamanho das penalidades), `ESPERADO_POR_SOMA` e `PISO_TREINADOR`
  (nota do treinador), `derivaCaracteristica` decide a característica.
- **`CFG_SIM`** — simulação da partida (lados, economia, momentum, mapas). Dois
  eixos **desacoplados**: `skillDuelo` (OVR) decide **quem ganha** o round/jogo;
  `fragPeso` (`FRAG_FP_BASE`/`FRAG_OVR`, firepower) decide **quem fraga** (kills e
  exposição). Assim um IGL de OVR alto e fp baixo ganha jogos mas fraga pouco.
- **`CFG_FA`** — rating estilo HLTV (FALLEnANGELs). `W_EK`/`W_SURV`/`W_KAST`
  (pesos de kill, sobrevivência, consistência), `FP` (bônus de firepower) e
  `FA_IMPACTO` (peso por função). A assistência é ponderada por **utilidade**.
  É **cosmético**: muda o rating exibido, não o resultado das partidas.

## Acessibilidade, mobile e desempenho

- **Responsivo**: 6 colunas no PC, 3 no celular; suporta o notch/barra do iPhone
  (`viewport-fit=cover` + `safe-area-insets`) e altura dinâmica (`100dvh`).
- Respeita `prefers-reduced-motion` (desliga animações pesadas).
- Overlays marcados como diálogos (`role="dialog"`/`aria-modal`); foco por teclado.
- Áudio sintetizado via Web Audio (sem arquivos externos); botão de mudo.
