# draft9-0 · Simulador de Counter-Strike

> **▶ Jogue agora:** <https://esteban-brito.github.io/Teste/>

Jogo de navegador (HTML/CSS/JavaScript, sem dependências nem build) onde você
monta um elenco de Counter-Strike sorteando times históricos, escolhe jogadores
e um treinador, e tenta a campanha invicta (9-0) em um Major com fase suíça e
playoffs.

![draft9-0](og-image.png)

## Como jogar

Abra <https://esteban-brito.github.io/Teste/> — ou baixe e abra o
`index.html` em qualquer navegador moderno. Não precisa instalar nada: o jogo é
só HTML, CSS e JavaScript estáticos. Mantenha os três arquivos (`index.html`,
`style.css`, `game.js`) na mesma pasta.

1. **Sorteie um time** na roleta.
2. **Escolha 1 carta** (jogador ou treinador) do time sorteado por rodada.
3. Repita até completar **5 jogadores + 1 treinador**.
4. Acompanhe a **Força efetiva** (força bruta × química × treinador) e os selos
   de análise do elenco.
5. Entre no **Major** e dispute a fase suíça e os playoffs rumo ao título.

Toque no ícone **⟲** no canto de uma carta para **virá-la**: o verso de um
**jogador** mostra o estilo dele e 4 stats (Firepower, Abertura, Clutch,
Utilitário); o verso de um **treinador** explica o que a característica dele
(Gestor, Desenvolvedor, Estrategista, Motivador) faz pelo time. Tocar no corpo
da carta continua escolhendo/posicionando normalmente. As cartas usam proporção
5/7 e se adaptam a qualquer tela.

## Estrutura do projeto

```
draft9-0/
├── index.html          ← página principal do jogo
├── style.css           ← todos os estilos (tema, cartas, roleta, overlays)
├── game.js             ← 6 motores + UI (toda a lógica)
├── elencos.html        ← base de elencos (página standalone)
├── sandbox.html        ← bancada de tuning dos motores
├── og-image.png        ← imagem para redes sociais
├── robots.txt
├── .gitignore
├── ADD_TEAM.md         ← documentação: como adicionar um time
├── AUDITORIA.md        ← auditoria completa dos 6 motores (40 itens)
├── bancada/            ← suíte de validação dos motores
│   ├── motor.js        ← carrega motores do game.js sem DOM (Node)
│   ├── times.js        ← lint de times (IDs, atributos, IGL, país)
│   ├── realismo.js     ← valida métricas simuladas vs CS real
│   ├── rating.js       ← valida rating simulado vs HLTV real
│   ├── roster.js       ← regenera elencos.html a partir dos motores
│   └── run.js          ← suíte completa (roda as 3 validações)
└── tools/
    └── add-team.js     ← adiciona time a partir de texto simples
```

## Os 6 motores

O `game.js` é dividido em duas camadas: **motor** (avaliação + simulação) e
**UI** (roleta, elenco, torneio). Os motores formam um pipeline — a saída de
um alimenta o próximo:

```
atributos crus
    │
    ├── PRISMA ─────── classifica o jogador: função + sub-arquétipo + lado
    │                  (CT/T). Tudo por afinidade contínua.
    │
    ├── ZÊNITE ─────── condensa identidade + atributos + rating num ÚNICO
    │                  número (OVR 5–22). Curva logística, sem cliffs.
    │
    ├── SINAPSE ────── lê o elenco: cobertura de pilares, saturação, egos,
    │                  treinador → química (50–100%) e força efetiva.
    │
    ├── MARÉ ────────── "humor competitivo": tier × OVR × firepower → forma
    │                  da noite/campanha. Motor de variância do roguelike.
    │
    ├── PÓLVORA ────── combate round a round: duelos, vantagem de homem,
    │   └─ COFRE ──── clutch, plant/post-plant/retake + economia.
    │
    └── FALLEnANGELs ─ rating contextual pós-combate (estilo HLTV):
                       KAST, ADR, swing, multi-kill, eco-adjust.
```

### Onde mexer no balanceamento

Os números ficam concentrados em blocos `CFG_*` no topo do `game.js`:

| Bloco | O que controla |
|---|---|
| `ROLE_PERFIL` | Pesos de **afinidade** (classificação) e **OVR** (nível) por função |
| `CFG_AVALIACAO` | Curva `core → OVR` (logística, satura em 22), regras do IGL |
| `CFG_QUIMICA` | Penalidades por falta de role, saturação, egos; mitigadores do treinador |
| `CFG_SIM` | Simulação: lados, economia, momentum, mapas |
| `CFG_FA` | Rating estilo HLTV: pesos de kill, sobrevivência, KAST, impacto por função |

## A bancada de tuning (sandbox)

O `sandbox.html` é um laboratório independente que carrega os motores do
`game.js` ao vivo e permite editar:

- **Atributos de um jogador** (sliders) e ver o efeito no OVR, função e playstyle
- **Pesos dos motores** (curva, afinidade, química, simulação, rating)
- **Receitas dos 10 playstyles** universais + Coringa
- **Simulação de mapa** ou lote de mapas com os valores editados

Tudo é comparado contra o **baseline** (estado inicial ao carregar). O painel
de impacto mostra o que mudou. Nada é salvo nem aplicado ao jogo — é isolado.

### Playstyles universais

10 estilos que servem pra qualquer função, cada um com uma "receita" de pesos:

| Estilo | Foco | Rating peso |
|---|---|---|
| Agressivo | Entrada + abertura | 40% |
| Spacetaker | Abertura + fogo + entrada | 52% |
| Trader | Trade + fogo + utilitário | 48% |
| Playmaker | Fogo + abertura | 60% |
| Infiltrador | Clutch + abertura + fogo | 52% |
| Baiter | Trade + clutch + fogo | 32% |
| Clutcher | Clutch + fogo | 52% |
| Suporte | Utilitário + trade + abertura | 40% |
| Cerebral | Abertura + utilitário + clutch | 52% |
| Âncora | Clutch + utilitário + trade | 45% |

**Coringa** (joker): 5 de 7 stats acima do piso (`pisoMin`). Tolerância 1
stat fraco. Spread máximo controlável.

### Química (SINAPSE no sandbox)

A química começa em 100% e é afetada por:

- **Sinergias** (bônus): Ponta de Lança, Dupla Dinâmica, Entry+Trade, Espaço+Lucro,
  Estrela Apoiado, Utility Combo, Split Setup, Rede de Informação, Retake Perfeito,
  Coringa+Agressivo, Coringa+Cerebral
- **Conflitos de playstyle** (penalidade): Saturação de Playmakers, Covardia Tática,
  Invasão de Espaço, Guerra de Estrelas
- **Cobertura de funções** (penalidade): falta de IGL, AWP, Entry, Âncora;
  saturação de qualquer role
- **Treinadores** (mitigam conflitos de playstyle, empilham):
  Estrategista, Gestor, Motivador, Desenvolvedor
- **Coringa** mitiga conflitos de playstyle (não de cobertura)

Bônus e penalidades são calculados separados. O Coringa divide só
penalidades de playstyle pela metade.

## A base de elencos

O `elencos.html` é uma página standalone que mostra todos os times, jogadores
e treinadores com OVR, funções, atributos e rating. Os dados são gerados
automaticamente a partir dos motores — nunca editados à mão.

Para regenerar: `node bancada/roster.js`

## Como adicionar um time

```
# 1. Escreva o time no formato simples (ver ADD_TEAM.md para detalhes)
# 2. Rode o gerador:
node tools/add-team.js caminho/do/time.txt

# 3. Valide:
node bancada/run.js

# 4. Commit + push + deploy
```

O gerador insere os 5 jogadores e o time no `game.js`, regenera a base de
elencos e roda o lint. Veja `ADD_TEAM.md` para o formato completo.

## Suíte de validação (bancada)

A pasta `bancada/` contém uma suíte de validação que roda no Node.js:

| Arquivo | O que valida |
|---|---|
| `times.js` | IDs únicos, atributos 0–100, ≥1 IGL, país do treinador, ≥16 times |
| `realismo.js` | KPR, CT-win, plant, clutch 1vX, anti-eco, conversão pós-pistol vs CS real |
| `rating.js` | Correlação r≥0.75 e erro médio≤0.12 vs rating HLTV real |
| `run.js` | Roda as 3 validações; sai ≠0 se degradar |

```bash
node bancada/run.js        # suíte rápida (N reduzido)
N=1500 node bancada/run.js  # suíte profunda
```

## Acessibilidade, mobile e desempenho

- **Responsivo**: 6 colunas no PC, 3 no celular; suporta o notch/barra do iPhone
  (`viewport-fit=cover` + `safe-area-insets`) e altura dinâmica (`100dvh`).
- Respeita `prefers-reduced-motion` (desliga animações pesadas).
- Overlays marcados como diálogos (`role="dialog"`/`aria-modal`); foco por teclado.
- Áudio sintetizado via Web Audio (sem arquivos externos); botão de mudo.
- Sem dependências externas; sem build; sem frameworks.

## Fidelidade dos motores

Métricas validadas vs CS profissional real (bancada `realismo.js`, N=300+):

| Métrica | Simulado | Real |
|---|---|---|
| Rounds/mapa | 20.4 | 20–22 |
| Overtime | 8.2% | 8–14% |
| Pistol win CT | 51.0% | 50–55% |
| KPR | 0.71 | 0.66–0.72 |
| CT-round win | 50.7% | 47–54% |
| Plant | 53–58% | 46–60% |
| Clutch 1v1/1v2/1v3 | 50/23.5/8.1% | 44-56/18-28/5-13% |
| Rating correlação r | 0.81 | ≥0.75 |
| Rating erro médio | 0.087 | ≤0.12 |

## Auditoria

O arquivo `AUDITORIA.md` documenta a auditoria completa dos 6 motores: 40
itens verificados, 16 corrigidos, 22 fechados como auditados/ideias futuras,
1 revertido por decisão de design. Status final: checklist encerrado.
