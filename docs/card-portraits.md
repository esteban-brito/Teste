# Contrato de retratos das cartas

## Objetivo

Fotos de origem diferentes devem terminar no mesmo sistema visual. A carta não
compensa cada jogador com `zoom`, `background-position`, fonte ou offset próprio:
o trabalho de normalização acontece no asset antes de ele entrar no jogo.

O contrato executável é:

- campo cru `foto` contém somente um asset-id seguro, normalmente o ID cru da era;
- arquivo final em `fotos/<asset-id>.webp`;
- proporção exata `5:7`, WebP, sRGB e fundo opaco;
- mínimo aceito de `500×700`, alvo recomendado de `1000×1400`;
- até 500 kB por arquivo;
- runtime fixo: `background-size: 100% auto` e `background-position: 50% 12%`;
- nenhuma exceção CSS, classe ou variável por jogador.

`tools/check-card-portraits.js`, executado por `npm run check`, prova formato,
dimensões, peso, correspondência com os dados e ausência de arquivos órfãos.

## Grade fotográfica

O canvas final é sempre 5:7. Na referência de 1000×1400:

- topo da cabeça: aproximadamente 5–10% da altura;
- linha dos olhos: aproximadamente 28–35%;
- queixo: aproximadamente 47–56%;
- ombros ou uniforme devem alcançar pelo menos 82%;
- o rosto fica centralizado no eixo horizontal, com tolerância apenas para a
  direção natural do olhar;
- o canto superior esquerdo precisa suportar o OVR após o escurecimento comum;
- nenhuma informação essencial pode depender dos 28% inferiores, ocupados pela
  placa na menor densidade.

Esses intervalos são uma régua de consistência, não um algoritmo cego. Cabeça,
pescoço e ombros são julgados em conjunto para que jogadores com poses distintas
tenham a mesma massa óptica.

## Fluxo de entrada

Para cada lote recebido:

1. associar a imagem ao ID cru correto e à era correta;
2. registrar origem e confirmar que o projeto pode usar a imagem;
3. avaliar resolução, foco, ruído, recorte existente e iluminação;
4. corrigir rotação, balanço de branco, contraste e ruído sem alterar a identidade;
5. recortar ou expandir para 5:7 seguindo a grade fotográfica;
6. exportar WebP no alvo recomendado e adicionar o asset-id ao dado cru;
7. rodar `npm run check` e `node bancada/e2e-cartas.js`;
8. capturar e conferir **frente e verso** a 250, 188, 176, 151, 150, 149, 130 e
   120 px, além de escala de cinza e três simulações de daltonismo no laboratório;
9. comparar massa óptica, linha dos olhos, cabeça, ombros, exposição e integração
   com a diagonal contra o Donk canônico; corrigir o asset antes de publicar.

Quando a origem já corta cabeça ou ombros, simples zoom não resolve. A ordem de
preferência é: obter outra foto, reconstruir somente o fundo, ou usar expansão
generativa com aprovação explícita. Rosto, uniforme, patrocinadores e logotipos
não devem ser inventados silenciosamente.

## Qualidade e padronização

- Fontes pequenas podem receber redução de ruído e aumento de resolução, mas não
  nitidez agressiva que crie halos no cabelo ou headset.
- Temperatura e exposição são normalizadas por lote; não se aplica um filtro que
  apague as cores históricas do uniforme.
- O banho de raridade e o escurecimento superior pertencem ao CSS compartilhado,
  portanto não devem ser queimados na imagem.
- Transparência não é necessária e aumenta o risco de bordas inconsistentes.
- Duas eras do mesmo nick podem e normalmente devem usar assets diferentes.
- A captura visual é obrigatória mesmo com o E2E verde: a suíte prova geometria e
  contratos, mas não decide se uma fonte ficou artificial, lavada ou mal cortada.
- Lotes devem manter um inventário simples de fonte, licença/permissão, ID cru,
  transformação aplicada e arquivo final. Esse inventário não deve conter
  cookies, credenciais nem material privado.

## Estado atual

`donk_kato24` é o primeiro asset ligado ao dado cru e a referência visual
canônica. A cobertura parcial é explícita em `src/data/catalog.mjs`; jogadores sem
foto usam o fallback gráfico da mesma carta, sem layout alternativo.

A próxima unidade recomendada é completar os jogadores da Spirit · IEM Katowice
2024 com `sh1ro_kato24`, `zont1x`, `magixx` e `chopper_kato24`. Isso fecha o
quinteto visual e permite julgar padronização entre poses diferentes antes de
escalar o processo para os demais elencos.

O checker e o campo `foto` atuais cobrem somente `ATRIBUTOS`. Um retrato para o
treinador `hally` exige uma extensão separada e testada do contrato de times,
catálogo, projeção pública e verificador; até lá, não adicionar um asset órfão.
O roteiro geral está em `docs/retomada-2026-07-31.md`.
