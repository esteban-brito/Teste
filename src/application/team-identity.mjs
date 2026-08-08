/* O NOME DO CLUBE DO JOGADOR — 07/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   Até aqui o time do jogador se chamava "SEU TIME", literal e cravado em
   `montarMeuTime()`. O responsável pediu que dê para escolher, "antes de qualquer
   coisa" — então o nome nasce na tela inicial, vale para a campanha inteira e
   sobrevive à sessão junto do resto do progresso.

   POR QUE UM MÓDULO PARA ALGO TÃO PEQUENO. Porque o nome não é só um rótulo: é
   por ele que o jogador reconhece o próprio clube na tabela da Suíça, no bracket
   e no placar. Um nome vazio vira caixa em branco no quadro do Major e silêncio
   no leitor de tela; um nome igual ao de um elenco do catálogo põe dois times
   com o mesmo rótulo na mesma tabela.

   A CONTAGEM DE PLACAR NÃO DEPENDE MAIS DISSO. Até 07/08/2026 a série era
   contada com `jogo.vencedorNome===A.nome`, e aí um homônimo mandava o placar
   para o lado errado; hoje a comparação é por REFERÊNCIA de objeto
   (`jogo.vencedor===tA`), que é exata. A normalização e a detecção de colisão
   continuam valendo pelo motivo acima — leitura —, não por risco de motor.

   O LIMITE DE 18 NÃO É ARBITRÁRIO: é o maior nome do catálogo (`Virtus.pro`, 10)
   com folga, e cabe na linha do topo da tela do mapa, que já trunca em telas
   estreitas — deixar passar 40 caracteres empurraria o problema para o layout,
   onde ele é mais caro de resolver. */

export const NOME_PADRAO="SEU TIME";
export const LIMITE_NOME=18;

/** Normaliza o que o jogador digitou. Vazio, espaços e controle viram o padrão. */
export function normalizarNomeDoTime(bruto){
  const limpo=String(bruto??"")
    /* Controles e separadores de linha sairiam como caixa vazia no HTML e como
       silêncio no leitor de tela. */
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu," ")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,LIMITE_NOME)
    .trim();
  return limpo||NOME_PADRAO;
}

/** true quando o nome escolhido é o mesmo de um elenco do catálogo.
    Comparação sem caixa e sem acento: para o OLHO, "navi" e "NAVI" são o mesmo
    time no quadro do Major, e é o olho que precisa distinguir os dois. */
export function colideComCatalogo(nome,times){
  const chave=chaveDeNome(nome);
  return (times||[]).some(t=>chaveDeNome(t?.nome)===chave);
}

export const chaveDeNome=nome=>String(nome??"")
  .normalize("NFD").replace(/\p{Mn}/gu,"").toLowerCase().trim();
