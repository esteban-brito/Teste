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

## Acessibilidade e desempenho

- Respeita `prefers-reduced-motion` (desliga animações pesadas).
- Overlays marcados como diálogos (`role="dialog"`/`aria-modal`).
- Áudio sintetizado via Web Audio (sem arquivos externos); botão de mudo.
