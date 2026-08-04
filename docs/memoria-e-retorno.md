# Memória, História e Retorno — plano em duas etapas

> Plano aprovado pelo responsável em 24/07/2026, com as decisões abertas já fechadas.
> Princípio inegociável: o motor NÃO muda — tudo aqui é derivação e apresentação da
> saída de `simularMapa`/campanha. Zero consumo extra de RNG (variação de texto por
> hash dos dados), golden/snapshot/paridades idênticos por construção.

## Decisões fechadas pelo responsável

- **Desbloqueios de times/eras: ADIADO.** O elenco ainda vai crescer bastante; o sistema
  de desbloqueio só faz sentido com um pool grande. Nada de gate de times por enquanto.
- **Hard mode = "Modo Profissional":** o mais fiel ao CS possível — química com peso real
  (time sem estrutura desmorona), **apenas 1 re-spin no draft inteiro** (no normal é livre)
  e títulos marcados com badge próprio no Hall. Números exatos da química são balanceamento
  deliberado: commit separado com comparação estatística.
- **Desafio diário: 1 tentativa OFICIAL por dia** (é a que compartilha e conta streak — a
  escassez é o ritual); depois de jogá-la, o mesmo desafio reabre como **treino ilimitado**,
  não-compartilhável e fora do streak.

## Etapa 1 — Memória e História (CONCLUÍDA)

Entregue nesta etapa:

- **Núcleo puro** (`src/domain/narrative/game-memory.mjs`, exposto pela API pública): `coletarMarcos`,
  `atualizarRecordes`, `manchete`, `narrativaMVP`, `perspectivaDoMapa`, `maiorClutchDoLado`.
  Contratos em `bancada/suites/memoria.js` (grupo regression): determinismo total, perspectiva do
  meu time, merge só quando supera, prioridade de manchetes (clutch 1v3+ > OT > virada >
  carry > atropelo > equilíbrio > padrão).
- **`PROGRESSO`** (`src/infrastructure/persistence/progress-store.mjs`): localStorage
  versionado (`draft90.progresso.v1`), blindado (modo privado/quota ⇒ jogo segue sem
  memória), com exportar/importar backup JSON e contrato isolado.
- **Captura**: `registrarPartida` alimenta recordes (kills/rating/ADR num mapa, clutch ≥1v2,
  margem, virada) e exibe a **manchete** do mapa com chips de recorde novo;
  `telaFinal` grava campanha/título (elenco, treinador, MVP, invicto 💎) e mostra a
  **narrativa do MVP** no card final.
- **Hall da Fama**: seção na tela principal + overlay (contadores, títulos, recordes do
  clube, estado vazio, exportar/importar).
- **Contrato E2E** (`e2e-game-flow`): título entra no progresso; recordes capturados;
  narrativa presente; **reload preserva**; Hall renderiza sem valores inválidos.

## Etapa 2 — Retorno e Desafio (PRÓXIMA)

1. **Desafio Diário** — seed do dia (`#N`); cada giro re-semeia `srand(seedDia+índice)`
   (escolha do usuário nunca dessincroniza os giros); torneio semeado por
   `seedDia+hash(lineup)` (mesmo lineup ⇒ mesmo destino, mata reroll); 1 oficial +
   treinos; resultado compartilhável (emoji da suíça + playoffs + selo, botão copiar);
   streak e histórico no Hall. E2E com data mockada.
2. **Modo Profissional (hard)** — perfil de modo opt-in com default neutro (golden roda
   o default e permanece idêntico); 1 re-spin; química punitiva em commit de balanceamento
   separado com antes/depois; badge 🔥 nos títulos do Hall.
3. **(futuro, pós-crescimento do elenco)** Desbloqueios por títulos — tabela declarativa,
   consumindo os contadores do PROGRESSO.

## Invariantes de teste

- `bancada/suites/memoria.js` cobre o núcleo puro; o E2E do jogo cobre persistência e Hall.
- Golden, snapshot e paridades **não mudam** em nenhuma entrega desta trilha, exceto o
  futuro commit de balanceamento do Modo Profissional (que seguirá o protocolo do
  `AGENTS.md`: separado, comparado e justificado).
