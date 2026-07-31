/* O estado do draft conserva identidade porque handlers e animações mantêm
   referências ao mesmo objeto durante toda a sessão. */
export function createDraftState(){
  return {
    jogadores:Array(5).fill(null),
    treinador:null,
    drawn:null,
    taken:new Set(),
    sel:null,
    spinning:false,
    justPlaced:null,
  };
}

export function resetDraftState(state){
  Object.assign(state,{
    jogadores:Array(5).fill(null),
    treinador:null,
    drawn:null,
    sel:null,
    spinning:false,
  });
  state.taken.clear();
  return state;
}
