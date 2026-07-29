/* Identidade de combate do jogador — fonte ÚNICA: o playstyle.
   Substitui o antigo sub-arquétipo, que era derivado do próprio playstyle e por isso
   podia contradizê-lo (um Âncora rotulado "Pop-flasher"). Aqui vivem apenas as
   derivações puras que a simulação consome: ritmo (agressão) e afinidade de lado.

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-style-identity-parity.js. */

/** Traços por estilo. `pace` é ritmo (agressão), `ct`/`t` são afinidade de lado. */
export const STYLE_TRAITS={
  aggressive:{pace:1,space:.7,trade:.2,structure:-.1,ct:-.2,t:.8},
  spacetaker:{pace:.8,space:1,trade:0,structure:-.2,ct:-.2,t:1},
  trader:{pace:.2,space:.1,trade:1,structure:.4,ct:.2,t:.5},
  playmaker:{pace:.4,space:.8,trade:.1,structure:-.1,ct:.1,t:.6},
  infiltrator:{pace:-.2,space:.8,trade:-.2,structure:.1,ct:.3,t:.3},
  baiter:{pace:-.5,space:-.4,trade:.4,structure:-.2,ct:.2,t:-.3},
  clutcher:{pace:-.1,space:.1,trade:0,structure:.2,ct:.5,t:.1},
  support:{pace:.1,space:.2,trade:.6,structure:1,ct:.5,t:.5},
  cerebral:{pace:-.1,space:.4,trade:.2,structure:.9,ct:.4,t:.3},
  anchor:{pace:-.6,space:-.2,trade:.2,structure:.8,ct:1,t:-.3}
};

/** Rótulos aceitos além do id, para normalizar entradas legadas. */
const STYLE_ALIASES={
  Opener:"aggressive",Spacetaker:"spacetaker",Trader:"trader",Playmaker:"playmaker",
  Infiltrador:"infiltrator",Baiter:"baiter",Closer:"clutcher",Facilitador:"support",
  Cerebral:"cerebral",Ancora:"anchor"
};

/** Coringa é polivalente: não inclina agressão nem lado. Estilo desconhecido cai no mesmo neutro. */
export const NEUTRAL_TRAITS={pace:0,space:0,trade:0,structure:0,ct:0,t:0};

/** Escalas medidas sobre os 85 jogadores para preservar o desvio-padrão do efeito anterior. */
export const STYLE_AGGRESSION_SCALE=1.4;
export const STYLE_SIDE_SCALE={ct:5.9,t:5.2};

const CLARITY_FLOOR=.35;
const CLARITY_GAIN=5;

export function styleId(value){
  if(value==="Coringa"||value==="joker")return "joker";
  if(value in STYLE_TRAITS)return value;
  return STYLE_ALIASES[value]||value;
}

export function styleTraits(value){
  const id=styleId(value);
  return id==="joker"?NEUTRAL_TRAITS:(STYLE_TRAITS[id]||NEUTRAL_TRAITS);
}

/** Quão definido é o estilo (0.35–1). Sem margem registrada, assume identidade plena. */
export function styleClarity(player){
  const margin=player&&player.style&&player.style.matchMargin;
  if(margin==null)return 1;
  const scaled=margin*CLARITY_GAIN;
  return scaled<CLARITY_FLOOR?CLARITY_FLOOR:scaled>1?1:scaled;
}

/** Ritmo de combate: direção do estilo × quão definido ele é. */
export function styleAggression(player,scale=STYLE_AGGRESSION_SCALE){
  const source=player?._eng||player||{};
  return styleTraits(source.playstyle).pace*styleClarity(source)*scale;
}

/** Contribuição do estilo para a afinidade de lado, em pontos de força [CT, T]. */
export function styleSideVector(player,scale=STYLE_SIDE_SCALE){
  const source=player?._eng||player||{};
  const traits=styleTraits(source.playstyle);
  return [traits.ct*scale.ct,traits.t*scale.t];
}
