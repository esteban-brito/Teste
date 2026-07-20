# Arquitetura

## Estado atual

O draft9-0 é uma aplicação estática, sem backend e sem dependências de runtime.
`index.html` carrega `style.css` e `game.js`. O arquivo `game.js` contém duas
regiões separadas pelo marcador `// === UI START ===`:

1. motores, dados e simulação;
2. estado, renderização, eventos e fluxo do jogo.

O sandbox carrega o texto de `game.js` e avalia a primeira região. O worker e a
bancada Node repetem esse mecanismo. Portanto, o marcador funciona hoje como
uma API implícita e frágil.

## Pipeline do domínio

```text
ATRIBUTOS + TIMES_DEF
        |
        v
PRISMA: afinidade -> role primário/secundário -> subarquétipo
        |
        v
ZÊNITE: playstyle + OVR
        |
        v
POOL / TEAMS avaliados
        |
        v
SINAPSE: composição + playstyles + treinador -> química e força
        |
        v
MARÉ: forma de jogador e campanha
        |
        v
PÓLVORA + COFRE: combate, objetivos e economia
        |
        v
FALLEnANGELs: rating contextual pós-partida
```

O calibrador observa esse pipeline, cria snapshots, mede margens e procura
alterações de configuração que satisfaçam intenções com o menor dano colateral.

## Fronteiras desejadas

- **Dados:** valores crus e definições de times. Não conhece DOM nem regras de
  renderização.
- **Domínio:** avaliação, química, simulação, torneio e calibração. Funções puras
  sempre que possível.
- **Aplicação:** coordena draft, lineup, partidas e sessões de calibração.
- **Interface:** transforma estado em DOM e converte eventos em comandos.
- **Infraestrutura:** workers, servidor de desenvolvimento, geração de artefatos
  e deploy.

O mapa final de diretórios e a ordem de migração estão no plano de
profissionalização aprovado. Cada extração deve manter uma camada de
compatibilidade até a suíte confirmar paridade.

## Dependências permitidas

```text
apps/ui ----------> application ----------> domain
   |                      |                    ^
   |                      v                    |
   +--------------> infrastructure            data

tests podem importar qualquer API pública, mas não devem recortar fonte.
```

- `domain` não importa `ui`, `application` ou `infrastructure`.
- `data` contém valores; validação de schema pode depender de contratos, não de
  UI.
- workers chamam a mesma API pública usada pelo processo principal.
- renderizadores recebem view models prontos e não recalculam regras de negócio.

## Estado atual do jogo

- `S`: draft, cartas escolhidas, treinador e interação da roleta.
- `TG`: campeonato, suíça, playoffs e resultados.
- `Audio`: contexto Web Audio e preferências de som.

Esses objetos são globais ao script e mutados por controllers e renderizadores.
O destino é um store pequeno, sem framework, com estados de draft e torneio
separados e efeitos explícitos para DOM, timers e áudio.

## Dados e identidade

`ATRIBUTOS` possui um ID explícito quando o mesmo nick aparece em outra era.
Caso contrário, `nome` é o ID. `POOL` indexa pelo ID cru. Os cards visuais têm
IDs sequenciais (`p0`, `p1`...), adequados ao DOM, mas não à persistência ou a
snapshots. Testes e artefatos persistentes devem usar o ID cru.

## Pontos de atenção

1. Uma chamada adicional ao RNG muda toda a simulação subsequente.
2. Ordem de inserção de objetos influencia desempates em classificação.
3. Arredondamentos de OVR, química e força fazem parte do comportamento.
4. `distribuirRoles` aplica contexto de time e muta avaliações dos jogadores.
5. O calibrador diferencia mudança material de deterioração de margem interna.
6. `elencos.html` contém dados gerados e pode divergir da fonte.

