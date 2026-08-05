/* TÁTICA — a chave e os pesos da camada de decisão.
   ══════════════════════════════════════════════════════════════════════════════

   `ATIVA:0` é o estado de repouso, e não é provisório: a camada só passa a valer
   quando alguém decidir, com medição na mão, que ela deve valer. Com a chave em
   zero o motor não chama nada, não consome nenhuma amostra a mais e o golden
   continua byte a byte idêntico — é isso que permite construir e revisar a
   camada inteira sem pedir nenhuma decisão de balanceamento.

   O SEED DA TÁTICA É DERIVADO, NÃO SORTEADO. Ele sai do seed da sessão por uma
   mistura fixa, então `srand(n)` continua reproduzindo a partida inteira, tática
   incluída — e, principalmente, o fluxo do COMBATE não perde nem ganha uma
   amostra por causa das decisões. Sem isso, ligar a camada invalidaria todos os
   goldens de uma vez e a comparação pareada deixaria de existir.

   Ver `docs/ciclos/tatica-baseline-2026-08-04.md` para o que foi medido ANTES de
   ligar, e por que os quatro eixos que já agem não podem agir de novo aqui. */

export const CFG_TATICA={
  /* 1 desde 05/08/2026. Ligar mudou o resultado das partidas: foi balanceamento,
     com comparação pareada nas mesmas seeds e os dois indicadores acumulados
     reportados juntos. Voltar para 0 também é balanceamento — não é chave de
     conveniência em direção nenhuma. */
  ATIVA:1,
  /* Mistura que separa o fluxo da tática do fluxo do combate. Constante
     arbitrária e fixa (a razão áurea em 32 bits, como em muitos hashes); o que
     importa é que ela não mude, senão partidas antigas deixam de reproduzir. */
  SEED_MIX:0x9E3779B9
};

/** Semente do fluxo tático a partir da semente da sessão. Determinística. */
export function seedTatico(seed,cfg=CFG_TATICA){
  return seed===undefined?cfg.SEED_MIX>>>0:((seed>>>0)^cfg.SEED_MIX)>>>0;
}
