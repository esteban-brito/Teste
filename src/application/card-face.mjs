/* Uma única transição de face mantém CSS, ponteiro e árvore de acessibilidade
   sincronizados. Alternar apenas a classe `.flipped` deixava as duas faces
   expostas a leitores de tela e a face invisível ainda interceptava eventos. */
export function setCardFlipped(card,showBack){
  if(!card)return false;
  const flipped=!!showBack;
  card.classList.toggle("flipped",flipped);
  card.dataset.face=flipped?"back":"front";
  const front=card.querySelector(".cfront"),back=card.querySelector(".cback");
  if(front)front.setAttribute("aria-hidden",String(flipped));
  if(back)back.setAttribute("aria-hidden",String(!flipped));
  return flipped;
}
