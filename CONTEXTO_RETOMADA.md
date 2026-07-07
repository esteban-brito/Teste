# Contexto de Retomada

Use este arquivo como primeira leitura ao retomar o projeto.

## Estado Atual

- Projeto em `C:\Users\esteb\Downloads\sandbox`.
- Branch principal: `main`.
- Ultimo commit enviado: `a377b2c Add soft role reality calibration`.
- O GitHub Pages deve refletir o estado de `main`.

## Direcao do Projeto

O objetivo atual e padronizar, limpar, otimizar e profissionalizar o jogo inteiro, com foco forte em:

- realismo de roles;
- realismo de playstyles;
- equilibrio geral dos 85 jogadores;
- sandbox como ferramenta principal de teste;
- bancada como protecao contra regressao.

O usuario nao quer curadoria manual nem travas duras. A regra de design e:

> Nada deve ser proibido por decreto. O sistema deve usar pesos, custos, raridade, contexto e stats para tornar combinacoes irreais naturalmente mais dificeis.

## Decisoes Importantes

- `Baiter` significa jogador ruim/egoista/sem impacto:
  - rating baixo;
  - entry baixo;
  - trade baixo;
  - impacto geral baixo;
  - no maximo um stat acima de 50.
- O antigo playstyle `Support` foi renomeado para `Facilitador`, porque `Support` ja existe como role.
- `Techno` e `zweih` sao exemplos atuais de `Baiter`.
- `Boombl4` foi o caso usado para testar calibracao de `IGL/Support` para `IGL/Entry`.
- `Entry/Support` nao e proibido, mas deve ser raro e justificado por stats.
- `Entry/Ancora`, `Support/Entry`, `AWPer/Entry`, etc. seguem a mesma logica: custo suave, nao veto.

## Commits Recentes Relevantes

- `a377b2c Add soft role reality calibration`
  - adiciona custo suave entre pares de roles;
  - adiciona custo suave entre role e playstyle;
  - faz role secundaria considerar custo de realidade;
  - melhora calibrador para penalizar dano de realidade;
  - adiciona modos no calibrador: `Mais realista`, `Menor dano`, `Mais direto`;
  - adiciona auditoria de pares raros.

- `0f7ca40 Finalize game and sandbox cleanup`
  - remove codigo antigo morto do sandbox;
  - corrige formula do `Coringa`;
  - valida `game.js` e `sandbox.html`.

- `81f3701 Add intelligent sandbox calibrator`
  - substitui a area antiga de receitas/pesos no sandbox;
  - adiciona calibrador inteligente com sugestao, aplicar, descartar e resetar.

## Arquivos Principais

- `game.js`
  - motor principal do jogo;
  - roles, playstyles, OVR, quimica, simulacao e UI principal;
  - funcoes novas importantes:
    - `rolePairReality(primary, secondary, player)`;
    - `roleStyleReality(role, style, player)`;
    - `secondaryScore(primary, secondary, player, scores)`.

- `sandbox.html`
  - principal tela de teste do usuario;
  - calibrador inteligente fica aqui;
  - usa os motores de `game.js` ao vivo;
  - deve continuar sendo prioridade para testes.

- `bancada/auditoria.js`
  - relatorio curto de roles/playstyles;
  - agora tambem lista:
    - pares de roles;
    - pares raros por contexto;
    - role/playstyle raros por contexto.

- `bancada/run.js`
  - roda suites principais.

## Validacoes Usadas

Antes de comitar mudancas relevantes, rodar:

```powershell
node --check game.js
node -e "const fs=require('fs'); const html=fs.readFileSync('sandbox.html','utf8'); const m=html.match(/<script>([\s\S]*)<\/script>/); new Function(m[1]); console.log('sandbox script ok');"
node bancada\auditoria.js
node bancada\run.js
git diff --check
```

`bancada/run.js` demora perto de 80-90 segundos nesta maquina.

## Estado da Auditoria no Ultimo Commit

Distribuicao atual:

- Roles:
  - IGL: 17
  - Rifler: 17
  - AWPer: 16
  - Entry: 16
  - Support: 10
  - Lurker: 9

- Playstyles:
  - Spacetaker: 16
  - Infiltrador: 13
  - Playmaker: 13
  - Agressivo: 9
  - Facilitador: 9
  - Trader: 7
  - Ancora: 6
  - Clutcher: 4
  - Cerebral: 3
  - Coringa: 3
  - Baiter: 2

Casos raros atuais destacados pela bancada:

- `Qikert` como `Support/Entry`, muito raro.
- `magixx` como `Support/Entry`, raro.
- `arT`, `chopper`, `karrigan` como `IGL/Entry`, raro por contexto.

Esses casos nao devem ser simplesmente bloqueados. Devem ser avaliados por stats, custo e impacto no ecossistema.

## Proximos Passos Sugeridos

1. Testar o sandbox no Pages, especialmente o calibrador com `Boombl4 -> Entry`.
2. Ver se os modos `Mais realista`, `Menor dano` e `Mais direto` geram sugestoes diferentes e uteis.
3. Melhorar a visualizacao do calibrador:
   - mostrar custo de realidade antes/depois;
   - mostrar motivo do risco por jogador;
   - talvez mostrar ranking de 2-3 sugestoes, nao apenas uma.
4. Refinar os custos suaves em `rolePairReality` e `roleStyleReality` jogador por jogador.
5. Continuar limpeza profunda do projeto, mas sem quebrar `sandbox.html`.

