# Contrato de retratos das cartas

## Objetivo

Fotos de origem diferentes devem terminar no mesmo sistema visual. A carta não
compensa cada jogador com `zoom`, `background-position`, fonte ou offset próprio:
o trabalho de normalização acontece no asset antes de ele entrar no jogo.

O contrato executável é:

- campo cru `foto` contém um asset-id que **precisa ser idêntico ao ID cru** do
  jogador (`id || nome`);
- arquivo final em `fotos/<asset-id>.webp`;
- proporção exata `5:7`, WebP, sRGB e fundo opaco;
- mínimo aceito de `500×700`, alvo recomendado de `1000×1400`;
- até 500 kB por arquivo;
- runtime fixo: `background-size: 100% auto` e `background-position: 50% 12%`;
- nenhuma exceção CSS, classe ou variável por jogador.

`tools/check-card-portraits.js`, executado por `npm run check`, prova formato,
dimensões, peso, correspondência com os dados e ausência de arquivos órfãos.

## A regra que sustenta o acervo em escala

**Asset-id de jogador é igual ao ID cru. Sem exceção.**

O ID cru já é único por era: `donk` é a Spirit de Budapest 2025 e `donk_kato24` é
a de Katowice 2024. Amarrando o arquivo a ele, o nome do arquivo herda essa
unicidade e **colar a foto de uma era noutra deixa de ser possível** — não apenas
improvável. É o que permite o acervo crescer para dezenas de times e várias eras
do mesmo nick sem virar loteria. O checador reprova a divergência com o motivo
escrito.

Para **treinador** o dado vive no elenco, não no treinador: `coachFoto`, ao lado de
`coachPais`. O motivo é o mesmo — hally treina as duas Spirits, e preso ao elenco
cada era declara (ou não) o seu retrato, sem herdar o da outra. Como treinador não
tem ID cru, a regra é que `coachFoto` **comece pelo nome do treinador**; o sufixo
distingue a era (`hally_kato24`). Isso prende o arquivo à pessoa e impede dar o
retrato do hally ao sidde.

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

## Estado atual — 31/07/2026

**A Spirit · IEM Katowice 2024 está completa**: `donk_kato24`, `sh1ro_kato24`,
`zont1x`, `magixx`, `chopper_kato24` e o treinador `hally_kato24`. Cobertura de
jogador: **5/85**. A outra Spirit, de Budapest 2025, continua sem nenhum retrato —
e é assim que se confirma que a fronteira de era funciona.

Jogadores sem foto usam o fallback gráfico da mesma carta, sem layout alternativo.

O contrato do treinador **existe** desde este lote: `coachFoto` no elenco,
projetado por `src/public/evaluation-api.mjs` e cobrado pelo checador. A observação
antiga de que "um retrato para hally exige extensão separada" está cumprida.

### Registro do lote

Origem: cinco arquivos AVIF 1200×800 (3:2) fornecidos pelo responsável, capturas de
transmissão do IEM Katowice 2024. O maior recorte 5:7 possível numa fonte dessas é
**570×798**, então não houve liberdade vertical — só horizontal. Cada recorte foi
centrado no rosto e posicionado para deixar a marca d'água do HLTV (x<180, y>700)
fora do quadro. Saída em 500×700, o mesmo formato do `donk_kato24`.

Limitações honestas destas fontes, para quem for melhorá-las depois:

- `hally`: o topo da cabeça fica a ~2% da altura, contra os 5–10% da grade. Isso
  chegou a parecer defeito do retrato enquanto a placa do treinador ficava no
  topo — não era: qualquer retrato bem enquadrado teria a cabeça coberta ali. Com
  a frente do treinador de volta à grade do jogador (placa nos 24% de baixo), o
  recorte único vale para as duas categorias e o rosto aparece inteiro; ainda
  assim, uma fonte com mais ar acima seria melhor;
- `chopper`: a origem é um close, então o rosto ocupa mais quadro que nos demais e
  o queixo cai por volta de 63%, fora da faixa de 47–56%. Não há como abrir mais:
  570×798 já é o campo de visão máximo dessa imagem.
