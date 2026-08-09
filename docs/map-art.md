# Arte de fundo dos mapas — protocolo

> Irmão de `docs/card-portraits.md`. Vale para os assets de
> `assets/mapas/`, que são o substrato visual da antessala desde 08/08/2026.
> O contrato executável está em `tools/check-map-art.js`.

## O que estes assets são, e o que NÃO são

São o **substrato** do vidro: a camada que dá ao `backdrop-filter` alguma coisa
real para refratar. Não são ilustração de destaque, não são o assunto da tela e
não substituem a marca de cor.

A distinção importa porque decide todos os números abaixo. Um asset que vai
aparecer desfocado, escurecido e coberto por atmosfera **não precisa de
resolução de foto** — precisa de estrutura de luz em escala grande. Foi assim
que sete imagens de 1920×1080 e 3,9 MB viraram 82 kB sem perda visível.

**A cor continua sendo a identidade primária.** `MAPA_MARCA` — `cor`, `ceu`,
`chao` — não foi substituída: ela veste a foto, mantém Mirage e Dust2
distinguíveis mesmo desfocadas (as duas são areia sob sol) e é o **fallback**
inteiro quando não há arte. `check-map-art` prova que os sete continuam com
`ceu`/`chao`.

## O contrato

| item | regra | cobrado por |
|---|---|---|
| cobertura | todo mapa de `MAPAS_POOL` tem arte | `check-map-art` |
| caminho | `assets/mapas/<slug>.webp`, slug **minúsculo** | `check-map-art` |
| formato | WebP | `check-map-art` |
| proporção | 16:9, tolerância 0,5% | `check-map-art` |
| largura | ≥ 200 px | `check-map-art` |
| peso | ≤ 25 kB por arquivo, ≤ 100 kB somados | `check-map-art` |
| órfãos | nenhum `.webp` sem mapa no pool | `check-map-art` |
| pasta limpa | só `.webp` em `assets/mapas/` | `check-map-art` |
| fallback | mapa desconhecido → `--mapa-arte:none` | `check-map-art` |
| consumo | `style.css` usa `var(--mapa-arte)` e `--mapa-blur` | `check-map-art` |

**O slug é minúsculo e isso não é estilo.** `MAPAS_POOL` escreve `Dust2` com
maiúscula; um arquivo `Dust2.webp` funciona no Windows e desaparece no CI Linux
se qualquer referência escrever `dust2`. Minúsculo em toda parte elimina a
classe inteira de defeito, e a guarda compara os dois lados.

## Como adicionar ou trocar um mapa

1. ponha a print crua em `mapas-origem/` (ignorada pelo Git, como
   `fotos-origem/`);
2. declare a origem em `ORIGENS`, no topo de `tools/build-map-art.js`. O
   mapeamento mora lá, e não num JSON à parte, porque é a única coisa que liga o
   nome que o jogo usa ao arquivo que a pessoa baixou — e mapeamento sem dono
   envelhece calado (regra 43);
3. `node tools/build-map-art.js`;
4. `node tools/check-map-art.js`;
5. ritual visual do `CLAUDE.md`, porque isto muda pixel.

Para reavaliar a resolução alvo:
`node tools/build-map-art.js mapas-origem 160,240,320,480` gera as candidatas em
subpastas `w<N>/`. **Apague as subpastas antes de commitar** — a guarda reprova
qualquer coisa que não seja `.webp` na raiz de `assets/mapas/`, exatamente para
que uma pasta de candidatas esquecida não dobre o peso do repositório em
silêncio.

## Os números, e de onde saíram

**Largura 240 px — medida, não escolhida.** Varrendo 160/320/720 px contra raios
de desfoque de 4 a 36 px, e medindo quanto da foto CHEGA à lâmina (delta máximo
de canal com × sem a arte):

| largura | desfoque 4px | 10px | 20px | 36px |
|---|---:|---:|---:|---:|
| 160 | 79 | 78 | 75 | 69 |
| 320 | 83 | 79 | 76 | 69 |
| 720 | 85 | 80 | 76 | 69 |

A curva satura cedo: com desfoque ≥ 10 px, 160 px e 720 px são indistinguíveis.
**Resolução e desfoque são o mesmo parâmetro** — esticar 240 px para 1440 já é
um desfoque de ~6 px antes de o `filter` rodar. 240 fica por margem.

**Qualidade 0,9 em resolução baixa, e não o contrário.** O instinto é comprimir
forte porque a imagem vai ser desfocada, e ele está errado: artefato de bloco do
WebP mede ~16 px na origem e, ampliado de 240 px para 1440, vira uma mancha
quadrada de ~96 px — maior que o raio de desfoque da lâmina, ou seja, **sobrevive
ao blur** e aparece como sujeira. Menos pixels com qualidade alta pesa o mesmo e
não inventa geometria. É a mesma razão do piso de 200 px na guarda.

**Exposição — `brightness(.4) saturate(1.5)`, aplicada no CSS e não no asset.**
As prints do CS2 são claras (céu branco em Cache, azul alto em Nuke, areia em
Anubis) e o jogo é escuro com texto claro. A primeira versão desta camada deixou
o scrim sozinho segurando isso, e o topo da tela ficou quase branco: os rótulos
da faixa de contexto sumiram e Inferno deixou de parecer Inferno. Escurecer na
camada, e não no arquivo, mantém o asset neutro — se o tema mudar, muda o CSS.
A saturação sobe junto porque `brightness` come croma, e é o croma que carrega a
identidade do lugar.

**Recorte centrado é seguro AQUI, e não em geral.** As sete prints já chegaram em
16:9 ou a 1–2% dele, então o corte descartou no máximo 3,4% de uma. O gerador
**avisa** quando a sobra passa de 8% — uma print futura em 4:3 comeria o assunto.

## Origem do material

As sete capturas foram fornecidas pelo responsável em 08/08/2026, tiradas do
CS2. É material da Valve num repositório público — a decisão foi tomada com o
ponto na mesa, e fica registrada aqui para que uma sessão futura não a trate
como descuido.

**A troca por arte original é barata por construção:** a arquitetura de camadas
de `style.css` não conhece o conteúdo do asset, então substituir os sete arquivos
não toca uma linha de CSS.
