/* CATÁLOGO DE DADOS — o índice que responde "que dado existe, onde, sob que chave".
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. Em 28/07/2026 um agente afirmou três vezes que dados
   existentes não existiam — `time`, `campeonato+ano` e `país completo` — porque
   procurou num arquivo o que era pergunta sobre o projeto, chutou o nome do
   campo (`campeonato`, quando é `camp`) e tratou "não achei" como "não existe".
   Os três estavam em `TIMES_DEF` e `PAISES_MAP`.

   Este arquivo é a resposta única a essa pergunta, e `tools/check-data-catalog.js`
   PROVA cada alegação contra a realidade. Um número aqui que não bate com o motor
   reprova a suíte — então o catálogo não pode envelhecer em silêncio.

   COMO USAR. Antes de concluir que um dado não existe, leia este arquivo. Se ele
   não menciona o dado, aí sim ele não existe.

   A FRONTEIRA CRU × DERIVADO é o ADR 0002: dado cru é entrada factual que os
   motores não calculam; derivado é resultado do domínio. O checador impede que os
   dois se misturem — derivado não pode aparecer em `src/data`, e cru tem de estar
   lá. Sem essa trava, a extração do P2 recria a bagunça que ela veio desfazer. */

/** Onde cada fonte física vive e sob que chave ela indexa. */
export const FONTES={
  jogadores:{
    arquivo:"src/data/players.mjs",
    exporta:"ATRIBUTOS",
    espelho:"game.js (bloco legado, projetado por tools/add-team.js — ADR 0005)",
    chave:"id || nome",
    nota:"O ID explícito só existe quando o mesmo nick aparece em outra era. "+
         "Ver docs/architecture.md §Dados e identidade."
  },
  elencos:{
    arquivo:"src/data/teams.mjs",
    exporta:"TIMES_DEF",
    espelho:"game.js (bloco legado)",
    chave:"nome (não é único: 'Spirit' e 'FURIA' aparecem em duas eras)",
    nota:"É AQUI que moram time, cor, campeonato, ano, colocação e treinador."
  },
  paises:{
    arquivo:"src/data/countries.mjs",
    exporta:"PAIS_JOGADOR + PAIS_TREINADOR",
    espelho:"game.js (bloco legado)",
    chave:"PAIS_JOGADOR pelo ID cru; PAIS_TREINADOR pelo nome do treinador",
    nota:"Duas tabelas desde 28/07/2026. Antes era uma só, misturando jogador, "+
         "treinador e um nome de TIME — e a busca de jogador usava `nome`, o que "+
         "deixava a chave `apEX_envy` morta no arquivo."
  }
};

/** Dado CRU do jogador: entrada factual, nunca calculada pelos motores. */
export const JOGADOR_CRU={
  nome:     {tipo:"string",       cobertura:85, nota:"vira o ID quando não há `id`"},
  id:       {tipo:"string",       cobertura:8,  nota:"só nas 8 entradas de era duplicada"},
  pais:     {tipo:"ISO3",         cobertura:40, nota:"PARCIAL no registro — os outros 45 vêm de PAIS_JOGADOR, indexado pelo ID cru. Use POOL.pais, que já resolve os 85."},
  fp:       {tipo:"inteiro 0-100",cobertura:85},
  en:       {tipo:"inteiro 0-100",cobertura:85},
  tr:       {tipo:"inteiro 0-100",cobertura:85},
  op:       {tipo:"inteiro 0-100",cobertura:85},
  cl:       {tipo:"inteiro 0-100",cobertura:85},
  sn:       {tipo:"inteiro 0-100",cobertura:85},
  ut:       {tipo:"inteiro 0-100",cobertura:85},
  rating:   {tipo:"number",       cobertura:85, nota:"GABARITO histórico (HLTV), não atributo do motor. Guarda estrutural aberta em next-steps.md §R6."},
  colocacao:{tipo:"enum",         cobertura:85, nota:"Campeao|Final|Top4|Top8|Grupos — redundante com a do elenco"},
  isIGL:    {tipo:"boolean",      cobertura:85, nota:"intenção de comando; o efeito esportivo é derivado"}
};

/** Dado CRU do elenco. */
export const ELENCO_CRU={
  nome:      {tipo:"string",  cobertura:17},
  cor:       {tipo:"hex",     cobertura:17, nota:"identidade visual do time"},
  camp:      {tipo:"string",  cobertura:17, nota:"EMPACOTA evento e ano: 'IEM Katowice 2024'. Fase 1 do P2 separa em evento+ano."},
  colocacao: {tipo:"enum",    cobertura:17},
  jogadores: {tipo:"ID[5]",   cobertura:17, nota:"referencia jogadores pelo ID cru"},
  coach:     {tipo:"string",  cobertura:15, nota:"2 elencos não têm treinador (EnVyUs, Virtus.pro)"},
  coachPais: {tipo:"ISO3",    cobertura:1,  nota:"inline; tem precedência sobre PAIS_TREINADOR"}
};

/** DERIVADO pelo domínio. Não é dado: não pode existir em `src/data`. (ADR 0002) */
export const JOGADOR_DERIVADO={
  ovr:        "ZÊNITE — ovrUnificado",
  role1:      "PRISMA — classificar",
  role2:      "PRISMA — roleSecundarioSeguro (null nos 17 IGLs)",
  combatRole: "PRISMA — papel de combate do IGL",
  primario:   "PRISMA",
  secundario: "PRISMA",
  secForte:   "PRISMA",
  classe:     "PRISMA — 'AWPer-Rifler'",
  playstyle:  "ZÊNITE — styleMatch",
  style:      "ZÊNITE — tabela completa da classificação",
  estrela:    "ZÊNITE — exatamente ovr>=20"
  /* `pais` NÃO entra aqui: ele é cru (ver JOGADOR_CRU). O POOL apenas o COMPLETA
     a partir do PAISES_MAP quando o registro não traz — isso é projeção de uma
     segunda fonte, não cálculo do domínio. O checador reprova a confusão. */
};

/** Agregados que o motor deriva e que valem como referência rápida. */
export const TOTAIS={
  jogadores:85,
  elencos:17,
  campeonatosDistintos:14,
  treinadoresDistintos:14,
  paisesDeJogador:20,
  paisesTotais:22,   // +CAN e +AUT, que só aparecem em treinador
  idsExplicitos:8,
  nomesDuplicados:8  // mesmo nick em duas eras
};

/** Divergências conhecidas — dívida declarada, não descoberta. */
export const DIVERGENCIAS=[
  {
    id:"camp-empacotado",
    o_que:"`camp` guarda evento e ano numa string só: 'IEM Katowice 2024'.",
    efeito:"Dois fatos num campo. Medido em 28/07/2026: NENHUM consumidor separa os "+
           "dois hoje — os 9 usos exibem a string inteira. Só uma carta com evento e "+
           "ano estilizados à parte precisaria da divisão.",
    conserto:"ADIADO de propósito. Dividir custa 17 registros × 3 fontes + 9 pontos de "+
             "UI que a Fase 7 do P2 reescreve, por zero consumidor atual. Fazer quando "+
             "houver um consumidor real, com a UI já modularizada."
  },
  {
    id:"sem-foto",
    o_que:"Não existe foto de jogador nem campo para guardá-la.",
    efeito:"Qualquer carta com retrato depende de criar essa fonte primeiro.",
    conserto:"fora do P2 — decisão de produto pendente."
  }
];
