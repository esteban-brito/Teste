# draft9-0 · Simulador de Counter-Strike

Jogo de navegador (HTML/CSS/JavaScript, sem dependências) onde você monta um
elenco de Counter-Strike sorteando times históricos, escolhe jogadores e um
treinador, e tenta a campanha invicta (9-0) em um Major com fase suíça e
playoffs.

## Como jogar

Abra o arquivo `index.html` em qualquer navegador moderno. Não precisa instalar
nada nem rodar servidor — é um único arquivo autossuficiente.

1. **Sorteie um time** na roleta.
2. **Escolha 1 carta** (jogador ou treinador) do time sorteado por rodada.
3. Repita até completar **5 jogadores + 1 treinador**.
4. Acompanhe a **Força efetiva** (força bruta × química × treinador) e os selos
   de análise do elenco.
5. Entre no **Major** e dispute a fase suíça e os playoffs rumo ao título.

## Estrutura

Tudo vive em `index.html`, dividido em três partes:

- **CSS** (`<style>`): tema, cartas por tier, roleta, overlays de torneio e
  tela de partida ao vivo.
- **Motor** (início do `<script>`): avaliação de jogadores (OVR), química de
  composição, rating contextual estilo HLTV e simulação de partida round a
  round. Os blocos `CFG_*` concentram os números de balanceamento.
- **UI** (final do `<script>`): roleta, montagem de elenco, fase suíça,
  playoffs e o reprodutor cinematográfico de partidas.

## Acessibilidade e desempenho

- Respeita `prefers-reduced-motion` (desliga animações pesadas).
- Overlays marcados como diálogos (`role="dialog"`/`aria-modal`).
- Áudio sintetizado via Web Audio (sem arquivos externos); botão de mudo.
