/* EMBLEMAS DE FUNÇÃO — a segunda dimensão da carta.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTEM. A carta comunicava UMA coisa por cor: a raridade. Numa linha
   de seis, quatro jogadores da mesma faixa viravam quatro cartas idênticas — foi
   exatamente o que o responsável apontou olhando o elenco do MongolZ (17, 17,
   17, 16, todos verdes).

   A carta passa a ter dois canais independentes:
     · MOLDURA (aro, brilho, fio, placa) = raridade — quanto ele vale;
     · CAMPO (cor de fundo, nome da função, este emblema) = função — o que faz.

   FORMA, NÃO SÓ COR. O emblema é uma silhueta distinta por função, e é ela que
   sustenta a leitura quando a carta é pequena e quando quem olha não distingue
   as cores. Era a lacuna de daltonismo registrada no design de 28/07/2026:
   prata contra roxo é o par de risco, e o aro sozinho ajudava pouco.

   Desenhados no mesmo grid 24×24, com traço de mesma espessura, para que
   pareçam um conjunto e não seis desenhos avulsos. Usam `currentColor`: quem
   define a cor é o CSS da carta. */

const svg=corpo=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" `+
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

export const EMBLEMA_FUNCAO={
  // comando: galões empilhados, como divisa de patente
  IGL:svg(`<path d="M4 15l8-6 8 6"/><path d="M4 20l8-6 8 6"/>`),
  // mira de precisão: retículo com marcas nos quatro pontos
  AWPer:svg(`<circle cx="12" cy="12" r="6.2"/><path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22"/>`),
  // invasão: seta rompendo a linha
  Entry:svg(`<path d="M12 20V5"/><path d="M6.5 10.5L12 5l5.5 5.5"/><path d="M4 22h16"/>`),
  // fuzileiro: rajada de três tiros em progressão
  Rifler:svg(`<path d="M5 19V13"/><path d="M12 19V9"/><path d="M19 19V5"/>`),
  // furtivo: lua crescente, a figura parcialmente oculta
  Lurker:svg(`<path d="M16.5 3.4A9 9 0 1 0 20.6 14 7 7 0 0 1 16.5 3.4Z"/>`),
  // apoio: cruz de utilitário
  Support:svg(`<path d="M12 4v16M4 12h16"/>`),
};

/* O treinador não tem função de combate: o emblema dele é a prancheta. */
export const EMBLEMA_TREINADOR=svg(`<rect x="5" y="3.5" width="14" height="17" rx="2"/>`+
  `<path d="M9 3.5h6v3H9z"/><path d="M9 11h6M9 15h4"/>`);

/** Slug estável para a classe CSS que carrega a cor da função. */
export const slugFuncao=role=>String(role||"").toLowerCase().replace(/[^a-z]/g,"")||"rifler";

export const emblemaDe=role=>EMBLEMA_FUNCAO[role]||"";
