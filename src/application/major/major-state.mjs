/* O Major nasce sem shape montado. `undefined` antes da primeira campanha e
   `null` depois do reset são estados observáveis distintos no jogo atual. */
export function createMajorState(){
  return {};
}

export function resetMajorState(state){
  Object.assign(state,{
    times:null,
    rodada:0,
    classificados:[],
    eliminados:[],
    playoffs:null,
    campanha:null,
  });
  return state;
}
